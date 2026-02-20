"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SETTINGS_2FA_SESSION_KEY = "settings_2fa_verified";

export function SettingsCleanup() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname && !pathname.startsWith("/admin/settings")) {
            sessionStorage.removeItem(SETTINGS_2FA_SESSION_KEY);
        }
    }, [pathname]);

    return null;
}
