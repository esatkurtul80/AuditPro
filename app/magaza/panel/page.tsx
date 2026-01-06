"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { AuditCard, ActionStats } from "@/components/audit-card";
import { ActionAlert } from "@/components/action-alert";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Store as StoreIcon, Sparkles, AlertCircle } from "lucide-react";
import { getReturnDeadline } from "@/lib/date-utils";

interface Audit {
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

export default function StorePanelPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [audits, setAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingActionsCount, setPendingActionsCount] = useState(0);
    const [rejectedActionsCount, setRejectedActionsCount] = useState(0);
    const [overdueAuditsCount, setOverdueAuditsCount] = useState(0);

    useEffect(() => {
        if (authLoading) return;

        if (user && userProfile?.storeId) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, userProfile, authLoading]);

    const fetchData = async () => {
        if (!userProfile?.storeId) return;

        setLoading(true);
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
                        try {
                            const auditorSnap = await getDocs(
                                query(collection(db, "users"), where("uid", "==", auditorId))
                            );
                            if (!auditorSnap.empty) {
                                const auditorData = auditorSnap.docs[0].data();
                                if (auditorData.firstName && auditorData.lastName) {
                                    auditorName = `${auditorData.firstName} ${auditorData.lastName}`;
                                } else {
                                    auditorName = auditorData.displayName || "Bilinmiyor";
                                }
                            }
                        } catch (error) {
                            console.error("Error fetching auditor:", error);
                        }
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
                    auditorName: auditorName || "Denetmen",
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
            // Client-side sort: Newest first
            resolvedAudits.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
            setAudits(resolvedAudits);

            // Global stats
            let totalPending = 0;
            let totalRejected = 0;
            let totalOverdue = 0;

            resolvedAudits.forEach(a => {
                totalPending += a.actionStats.pending_store;
                totalRejected += a.actionStats.rejected;

                // Check for overdue audit
                // Audit is overdue if it has pending actions (pending_store or rejected) AND deadline is passed
                if (a.actionStats.pending_store > 0 || a.actionStats.rejected > 0) {
                    const deadlineInfo = getReturnDeadline(a.completedAt);
                    if (deadlineInfo?.status === 'overdue') {
                        totalOverdue++;
                    }
                }
            });

            setPendingActionsCount(totalPending);
            setRejectedActionsCount(totalRejected);
            setOverdueAuditsCount(totalOverdue);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAuditClick = (auditId: string) => {
        router.push(`/audits/${auditId}/summary`);
    };

    return (
        <ProtectedRoute allowedRoles={["magaza"]}>
            <DashboardLayout>
                <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="container max-w-7xl mx-auto py-4 px-4 md:px-6 space-y-5">

                        {/* Hero / Welcome Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="space-y-1">
                                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                                    <StoreIcon className="h-8 w-8 text-primary" />
                                    {userProfile?.storeName || "Mağaza Paneli"}
                                </h1>
                                <p className="text-base md:text-lg text-slate-500 dark:text-slate-400">
                                    Denetim performansınızı ve aksiyon durumlarınızı buradan takip edebilirsiniz.
                                </p>
                            </div>
                        </div>

                        {/* Missing Store Name Warning */}
                        {!loading && !userProfile?.storeId && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">
                                            Mağaza Tanımlaması Eksik
                                        </h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <p>
                                                Kullanıcı profilinizde atanmış bir mağaza bulunamadı. Lütfen yöneticinizle iletişime geçerek hesabınıza doğru mağazanın tanımlanmasını isteyin.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notifications Area */}
                        {!loading && (rejectedActionsCount > 0 || pendingActionsCount > 0 || overdueAuditsCount > 0) && (
                            <div className="space-y-4 max-w-4xl animate-in slide-in-from-top-4 fade-in duration-500">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                                    Önemli Bildirimler
                                </h2>
                                <div className="grid gap-3">
                                    {/* Overdue Alert */}
                                    {overdueAuditsCount > 0 && (
                                        <ActionAlert
                                            type="overdue"
                                            count={overdueAuditsCount}
                                            link="/magaza"
                                            hideViewButton={true}
                                        />
                                    )}

                                    {/* Rejected Alert */}
                                    {rejectedActionsCount > 0 && (
                                        <ActionAlert
                                            type="rejected"
                                            count={rejectedActionsCount}
                                            link="/magaza"
                                            hideViewButton={true}
                                        />
                                    )}

                                    {/* Pending alert removed by user request (Task #51) */}
                                </div>
                            </div>
                        )}

                        {/* Main Content: Audits Grid */}
                        <div className="space-y-5">
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-[280px] w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : audits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <Sparkles className="h-10 w-10 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                        Henüz Hiç Denetim Yok
                                    </h3>
                                    <p className="max-w-md text-slate-500 dark:text-slate-400 mb-6">
                                        Mağazanız için tamamlanmış bir denetim raporu sistemde bulunamadı. Denetimler tamamlandığında burada listelenecektir.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-700">
                                    {audits.map((audit) => (
                                        <AuditCard
                                            key={audit.id}
                                            auditId={audit.id}
                                            storeName={audit.storeName}
                                            auditorName={audit.auditorName}
                                            auditType={audit.auditType}
                                            completedAt={audit.completedAt}
                                            score={audit.score}
                                            totalScore={audit.totalScore}
                                            hasActions={audit.hasActions}
                                            actionStats={audit.actionStats}
                                            lastSubmittedAt={audit.lastSubmittedAt}
                                            onClick={() => handleAuditClick(audit.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
