"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
    useEffect(() => {
        // 1. Service Worker Registration
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/firebase-messaging-sw.js")
                .then((registration) => {
                    console.log("Service Worker registered with scope:", registration.scope);
                })
                .catch((err) => {
                    console.error("Service Worker registration failed:", err);
                });
        }

        // 2. Aggressive Version Check
        const checkVersion = async () => {
            try {
                const response = await fetch('/api/version?t=' + new Date().getTime()); // Prevent caching
                if (!response.ok) return;
                
                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = process.env.NEXT_PUBLIC_APP_VERSION;

                if (serverVersion && localVersion && serverVersion !== localVersion) {
                    const reloadKey = `reload_attempt_${serverVersion}`;
                    const hasReloaded = sessionStorage.getItem(reloadKey);

                    if (!hasReloaded) {
                        console.log(`Version mismatch! Local: ${localVersion}, Server: ${serverVersion}. Reloading...`);
                        
                        // Mark as reloaded for this specific server version
                        sessionStorage.setItem(reloadKey, 'true');

                        // Unregister all service workers
                        if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (const registration of registrations) {
                                await registration.unregister();
                            }
                        }

                        // Clear cache storage
                        if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                        }

                        // Hard reload
                        window.location.reload();
                    } else {
                        console.warn(`Version mismatch (${localVersion} vs ${serverVersion}) detected but already reloaded once. Stopping loop.`);
                    }
                }
            } catch (error) {
                console.error("Failed to check version:", error);
            }
        };

        // Check immediately on mount
        checkVersion();

        // Check when app comes to foreground (APK Re-open)
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkVersion();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return null;
}
