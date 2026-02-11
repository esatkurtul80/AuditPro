"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Bell, User, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlineStatusBadge } from "@/components/online-status-badge";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "@/components/sidebar";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function RegionalManagerHeader() {
    const { userProfile, signOut } = useAuth();
    const isOnline = useOnlineStatus();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadCount] = useState(0); // Can be implemented later with notification subscription

    // Mobile Debug Logger activation (10 taps)
    const [tapCount, setTapCount] = useState(0);
    const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const handleLogoTap = () => {
        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
        }
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 10) {
            // Debug logger can be added here if needed
            setTapCount(0);
        } else {
            tapTimeoutRef.current = setTimeout(() => setTapCount(0), 3000);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "U";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
        toast.success("Çıkış yapıldı");
    };

    return (
        <>
            {/* Mobile Header - Matches Auditor Panel Style */}
            <div className="lg:hidden flex items-center justify-between gap-2 p-2.5 border-b bg-background/95 backdrop-blur sticky top-0 z-40 relative">
                {/* Left: Hamburger Menu */}
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                        className="shrink-0"
                    >
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                </div>

                {/* Center: Logo (Always Centered) - Tap 10x for Debug Logger */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 cursor-pointer select-none"
                    onClick={handleLogoTap}
                    onTouchEnd={(e) => { e.preventDefault(); handleLogoTap(); }}
                >
                    <span className="text-2xl font-playwrite-norge text-black dark:text-white">AuditPro</span>
                </div>

                {/* Right: Header actions - WITHOUT location icon */}
                <div className="flex items-center gap-1">
                    {/* Online Status ONLY - No Location */}
                    <div className="flex items-center gap-1 md:mr-2">
                        <OnlineStatusBadge isOnline={isOnline} compact={true} />
                    </div>

                    {/* Notifications Button */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative h-8 w-8 rounded-full border bg-background hover:bg-accent"
                            >
                                <Bell className="h-4 w-4" />
                                {unreadCount > 0 && (
                                    <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-1 ring-white dark:ring-black">
                                        <span className="sr-only">{unreadCount}</span>
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                            <DropdownMenuItem onClick={() => router.push("/notifications")}>
                                <Bell className="mr-2 h-4 w-4" />
                                Bildirimler {unreadCount > 0 && `(${unreadCount})`}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-blue-600 text-white text-xs font-medium">
                                        {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "U"}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel>
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium">{userProfile?.displayName || "Kullanıcı"}</p>
                                    <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push("/profile")}>
                                <User className="mr-2 h-4 w-4" />
                                Profil
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="text-red-600 focus:text-red-600"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Çıkış Yap
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Desktop Header - Hidden on mobile, shows sidebar nav on lg+ */}
            <div className="hidden lg:block sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-full items-center justify-between px-4">
                    <div className="flex-1 flex items-center gap-3">
                        <h2 className="text-lg font-semibold">Bölge Müdürü Paneli</h2>
                        <p className="text-xs text-muted-foreground">
                            {userProfile?.firstName} {userProfile?.lastName}
                        </p>
                    </div>

                    {/* Desktop: Same header actions */}
                    <div className="flex items-center gap-1">
                        <OnlineStatusBadge isOnline={isOnline} compact={false} />
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative h-8 w-8 rounded-full border bg-background hover:bg-accent"
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-1 ring-white dark:ring-black">
                                            <span className="sr-only">{unreadCount}</span>
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                                <DropdownMenuItem onClick={() => router.push("/notifications")}>
                                    <Bell className="mr-2 h-4 w-4" />
                                    Bildirimler
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-blue-600 text-white text-xs font-medium">
                                            {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{userProfile?.displayName || "Kullanıcı"}</p>
                                        <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push("/profile")}>
                                    <User className="mr-2 h-4 w-4" />
                                    Profil
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Çıkış Yap
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay with smooth transition */}
            <div
                className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
                    isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            >
                <div className="fixed inset-0 bg-black/80" onClick={() => setIsMobileMenuOpen(false)} />
                <div
                    className={`fixed inset-y-0 left-0 w-[65%] max-w-[280px] bg-background p-0 shadow-lg transform transition-transform duration-300 ease-in-out ${
                        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <Sidebar className="border-none" onLinkClick={() => setIsMobileMenuOpen(false)} />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </>
    );
}
