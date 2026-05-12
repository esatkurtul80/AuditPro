"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { getReturnDeadline } from "@/lib/date-utils";
import { Audit, ActionStats } from "@/lib/types";

// --- Types ---


interface StoreDataCache {
    audits: Audit[];
    pendingActionsCount: number;
    rejectedActionsCount: number;
    overdueAuditsCount: number;
    lastFetched: number;
    storeId: string | null;
}

// --- Global Cache (Singleton) ---
let globalCache_v2: StoreDataCache | null = null;
let globalFetchPromise: Promise<any> | null = null; // Track in-flight request
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes cache duration

// Export function to allow external cache invalidation (e.g., after submitting actions)
export function invalidateStoreDataCache() {
    globalCache_v2 = null;
    globalFetchPromise = null;
}

export function useStoreData() {
    const { userProfile } = useAuth();
    const [data, setData] = useState<{
        audits: Audit[];
        pendingActionsCount: number;
        rejectedActionsCount: number;
        overdueAuditsCount: number;
        loading: boolean;
    }>({
        audits: globalCache_v2?.audits || [],
        pendingActionsCount: globalCache_v2?.pendingActionsCount || 0,
        rejectedActionsCount: globalCache_v2?.rejectedActionsCount || 0,
        overdueAuditsCount: globalCache_v2?.overdueAuditsCount || 0,
        loading: !globalCache_v2, // If cache exists, not loading initially
    });

    const fetchData = useCallback(async (force = false) => {
        if (!userProfile?.storeId) return;

        // Check Cache Validity
        const now = Date.now();
        if (
            !force &&
            globalCache_v2 &&
            globalCache_v2.storeId === userProfile.storeId &&
            now - globalCache_v2.lastFetched < CACHE_DURATION
        ) {
            // Cache is valid, no need to fetch
            setData(prev => ({ ...prev, loading: false }));
            return;
        }

        // If no cache, set loading true (only if we don't have partial data)
        // If fetch is already in progress, wait for it
        if (globalFetchPromise) {
            try {
                const result = await globalFetchPromise;
                // Update local state with the result from the shared promise
                setData({
                    audits: result.audits,
                    pendingActionsCount: result.pendingActionsCount,
                    rejectedActionsCount: result.rejectedActionsCount,
                    overdueAuditsCount: result.overdueAuditsCount,
                    loading: false
                });
                return;
            } catch (e) {
                // If shared promise failed, valid logic below will try again or fail locally
                console.error("Shared fetch failed", e);
            }
        }

        // Check Cache Validity AGAIN (in case the in-flight one finished just before we checked promise)
        if (
            !force &&
            globalCache_v2 &&
            globalCache_v2.storeId === userProfile.storeId &&
            Date.now() - globalCache_v2.lastFetched < CACHE_DURATION
        ) {
             setData(prev => ({ ...prev, loading: false }));
             return;
        }

        // If no cache, set loading true (only if we don't have partial data)
        if (!globalCache_v2) {
            setData(prev => ({ ...prev, loading: true }));
        }

        // Start new fetch
        globalFetchPromise = (async () => {
            try {
                const auditsQuery = query(
                    collection(db, "audits"),
                    where("storeId", "==", userProfile.storeId),
                    where("status", "==", "tamamlandi")
                );

                const auditsSnapshot = await getDocs(auditsQuery);

                const auditorPromises = auditsSnapshot.docs.map(async (doc) => {
                    const auditData = doc.data();

                    // 1. Auditor Name Logic
                    let auditorName = auditData.auditorName;
                    if (!auditorName || auditorName === "Bilinmiyor") {
                        const auditorId = auditData.auditorId || auditData.userId;
                        if (auditorId) {
                            auditorName = "Denetmen"; 
                        }
                    }
                    if (!auditorName) auditorName = "Bilinmiyor";

                    // 2. Action Stats Calculation
                    let totalActions = 0;
                    let approvedActions = 0;
                    let rejectedActions = 0;
                    let pendingStoreActions = 0;
                    let pendingAdminActions = 0;
                    let lastSubmittedAt: Date | undefined;

                    if (auditData.sections) {
                        auditData.sections.forEach((section: any) => {
                            // Check if section has any real answers
                            const hasAnyAnswer = section.answers?.some((a: any) => a.answer && a.answer.trim() !== "");
                            if (!hasAnyAnswer) return;

                            section.answers?.forEach((answer: any) => {
                                // 2026-02-11: Updated logic to match other files.
                                // Don't count empty answers or 'hicbiri' as actions.
                                const isActionNeeded = 
                                    answer.answer && 
                                    answer.answer.trim() !== "" && 
                                    answer.answer !== "muaf" && 
                                    (answer.earnedPoints || 0) < (answer.maxPoints || 0);
                                if (isActionNeeded) {
                                    totalActions++;
                                    const status = answer.actionData?.status;
                                    if (!status || status === "pending_store") {
                                        pendingStoreActions++;
                                    } else if (status === "pending_admin") {
                                        pendingAdminActions++;
                                    } else if (status === "rejected") {
                                        rejectedActions++;
                                    } else if (status === "approved") {
                                        approvedActions++;
                                    }

                                    // Track latest submission
                                    if (answer.actionData?.submittedAt) {
                                        const rawDate = answer.actionData.submittedAt;
                                        let submittedDate: Date | undefined;

                                        if (rawDate instanceof Date) {
                                            submittedDate = rawDate;
                                        } else if (typeof rawDate.toDate === 'function') {
                                            submittedDate = rawDate.toDate();
                                        } else if (rawDate.seconds) {
                                            submittedDate = new Date(rawDate.seconds * 1000);
                                        }

                                        if (submittedDate && (!lastSubmittedAt || submittedDate > lastSubmittedAt)) {
                                            lastSubmittedAt = submittedDate;
                                        }
                                    }
                                }
                            });
                        });
                    }

                    const hasActions = totalActions > 0;

                    const actionStats: ActionStats = {
                        total: totalActions,
                        approved: approvedActions,
                        rejected: rejectedActions,
                        pending_store: pendingStoreActions,
                        pending_admin: pendingAdminActions
                    };

                    // 3. Score Calculation
                    // Use the stored totalScore from Firestore as source of truth.
                    // Only apply the 99-cap for scores strictly between 99 and 100 (e.g., 99.3 → 99).
                    let finalScore = auditData.totalScore ?? auditData.score ?? 0;

                    // If totalScore is not stored, recalculate from sections using Algorithm B (section-average)
                    if (!auditData.totalScore && auditData.sections) {
                        const sectionScores: number[] = [];
                        auditData.sections.forEach((section: any) => {
                            let e = 0, m = 0;
                            section.answers?.forEach((a: any) => {
                                if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
                                    e += (a.earnedPoints || 0);
                                    m += (a.maxPoints || 0);
                                }
                            });
                            if (m > 0) sectionScores.push((e / m) * 100);
                        });
                        const rawPercentage = sectionScores.length > 0
                            ? sectionScores.reduce((s, v) => s + v, 0) / sectionScores.length
                            : 0;
                        finalScore = Math.round(rawPercentage);
                    }

                    // Apply 99-cap: only values strictly between 99 and 100 get capped to 99.
                    // Exact 99 and exact 100 are left untouched.
                    if (finalScore > 99 && finalScore < 100) {
                        finalScore = 99;
                    }

                    if (finalScore > 100) finalScore = 100;

                    return {
                        id: doc.id,
                        auditTypeId: auditData.auditTypeId || "",
                        auditTypeName: auditData.formName || auditData.auditType || "Mağaza Denetimi",
                        storeId: userProfile?.storeId || "",
                        storeName: auditData.storeName || userProfile?.storeName || "Mağazam",
                        auditorId: auditData.auditorId || "",
                        auditorName: auditorName,
                        status: auditData.status || "tamamlandi",
                        sections: auditData.sections,
                        totalScore: 100,
                        maxScore: auditData.maxScore || 100,
                        score: finalScore,
                        startedAt: auditData.startedAt || auditData.createdAt || Timestamp.now(),
                        createdAt: auditData.createdAt || Timestamp.now(),
                        updatedAt: auditData.updatedAt || Timestamp.now(),
                        completedAt: auditData.completedAt || Timestamp.now(), // Keep as Timestamp to match interface
                        hasActions,
                        actionStats,
                        lastSubmittedAt,
                        location: auditData.location || null,
                        actionDeadline: auditData.actionDeadline || null,
                        allActionsResolved: auditData.allActionsResolved || false
                    } as Audit;
                });

                const resolvedAudits = await Promise.all(auditorPromises);
                resolvedAudits.sort((a, b) => {
                    const timeA = a.completedAt?.toMillis() || 0;
                    const timeB = b.completedAt?.toMillis() || 0;
                    return timeB - timeA;
                });

                // Global stats
                let totalPending = 0;
                let totalRejected = 0;
                let totalOverdue = 0;

                resolvedAudits.forEach(a => {
                    if (a.actionStats) {
                        totalPending += a.actionStats.pending_store;
                        totalRejected += a.actionStats.rejected;
                        if (a.actionStats.pending_store > 0 || a.actionStats.rejected > 0) {
                            const deadlineInfo = getReturnDeadline(a.completedAt);
                            if (deadlineInfo?.status === 'overdue') {
                                totalOverdue++;
                            }
                        }
                    }
                });

                // Update Cache
                globalCache_v2 = {
                    audits: resolvedAudits,
                    pendingActionsCount: totalPending,
                    rejectedActionsCount: totalRejected,
                    overdueAuditsCount: totalOverdue,
                    lastFetched: Date.now(),
                    storeId: userProfile!.storeId!
                };

                return globalCache_v2;
            } finally {
                globalFetchPromise = null;
            }
        })();

        try {
            const result = await globalFetchPromise;
            setData({
                audits: result.audits,
                pendingActionsCount: result.pendingActionsCount,
                rejectedActionsCount: result.rejectedActionsCount,
                overdueAuditsCount: result.overdueAuditsCount,
                loading: false
            });
        } catch (error) {
             console.error("Error in fetch promise:", error);
             setData(prev => ({ ...prev, loading: false }));
        }

    }, [userProfile?.storeId]);

    // Initial fetch trigger
    useEffect(() => {
        if (userProfile?.storeId) {
            fetchData();
        }
    }, [userProfile, fetchData]);

    return { ...data, refresh: () => fetchData(true) };
}
