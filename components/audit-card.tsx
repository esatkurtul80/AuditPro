"use client";

import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, FileText, ChevronRight, Eye, Play, Award, CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// Helper function to calculate days excluding Sundays
const calculateDaysExcludingSundays = (fromDate: Date, toDate: Date): number => {
    let count = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
        if (current.getDay() !== 0) { // 0 = Sunday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

// Helper function to get return deadline info
const getReturnDeadline = (completedAt: any) => {
    if (!completedAt) return null;

    const completedDate = completedAt instanceof Date
        ? completedAt
        : typeof completedAt.toDate === 'function'
            ? completedAt.toDate()
            : new Date(completedAt.seconds * 1000);

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
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const daysRemaining = calculateDaysExcludingSundays(tomorrow, deadlineDate);

    if (now > deadline) {
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

export interface ActionStats {
    total: number;
    approved: number;
    rejected: number;
    pending_store: number;
    pending_admin: number;
}

interface AuditCardProps {
    auditId: string;
    storeName: string;
    auditorName: string;
    auditType: string;
    completedAt: Date;
    score: number;
    totalScore: number;
    hasActions: boolean;
    actionStats?: ActionStats;
    lastSubmittedAt?: Date;
    onClick: () => void;
    onActionClick?: () => void;
}

export function AuditCard({
    auditId,
    storeName,
    auditorName,
    auditType,
    completedAt,
    score,
    totalScore,
    hasActions,
    actionStats,
    lastSubmittedAt,
    onClick,
    onActionClick
}: AuditCardProps) {
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const isPerfectScore = percentage === 100;

    // Calculate pending action count explicitly for the badge
    const pendingActionCount = (actionStats?.pending_store || 0) + (actionStats?.rejected || 0);

    const deadlineInfo = getReturnDeadline(completedAt);

    const getScoreBadgeStyles = (percentage: number) => {
        if (percentage >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
        if (percentage >= 75) return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
        if (percentage >= 60) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    };

    // Helper to determine status based on stats
    const getStatusContent = () => {
        if (!actionStats || !hasActions) {
            if (isPerfectScore) {
                return { text: "Harika! Tam Puan", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
            }
            return { text: "Aksiyon Yok", color: "text-slate-500 bg-slate-100 border-slate-200" };
        }

        const { total, approved, rejected, pending_store, pending_admin } = actionStats;

        if (approved > 0 && rejected > 0) {
            return {
                text: `${approved} Soru Onaylandı, ${rejected} Soru Reddedildi ve tekrar dönüş bekliyor`,
                color: "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
            };
        }

        if (rejected > 0) {
            return {
                text: `${rejected} aksiyon reddedildi, tekrar dönüş bekliyor`,
                color: "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
            };
        }

        if (pending_store > 0) {
            return {
                text: "Aksiyon Gerekiyor",
                color: "text-orange-700 bg-orange-50 border-orange-200 animate-pulse dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800"
            };
        }

        if (approved > 0 && pending_admin > 0) {
            return {
                text: `${approved}/${total} Soru Onaylandı, Kalanlar Onay Sürecinde`,
                color: "text-blue-700 bg-blue-50 border-blue-200"
            };
        }

        if (pending_admin > 0) {
            return {
                text: "Onay Bekliyor",
                color: "text-yellow-700 bg-yellow-50 border-yellow-200"
            };
        }

        if (approved === total && total > 0) {
            return {
                text: "Dönüş Onaylandı",
                color: "text-emerald-700 bg-emerald-50 border-emerald-200"
            };
        }

        // Mixed state: fallback
        return {
            text: `${approved}/${total} Soru Onaylandı`,
            color: "text-blue-700 bg-blue-50 border-blue-200"
        };
    };

    const status = getStatusContent();
    const showActionButton = (actionStats?.pending_store || 0) > 0 || (actionStats?.rejected || 0) > 0;
    const hasAnyActions = hasActions || (actionStats?.total || 0) > 0;

    return (
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden group border-slate-200 dark:border-slate-800">
             {/* Header Section */}
            <CardHeader className="pb-3 space-y-0">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                         <div className="flex items-center gap-2">
                             <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 font-normal">
                                 {formatDate(completedAt)}
                             </Badge>
                             {isPerfectScore && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-500 border-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1">
                                    <Award className="h-3 w-3" />
                                    MÜKEMMEL
                                </Badge>
                             )}
                         </div>
                        <CardTitle className="text-lg font-bold line-clamp-1 pr-2 tracking-tight flex items-center gap-2">
                            {storeName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                            {auditType}
                        </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-xl border-2 font-black text-lg shadow-sm transition-colors",
                            isPerfectScore ? "bg-amber-50 text-amber-600 border-amber-200" :
                            percentage >= 90 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                            percentage >= 75 ? "bg-blue-50 text-blue-600 border-blue-200" :
                            percentage >= 60 ? "bg-orange-50 text-orange-600 border-orange-200" :
                            "bg-red-50 text-red-600 border-red-200"
                        )}>
                            {percentage}
                        </div>
                    </div>
                 </div>
            </CardHeader>

            <CardContent className="pb-3 pt-0 space-y-4">
                 <Separator className="bg-slate-100 dark:bg-slate-800" />
                 
                 {/* Auditor */}
                 <div className="flex items-center gap-3 group/auditor">
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 ring-2 ring-white dark:ring-slate-950 transition-colors group-hover/auditor:bg-slate-200 dark:group-hover/auditor:bg-slate-700">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Denetmen</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{auditorName}</span>
                    </div>
                 </div>

                 {/* Status Badges */}
                 <div className="space-y-2">
                     {/* Deadline Badge */}
                     {deadlineInfo && pendingActionCount > 0 && actionStats && (
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                            deadlineInfo.status === 'overdue' 
                                ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50" 
                                : deadlineInfo.status === 'warning'
                                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50"
                                    : "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                        )}>
                            <Clock className={cn("h-3.5 w-3.5", deadlineInfo.status === 'overdue' && "animate-pulse")} />
                            <span>
                                {deadlineInfo.status === 'overdue' 
                                    ? `${Math.abs(deadlineInfo.daysRemaining)} Gün Geç` 
                                    : deadlineInfo.status === 'warning'
                                        ? "Bugün Son Gün"
                                        : `${deadlineInfo.daysRemaining} Gün Kaldı`
                                }
                            </span>
                        </div>
                     )}

                     {/* Action Status Badge */}
                     {hasAnyActions && (
                         <div className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border",
                             (actionStats?.pending_store || 0) > 0 ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50" :
                             (actionStats?.rejected || 0) > 0 ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50" :
                             "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50"
                         )}>
                             {(actionStats?.pending_store || 0) > 0 || (actionStats?.rejected || 0) > 0 ? (
                                <AlertCircle className="h-3.5 w-3.5" />
                             ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                             )}
                             <span className="line-clamp-1">{status.text}</span>
                         </div>
                     )}
                 </div>
            </CardContent>

            <CardFooter className="pt-0 p-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <div className="flex gap-2 w-full">
                    {((actionStats?.pending_store || 0) > 0 || (actionStats?.rejected || 0) > 0) && (
                        <Button 
                            className="flex-1 h-10 font-bold tracking-wide shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 transition-all hover:-translate-y-0.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onActionClick) onActionClick();
                                else onClick();
                            }}
                        >
                            DÖNÜŞ YAP
                            <ArrowRight className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                    )}
                    <Button 
                        variant="secondary" 
                        className={cn(
                            "h-10 font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-all",
                            ((actionStats?.pending_store || 0) > 0 || (actionStats?.rejected || 0) > 0) ? "flex-1" : "w-full"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                    >
                        <Eye className="mr-2 h-4 w-4 text-slate-500" />
                        {(actionStats?.pending_admin || 0) > 0 ? "AKSİYON GÖR" : "İNCELE"}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
