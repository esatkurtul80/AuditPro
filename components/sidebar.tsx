"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Users,
    Store,
    FileQuestion,
    LayoutList,
    ClipboardList,
    CheckSquare,
    BarChart3,
    ChevronDown,
    Trash2,
    Bell,
    PlayCircle,
    CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const { userProfile, loading } = useAuth();
    const pathname = usePathname();
    const [isAuditMenuOpen, setIsAuditMenuOpen] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (userProfile?.uid) {
            const notifQuery = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("read", "==", false)
            );
            const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
                setUnreadCount(snapshot.docs.length);
            });
            return () => unsubscribe();
        }
    }, [userProfile]);

    const adminLinks = [
        { href: "/admin/dashboard", label: "Panel", icon: LayoutDashboard },
        { href: "/admin/users", label: "Kullanıcılar", icon: Users },
        { href: "/admin/stores", label: "Mağazalar", icon: Store },
        { href: "/admin/actions", label: "Aksiyonlar", icon: CheckSquare },
        { href: "/admin/reports/stores", label: "Raporlar", icon: BarChart3 },
        { href: "/admin/cop-kutusu", label: "Çöp Kutusu", icon: Trash2 },
    ];

    const auditSubLinks = [
        { href: "/admin/questions", label: "Sorular", icon: FileQuestion },
        { href: "/admin/sections", label: "Bölümler", icon: LayoutList },
        { href: "/admin/audit-types", label: "Denetim Formları", icon: ClipboardList },
    ];

    const denetmenLinks = [
        { href: "/denetmen/panel", label: "Panel", icon: LayoutDashboard },
        { href: "/denetmen/bekleyen", label: "Bekleyen Denetimler", icon: PlayCircle },
        { href: "/denetmen/tamamlanan", label: "Tamamlanan Denetimlerim", icon: CheckCircle },
    ];

    const magazaLinks = [
        { href: "/magaza", label: "Aksiyonlarım", icon: CheckSquare },
    ];

    const bolgeMuduruLinks = [
        { href: "/bolge-muduru", label: "Panel", icon: LayoutDashboard },
        // { href: "/bolge-muduru/magazalar", label: "Mağazalarım", icon: Store }, // Şimdilik panelde var
        // { href: "/bolge-muduru/denetimler", label: "Denetimler", icon: ClipboardList }, // Şimdilik panelden gidiliyor
    ];



    const isAuditSectionActive = auditSubLinks.some(
        link => pathname === link.href || pathname.startsWith(link.href + '/')
    );

    return (
        <div className={cn("flex flex-col h-screen border-r bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900", className)}>
            {/* Header */}
            <div className="px-6 py-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 shadow-lg shadow-purple-500/30">
                        <span className="text-xl font-bold text-white">
                            {userProfile?.firstName?.[0] || userProfile?.email?.[0]?.toUpperCase() || "A"}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        {loading ? (
                            <Skeleton className="h-4 w-24 mt-1" />
                        ) : (
                            <>
                                {userProfile?.firstName && userProfile?.lastName ? (
                                    <span className="text-sm font-semibold">{userProfile.firstName} {userProfile.lastName}</span>
                                ) : (
                                    <span className="text-sm font-semibold">{userProfile?.email}</span>
                                )}
                                <span className="text-xs text-muted-foreground capitalize">{userProfile?.role || "User"}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
                <nav className="space-y-1">
                    {loading ? (
                        // Show skeleton while loading
                        <div className="space-y-2">
                            <Skeleton className="h-11 w-full" />
                            <Skeleton className="h-11 w-full" />
                            <Skeleton className="h-11 w-full" />
                        </div>
                    ) : userProfile?.role === "admin" ? (
                        <>
                            {adminLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start gap-3 h-11 px-4 font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-200",
                                                isActive && "scale-110"
                                            )} />
                                            <span className="text-sm">{link.label}</span>
                                        </Button>
                                    </Link>
                                );
                            })}

                            {/* Denetim Yönetimi Dropdown */}
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsAuditMenuOpen(!isAuditMenuOpen)}
                                    className={cn(
                                        "w-full justify-start gap-3 h-11 px-4 font-medium transition-all duration-200",
                                        isAuditSectionActive
                                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                >
                                    <ClipboardList className={cn(
                                        "h-5 w-5 transition-transform duration-200",
                                        isAuditSectionActive && "scale-110"
                                    )} />
                                    <span className="text-sm flex-1 text-left">Denetim Yönetimi</span>
                                    <ChevronDown className={cn(
                                        "h-4 w-4 transition-transform duration-200",
                                        isAuditMenuOpen && "rotate-180"
                                    )} />
                                </Button>

                                {/* Sub Menu Items */}
                                {isAuditMenuOpen && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {auditSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                            return (
                                                <Link key={link.href} href={link.href}>
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "w-full justify-start gap-3 h-10 px-3 font-medium transition-all duration-200",
                                                            isActive
                                                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-sm"
                                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        <span className="text-sm">{link.label}</span>
                                                    </Button>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </>
                    ) : userProfile?.role === "bolge-muduru" ? (
                        <>
                            {bolgeMuduruLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start gap-3 h-11 px-4 font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-200",
                                                isActive && "scale-110"
                                            )} />
                                            <span className="text-sm">{link.label}</span>
                                        </Button>
                                    </Link>
                                );
                            })}
                        </>
                    ) : userProfile?.role === "denetmen" ? (
                        denetmenLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                            return (
                                <Link key={link.href} href={link.href}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 h-11 px-4 font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-gradient-to-r from-[#8B0000] to-[#A0522D] hover:from-[#6B0000] hover:to-[#8B0000] text-white hover:text-white shadow-md shadow-red-500/20"
                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-transform duration-200",
                                            isActive && "scale-110"
                                        )} />
                                        <span className="text-sm">{link.label}</span>
                                    </Button>
                                </Link>
                            );
                        })
                    ) : (
                        magazaLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                            return (
                                <Link key={link.href} href={link.href}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 h-11 px-4 font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-transform duration-200",
                                            isActive && "scale-110"
                                        )} />
                                        <span className="text-sm">{link.label}</span>
                                    </Button>
                                </Link>
                            );
                        })
                    )}
                </nav>
            </div>
        </div >
    );
}
