"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";

// Session key for Settings 2FA - must match the one in settings/layout.tsx
const SETTINGS_2FA_SESSION_KEY = "settings_2fa_verified";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Clear settings 2FA session when navigating away from settings
    useEffect(() => {
        if (pathname && !pathname.startsWith("/admin/settings")) {
            sessionStorage.removeItem(SETTINGS_2FA_SESSION_KEY);
        }
    }, [pathname]);

    return (
        <DashboardLayout>
            <ProtectedRoute allowedRoles={["admin"]}>
                {children}
            </ProtectedRoute>
        </DashboardLayout>
    );
}
