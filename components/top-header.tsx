"use client";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { CheckSquare, Zap, PanelLeft, BellRing, Sparkles, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { SendNotificationDialog } from "./admin/send-notification-dialog";
import { AIAnalysisDialog } from "./admin/ai-analysis-dialog";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
    NavigationMenuLink,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

interface TopHeaderProps {
    toggleSidebar?: () => void;
    isCollapsed?: boolean;
}

export function TopHeader({ toggleSidebar, isCollapsed }: TopHeaderProps) {
    const router = useRouter();
    const { userProfile } = useAuth();

    return (
        <>
            {/* Full-width border underneath sidebar + header */}
            <div className="sticky top-0 z-40 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-full items-center justify-between px-4">
                    {/* Left: Sidebar Toggle + Navigation Buttons */}
                    <div className="flex-1 flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className="text-muted-foreground mr-2"
                            title={isCollapsed ? "Menüyü Aç" : "Menüyü Daralt"}
                        >
                            <PanelLeft className="h-5 w-5" />
                        </Button>

                        {userProfile && userProfile.role !== "magaza" && userProfile.role !== "denetmen" && (
                            <Button
                                variant="ghost"
                                className="hidden xl:flex gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                onClick={() => router.push("/admin/actions?tab=pending_admin")}
                            >
                                <Zap className="h-4 w-4" />
                                AKSİYONLAR
                            </Button>
                        )}

                        {userProfile?.role === "admin" && (
                            <div className="hidden md:flex items-center gap-2">
                                <SendNotificationDialog
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            className="gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <BellRing className="h-4 w-4" />
                                            BİLDİRİM GÖNDER
                                        </Button>
                                    }
                                />
                                <AIAnalysisDialog
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            className="gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <Sparkles className="h-4 w-4" />
                                            AI ANALİZ
                                        </Button>
                                    }
                                />
                                <Button
                                    variant="ghost"
                                    className="gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    onClick={() => router.push("/admin/schedule")}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    DENETİM PROGRAMI
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right: Header actions */}
                    <HeaderActions />
                </div>
            </div>
        </>
    );
}
