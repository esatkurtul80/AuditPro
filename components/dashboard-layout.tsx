"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar - Fixed Position */}
            <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
                <Sidebar />
            </aside>

            {/* Mobile Header with all elements in one row */}
            <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40">
                {/* Left: Hamburger */}
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="shrink-0">
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>

                {/* Center: Logo */}
                <div className="absolute left-1/2 -translate-x-1/2">
                    <span className="text-2xl font-playwrite-norge text-[#8B0000] dark:text-white">AuditPro</span>
                </div>

                {/* Right: Header actions (online status, notifications, theme, profile) */}
                <HeaderActions compact />
            </div>

            {/* Mobile Menu Overlay with smooth transition */}
            <div
                className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <div className="fixed inset-0 bg-black/80" onClick={() => setIsMobileMenuOpen(false)} />
                <div
                    className={`fixed inset-y-0 left-0 w-[80%] max-w-sm bg-background p-0 shadow-lg transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    <Sidebar className="border-none" />
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

            {/* Main Content */}
            <main className="lg:pl-64">
                {/* Top Header - Only show on desktop */}
                <div className="hidden lg:block">
                    <TopHeader />
                </div>

                {/* Page Content */}
                <div className="min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    );
}
