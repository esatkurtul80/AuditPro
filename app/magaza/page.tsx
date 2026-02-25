"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { GridFadeIn, GridItem } from "@/components/stagger-animation";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, UserProfile } from "@/lib/types";
// import {
//     Card,
//     CardContent,
//     CardDescription,
//     CardHeader,
//     CardTitle,
// } from "@/components/ui/card";
// Removed Card usage
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, AlertTriangle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NotificationFeed } from "@/components/announcements/notification-feed";

// Helper function to calculate days
const calculateDays = (fromDate: Date, toDate: Date): number => {
    let count = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
        count++;
        current.setDate(current.getDate() + 1);
    }

    return count;
};

// Helper function to get return deadline info
const getReturnDeadline = (completedAt: any) => {
    if (!completedAt) return null;

    const completedDate = completedAt.toDate();
    const now = new Date();

    // Calculate deadline: 3 days from completion
    let daysAdded = 0;
    const deadline = new Date(completedDate);

    while (daysAdded < 3) {
        deadline.setDate(deadline.getDate() + 1);
        daysAdded++;
    }

    // Calculate days remaining
    // Start from tomorrow to avoid inconsistencies based on time of day
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const daysRemaining = calculateDays(tomorrow, deadlineDate);

    if (now > deadline) {
        // Overdue
        const daysOverdue = calculateDays(deadline, now);
        return {
            deadline,
            daysRemaining: -daysOverdue,
            status: 'overdue' as const,
        };
    } else if (daysRemaining === 0) {
        return {
            deadline,
            daysRemaining: 0,
            status: 'warning' as const,
        };
    } else {
        return {
            deadline,
            daysRemaining,
            status: 'ok' as const,
        };
    }
};

// Helper function to check if return has been submitted
const hasSubmittedReturn = (audit: Audit): boolean => {
    // Check if any answer has actionData with status other than pending_store
    return audit.sections.some(section =>
        section.answers.some(answer =>
            answer.actionData && answer.actionData.status !== "pending_store"
        )
    );
};

