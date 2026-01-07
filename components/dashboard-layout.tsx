"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { FloatingActionButton } from "@/components/floating-action-button";
import { BottomNav } from "@/components/bottom-nav";

export function DashboardLayout({ children, forceStoreLayout }: { children: React.ReactNode, forceStoreLayout?: boolean }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { userProfile } = useAuth();

    // Determine if we should show store layout (no hamburger, no sidebar overlay on mobile)
    const isStoreUser = forceStoreLayout || userProfile?.role === "magaza";

    const sidebarWidth = isSidebarCollapsed ? "lg:w-[70px]" : "lg:w-64";
    const mainPadding = isSidebarCollapsed ? "lg:pl-[70px]" : "lg:pl-64";

    return (
        <div className="min-h-screen bg-background pb-16 lg:pb-0">
            {/* Desktop Sidebar - Fixed Position */}
            <aside className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex ${sidebarWidth} lg:flex-col transition-all duration-300`}>
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
            </aside>

            {/* Mobile Header with all elements in one row */}
            <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40 relative">
                {/* Left Area: Hamburger (Hidden for Store Users) - Keep div for spacing */}
                <div className="flex items-center gap-2">
                    {!isStoreUser && (
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="shrink-0">
                            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    )}
                </div>

                {/* Center: Logo (Always Centered) */}
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="text-2xl font-playwrite-norge text-black dark:text-white">AuditPro</span>
                </div>

                {/* Right: Header actions */}
                <HeaderActions compact />
            </div>

            {/* Mobile Menu Overlay with smooth transition */}
            {!isStoreUser && (
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
                <div className="min-h-screen">
                    {children}
                </div>

                {/* Role-specific Floating Button */}
                {userProfile?.role === "denetmen" && <FloatingActionButton />}
            </main>

            {/* Store User Bottom Navigation - Persist on all pages using DashboardLayout */}
            {isStoreUser && <BottomNav />}
        </div>
    );
}
