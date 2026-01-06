"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
    useEffect(() => {
        // Disabled aggressive auto-update check to prevent loops
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Register the service worker to ensure PWA functionality works correctly on Android
            navigator.serviceWorker
                .register("/firebase-messaging-sw.js")
                .then((registration) => {
                    console.log("Service Worker registered with scope:", registration.scope);
                })
                .catch((err) => {
                    console.error("Service Worker registration failed:", err);
                });
        }
    }, []);

    return null;
}