// Helper function to get audit status
const getAuditStatus = (audit: Audit): { text: string; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" } => {
    // Check if all actions resolved
    if (audit.allActionsResolved) {
        return { text: "Tamamlandı", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", badgeVariant: "outline" };
    }

    // Count actions by status
    let pendingApprovalCount = 0;
    let rejectedCount = 0;
    let hasActions = false;

    audit.sections.forEach(section => {
        section.answers.forEach(answer => {
            const isCheckboxActionNeeded = answer.questionType === "checkbox" && 
                                           answer.answer && 
                                           answer.answer !== "hicbiri" && 
                                           answer.answer !== "muaf" &&
                                           answer.earnedPoints < answer.maxPoints;
            
            const isActionNeeded = answer.answer === "hayir" || isCheckboxActionNeeded;

            if (isActionNeeded && answer.actionData) {
                hasActions = true;
                if (answer.actionData.status === "pending_admin") {
                    pendingApprovalCount++;
                } else if (answer.actionData.status === "rejected") {
                    rejectedCount++;
                }
            }
        });
    });

    if (rejectedCount > 0) {
        return {
            text: `${rejectedCount} Red`,
            color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
            badgeVariant: "destructive"
        };
    }

    if (pendingApprovalCount > 0) {
        return { text: "Onay Bekliyor", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", badgeVariant: "secondary" };
    }

    return { text: "Aksiyon Bekleniyor", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", badgeVariant: "default" };
};

export default function MagazaPage() {
    const { userProfile } = useAuth();
    const [auditsWithActions, setAuditsWithActions] = useState<Audit[]>([]);
    const [auditorProfiles, setAuditorProfiles] = useState<Map<string, UserProfile>>(new Map());
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.storeId) {
            loadAudits();
        }
    }, [userProfile]);

    const loadAudits = async () => {
        if (!userProfile?.storeId) return;

        try {
            const auditsQuery = query(
                collection(db, "audits"),
                where("storeId", "==", userProfile.storeId),
                where("status", "==", "tamamlandi")
            );

            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as Audit))
                .filter((audit) => {
                    if (!audit.completedAt) return false; // Add this
                    // "hayır" cevabı olan veya checkbox sorusunda tam puan alamayan (ama cevaplanmış ve muaf olmayan) denetimleri al
                    return audit.sections.some((section) => {
                        return section.answers.some((answer) => {
                            const isCheckboxActionNeeded = answer.questionType === "checkbox" && 
                                                           answer.answer && 
                                                           answer.answer !== "hicbiri" && 
                                                           answer.answer !== "muaf" &&
                                                           answer.earnedPoints < answer.maxPoints;
                            
                            return answer.answer === "hayir" || isCheckboxActionNeeded;
                        });
                    });
                })
                .sort((a, b) => {
                    const deadlineA = getReturnDeadline(a.completedAt);
                    const deadlineB = getReturnDeadline(b.completedAt);

                    if (!deadlineA || !deadlineB) return 0;

                    const priorityMap = { overdue: 3, warning: 2, ok: 1 };
                    const priorityA = priorityMap[deadlineA.status];
                    const priorityB = priorityMap[deadlineB.status];

                    if (priorityA !== priorityB) {
                        return priorityB - priorityA;
                    }

                    if (deadlineA.status === 'overdue') {
                        return deadlineA.daysRemaining - deadlineB.daysRemaining;
                    } else {
                        return deadlineB.daysRemaining - deadlineA.daysRemaining;
                    }
                });

            setAuditsWithActions(auditsData);

            const uniqueAuditorIds = [...new Set(auditsData.map(audit => audit.auditorId))];
            const profilesMap = new Map<string, UserProfile>();

            for (const auditorId of uniqueAuditorIds) {
                try {
                    const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", auditorId)));
                    if (!userDoc.empty) {
                        const profile = userDoc.docs[0].data() as UserProfile;
                        profilesMap.set(auditorId, profile);
                    }
                } catch (err) {
                    console.error(`❌ Error fetching auditor ${auditorId}:`, err);
                }
            }

            setAuditorProfiles(profilesMap);
        } catch (error) {
            console.error("Error loading audits:", error);
            toast.error("Denetimler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        return timestamp.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const activeAudits = auditsWithActions.filter(audit => !audit.allActionsResolved);
    const completedAudits = auditsWithActions.filter(audit => audit.allActionsResolved);

    const urgentAudits = activeAudits.filter(audit => {
        const deadlineInfo = getReturnDeadline(audit.completedAt);
        const isUrgent = deadlineInfo && (deadlineInfo.status === 'warning' || deadlineInfo.status === 'overdue');
        const notSubmitted = !hasSubmittedReturn(audit);
        return isUrgent && notSubmitted;
    });

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["magaza"]}>
                <DashboardLayout>
                    <div className="flex min-h-screen items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["magaza"]}>
            <DashboardLayout>
                <div className="container mx-auto py-4 px-2 md:py-8 md:px-6 max-w-[1600px]">
                    <div className="mb-4 md:mb-8">
                        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">Denetim Dönüşleri</h1>
                        <p className="text-muted-foreground mt-2 font-medium">
                            Mağazanız için aksiyon gerektiren denetimler
                        </p>
                    </div>

                    <div className="mb-8">
                        <NotificationFeed />
                    </div>

                    {urgentAudits.length > 0 && (
                        <div className="mb-8 rounded-xl border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/10 p-4 shadow-sm">
                           <div className="flex items-start gap-4">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-red-900 dark:text-red-300">Acil Dönüş Gerekiyor!</h3>
                                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                                        {urgentAudits.length} adet denetim için son gün veya geç dönüş durumunda. Lütfen acilen inceleyiniz.
                                    </p>
                                </div>
                           </div>
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 p-1 h-auto bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <TabsTrigger 
                                value="active" 
                                className="rounded-lg py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm"
                            >
                                Aktif Aksiyonlarım
                                {activeAudits.length > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-bold">
                                        {activeAudits.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger 
                                value="completed"
                                className="rounded-lg py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm"
                            >
                                Geçmiş Aksiyonlarım
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                            {activeAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed">
                                    <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                        <AlertCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Aktif aksiyon yok</h3>
                                    <p className="text-muted-foreground mt-2 max-w-sm">
                                        Şu anda aksiyon gerektiren herhangi bir denetim bulunmuyor. Harika gidiyorsunuz!
                                    </p>
                                </div>
                            ) : (
                                <GridFadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {activeAudits.map((audit) => {
                                        const deadlineInfo = getReturnDeadline(audit.completedAt);
                                        const statusInfo = getAuditStatus(audit);
                                        const profile = auditorProfiles.get(audit.auditorId);
                                        
                                        const percentage = (audit.totalScore / audit.maxScore) * 100;
                                        
                                        // Colors based on score
                                        let scoreClass = "";
                                        if (percentage < 70) scoreClass = "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
                                        else if (percentage < 85) scoreClass = "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20";
                                        else if (percentage < 93) scoreClass = "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
                                        else scoreClass = "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";

                                        // Auditor name logic
                                        const firstName = profile?.firstName || "";
                                        const lastName = profile?.lastName || "";
                                        const auditorName = (firstName.length > 1 && lastName.length > 1) 
                                            ? `${firstName} ${lastName}`
                                            : (profile?.displayName || audit.auditorName || "Denetmen");

                                        // Initials for avatar
                                        const initials = auditorName
                                            .split(" ")
                                            .map((n: string) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2);

                                        // Calculate counts
                                        let pendingActionCount = 0;
                                        audit.sections.forEach(s => {
                                            s.answers.forEach(a => {
                                                const isActionNeeded = a.earnedPoints < a.maxPoints && a.answer !== "muaf";
                                                
                                                if (isActionNeeded) {
                                                    const status = a.actionData?.status;
                                                    if (!status || status === "pending_store" || status === "rejected") {
                                                        pendingActionCount++;
                                                    }
                                                }
                                            });
                                        });

                                        return (
                                            <GridItem key={audit.id}>
                                                <div className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 transition-all duration-300 flex flex-col h-full">
                                                    {/* Header */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">{auditorName}</h4>
                                                                <span className="text-xs text-muted-foreground font-medium">{formatDate(audit.completedAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-2.5 py-1 rounded-md border text-xs font-bold leading-none ${scoreClass}`}>
                                                            {percentage.toFixed(0)} Puan
                                                        </div>
                                                    </div>

                                                    {/* Body */}
                                                    <div className="flex-1 space-y-3 mb-5">
                                                        {deadlineInfo && (
                                                            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${
                                                                deadlineInfo.status === 'overdue' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                                deadlineInfo.status === 'warning' ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' :
                                                                'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                            }`}>
                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                <span>
                                                                    {deadlineInfo.status === 'overdue' ? `${Math.abs(deadlineInfo.daysRemaining)} Gün Gecikti` :
                                                                     deadlineInfo.status === 'warning' ? 'Son Gün' :
                                                                     `${deadlineInfo.daysRemaining} Gün Kaldı`}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-0.5">Yapılacak</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                                    {pendingActionCount > 0 ? `${pendingActionCount} Madde` : "0 Madde"}
                                                                </span>
                                                            </div>
                                                            <div className={`p-2 rounded-lg border ${statusInfo.color.replace('bg-', 'bg-opacity-20 ')}`}>
                                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-0.5">Durum</span>
                                                                <span className="text-xs font-bold truncate block" title={statusInfo.text}>
                                                                    {statusInfo.text}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="flex gap-2 mt-auto">
                                                        {((audit.actionStats?.pending_store || 0) > 0 || (audit.actionStats?.rejected || 0) > 0) ? (
                                                            <Link href={`/audits/${audit.id}/actions`} className="w-full">
                                                                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-6 font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                                                    <div className="flex items-center gap-2">
                                                                        <span>Dönüş Yap</span>
                                                                        <div className="bg-white/20 rounded-full p-1">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                                                        </div>
                                                                    </div>
                                                                </Button>
                                                            </Link>
                                                        ) : (
                                                            <Link href={(audit.actionStats?.pending_admin || 0) > 0 ? `/audits/${audit.id}/actions` : `/audits/${audit.id}`} className="w-full">
                                                                <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl py-5 font-semibold transition-all">
                                                                    <div className="flex items-center gap-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                        <span>
                                                                            {(audit.actionStats?.pending_admin || 0) > 0 ? "Aksiyon Gör" : "İncele"}
                                                                        </span>
                                                                    </div>
                                                                </Button>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </GridItem>
                                        );
                                    })}
                                </GridFadeIn>
                            )}
                        </TabsContent>

                        <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
                            {completedAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed">
                                    <div className="h-20 w-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <BarChart3 className="h-10 w-10 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Geçmiş aksiyon yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Tamamlanmış aksiyonlarınız burada listelenecektir.
                                    </p>
                                </div>
                            ) : (
                                <GridFadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {completedAudits.map((audit) => {
                                        const profile = auditorProfiles.get(audit.auditorId);
                                        const percentage = (audit.totalScore / audit.maxScore) * 100;
                                        
                                        // Colors
                                        let scoreClass = "";
                                        if (percentage < 70) scoreClass = "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
                                        else if (percentage < 85) scoreClass = "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20";
                                        else if (percentage < 93) scoreClass = "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
                                        else scoreClass = "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";

                                        // Name logic
                                        const firstName = profile?.firstName || "";
                                        const lastName = profile?.lastName || "";
                                        const auditorName = (firstName.length > 1 && lastName.length > 1) 
                                            ? `${firstName} ${lastName}`
                                            : (profile?.displayName || audit.auditorName || "Denetmen");
                                            
                                        const initials = auditorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

                                        let doneCount = 0;
                                        audit.sections.forEach(s => {
                                            s.answers.forEach(a => {
                                                const isCheckboxActionNeeded = a.questionType === "checkbox" && 
                                                                               a.answer && 
                                                                               a.answer !== "hicbiri" && 
                                                                               a.answer !== "muaf" &&
                                                                               a.earnedPoints < a.maxPoints;
                                                
                                                if (a.answer === "hayir" || isCheckboxActionNeeded) doneCount++;
                                            });
                                        });

                                        return (
                                            <GridItem key={audit.id}>
                                               <div className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 transition-all duration-300 flex flex-col h-full opacity-75 hover:opacity-100 grayscale hover:grayscale-0">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-slate-500">
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{auditorName}</h4>
                                                                <span className="text-xs text-muted-foreground">{formatDate(audit.completedAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-2.5 py-1 rounded-md border text-xs font-bold leading-none ${scoreClass}`}>
                                                            {percentage.toFixed(0)} Puan
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 space-y-3 mb-5">
                                                        <div className="flex items-center justify-center p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                                                            <div className="text-center">
                                                                <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider block mb-0.5">Tamamlanan</span>
                                                                <span className="text-emerald-800 dark:text-emerald-300 font-bold text-sm">{doneCount} Aksiyon</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Link href={`/audits/${audit.id}/summary`} className="w-full mt-auto">
                                                        <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl py-5 font-semibold">
                                                            İncele
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </GridItem>
                                        );
                                    })}
                                </GridFadeIn>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
