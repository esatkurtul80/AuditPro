"use client";

import { Home, BarChart3, Settings, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function BottomNav() {
    const pathname = usePathname();
    const { userProfile, loading } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (userProfile?.uid && !loading) {
            const q = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("read", "==", false),
                limit(99)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                setUnreadCount(snapshot.size);
            }, (error) => {
                // Silently handle permission errors causing by auth race conditions
                if (error.code !== 'permission-denied') {
                    console.error("BottomNav: Notification listener error:", error);
                }
            });

            return () => unsubscribe();
        }
    }, [userProfile?.uid, loading]);

    const items = [
        {
            href: "/magaza/panel?tab=reports", // URL Parameter Navigation
            label: "Raporlar",
            icon: BarChart3,
        },
        {
            href: "/magaza/panel?tab=panel",
            label: "Panel",
            icon: Home,
        },
        {
            href: "/magaza/panel?tab=notifications",
            label: "Bildirimler",
            icon: Bell,
            badge: unreadCount
        },
        {
            href: "/magaza/panel?tab=settings",
            label: "Ayarlar",
            icon: Settings,
        },
    ];

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const currentTab = searchParams.get('tab');

    const activeIndex = items.findIndex(item => {
        if (pathname === '/magaza/panel') {
            // If we are on the panel, check the tab param
            if (item.href.includes('?tab=')) {
                const itemTab = item.href.split('tab=')[1];
                return currentTab === itemTab || (!currentTab && itemTab === 'panel');
            }
            return item.href === '/magaza/panel?tab=panel' || item.href === '/magaza/panel';
        }
        // Fallback for other routes (though GlobalBottomNavWrapper hides this on panel usually, wait... GlobalBottomNavWrapper logic might need update if we want to show THIS nav on panel too? No, panel has StoreBottomNav)
        // Since GlobalBottomNavWrapper returns NULL on /magaza/panel, this BottomNav is ONLY visible when NOT on /magaza/panel.
        // So checking tab params here is only relevant if we are navigating TO the panel.
        // But if we are NOT on the panel, none of these should be active effectively, except maybe if we want to highlight "Panel" generically?
        
        // Actually, if we are on /audits/..., none of these are active. And that's correct.
        // But the user clicks them to go TO the panel.
        
        return pathname.startsWith(item.href.split('?')[0]);
    });

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#111318] border-t border-gray-200 dark:border-white/5 px-2 lg:hidden z-50 pb-safe">
            <div className="grid grid-cols-4 items-center h-[70px]">
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = index === activeIndex;

                    return (
                        <Link key={item.href} href={item.href} className="flex justify-center w-full relative z-10">
                            <div
                                className={cn(
                                    "relative flex flex-col items-center gap-1 min-w-[60px] px-2 py-1.5 rounded-xl transition-colors duration-200",
                                    isActive ? "bg-blue-600 shadow-lg" : "bg-transparent"
                                )}
                            >
                                <div className="relative">
                                    <Icon
                                        className={cn(
                                            "transition-colors duration-200",
                                            isActive ? "text-white" : "text-gray-400 dark:text-slate-500"
                                        )}
                                        size={24}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                    {item.badge && item.badge > 0 ? (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-2 ring-white dark:ring-[#111318]">
                                            {item.badge > 9 ? "9+" : item.badge}
                                        </span>
                                    ) : null}
                                </div>
                                <span
                                    className={cn(
                                        "text-[10px] transition-colors duration-200 font-medium truncate max-w-full",
                                        isActive ? "text-white" : "text-gray-400 dark:text-slate-500"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
