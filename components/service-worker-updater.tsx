"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ServiceWorkerUpdater() {
    const [showUpdate, setShowUpdate] = useState(false);
    const [latestVersion, setLatestVersion] = useState("");

    // Helper to perform the actual update cleanup and reload
    const performUpdate = async () => {
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
    };

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
                // Detection: Check if running in APK (Android + Standalone)
                // Note: User says they made web app as APK, likely TWA or added to homescreen.
                const isAndroid = /Android/i.test(navigator.userAgent);
                const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
                const isAPK = isAndroid && isStandalone;

                const response = await fetch('/api/version?t=' + new Date().getTime()); // Prevent caching
                if (!response.ok) return;
                
                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = process.env.NEXT_PUBLIC_APP_VERSION;

                if (serverVersion && localVersion && serverVersion !== localVersion) {
                    // Normalize versions for comparison if needed, or exact string match
                    
                    if (isAPK) {
                        // APK Specific: Show Dialog
                        setLatestVersion(serverVersion);
                        setShowUpdate(true);
                        return; // Stop here, wait for user action
                    }

                    // Non-APK (Web): Auto-Reload Logic
                    const reloadKey = `reload_attempt_${serverVersion}`;
                    const hasReloaded = sessionStorage.getItem(reloadKey);

                    if (!hasReloaded) {
                        console.log(`Version mismatch! Local: ${localVersion}, Server: ${serverVersion}. Reloading...`);
                        
                        // Mark as reloaded for this specific server version
                        sessionStorage.setItem(reloadKey, 'true');

                        await performUpdate();
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

    if (!showUpdate) return null;

    return (
        <AlertDialog open={showUpdate}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Güncelleme Mevcut</AlertDialogTitle>
                    <AlertDialogDescription>
                        Uygulamanın yeni sürümü ({latestVersion}) yayınlandı. En iyi deneyim için lütfen güncelleyin.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={performUpdate} className="gap-2">
                        <Download className="h-4 w-4" />
                        Güncelle ({latestVersion})
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
