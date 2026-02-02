"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { HeaderActions } from "@/components/header-actions";
import { usePathname } from "next/navigation";
import { MobileDebugLogger } from "@/components/mobile-debug-logger";

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

    // Currently only hoisting for Store Users to ensure stability
    // Admin users can continue using DashboardLayout's header for now (complex sidebar logic)
    const isStoreUser = userProfile?.role === "magaza" || !!userProfile?.storeId;

    if (!isStoreUser) return null;

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
            {/* Left Area: Empty for Store Users (No Hamburger) */}
            <div className="w-10"></div>

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
