"use client";

import { useState, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { FloatingActionButton } from "@/components/floating-action-button";
import { usePathname } from "next/navigation";
import { MobileDebugLogger } from "@/components/mobile-debug-logger";

export function DashboardLayout({ children, forceStoreLayout, initialRole }: { children: React.ReactNode, forceStoreLayout?: boolean, initialRole?: string | null }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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

    // Determine if we should show store layout (no hamburger, no sidebar overlay on mobile)
    // CRITICAL for Hydration: We MUST use initialRole as a fallback so that the server renders the same HTML as the client.
    const effectiveRole = userProfile?.role ?? initialRole;
    
    const isStoreUser = forceStoreLayout || effectiveRole === "magaza" || effectiveRole === "bolge-muduru" || (!!userProfile?.storeId);

    // Optimistically show auditor layout elements to prevent layout shift
    const hasAuditorProfile = effectiveRole === "denetmen" || effectiveRole === "admin";
    const isOptimisticAuditor = loading && !effectiveRole && pathname?.startsWith("/denetmen");

    // Prevent flash of hamburger menu during loading
    // Show if (Not Store AND (Loaded OR HasAuditorProfile OR Optimistic))
    const showHamburger = (!isStoreUser && (!loading || hasAuditorProfile || isOptimisticAuditor));

    const sidebarWidth = isSidebarCollapsed ? "lg:w-[70px]" : "lg:w-64";
    const mainPadding = isSidebarCollapsed ? "lg:pl-[70px]" : "lg:pl-64";

    return (
        <div className="h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar - Fixed Position */}
            <aside className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex ${sidebarWidth} lg:flex-col transition-all duration-300`}>
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    initialRole={initialRole}
                />
            </aside>

            {/* Mobile Header with all elements in one row - HIDDEN FOR STORE USERS (GlobalHeader used instead) */}
            {showHamburger && (
                <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40 relative">
                    {/* Left Area: Hamburger (Hidden for Store Users) - Keep div for spacing */}
                    <div className="flex items-center gap-2">
                        {showHamburger && (
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="shrink-0">
                                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </Button>
                        )}
                    </div>

                    {/* Center: Logo (Always Centered) - Tap 10x for Debug Logger */}
                    <div 
                        className="absolute left-[37%] sm:left-1/2 -translate-x-1/2 cursor-pointer select-none"
                        onClick={handleLogoTap}
                        onTouchEnd={(e) => { e.preventDefault(); handleLogoTap(); }}
                    >
                        <span className="text-2xl font-playwrite-norge text-black dark:text-white">AuditPro</span>
                    </div>

                    {/* Right: Header actions */}
                    <HeaderActions compact />
                </div>
            )}

            {/* Mobile Menu Overlay with smooth transition */}
            {showHamburger && (
                <div
                    className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                >
                    <div className="fixed inset-0 bg-black/80" onClick={() => setIsMobileMenuOpen(false)} />
                    <div
                        className={`fixed inset-y-0 left-0 w-[65%] max-w-[280px] bg-background p-0 shadow-lg transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
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
            )}

            {/* Main Content */}
            <main className={`${mainPadding} transition-all duration-300`}>
                {/* Top Header - Only show on desktop */}
                <div className="hidden lg:block sticky top-0 z-40">
                    <TopHeader toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} isCollapsed={isSidebarCollapsed} />
                </div>

                {/* Page Content */}
                <div id="main-content-scroll-area" className="h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] overflow-y-auto overscroll-y-contain pb-20 lg:pb-0">
                    {children}
                </div>

                {/* Role-specific Floating Button - Show if denetmen OR if loading and we think it's denetmen route */}
                {(userProfile?.role === "denetmen" || (loading && pathname?.startsWith("/denetmen"))) && <FloatingActionButton />}
            </main>
            
            {/* Mobile Debug Logger Modal */}
            <MobileDebugLogger open={showDebugger} onClose={() => setShowDebugger(false)} />
        </div>
    );
}
