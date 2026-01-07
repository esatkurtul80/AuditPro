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
    const { userProfile } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (userProfile?.uid) {
            const q = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("read", "==", false),
                limit(99)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                setUnreadCount(snapshot.size);
            });

            return () => unsubscribe();
        }
    }, [userProfile?.uid]);

    const items = [
        {
            href: "/magaza/raporlar",
            label: "Raporlar",
            icon: BarChart3,
        },
        {
            href: "/magaza/panel",
            label: "Panel",
            icon: Home,
        },
        {
            href: "/notifications",
            label: "Bildirimler",
            icon: Bell,
            badge: unreadCount
        },
        {
            href: "/magaza/ayarlar",
            label: "Ayarlar",
            icon: Settings,
        },
    ];

    const activeIndex = items.findIndex(item => {
        return item.href === "/magaza/panel"
            ? (pathname === "/magaza/panel" || pathname === "/magaza")
            : pathname.startsWith(item.href);
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
