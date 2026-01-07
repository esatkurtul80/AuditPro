"use client";

import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, FileText, ChevronRight, Eye, Play, Award, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
    onClick
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
        <Card
            className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col gap-3 py-0"
        >
            {/* Top decorative line */}
            <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                percentage >= 90 ? "bg-emerald-500" :
                    percentage >= 75 ? "bg-blue-500" :
                        percentage >= 60 ? "bg-orange-500" : "bg-red-500"
            )} />

            <CardHeader className="p-4 pb-1">
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <Badge
                            variant="outline"
                            className="text-xs font-normal text-slate-500 border-slate-200 dark:border-slate-700 mb-1 w-fit flex items-center gap-1"
                        >
                            <Calendar className="h-3 w-3" />
                            {formatDate(completedAt)}
                        </Badge>
                        <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-50 line-clamp-1 group-hover:text-primary transition-colors">
                            {storeName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5 text-sm font-medium">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            {auditType}
                        </CardDescription>
                    </div>

                    <div className="flex flex-col items-end">
                        {isPerfectScore ? (
                            <div className="relative flex items-center justify-center h-16 w-16">
                                {/* Gold Seal Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-full shadow-lg shadow-amber-200 border-2 border-amber-100 flex items-center justify-center">
                                    <div className="h-[54px] w-[54px] rounded-full border border-yellow-200 border-dashed flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500">
                                        <span className="text-xl font-black text-white drop-shadow-sm">100</span>
                                    </div>
                                </div>
                                {/* Ribbon bits */}
                                <div className="absolute -bottom-2 -left-1 w-4 h-6 bg-red-600 -z-10 rotate-12"></div>
                                <div className="absolute -bottom-2 -right-1 w-4 h-6 bg-red-600 -z-10 -rotate-12"></div>
                            </div>
                        ) : (
                            <div className={cn(
                                "flex items-center justify-center h-14 w-14 rounded-2xl border-2 shadow-sm bg-white dark:bg-slate-900",
                                getScoreBadgeStyles(percentage)
                            )}>
                                <div className="flex flex-col items-center justify-center text-center leading-none">
                                    <span className="text-sm font-bold">{percentage}</span>
                                    <span className="text-[10px] opacity-80">PUAN</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            <CardContent className="p-4 pt-1 pb-2 flex-1">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-2">
                    <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-500">
                        <User className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-medium">Denetmen</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-200">{auditorName}</div>
                    </div>
                </div>

                {/* Deadline Badge */}
                <div className="mb-2">
                    {/* SHOW DEADLINE INFO IF PENDING STORE ACTIONS EXIST */}
                    {deadlineInfo && pendingActionCount > 0 && actionStats && (
                        <div className={cn(
                            "flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium mb-3",
                            deadlineInfo.status === 'overdue'
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                : deadlineInfo.status === 'warning'
                                    ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                        )}>
                            <Clock className={cn("h-4 w-4", deadlineInfo.status === 'overdue' && "animate-pulse")} />
                            <span>
                                Dönüş: {deadlineInfo.status === 'overdue'
                                    ? `${Math.abs(deadlineInfo.daysRemaining)} gün geç`
                                    : deadlineInfo.status === 'warning'
                                        ? "Son gün"
                                        : `${deadlineInfo.daysRemaining} gün kaldı`
                                }
                            </span>
                        </div>
                    )}

                    {/* SHOW RETURN STATUS IF ALL ACTIONS SUBMITTED (NO PENDING STORE, BUT HAS ACTIONS) */}
                    {!pendingActionCount && hasActions && lastSubmittedAt && (
                        (() => {
                            const deadline = deadlineInfo?.deadline;
                            if (!deadline) return null;

                            // Re-calculate effective deadline date (midnight)
                            const deadlineDate = new Date(deadline);
                            deadlineDate.setHours(23, 59, 59, 999);

                            // Submission date
                            const submissionDate = new Date(lastSubmittedAt);

                            // Check if late
                            const isLate = submissionDate > deadlineDate;

                            if (isLate) {
                                // Calculate how many days late (excluding Sundays)
                                const daysLate = calculateDaysExcludingSundays(deadlineDate, submissionDate);
                                return (
                                    <div className="flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium mb-3 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                        <Clock className="h-4 w-4" />
                                        <span>Dönüş: {daysLate > 0 ? `${daysLate} gün geç yapıldı` : "Geç yapıldı"}</span>
                                    </div>
                                );
                            } else {
                                const daysTaken = calculateDaysExcludingSundays(completedAt, submissionDate);
                                const displayDays = daysTaken === 0 ? 1 : daysTaken;

                                return (
                                    <div className="flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium mb-3 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                        <Clock className="h-4 w-4" />
                                        <span>Dönüş: {daysTaken === 0 ? "Aynı gün" : `${displayDays} gün içinde`} yapıldı</span>
                                    </div>
                                );
                            }
                        })()
                    )}
                </div>

                {/* Dynamic Status Section */}
                {hasActions && (
                    <div className={cn("flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium", status.color)}>
                        {/* Fix: Explicit boolean conversion to prevent rendering '0' */}
                        {(actionStats?.pending_store || 0) > 0 && <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />}
                        {(actionStats?.rejected || 0) > 0 && <AlertCircle className="h-4 w-4" />}
                        {(actionStats?.approved || 0) === (actionStats?.total || 0) && (actionStats?.total || 0) > 0 && <CheckCircle2 className="h-4 w-4" />}

                        <span>{status.text}</span>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-1 gap-2">
                {/* Left Button: Actions (if applicable) */}
                {hasAnyActions ? (
                    showActionButton ? (
                        <Button
                            className="flex-1 justify-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md shadow-blue-500/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/audits/${auditId}/actions`;
                            }}
                        >
                            <Play className="mr-2 h-4 w-4 fill-current" />
                            Dönüş Yap
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="flex-1 justify-center border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/audits/${auditId}/actions`;
                            }}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Aksiyon
                        </Button>
                    )
                ) : !isPerfectScore && (
                    <div className="flex-1" />
                )}

                {/* Right Button: Inspect (Always visible, goes to Summary) */}
                <Button
                    className={cn(
                        "shadow-sm justify-center",
                        hasAnyActions || !isPerfectScore
                            ? "flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border border-transparent"
                            : "w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border border-transparent"
                    )}
                    onClick={onClick}
                >
                    İncele
                    <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card >
    );
}
