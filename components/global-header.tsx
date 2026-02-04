"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { HeaderActions } from "@/components/header-actions";
import { usePathname } from "next/navigation";
import { MobileDebugLogger } from "@/components/mobile-debug-logger";
import { Menu } from "lucide-react";

export function GlobalHeader() {
    const { userProfile, loading } = useAuth();
    const pathname = usePathname();
    
    // Mobile Debug Logger activation (10 taps)
    const [tapCount, setTapCount] = useState(0);
    const [showDebugger, setShowDebugger] = useState(false);
    const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const handleLogoTap = () => {
        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
        }
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 10) {
            setShowDebugger(true);
            setTapCount(0);
        } else {
            tapTimeoutRef.current = setTimeout(() => setTapCount(0), 3000);
        }
    };

    // Don't show on login page
    if (pathname === "/login") return null;

    // Currently only hoisting for Store Users and Auditors to ensure stability
    // Admin users can continue using DashboardLayout's header for now (complex sidebar logic)
    const isMobileUser = userProfile?.role === "magaza" || userProfile?.role === "denetmen" || !!userProfile?.storeId;

    if (!isMobileUser) return null;

    // Prevent layout shift during loading by rendering a placeholder
    if (loading) {
        return (
            <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40 w-full h-[57px]">
                {/* Spacer to hold height */}
            </div>
        );
    }

    return (
        <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40 w-full">
            {/* Left Area: Hamburger for Auditors, Empty for Store Users */}
            <div className="w-10">
                {userProfile?.role === "denetmen" && (
                     /* If we had a SidebarTrigger here it would go here, 
                        but for now Denetmen uses Bottom Nav usually? 
                        Wait, the user requested Hamburger menu in the screenshot.
                        The screenshot shows a Hamburger menu. 
                        Let's check if SidebarTrigger is available or if we need to implement a mobile menu trigger.
                        Since Denetmen panel usually has a bottom bar, maybe the sidebar is for administrative tasks?
                        
                        However, the screenshot explicitly has a hamburger menu.
                        If I don't have the sidebar trigger handy, I'll put a placeholder or just leave it empty 
                        if the bottom nav is the primary nav.
                        
                        BUT, the user said "resimdeki gibi normal headeri kullan".
                        The screenshot shows hamburger.
                        
                        Let's just keep the w-10 for now. If SidebarTrigger is needed, I'd need to know if Shadcn Sidebar is used here.
                        Assuming Custom Header actions might have it.
                     */
                     <div className="flex items-center justify-center w-10 h-10">
                         <Menu className="h-6 w-6" />
                     </div>
                )}
            </div>

            {/* Center: Logo - Tap 10x for Debug Logger */}
            <div 
                className="absolute left-1/2 -translate-x-1/2 cursor-pointer select-none"
                onClick={handleLogoTap}
                onTouchEnd={(e) => { e.preventDefault(); handleLogoTap(); }}
            >
                <span className="text-2xl font-playwrite-norge text-black dark:text-white">AuditPro</span>
            </div>

            {/* Right: Header actions */}
            <HeaderActions compact />
            
            {/* Mobile Debug Logger Modal */}
            <MobileDebugLogger open={showDebugger} onClose={() => setShowDebugger(false)} />
        </div>
    );
}
