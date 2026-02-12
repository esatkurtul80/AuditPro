"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
    useEffect(() => {
        // Simple logic: If this is the first time loading in this session, force a reload.
        // This ensures that when the APK is opened (fresh session), we get the latest content.
        try {
            const hasReloaded = sessionStorage.getItem('app_init_refresh');
            
            // Skip in dev
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return;
            }

            if (!hasReloaded) {
                sessionStorage.setItem('app_init_refresh', 'true');
                window.location.reload();
            }
        } catch (e) {
            console.error("Auto-reload error:", e);
        }
    }, []);

    return null; 
}
