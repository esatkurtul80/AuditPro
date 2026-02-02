"use client";

import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { usePathname } from "next/navigation";

export function GlobalBottomNavWrapper() {
    const { userProfile } = useAuth();
    const pathname = usePathname();

    // Only show for 'magaza' role
    if (userProfile?.role !== "magaza") return null;

    // Don't show on login page (just in case)
    if (pathname === "/login") return null;

    // Don't show on the new single-view store panel (it has its own nav)
    if (pathname === "/magaza/panel") return null;

    return <BottomNav />;
}
