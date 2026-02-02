"use client";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { CheckSquare, Zap, PanelLeft, BellRing, Sparkles, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { SendNotificationDialog } from "./admin/send-notification-dialog";
import { AIAnalysisDialog } from "./admin/ai-analysis-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Clock, AlertCircle, CheckCircle, CalendarOff, Home, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";


interface TopHeaderProps {
    toggleSidebar?: () => void;
    isCollapsed?: boolean;
}

export function TopHeader({ toggleSidebar, isCollapsed }: TopHeaderProps) {
    const router = useRouter();
    const { userProfile } = useAuth();
    const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);

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

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="hidden xl:flex gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                        <Zap className="h-4 w-4" />
                                        AKSİYONLAR
                                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[300px]">
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/actions?tab=pending_store" className="flex items-start gap-3 p-2 cursor-pointer">
                                            <div className="mt-1"><Clock className="h-5 w-5 text-orange-500" /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Dönüş Yapmayanlar</span>
                                                <span className="text-xs text-muted-foreground">Mağazadan aksiyon dönüşü beklenen denetimler</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/actions?tab=pending_admin" className="flex items-start gap-3 p-2 cursor-pointer">
                                            <div className="mt-1"><AlertCircle className="h-5 w-5 text-blue-500" /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Onay Bekleyenler</span>
                                                <span className="text-xs text-muted-foreground">Onayınızı bekleyen denetim aksiyonları</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/actions?tab=approved" className="flex items-start gap-3 p-2 cursor-pointer">
                                            <div className="mt-1"><CheckCircle className="h-5 w-5 text-green-500" /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Onaylananlar</span>
                                                <span className="text-xs text-muted-foreground">Tüm aksiyonları tamamlanmış denetimler</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {userProfile?.role === "admin" && (
                            <div className="hidden md:flex items-center gap-2">
                                <SendNotificationDialog 
                                    open={isNotificationDialogOpen} 
                                    onOpenChange={setIsNotificationDialogOpen}
                                    trigger={<span className="hidden" />}
                                />
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <BellRing className="h-4 w-4" />
                                            BİLDİRİM GÖNDER
                                            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[300px]">
                                        <DropdownMenuItem 
                                            className="cursor-pointer p-0"
                                            onClick={() => setIsNotificationDialogOpen(true)}
                                        >
                                            <div className="flex items-start gap-3 p-2 w-full">
                                                <div className="mt-1"><BellRing className="h-5 w-5 text-blue-600" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">Bildirim Gönder</span>
                                                    <span className="text-xs text-muted-foreground">Kullanıcılara anlık bildirim gönderin</span>
                                                </div>
                                            </div>
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem 
                                            className="cursor-pointer p-0"
                                            onClick={() => router.push("/admin/announcements")}
                                        >
                                            <div className="flex items-start gap-3 p-2 w-full">
                                                <div className="mt-1"><Info className="h-5 w-5 text-blue-500" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">Bilgilendirme Gönder</span>
                                                    <span className="text-xs text-muted-foreground">Duyuru ve bilgilendirme yayınlayın</span>
                                                </div>
                                            </div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="gap-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                            DENETİM PROGRAMI
                                            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[300px]">
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/schedule" className="flex items-start gap-3 p-2 cursor-pointer">
                                                <div className="mt-1"><CalendarDays className="h-5 w-5 text-purple-500" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">Program</span>
                                                    <span className="text-xs text-muted-foreground">Aylık denetim planı ve takvimi</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/schedule/leave-types" className="flex items-start gap-3 p-2 cursor-pointer">
                                                <div className="mt-1"><CalendarOff className="h-5 w-5 text-red-500" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">İzin Türleri</span>
                                                    <span className="text-xs text-muted-foreground">Yıllık izin, rapor vb. tanımları</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/schedule/accommodation-types" className="flex items-start gap-3 p-2 cursor-pointer">
                                                <div className="mt-1"><Home className="h-5 w-5 text-blue-500" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">Konaklama Türleri</span>
                                                    <span className="text-xs text-muted-foreground">Otel ve konaklama tipi tanımları</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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



