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
import { Button } from "@/components/ui/button";

export function ServiceWorkerUpdater() {
    const [showUpdate, setShowUpdate] = useState(false);
    const [latestVersion, setLatestVersion] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);

    // Helper to perform the actual update cleanup and reload
    const performUpdate = async () => {
         setIsUpdating(true);
         setProgress(10); // Start

         // 1. Unregister Service Workers
         if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            } catch (e) {
                console.error("SW unregister error:", e);
            }
        }
        setProgress(40); // SW Unregistered based on await

        // 2. Wait a bit to ensure browser processes it (Simulation for UX)
        await new Promise(resolve => setTimeout(resolve, 800));
        setProgress(60);

        // 3. Clear Cache
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {
                console.error("Cache clear error:", e);
            }
        }
        setProgress(90); // Cache Cleared

        // 4. Final waiting and reload
        await new Promise(resolve => setTimeout(resolve, 500));
        setProgress(100);

        // Reload
        // Reload with cache busting
        window.location.href = window.location.origin + window.location.pathname + '?update_t=' + Date.now();
        // Fallback reload if href assignment doesn't trigger immediately
        setTimeout(() => {
             window.location.reload();
        }, 100);
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
                const isAndroid = /Android/i.test(navigator.userAgent);
                const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
                const isAPK = isAndroid && isStandalone;

                const response = await fetch('/api/version?t=' + new Date().getTime()); // Prevent caching
                if (!response.ok) return;
                
                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = process.env.NEXT_PUBLIC_APP_VERSION;

                if (serverVersion && localVersion && serverVersion !== localVersion) {
                    // Update latest version state
                    setLatestVersion(serverVersion);

                    if (isAPK) {
                        // APK Specific: Show Dialog
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
                        Uygulamanın yeni sürümü ({latestVersion}) yayınlandı.
                        {isUpdating ? (
                            <div className="mt-4 space-y-2">
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-600 transition-all duration-300" 
                                        style={{ width: `${progress}%` }} 
                                    />
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Yükleniyor... %{progress}
                                </p>
                            </div>
                        ) : (
                            <span> En iyi deneyim için lütfen güncelleyin.</span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    {!isUpdating && (
                        <Button 
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault(); 
                                performUpdate();
                            }} 
                            className="gap-2 w-full sm:w-auto"
                        >
                            <Download className="h-4 w-4" />
                            Güncelle ({latestVersion})
                        </Button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
