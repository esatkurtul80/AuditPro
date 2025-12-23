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
    XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onLinkClick?: () => void;
    isCollapsed?: boolean;
    toggleSidebar?: () => void;
}

export function Sidebar({ className, onLinkClick, isCollapsed, toggleSidebar }: SidebarProps) {
    const { userProfile, loading } = useAuth();
    const pathname = usePathname();
    const [isAuditMenuOpen, setIsAuditMenuOpen] = useState(true);
    const [isDenetmenAuditMenuOpen, setIsDenetmenAuditMenuOpen] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    // Auto-expand if collapsed is turned off
    useEffect(() => {
        if (!isCollapsed) {
            setIsAuditMenuOpen(true);
            setIsDenetmenAuditMenuOpen(true);
        } else {
            setIsAuditMenuOpen(false);
            setIsDenetmenAuditMenuOpen(false);
        }
    }, [isCollapsed]);

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
    ];

    const denetimSubLinks = [
        { href: "/denetmen/tamamlanan", label: "Tamamlanan Denetimler", icon: CheckCircle },
        { href: "/denetmen/bekleyen", label: "Bekleyen Denetimler", icon: PlayCircle },
        { href: "/denetmen/iptal-edilen", label: "İptal Edilen Denetimler", icon: XCircle },
    ];

    const magazaLinks = [
        { href: "/magaza", label: "Aksiyonlarım", icon: CheckSquare },
    ];

    const bolgeMuduruLinks = [
        { href: "/bolge-muduru", label: "Panel", icon: LayoutDashboard },
    ];

    const isAuditSectionActive = auditSubLinks.some(
        link => pathname === link.href || pathname.startsWith(link.href + '/')
    );

    const isDenetmenAuditSectionActive = denetimSubLinks.some(
        link => pathname === link.href || pathname.startsWith(link.href + '/')
    );

    return (
        <div className={cn("flex flex-col h-screen border-r bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 transition-all duration-300", className)}>
            {/* Header / Brand */}
            <div className={cn("flex items-center justify-center h-16 border-b transition-all duration-300", isCollapsed ? "px-2" : "px-4")}>
                {/* Version Badge - Always visible */}
                <div className={cn(
                    "flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 shadow-lg shadow-purple-500/30 shrink-0 transition-all duration-300",
                    isCollapsed ? "h-9 w-9" : "h-10 w-10"
                )}>
                    <span className={cn("font-bold text-white", isCollapsed ? "text-[10px]" : "text-xs")}>
                        {isCollapsed ? "A" : "v1.9"}
                    </span>
                </div>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
                <nav className="space-y-1">
                    {loading ? (
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
                                    <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-200",
                                                isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-200",
                                                isActive && "scale-110"
                                            )} />
                                            {!isCollapsed && <span className="text-sm">{link.label}</span>}
                                        </Button>
                                    </Link>
                                );
                            })}

                            {/* Denetim Yönetimi Dropdown */}
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (isCollapsed && toggleSidebar) {
                                            toggleSidebar();
                                            setTimeout(() => setIsAuditMenuOpen(true), 100);
                                        } else {
                                            setIsAuditMenuOpen(!isAuditMenuOpen);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-200",
                                        isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                        isAuditSectionActive
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Denetim Yönetimi" : undefined}
                                >
                                    <ClipboardList className={cn(
                                        "h-5 w-5 transition-transform duration-200",
                                        isAuditSectionActive && "scale-110"
                                    )} />
                                    {!isCollapsed && (
                                        <>
                                            <span className="text-sm flex-1 text-left">Denetim Yönetimi</span>
                                            <ChevronDown className={cn(
                                                "h-4 w-4 transition-transform duration-200",
                                                isAuditMenuOpen && "rotate-180"
                                            )} />
                                        </>
                                    )}
                                </Button>

                                {/* Sub Menu Items - Only show if open and NOT collapsed */}
                                {isAuditMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {auditSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "w-full justify-start gap-3 h-10 px-3 font-medium transition-all duration-200",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
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
                                    <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-200",
                                                isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-200",
                                                isActive && "scale-110"
                                            )} />
                                            {!isCollapsed && <span className="text-sm">{link.label}</span>}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </>
                    ) : userProfile?.role === "denetmen" ? (
                        <>
                            {denetmenLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                return (
                                    <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-200",
                                                isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-200",
                                                isActive && "scale-110"
                                            )} />
                                            {!isCollapsed && <span className="text-sm">{link.label}</span>}
                                        </Button>
                                    </Link>
                                );
                            })}

                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (isCollapsed && toggleSidebar) {
                                            toggleSidebar();
                                            setTimeout(() => setIsDenetmenAuditMenuOpen(true), 100);
                                        } else {
                                            setIsDenetmenAuditMenuOpen(!isDenetmenAuditMenuOpen);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-200",
                                        isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                        isDenetmenAuditSectionActive
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Denetimlerim" : undefined}
                                >
                                    <ClipboardList className={cn(
                                        "h-5 w-5 transition-transform duration-200",
                                        isDenetmenAuditSectionActive && "scale-110"
                                    )} />
                                    {!isCollapsed && (
                                        <>
                                            <span className="text-sm flex-1 text-left">Denetimlerim</span>
                                            <ChevronDown className={cn(
                                                "h-4 w-4 transition-transform duration-200",
                                                isDenetmenAuditMenuOpen && "rotate-180"
                                            )} />
                                        </>
                                    )}
                                </Button>

                                {isDenetmenAuditMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {denetimSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "w-full justify-start gap-3 h-10 px-3 font-medium transition-all duration-200",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
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
                    ) : (
                        magazaLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                            return (
                                <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full h-11 px-4 font-medium transition-all duration-200",
                                            isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                                            isActive
                                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-transform duration-200",
                                            isActive && "scale-110"
                                        )} />
                                        {!isCollapsed && <span className="text-sm">{link.label}</span>}
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
