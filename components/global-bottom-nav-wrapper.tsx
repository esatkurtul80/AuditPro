"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { usePathname } from "next/navigation";

export function GlobalBottomNavWrapper() {
    const { userProfile } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch: Server doesn't have the role from localStorage
    if (!mounted) return null;

    // Only show for 'magaza' role
    if (userProfile?.role !== "magaza") return null;

    // Don't show on login page (just in case)
    if (pathname === "/login") return null;

    // Don't show on the new single-view store panel (it has its own nav)
    if (pathname?.startsWith("/magaza/panel")) return null;

    return <BottomNav />;
}
