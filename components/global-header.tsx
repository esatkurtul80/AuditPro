"use client";

import { useAuth } from "@/components/auth-provider";
import { HeaderActions } from "@/components/header-actions";
import { usePathname } from "next/navigation";

export function GlobalHeader() {
    const { userProfile, loading } = useAuth();
    const pathname = usePathname();

    // Don't show on login page
    if (pathname === "/login") return null;

    // Currently only hoisting for Store Users to ensure stability
    // Admin users can continue using DashboardLayout's header for now (complex sidebar logic)
    const isStoreUser = userProfile?.role === "magaza" || !!userProfile?.storeId;

    if (!isStoreUser) return null;

    // Don't render until loaded to prevent flash
    if (loading) return null;

    return (
        <div className="lg:hidden flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-40 w-full">
            {/* Left Area: Empty for Store Users (No Hamburger) */}
            <div className="w-10"></div>

            {/* Center: Logo */}
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-2xl font-playwrite-norge text-black dark:text-white">AuditPro</span>
            </div>

            {/* Right: Header actions */}
            <HeaderActions compact />
        </div>
    );
}
