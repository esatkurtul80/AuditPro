"use client";

import { Home, BarChart3, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface StoreBottomNavProps {
    activeTab: 'panel' | 'reports' | 'notifications' | 'settings'; // Add settings
    onTabChange: (tab: 'panel' | 'reports' | 'notifications' | 'settings') => void;
    notificationCount?: number;
}

export function StoreBottomNav({ activeTab, onTabChange, notificationCount = 0 }: StoreBottomNavProps) {
    
    // Helper for simple button rendering (No Blue Circle)
    const renderNavButton = (
        id: 'panel' | 'reports' | 'notifications' | 'settings', 
        label: string, 
        Icon: any,
        badge?: number
    ) => {
        const isActive = activeTab === id;
        
        return (
            <button
                onClick={() => onTabChange(id)}
                className="flex justify-center w-full relative z-10 font-sans" // ensure font-sans and remove space-y
            >
                <div
                    className={cn(
                        "relative flex flex-col items-center gap-1 min-w-[60px] px-2 py-1.5 rounded-xl", // No transition
                        isActive ? "bg-blue-600 shadow-md" : "bg-transparent"
                    )}
                >
                    <div className="relative">
                        <Icon 
                            className={cn(
                                "", 
                                isActive ? "text-white" : "text-gray-400 dark:text-slate-500"
                            )} 
                            size={24} 
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        {badge && badge > 0 ? (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white font-bold has-shadow">
                                {badge > 9 ? "9+" : badge}
                            </span>
                        ) : null}
                    </div>
                    <span 
                        className={cn(
                            "text-[10px] font-medium truncate max-w-full",
                            isActive ? "text-white" : "text-gray-400 dark:text-slate-500"
                        )}
                    >
                        {label}
                    </span>
                </div>
            </button>
        );
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t pb-safe-area-bottom">
            <div className="grid grid-cols-4 items-center h-16">
                {/* 1. Raporlar */}
                {renderNavButton('reports', 'Raporlar', BarChart3)}

                {/* 2. Panel */}
                {renderNavButton('panel', 'Panel', Home)}

                {/* 3. Bildirimler */}
                {renderNavButton('notifications', 'Bildirimler', Bell, notificationCount)}

                {/* 4. Ayarlar (Now a state button) */}
                {renderNavButton('settings', 'Ayarlar', Settings)}
            </div>
        </div>
    );
}
