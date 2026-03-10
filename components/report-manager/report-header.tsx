"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Bell, User, Menu, X, LogOut, BarChart2 } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReportSidebar } from "./report-sidebar";

type ReportTab = "panel" | "personel" | "puan" | "soru" | "aksiyon" | "denetci" | "program";

interface ReportHeaderProps {
    activeTab: ReportTab;
    onTabChange: (tab: ReportTab) => void;
}

export function ReportManagerHeader({ activeTab, onTabChange }: ReportHeaderProps) {
    const { userProfile, signOut } = useAuth();
    const isOnline = useOnlineStatus();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            {/* Mobile Header */}
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

                {/* Center: Logo */}
                <div className="absolute left-1/2 -translate-x-1/2 select-none pointer-events-none flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-primary" />
                    <span className="text-lg font-bold tracking-tight text-foreground">Yönetici</span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 md:mr-2">
                        <OnlineStatusBadge isOnline={isOnline} compact={true} />
                    </div>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-emerald-600 text-white text-xs font-medium">
                                        {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "R"}
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

            {/* Desktop Header */}
            <div className="hidden lg:block sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-full items-center justify-between px-4">
                    <div className="flex-1 flex items-center gap-3">
                        <BarChart2 className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-lg font-semibold">Yönetici Paneli</h2>
                        <p className="text-xs text-muted-foreground">
                            {userProfile?.firstName} {userProfile?.lastName}
                        </p>
                    </div>

                    <div className="flex items-center gap-1">
                        <OnlineStatusBadge isOnline={isOnline} compact={false} />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-emerald-600 text-white text-xs font-medium">
                                            {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "R"}
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

            {/* Mobile Sidebar Overlay */}
            <div
                className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
            >
                <div className="fixed inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
                <div
                    className={`fixed inset-y-0 left-0 w-[72%] max-w-[300px] bg-background shadow-2xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                        }`}
                >
                    <ReportSidebar
                        activeTab={activeTab}
                        onTabChange={(tab) => {
                            onTabChange(tab);
                            setIsMobileMenuOpen(false);
                        }}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-3"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </>
    );
}
