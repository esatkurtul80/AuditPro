"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ActionStats } from "@/components/audit-card";
import { getReturnDeadline } from "@/lib/date-utils";

// --- Types ---

export interface Audit {
    id: string;
    storeName: string;
    auditorName: string;
    auditType: string;
    completedAt: any;
    score: number;
    totalScore: number;
    hasActions: boolean;
    actionStats: ActionStats;
    lastSubmittedAt?: Date;
}

interface StoreDataCache {
    audits: Audit[];
    pendingActionsCount: number;
    rejectedActionsCount: number;
    overdueAuditsCount: number;
    lastFetched: number;
    storeId: string | null;
}

// --- Global Cache (Singleton) ---
// This acts as a simple in-memory cache that persists as long as the app (tab) is open
let globalCache: StoreDataCache | null = null;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes cache duration

export function useStoreData() {
    const { userProfile } = useAuth();
    const [data, setData] = useState<{
        audits: Audit[];
        pendingActionsCount: number;
        rejectedActionsCount: number;
        overdueAuditsCount: number;
        loading: boolean;
    }>({
        audits: globalCache?.audits || [],
        pendingActionsCount: globalCache?.pendingActionsCount || 0,
        rejectedActionsCount: globalCache?.rejectedActionsCount || 0,
        overdueAuditsCount: globalCache?.overdueAuditsCount || 0,
        loading: !globalCache, // If cache exists, not loading initially
    });

    const fetchData = useCallback(async (force = false) => {
        if (!userProfile?.storeId) return;

        // Check Cache Validity
        const now = Date.now();
        if (
            !force &&
            globalCache &&
            globalCache.storeId === userProfile.storeId &&
            now - globalCache.lastFetched < CACHE_DURATION
        ) {
            // Cache is valid, no need to fetch
            setData(prev => ({ ...prev, loading: false }));
            return;
        }

        // If no cache, set loading true (only if we don't have partial data)
        // If we have stale data, we keep showing it while fetching (optimistic UI)
        if (!globalCache) {
            setData(prev => ({ ...prev, loading: true }));
        }

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
                         // We skip fetching specific user data to speed up list
                         // Or we can cache this too, but for now focus on list speed
                        auditorName = "Denetmen"; 
                        // Note: For absolute speed we might skip the secondary fetch or 
                        // trust the denormalized name if available.
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
                        section.answers?.forEach((answer: any) => {
                            const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < (answer.maxPoints || 0));
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
                let finalScore = 0;
                if (auditData.sections) {
                    let totalSectionPercentage = 0;
                    let sectionCount = 0;

                    auditData.sections.forEach((section: any) => {
                        let sectionEarned = 0;
                        let sectionMax = 0;
                        let hasValidQuestions = false;

                        section.answers?.forEach((a: any) => {
                            if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
                                sectionEarned += (a.earnedPoints || 0);
                                sectionMax += (a.maxPoints || 0);
                                hasValidQuestions = true;
                            }
                        });

                        if (hasValidQuestions && sectionMax > 0) {
                            const sectionScore = (sectionEarned / sectionMax) * 100;
                            totalSectionPercentage += sectionScore;
                            sectionCount++;
                        }
                    });

                    const averageScore = sectionCount > 0 ? totalSectionPercentage / sectionCount : 0;
                    const decimalPart = averageScore % 1;
                    finalScore = decimalPart >= 0.50 ? Math.ceil(averageScore) : Math.floor(averageScore);
                } else {
                    finalScore = auditData.totalScore || 0;
                }

                if (finalScore > 100) finalScore = 100;

                return {
                    id: doc.id,
                    storeName: auditData.storeName || userProfile?.storeName || "Mağazam",
                    auditorName: auditorName,
                    auditType: auditData.formName || auditData.auditType || "Mağaza Denetimi",
                    completedAt: auditData.completedAt?.toDate() || new Date(),
                    score: finalScore,
                    totalScore: 100,
                    hasActions,
                    actionStats,
                    lastSubmittedAt
                };
            });

            const resolvedAudits = await Promise.all(auditorPromises);
            resolvedAudits.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

            // Global stats
            let totalPending = 0;
            let totalRejected = 0;
            let totalOverdue = 0;

            resolvedAudits.forEach(a => {
                totalPending += a.actionStats.pending_store;
                totalRejected += a.actionStats.rejected;
                if (a.actionStats.pending_store > 0 || a.actionStats.rejected > 0) {
                    const deadlineInfo = getReturnDeadline(a.completedAt);
                    if (deadlineInfo?.status === 'overdue') {
                        totalOverdue++;
                    }
                }
            });

            // Update Cache
            globalCache = {
                audits: resolvedAudits,
                pendingActionsCount: totalPending,
                rejectedActionsCount: totalRejected,
                overdueAuditsCount: totalOverdue,
                lastFetched: Date.now(),
                storeId: userProfile!.storeId!
            };

            // Update State
            setData({
                audits: resolvedAudits,
                pendingActionsCount: totalPending,
                rejectedActionsCount: totalRejected,
                overdueAuditsCount: totalOverdue,
                loading: false
            });

        } catch (error) {
            console.error("Error fetching store data:", error);
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
