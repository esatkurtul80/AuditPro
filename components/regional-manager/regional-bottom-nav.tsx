"use client";

import { Home, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegionalBottomNavProps {
    activeTab: "panel" | "scores" | "settings";
    onTabChange: (tab: "panel" | "scores" | "settings") => void;
}

export function RegionalBottomNav({ activeTab, onTabChange }: RegionalBottomNavProps) {
    const navItems = [
        { id: "panel" as const, label: "Panel", icon: Home },
        { id: "scores" as const, label: "Puanlar", icon: TrendingUp },
        { id: "settings" as const, label: "Ayarlar", icon: Settings },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-safe">
            <nav className="container mx-auto flex items-center justify-around h-16 px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors rounded-lg",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
