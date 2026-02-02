"use client";

import { useAuth } from "@/components/auth-provider";
import { AuditCard } from "@/components/audit-card";
import { useStoreData } from "@/hooks/use-store-data";
import { ActionAlert } from "@/components/action-alert";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { NotificationFeed } from "@/components/announcements/notification-feed";

export function StoreHomeView() {
    const { userProfile } = useAuth();
    const router = useRouter();
    
    // Use the cached data hook
    const { 
        audits, 
        loading, 
        pendingActionsCount, 
        rejectedActionsCount, 
        overdueAuditsCount,
    } = useStoreData();

    const handleAuditClick = (auditId: string) => {
        router.push(`/audits/${auditId}/summary`);
    };

    if (loading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                 {/* Skeleton Loader */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {[1, 2, 3].map((i) => (
                         <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
                     ))}
                 </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6 px-4 md:px-6 mb-20">
            {/* Header Section */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">
                    Merhaba, {userProfile?.storeName || userProfile?.firstName || "Mağaza Yöneticisi"}
                </h1>
                <p className="text-muted-foreground text-sm">
                    Mağazanızın denetim durumu ve aksiyonları aşağıdadır.
                </p>
            </div>

            {/* Notification Feed */}
            <NotificationFeed />

            {/* Alerts Section */}
            <div className="space-y-4">
                {overdueAuditsCount > 0 && (
                    <ActionAlert
                        type="overdue"
                        count={overdueAuditsCount}
                        link="/magaza" // Or a specific filter link if available
                        hideViewButton={true}
                    />
                )}
                {rejectedActionsCount > 0 && (
                    <ActionAlert
                        type="rejected"
                        count={rejectedActionsCount}
                        link="/magaza"
                        hideViewButton={true}
                    />
                )}
                {/* Pending alert can be added here if needed */}
            </div>

            {/* Audits List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Son Denetimler</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {audits.length} Denetim
                    </span>
                </div>

                {audits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/30">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold">Henüz Hiç Denetim Yok</h3>
                        <p className="text-muted-foreground max-w-[280px] mt-2 text-sm">
                            Mağazanız için henüz bir denetim kaydı oluşturulmamış. Denetim yapıldığında burada görünecektir.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    );
}
