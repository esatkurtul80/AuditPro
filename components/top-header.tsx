"use client";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { CheckSquare, Zap, PanelLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopHeaderProps {
    toggleSidebar?: () => void;
    isCollapsed?: boolean;
}

export function TopHeader({ toggleSidebar, isCollapsed }: TopHeaderProps) {
    const router = useRouter();

    return (
        <>
            {/* Full-width border underneath sidebar + header */}
            <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between px-4">
                    {/* Left: Sidebar Toggle + Actions Button */}
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

                        <Button
                            variant="default"
                            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            onClick={() => router.push("/admin/actions")}
                        >
                            <Zap className="h-4 w-4" />
                            AKSİYONLAR
                        </Button>
                    </div>

                    {/* Right: Header actions */}
                    <HeaderActions />
                </div>
            </div>
        </>
    );
}

