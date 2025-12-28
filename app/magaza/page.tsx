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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Helper function to calculate days excluding Sundays
const calculateDaysExcludingSundays = (fromDate: Date, toDate: Date): number => {
    let count = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
        // 0 = Sunday, skip it
        if (current.getDay() !== 0) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

// Helper function to get return deadline info
const getReturnDeadline = (completedAt: any) => {
    if (!completedAt) return null;

    const completedDate = completedAt.toDate();
    const now = new Date();

    // Calculate deadline: 3 days from completion (excluding Sundays)
    let daysAdded = 0;
    const deadline = new Date(completedDate);

    while (daysAdded < 3) {
        deadline.setDate(deadline.getDate() + 1);
        // Skip Sundays
        if (deadline.getDay() !== 0) {
            daysAdded++;
        }
    }

    // Calculate days remaining (excluding Sundays)
    // Start from tomorrow to avoid inconsistencies based on time of day
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const daysRemaining = calculateDaysExcludingSundays(tomorrow, deadlineDate);

    if (now > deadline) {
        // Overdue
        const daysOverdue = calculateDaysExcludingSundays(deadline, now);
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
const getAuditStatus = (audit: Audit): { text: string; color: string } => {
    // Check if all actions resolved
    if (audit.allActionsResolved) {
        return { text: "Onaylandı", color: "bg-green-100 text-green-800 border-green-200" };
    }

    // Count actions by status
    let pendingApprovalCount = 0;
    let rejectedCount = 0;
    let hasActions = false;

    audit.sections.forEach(section => {
        section.answers.forEach(answer => {
            if (answer.answer === "hayir" && answer.actionData) {
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
            text: `${rejectedCount} soru iptal edildi tekrar dönülmesi gerekiyor`,
            color: "bg-red-100 text-red-800 border-red-200"
        };
    }

    if (pendingApprovalCount > 0) {
        return { text: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    }

    return { text: "Aksiyon Bekleniyor", color: "bg-blue-100 text-blue-800 border-blue-200" };
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
                    // Sadece "hayır" cevabı olan denetimleri al
                    return audit.sections.some((section) =>
                        section.answers.some((answer) => answer.answer === "hayir")
                    );
                })
                .sort((a, b) => {
                    // Sort by deadline priority: overdue > warning > ok
                    const deadlineA = getReturnDeadline(a.completedAt);
                    const deadlineB = getReturnDeadline(b.completedAt);

                    if (!deadlineA || !deadlineB) return 0;

                    // Priority order: overdue (3), warning (2), ok (1)
                    const priorityMap = { overdue: 3, warning: 2, ok: 1 };
                    const priorityA = priorityMap[deadlineA.status];
                    const priorityB = priorityMap[deadlineB.status];

                    // Sort descending by priority (most urgent first)
                    if (priorityA !== priorityB) {
                        return priorityB - priorityA;
                    }

                    // If same priority, sort by days remaining
                    if (deadlineA.status === 'overdue') {
                        return deadlineA.daysRemaining - deadlineB.daysRemaining; // More overdue first
                    } else {
                        return deadlineB.daysRemaining - deadlineA.daysRemaining; // Less time remaining first
                    }
                });

            setAuditsWithActions(auditsData);

            // Fetch auditor profiles to get firstName + lastName
            const uniqueAuditorIds = [...new Set(auditsData.map(audit => audit.auditorId))];
            const profilesMap = new Map<string, UserProfile>();



            for (const auditorId of uniqueAuditorIds) {
                try {
                    const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", auditorId)));
                    if (!userDoc.empty) {
                        const profile = userDoc.docs[0].data() as UserProfile;

                        profilesMap.set(auditorId, profile);
                    } else {

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
        return timestamp?.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    // Aktif ve geçmiş aksiyonları ayır
    const activeAudits = auditsWithActions.filter(audit => !audit.allActionsResolved);
    const completedAudits = auditsWithActions.filter(audit => audit.allActionsResolved);

    // Check for urgent audits (last day or overdue, without submitted return) - sadece aktif aksiyonlarda
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
                        <h1 className="text-2xl sm:text-4xl font-bold">Denetim Dönüşleri</h1>
                        <p className="text-muted-foreground mt-2">
                            Mağazanız için aksiyon gerektiren denetimler
                        </p>
                    </div>

                    {/* Urgent notification */}
                    {urgentAudits.length > 0 && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Acil Dönüş Gerekiyor!</AlertTitle>
                            <AlertDescription>
                                {urgentAudits.length} adet denetim için son gün veya geç dönüş durumunda. Lütfen acilen dönüş yapınız.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Denetim Aksiyonları</CardTitle>
                                <CardDescription>
                                    Aksiyonlarınızı takip edin ve yönetin
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="active" className="relative">
                                        Aktif Aksiyonlarım
                                        {activeAudits.length > 0 && (
                                            <span className="ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-blue-500 text-sm font-semibold text-white">
                                                {activeAudits.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="completed">
                                        Geçmiş Aksiyonlarım
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="active" className="mt-0">
                                    {activeAudits.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold">Aktif aksiyon yok</h3>
                                            <p className="text-muted-foreground mt-2">
                                                Harika! Şu anda aksiyon gerektiren denetim bulunmuyor.
                                            </p>
                                        </div>
                                    ) : (
                                        <GridFadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-0 py-4 sm:px-4">
                                            {activeAudits.map((audit) => {
                                                const deadlineInfo = getReturnDeadline(audit.completedAt);
                                                const statusInfo = getAuditStatus(audit);
                                                const profile = auditorProfiles.get(audit.auditorId);

                                                // Get auditor name - prefer full name, but check for single-letter errors
                                                let auditorName;
                                                if (profile?.firstName && profile?.lastName) {
                                                    // Check if firstName or lastName are single characters (likely database error)
                                                    if (profile.firstName.trim().length > 1 && profile.lastName.trim().length > 1) {
                                                        auditorName = `${profile.firstName} ${profile.lastName}`;
                                                    } else {
                                                        // Fall back to displayName if names are suspiciously short
                                                        auditorName = profile.displayName || audit.auditorName;
                                                    }
                                                } else {
                                                    auditorName = profile?.displayName || audit.auditorName;
                                                }

                                                const percentage = (audit.totalScore / audit.maxScore) * 100;
                                                let scoreBgColor = "";

                                                if (percentage < 70) {
                                                    scoreBgColor = "bg-red-100 text-red-800 border-red-200";
                                                } else if (percentage < 85) {
                                                    scoreBgColor = "bg-orange-100 text-orange-800 border-orange-200";
                                                } else if (percentage < 93) {
                                                    scoreBgColor = "bg-orange-50 text-orange-700 border-orange-200";
                                                } else {
                                                    scoreBgColor = "bg-green-100 text-green-800 border-green-200";
                                                }

                                                // Calculate action counts
                                                let pendingActionCount = 0;
                                                let pendingAdminCount = 0;
                                                audit.sections.forEach(s => s.answers.forEach(a => {
                                                    if (a.answer === "hayir") {
                                                        const status = a.actionData?.status;
                                                        // Count if no status (initial), pending_store (draft), or rejected (needs fix)
                                                        if (!status || status === "pending_store" || status === "rejected") {
                                                            pendingActionCount++;
                                                        } else if (status === "pending_admin") {
                                                            pendingAdminCount++;
                                                        }
                                                    }
                                                }));

                                                return (
                                                    <GridItem key={audit.id}>
                                                        <div className="border rounded-lg p-4 hover:shadow-md transition-shadow h-full">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold text-sm mb-1">{auditorName}</h4>
                                                                    <p className="text-xs text-muted-foreground">{formatDate(audit.completedAt)}</p>
                                                                </div>
                                                                <Badge variant="outline" className={`${scoreBgColor} text-base font-semibold px-3 py-1`}>
                                                                    {audit.totalScore}
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-2 mb-3">
                                                                {deadlineInfo && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-muted-foreground">Dönüş:</span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`text-xs ${deadlineInfo.status === 'overdue'
                                                                                ? "bg-red-100 text-red-800 border-red-200 animate-pulse"
                                                                                : deadlineInfo.status === 'warning'
                                                                                    ? "bg-orange-100 text-orange-800 border-orange-200"
                                                                                    : "bg-green-100 text-green-800 border-green-200"
                                                                                }`}
                                                                        >
                                                                            {deadlineInfo.status === 'overdue'
                                                                                ? `${Math.abs(deadlineInfo.daysRemaining)} gün geç`
                                                                                : deadlineInfo.status === 'warning'
                                                                                    ? "Son gün"
                                                                                    : `${deadlineInfo.daysRemaining} gün kaldı`
                                                                            }
                                                                        </Badge>
                                                                    </div>
                                                                )}

                                                                {/* Action Item Count for Active Audits */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Yapılacak:</span>
                                                                    {pendingActionCount > 0 ? (
                                                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                                            {pendingActionCount} Madde
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                                            Tümü Yapıldı
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-start gap-2">
                                                                    <span className="text-xs text-muted-foreground shrink-0">Durum:</span>
                                                                    <Badge variant="outline" className={`text-xs ${statusInfo.color} whitespace-normal h-auto text-left leading-tight py-1 break-words max-w-full flex-1`}>
                                                                        {statusInfo.text}
                                                                    </Badge>
                                                                </div>
                                                            </div>

                                                            <Link href={`/audits/${audit.id}/actions`} className="w-full">
                                                                <Button
                                                                    className={`w-full h-8 text-xs text-white shadow-lg ${pendingActionCount > 0
                                                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                                                        : "bg-gray-600 hover:bg-gray-700"
                                                                        }`}
                                                                >
                                                                    {pendingActionCount > 0 ? (
                                                                        "Dönüş Yap"
                                                                    ) : (
                                                                        <>
                                                                            <Eye className="mr-2 h-3 w-3" />
                                                                            Aksiyonu Gör
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </GridItem>
                                                );
                                            })}
                                        </GridFadeIn>
                                    )}
                                </TabsContent>

                                <TabsContent value="completed" className="mt-0">
                                    {completedAudits.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold">Geçmiş aksiyon yok</h3>
                                            <p className="text-muted-foreground mt-2">
                                                Henüz tamamlanmış aksiyonunuz bulunmuyor.
                                            </p>
                                        </div>
                                    ) : (
                                        <GridFadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-0 py-4 sm:px-4">
                                            {completedAudits.map((audit) => {
                                                const profile = auditorProfiles.get(audit.auditorId);

                                                // Get auditor name - same logic as active audits tab
                                                let auditorName;
                                                if (profile?.firstName && profile?.lastName) {
                                                    if (profile.firstName.trim().length > 1 && profile.lastName.trim().length > 1) {
                                                        auditorName = `${profile.firstName} ${profile.lastName}`;
                                                    } else {
                                                        auditorName = profile.displayName || audit.auditorName;
                                                    }
                                                } else {
                                                    auditorName = profile?.displayName || audit.auditorName;
                                                }

                                                const percentage = (audit.totalScore / audit.maxScore) * 100;
                                                let scoreBgColor = "";
                                                let totalActionCount = 0;
                                                audit.sections.forEach(s => s.answers.forEach(a => {
                                                    if (a.answer === "hayir") totalActionCount++;
                                                }));

                                                if (percentage < 70) {
                                                    scoreBgColor = "bg-red-100 text-red-800 border-red-200";
                                                } else if (percentage < 85) {
                                                    scoreBgColor = "bg-orange-100 text-orange-800 border-orange-200";
                                                } else if (percentage < 93) {
                                                    scoreBgColor = "bg-orange-50 text-orange-700 border-orange-200";
                                                } else {
                                                    scoreBgColor = "bg-green-100 text-green-800 border-green-200";
                                                }
                                                return (
                                                    <GridItem key={audit.id}>
                                                        <div className="border rounded-lg p-4 hover:shadow-md transition-shadow h-full">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold text-sm mb-1">{auditorName}</h4>
                                                                    <p className="text-xs text-muted-foreground">{formatDate(audit.completedAt)}</p>
                                                                </div>
                                                                <Badge variant="outline" className={`${scoreBgColor} text-base font-semibold px-3 py-1`}>
                                                                    {audit.totalScore}
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-2 mb-3">
                                                                {/* Total Action Count for Completed Audits */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">İşlem Yapılan:</span>
                                                                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-200">
                                                                        {totalActionCount} Madde
                                                                    </Badge>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">
                                                                        ✓ Tamamlandı
                                                                    </Badge>
                                                                </div>
                                                            </div>

                                                            <Link href={`/audits/${audit.id}/summary`} className="w-full">
                                                                <Button className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                                                                    Detay Gör
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
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
