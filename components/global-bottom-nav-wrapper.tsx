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

    return <BottomNav />;
}
