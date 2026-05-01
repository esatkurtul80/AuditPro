"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, calcDisplayScore } from "@/lib/utils";
import { Calendar, CheckCircle2, AlertCircle, Clock, ArrowRight, Star, ExternalLink, Award, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface AuditCardProps {
    auditId: string;
    storeName: string;
    auditorName: string;
    auditType: string;
    completedAt: any;
    score: number;
    totalScore: number;
    hasActions: boolean;
    actionStats?: {
        total: number;
        approved: number;
        rejected: number;
        pending_store: number;
        pending_admin: number;
    };
    lastSubmittedAt?: Date;
    onClick?: () => void;
}

export function ReportAuditCard({
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
    const router = useRouter();

    // Check if dates are valid
    const isValidDate = (date: any) => {
        return date instanceof Date && !isNaN(date.getTime());
    };

    const formatDate = (date: any) => {
        if (!date) return "-";
        let parsedDate: Date;
        
        if (date instanceof Date) {
            parsedDate = date;
        } else if (typeof date.toDate === 'function') {
            parsedDate = date.toDate();
        } else if (date.seconds) {
            parsedDate = new Date(date.seconds * 1000);
        } else {
            parsedDate = new Date(date);
        }

        if (!isValidDate(parsedDate)) return "-";
        
        return new Intl.DateTimeFormat('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(parsedDate);
    };

    const getScoreColor = (score: number, total: number) => {
        const percentage = total > 0 ? (score / total) * 100 : 0;
        if (percentage >= 90) return "text-emerald-600 dark:text-emerald-400";
        if (percentage >= 75) return "text-blue-600 dark:text-blue-400";
        if (percentage >= 60) return "text-orange-600 dark:text-orange-400";
        return "text-red-600 dark:text-red-400";
    };

    const getScoreBadgeColor = (score: number, total: number) => {
        const percentage = total > 0 ? (score / total) * 100 : 0;
        if (percentage >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
        if (percentage >= 75) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
        if (percentage >= 60) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800";
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    };

    const calculateDeadline = () => {
        if (!lastSubmittedAt || !isValidDate(lastSubmittedAt)) return null;
        
        const deadline = new Date(lastSubmittedAt);
        // Add 3 days logic could be implemented here if needed broadly
        // For now just basic date + 3 days
        let daysAdded = 0;
        while (daysAdded < 3) {
            deadline.setDate(deadline.getDate() + 1);
            daysAdded++;
        }
        
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            date: deadline,
            daysRemaining: diffDays,
            status: diffDays < 0 ? 'overdue' : diffDays <= 1 ? 'warning' : 'normal'
        };
    };

    const deadlineInfo = calculateDeadline();

    const getStatusText = () => {
        if (!hasActions && (!actionStats || actionStats.total === 0)) {
            return { text: "Aksiyon Yok", color: "text-slate-500", bg: "bg-slate-100" };
        }

        if (actionStats?.pending_store && actionStats.pending_store > 0) {
            return { text: "Aksiyon Bekliyor", color: "text-amber-600", bg: "bg-amber-100" };
        }
        
        if (actionStats?.rejected && actionStats.rejected > 0) {
             return { text: "Reddedildi", color: "text-red-600", bg: "bg-red-100" };
        }

        if (actionStats?.pending_admin && actionStats.pending_admin > 0) {
            return { text: "Onay Bekliyor", color: "text-blue-600", bg: "bg-blue-100" };
        }

        return { text: "Tamamlandı", color: "text-emerald-600", bg: "bg-emerald-100" };
    };

    const status = getStatusText();
    const percentage = calcDisplayScore(null, score, totalScore > 0 ? totalScore : undefined);
    const isPerfectScore = percentage === 100;
    
    // Calculate pending actions for display
    const pendingActionCount = actionStats?.pending_store || 0;
    const hasAnyActions = hasActions || (actionStats?.total || 0) > 0;

    return (
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 flex flex-col justify-between h-full relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div>
                {/* Üst Kısım: Tarih ve Puan */}
                <div className="flex justify-between items-start mb-3">
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-1 rounded-full uppercase">
                        {formatDate(completedAt)}
                    </span>
                    
                    {isPerfectScore ? (
                        <div className="relative group/badge flex items-center justify-center p-0.5 mt-1 mr-1">
                            {/* Altın Yıldız */}
                            <div className="relative flex items-center justify-center text-amber-500">
                                <Star className="w-16 h-16 fill-yellow-400 text-amber-500" strokeWidth={1} />
                                
                                {/* İçindeki 100 Yazısı */}
                                <div className="absolute flex flex-col items-center justify-center mt-1 ml-[1px]">
                                    <span className="font-extrabold text-[12px] tracking-tighter text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]">
                                        100
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-xl shadow-sm border",
                            percentage >= 90 ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            percentage >= 75 ? "bg-blue-50 border-blue-100 text-blue-600" :
                            percentage >= 60 ? "bg-orange-50 border-orange-100 text-orange-600" :
                            "bg-red-50 border-red-100 text-red-600"
                        )}>
                            <span className="font-bold text-lg">{percentage}</span>
                        </div>
                    )}
                </div>

                {/* Başlık */}
                <h2 className="text-xl font-bold text-gray-900 leading-tight line-clamp-2">{storeName}</h2>
                <div className="flex items-center mt-1 text-gray-500 text-xs font-medium uppercase">{auditType}</div>

                {/* Kullanıcı Bilgisi */}
                <div className="flex items-center mt-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-2 text-xs">
                        <i className="fa-regular fa-user"></i>
                    </div>
                    <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">DENETMEN</p>
                        <p className="text-xs font-bold text-gray-800 line-clamp-1">{auditorName}</p>
                    </div>
                </div>

                {/* Uyarı Etiketleri */}
                <div className="space-y-1 mb-4">
                     {/* Return Deadline Status */}
                    {deadlineInfo && pendingActionCount > 0 && actionStats && (
                         <div className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center border",
                            deadlineInfo.status === 'overdue'
                                ? "bg-red-50 text-red-700 border-red-100/50"
                                : deadlineInfo.status === 'warning'
                                    ? "bg-amber-50 text-amber-700 border-amber-100/50"
                                    : "bg-gray-50 text-gray-700 border-gray-100/50"
                        )}>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full mr-2",
                                deadlineInfo.status === 'overdue' ? "bg-red-500" :
                                deadlineInfo.status === 'warning' ? "bg-amber-500" : "bg-gray-500"
                            )}></span>
                             {deadlineInfo.status === 'overdue'
                                    ? `${Math.abs(deadlineInfo.daysRemaining)} gün geç`
                                    : deadlineInfo.status === 'warning'
                                        ? "Bugün son gün"
                                        : `${deadlineInfo.daysRemaining} gün kaldı`
                             }
                        </div>
                    )}

                    {/* Action Status */}
                    {hasActions && (
                         <div className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center border",
                             (actionStats?.pending_store || 0) > 0 ? "bg-amber-50 text-amber-700 border-amber-100/50" :
                             (actionStats?.rejected || 0) > 0 ? "bg-red-50 text-red-700 border-red-100/50" :
                             "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                         )}>
                             <i className={cn(
                                 "mr-2 text-[10px]",
                                 (actionStats?.pending_store || 0) > 0 ? "fa-solid fa-circle-exclamation" :
                                 (actionStats?.rejected || 0) > 0 ? "fa-solid fa-circle-xmark" :
                                 "fa-solid fa-circle-check"
                             )}></i>
                             {status.text}
                        </div>
                    )}
                </div>
            </div>

            {/* Buton */}
            <button 
                className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-3 rounded-lg text-xs shadow-md transition-colors"
                onClick={onClick}
            >
                İNCELE
            </button>
        </div>
    );
}
