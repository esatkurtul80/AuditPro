"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionAlertProps {
    type: "pending" | "rejected" | "overdue";
    count: number;
    link: string;
    hideViewButton?: boolean;
}

export function ActionAlert({ type, count, link, hideViewButton }: ActionAlertProps) {
    if (count === 0) return null;

    const config = {
        pending: {
            icon: Info,
            title: "Aksiyon Dönüşü Bekleniyor",
            description: "Mağaza tarafından yanıtlanması gereken aksiyonlarınız mevcut.",
            bgClass: "bg-blue-50 dark:bg-blue-950/30",
            borderClass: "border-blue-200 dark:border-blue-800",
            iconClass: "text-blue-600 dark:text-blue-400",
            badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
            buttonVariant: "default" as const
        },
        rejected: {
            icon: AlertTriangle,
            title: "Düzeltme Gerekiyor",
            description: "Admin tarafından reddedilen ve düzeltme bekleyen aksiyonlarınız var.",
            bgClass: "bg-red-50 dark:bg-red-950/30",
            borderClass: "border-red-200 dark:border-red-800",
            iconClass: "text-red-600 dark:text-red-400",
            badgeClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
            buttonVariant: "destructive" as const
        },
        overdue: {
            icon: AlertCircle,
            title: "Süresi Geçen Denetimler",
            description: "Aksiyon süresi dolmuş denetimleriniz bulunmaktadır.",
            bgClass: "bg-orange-50 dark:bg-orange-950/30",
            borderClass: "border-orange-200 dark:border-orange-800",
            iconClass: "text-orange-600 dark:text-orange-400",
            badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
            buttonVariant: "destructive" as const // Using destructive/red button for urgency
        }
    };

    const styles = config[type];
    const Icon = styles.icon;

    return (
        <div className={cn(
            "relative flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md",
            styles.bgClass,
            styles.borderClass
        )}>
            <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-full bg-white dark:bg-slate-900 shadow-sm border", styles.borderClass)}>
                    <Icon className={cn("h-5 w-5", styles.iconClass)} />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {styles.title}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", styles.badgeClass)}>
                            {count}
                        </span>
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {styles.description}
                    </p>
                </div>
            </div>

            {!hideViewButton && (
                <Link href={link}>
                    <Button size="sm" variant={styles.buttonVariant} className="gap-1 shadow-sm">
                        Görüntüle
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            )}
        </div>
    );
}
