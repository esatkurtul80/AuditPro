"use client";

import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    BarChart3,
    FileQuestion,
    CheckCircle,
    TrendingUp,
    FileBarChart,
} from "lucide-react";

type ReportTab = "panel" | "personel" | "puan" | "soru" | "aksiyon" | "denetci";

interface ReportSidebarProps {
    activeTab: ReportTab;
    onTabChange: (tab: ReportTab) => void;
    className?: string;
}

const navItems: { id: ReportTab; label: string; icon: React.ElementType; description: string }[] = [
    { id: "panel", label: "Panel", icon: LayoutDashboard, description: "Günlük özel raporlar" },
    { id: "personel", label: "Personel Raporu", icon: Users, description: "Personel değerlendirmeleri" },
    { id: "puan", label: "Puan Raporu", icon: BarChart3, description: "Mağaza puan analizi" },
    { id: "soru", label: "Soru Raporları", icon: FileQuestion, description: "Soru bazlı analizler" },
    { id: "aksiyon", label: "Aksiyon Raporu", icon: CheckCircle, description: "Aksiyon performansı" },
    { id: "denetci", label: "Denetçi Performansı", icon: TrendingUp, description: "Denetmen istatistikleri" },
];

export function ReportSidebar({ activeTab, onTabChange, className }: ReportSidebarProps) {
    return (
        <div className={cn("flex flex-col h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r", className)}>
            {/* Brand Header */}
            <div className="flex items-center gap-3 h-16 px-5 border-b shrink-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                    <FileBarChart className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Yönetici</span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Analytics</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <p className="px-3 pb-2 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Menü</p>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                                isActive
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                            )}
                        >
                            <Icon className={cn("h-4.5 w-4.5 shrink-0 h-[18px] w-[18px]", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                            <div className="flex flex-col leading-tight">
                                <span className="text-sm font-medium">{item.label}</span>
                                <span className={cn("text-[10px]", isActive ? "text-emerald-100" : "text-slate-400")}>{item.description}</span>
                            </div>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
