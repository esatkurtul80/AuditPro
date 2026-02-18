"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
    CalendarDays,
    Calendar,
    Hotel,
    Paintbrush,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SendNotificationDialog } from "./admin/send-notification-dialog";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onLinkClick?: () => void;
    isCollapsed?: boolean;
    toggleSidebar?: () => void;
}

function SidebarContent({ className, onLinkClick, isCollapsed, toggleSidebar }: SidebarProps) {
    const { userProfile, loading } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isAuditMenuOpen, setIsAuditMenuOpen] = useState(false);
    const [isDenetmenAuditMenuOpen, setIsDenetmenAuditMenuOpen] = useState(false);
    const [isProgramMenuOpen, setIsProgramMenuOpen] = useState(false);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);
    const [isScheduleMenuOpen, setIsScheduleMenuOpen] = useState(false);
    // Removed isSettingsMenuOpen settings state as it is now a direct link
    const [unreadCount, setUnreadCount] = useState(0);

    // Define links and active states FIRST  
    const auditSubLinks = [
        { href: "/admin/audit-types", label: "Denetim Formları", icon: LayoutList },
        { href: "/admin/sections", label: "Denetim Bölümleri", icon: ClipboardList },
        { href: "/admin/questions", label: "Denetim Soruları", icon: FileQuestion },
    ];
    
    // Removed settingsSubLinks as they are no longer used in sidebar dropdown

    const reportsSubLinks = [
        { href: "/admin/reports/puan-raporu", label: "Puan Raporu", icon: BarChart3 },
        { href: "/admin/reports/questions", label: "Soru Raporları", icon: FileQuestion },
        { href: "/admin/reports/action-performance", label: "Aksiyon Raporu", icon: CheckCircle },
        { href: "/admin/reports/auditor-performance", label: "Denetçi Performansı", icon: Users },
        { href: "/admin/reports/auditor-timesheet", label: "Denetmen Puantajı", icon: Calendar },
        { href: "/admin/reports/special-report-design", label: "Özel Rapor Tasarımı", icon: Paintbrush },
    ];

    const scheduleSubLinks = [
        { href: "/admin/schedule", label: "Program", icon: CalendarDays },
        { href: "/admin/schedule/leave-types", label: "İzin Türleri", icon: ClipboardList },
        { href: "/admin/schedule/accommodation-types", label: "Konaklama Türleri", icon: Hotel },
    ];

    const actionsSubLinks = [
        { href: "/admin/actions?tab=pending_store", label: "Dönüş Yapmayanlar", icon: XCircle },
        { href: "/admin/actions?tab=pending_admin", label: "Onay Bekleyenler", icon: PlayCircle },
        { href: "/admin/actions?tab=approved", label: "Onaylananlar", icon: CheckCircle },
    ];

    const denetmenLinks = [
        { href: "/denetmen/panel", label: "Panel", icon: LayoutDashboard },
    ];

    const programSubLinks = [
        { href: "/denetmen/program/haftalik", label: "Denetim Programı", icon: CalendarDays },
    ];

    const denetimSubLinks = [
        { href: "/denetmen/tamamlanan", label: "Tamamlanan Denetimler", icon: CheckCircle },
        { href: "/denetmen/bekleyen", label: "Bekleyen Denetimler", icon: PlayCircle },
        { href: "/denetmen/iptal-edilen", label: "İptal Edilen Denetimler", icon: XCircle },
    ];

    const magazaLinks = [
        { href: "/magaza/panel", label: "Panel", icon: LayoutDashboard },
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

    const isProgramSectionActive = programSubLinks.some(
        link => pathname === link.href || pathname.startsWith(link.href + '/')
    );

    // Close submenus when sidebar is collapsed
    useEffect(() => {
        if (isCollapsed) {
            setIsAuditMenuOpen(false);
            setIsDenetmenAuditMenuOpen(false);
            setIsProgramMenuOpen(false);
            setIsActionsMenuOpen(false);
            setIsReportsMenuOpen(false);
            setIsScheduleMenuOpen(false);
        }
    }, [isCollapsed]);

    // Auto-open menus based on active path
    useEffect(() => {
        if (isAuditSectionActive) {
            setIsAuditMenuOpen(true);
        }
        if (isDenetmenAuditSectionActive) {
            setIsDenetmenAuditMenuOpen(true);
        }
        if (isProgramSectionActive) {
            setIsProgramMenuOpen(true);
        }
        // Auto-open Actions menu if on any actions page
        if (pathname.startsWith('/admin/actions')) {
            setIsActionsMenuOpen(true);
        }

        // Auto-open Reports menu if on any reports page
        if (pathname.startsWith('/admin/reports')) {
            setIsReportsMenuOpen(true);
        }

        // Auto-open Schedule menu if on any schedule page
        if (pathname.startsWith('/admin/schedule') || pathname.startsWith('/admin/create-auditor-schedule')) {
            setIsScheduleMenuOpen(true);
        }
    }, [pathname, isAuditSectionActive, isDenetmenAuditSectionActive, isProgramSectionActive]);

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
        { href: "/admin/stores", label: "Mağazalar", icon: Store },
        { href: "/admin/cop-kutusu", label: "Çöp Kutusu", icon: Trash2 },
    ];

    return (
        <div className={cn("flex flex-col h-screen border-r bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 transition-all duration-500", className)}>
            {/* Header / Brand */}
            <div className={cn("flex items-center h-16 border-b transition-all duration-500 gap-3", isCollapsed ? "justify-center px-2" : "justify-start px-6")}>
                {/* Version Badge - Always visible */}
                <div className={cn(
                    "flex items-center justify-center shrink-0 transition-all duration-500 relative",
                    isCollapsed ? "h-9 w-9" : "h-9 w-9"
                )}>
                    <img
                        src="/logo.png"
                        alt="AuditPro"
                        className="h-full w-full object-contain"
                    />
                </div>
                <span className={cn(
                    "text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap transition-all duration-500 ease-in-out origin-left",
                    isCollapsed
                        ? "opacity-0 w-0 -translate-x-5 overflow-hidden scale-90"
                        : "opacity-100 w-auto translate-x-0 scale-100"
                )}>
                    AuditPro
                </span>
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
                                        <div
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                isCollapsed ? "justify-center px-2" : "justify-start",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-500 shrink-0",
                                                isActive && "scale-110"
                                            )} />
                                            <span className={cn(
                                                "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                                isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                            )}>
                                                {link.label}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}

                            {/* Send Notification Button for Mobile/Sidebar Usage */}
                            <SendNotificationDialog
                                trigger={
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Optional: Close sidebar on mobile if needed, but Dialog acts as overlay
                                        }}
                                        className={cn(
                                            "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                            isCollapsed ? "justify-center px-2" : "justify-start",
                                            "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                        )}
                                        title={isCollapsed ? "Bildirim Gönder" : undefined}
                                    >
                                        <Bell className={cn(
                                            "h-5 w-5 transition-transform duration-500 shrink-0"
                                        )} />
                                        <span className={cn(
                                            "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                            isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                        )}>
                                            Bildirim Gönder
                                        </span>
                                    </button>
                                }
                            />


                            {/* Denetim Programı Dropdown */}
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (isCollapsed && toggleSidebar) {
                                            toggleSidebar();
                                            setTimeout(() => setIsScheduleMenuOpen(true), 100);
                                        } else {
                                            setIsScheduleMenuOpen(!isScheduleMenuOpen);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-500",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        pathname.startsWith("/admin/schedule")
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Denetim Programı" : undefined}
                                >
                                    <CalendarDays className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        pathname.startsWith("/admin/schedule") && "scale-110"
                                    )} />
                                    <div className={cn(
                                        "flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        <span className="text-sm text-left">Denetim Programı</span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform duration-500 shrink-0 ml-2",
                                            isScheduleMenuOpen && "rotate-180"
                                        )} />
                                    </div>
                                </Button>

                                {/* Sub Menu Items */}
                                {isScheduleMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {scheduleSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href;
                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <div
                                                        className={cn(
                                                            "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                        <span className="text-sm">{link.label}</span>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Aksiyonlar Dropdown */}
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (isCollapsed && toggleSidebar) {
                                            toggleSidebar();
                                            setTimeout(() => setIsActionsMenuOpen(true), 100);
                                        } else {
                                            setIsActionsMenuOpen(!isActionsMenuOpen);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-500",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        pathname.startsWith("/admin/actions")
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Aksiyonlar" : undefined}
                                >
                                    <CheckSquare className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        pathname.startsWith("/admin/actions") && "scale-110"
                                    )} />
                                    <div className={cn(
                                        "flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        <span className="text-sm text-left">Aksiyonlar</span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform duration-500 shrink-0 ml-2",
                                            isActionsMenuOpen && "rotate-180"
                                        )} />
                                    </div>
                                </Button>

                                {/* Sub Menu Items - Only show if open and NOT collapsed */}
                                {isActionsMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {actionsSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            // Check exact match for query params handling
                                            const currentTab = searchParams.get('tab') || 'pending_store';
                                            const linkTab = link.href.split('tab=')[1];
                                            const isActive = pathname === "/admin/actions" && currentTab === linkTab;

                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <div
                                                        className={cn(
                                                            "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                        <span className="text-sm">{link.label}</span>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Reports Dropdown */}
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (isCollapsed && toggleSidebar) {
                                            toggleSidebar();
                                            setTimeout(() => setIsReportsMenuOpen(true), 100);
                                        } else {
                                            setIsReportsMenuOpen(!isReportsMenuOpen);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-500",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        pathname.startsWith("/admin/reports")
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Raporlar" : undefined}
                                >
                                    <BarChart3 className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        pathname.startsWith("/admin/reports") && "scale-110"
                                    )} />
                                    <div className={cn(
                                        "flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        <span className="text-sm text-left">Raporlar</span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform duration-500 shrink-0 ml-2",
                                            isReportsMenuOpen && "rotate-180"
                                        )} />
                                    </div>
                                </Button>

                                {/* Sub Menu Items - Only show if open and NOT collapsed */}
                                {isReportsMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {reportsSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            // @ts-ignore
                                            if (link.href) {
                                                // @ts-ignore
                                                const isActive = pathname === link.href;
                                                return (
                                                    // @ts-ignore
                                                    <Link key={link.label} href={link.href} onClick={onLinkClick}>
                                                        <div
                                                            className={cn(
                                                                "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                                isActive
                                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                            )}
                                                        >
                                                            <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                            <span className="text-sm">{link.label}</span>
                                                        </div>
                                                    </Link>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={link.label}
                                                    className={cn(
                                                        "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-not-allowed opacity-50",
                                                        "text-slate-600 dark:text-slate-400 hover:bg-transparent"
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                    <span className="text-sm">{link.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

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
                                        "w-full h-11 px-4 font-medium transition-all duration-500",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        isAuditSectionActive
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Denetim Yönetimi" : undefined}
                                >
                                    <ClipboardList className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        isAuditSectionActive && "scale-110"
                                    )} />
                                    <div className={cn(
                                        "flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        <span className="text-sm text-left">Denetim Yönetimi</span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform duration-500 shrink-0 ml-2",
                                            isAuditMenuOpen && "rotate-180"
                                        )} />
                                    </div>
                                </Button>

                                {/* Sub Menu Items - Only show if open and NOT collapsed */}
                                {isAuditMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {auditSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <div
                                                        className={cn(
                                                            "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                        <span className="text-sm">{link.label}</span>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Ayarlar (Settings) - Direct Link */}
                            <Link href="/admin/settings" onClick={onLinkClick} title={isCollapsed ? "Ayarlar" : undefined}>
                                <div
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        pathname.startsWith("/admin/settings")
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                >
                                    {/* Used LayoutList as the icon previously, keeping it or swapping to generic Settings if imported, but sticking to existing icon for consistency within this file context without adding imports blindly */}
                                    <div className={cn(
                                        "flex items-center justify-center shrink-0",
                                    )}>
                                       <LayoutList className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        pathname.startsWith("/admin/settings") && "scale-110"
                                    )} />
                                    </div>
                                    <span className={cn(
                                        "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        Ayarlar
                                    </span>
                                </div>
                            </Link>
                        </>
                    ) : userProfile?.role === "bolge-muduru" ? (
                        <>
                            {bolgeMuduruLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                return (
                                    <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                        <div
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                isCollapsed ? "justify-center px-2" : "justify-start",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-500 shrink-0",
                                                isActive && "scale-110"
                                            )} />
                                            <span className={cn(
                                                "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                                isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                            )}>
                                                {link.label}
                                            </span>
                                        </div>
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
                                        <div
                                            className={cn(
                                                "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                isCollapsed ? "justify-center px-2" : "justify-start",
                                                isActive
                                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "h-5 w-5 transition-transform duration-500 shrink-0",
                                                isActive && "scale-110"
                                            )} />
                                            <span className={cn(
                                                "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                                isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                            )}>
                                                {link.label}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}

                            {/* Denetim Programı Single Button */}
                            <Link href="/denetmen/program/haftalik" onClick={onLinkClick} title={isCollapsed ? "Denetim Programı" : undefined}>
                                <div
                                    className={cn(
                                        "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        pathname.startsWith("/denetmen/program")
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                >
                                    <CalendarDays className={cn(
                                        "h-5 w-5 transition-transform duration-500 shrink-0",
                                        pathname.startsWith("/denetmen/program") && "scale-110"
                                    )} />
                                    <span className={cn(
                                        "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        Denetim Programı
                                    </span>
                                </div>
                            </Link>

                            {/* Denetimlerim Dropdown */}
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
                                        isCollapsed ? "justify-center px-2" : "justify-start",
                                        isDenetmenAuditSectionActive
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                    title={isCollapsed ? "Denetimlerim" : undefined}
                                >
                                    <ClipboardList className={cn(
                                        "h-5 w-5 transition-transform duration-200 shrink-0",
                                        isDenetmenAuditSectionActive && "scale-110"
                                    )} />
                                    <div className={cn(
                                        "flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                        isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                    )}>
                                        <span className="text-sm text-left">Denetimlerim</span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform duration-200 shrink-0 ml-2",
                                            isDenetmenAuditMenuOpen && "rotate-180"
                                        )} />
                                    </div>
                                </Button>

                                {isDenetmenAuditMenuOpen && !isCollapsed && (
                                    <div className="ml-4 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                                        {denetimSubLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                            return (
                                                <Link key={link.href} href={link.href} onClick={onLinkClick}>
                                                    <div
                                                        className={cn(
                                                            "w-full justify-start h-10 px-3 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                                            isActive
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0 mr-3" />
                                                        <span className="text-sm">{link.label}</span>
                                                    </div>
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
                            // @ts-ignore
                            const isExact = link.exact;
                            // @ts-ignore
                            const href = link.href;

                            const isActive = isExact
                                ? pathname === href
                                : pathname === href || pathname.startsWith(href + '/');
                            return (
                                <Link key={link.href} href={link.href} onClick={onLinkClick} title={isCollapsed ? link.label : undefined}>
                                    <div
                                        className={cn(
                                            "w-full h-11 px-4 font-medium transition-all duration-500 flex items-center rounded-md cursor-pointer",
                                            isCollapsed ? "justify-center px-2" : "justify-start",
                                            isActive
                                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-transform duration-500 shrink-0",
                                            isActive && "scale-110"
                                        )} />
                                        <span className={cn(
                                            "text-sm whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden origin-left",
                                            isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"
                                        )}>
                                            {link.label}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </nav>
            </div>
        </div >
    );
}

export function Sidebar(props: SidebarProps) {
    return (
        <Suspense fallback={<div className="w-[70px] bg-white h-screen border-r" />}>
            <SidebarContent {...props} />
        </Suspense>
    );
}
