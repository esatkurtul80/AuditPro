"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ServiceWorkerUpdater() {
    const [updating, setUpdating] = useState(false);
    const [showManualButton, setShowManualButton] = useState(false);

    // 3. Auto-Reload on Version Mismatch
    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Skip if running as PWA (PWA has its own service worker update mechanism)
                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                if (isPWA) return;

                // Avoid checking on localhost to prevent annoyance
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;

                const response = await fetch('/api/version?t=' + new Date().getTime());
                if (!response.ok) return;

                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = process.env.NEXT_PUBLIC_APP_VERSION; // This should be provided by build time env

                // If localVersion is undefined (dev mode), skip
                if (!localVersion) return;

                // Normalize versions for comparison (remove 'v' prefix if exists)
                const cleanServer = serverVersion.replace(/^v/, '');
                const cleanLocal = localVersion.replace(/^v/, '');

                if (cleanServer !== cleanLocal) {
                    console.log(`🚀 Update detected: ${cleanLocal} -> ${cleanServer}`);
                    
                    // Trigger Update Mode
                    setUpdating(true);

                    // 1. Clear Caches immediately
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const reg of regs) await reg.unregister();
                    }
                    if ('caches' in window) {
                         const keys = await caches.keys();
                         await Promise.all(keys.map(key => caches.delete(key)));
                    }

                    // 2. Set timeout for 10 seconds to show manual button if auto-reload fails/hangs
                    setTimeout(() => {
                        setShowManualButton(true);
                    }, 10000);

                    // 3. Attempt immediate reload after a short delay to let UI render
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000); // 1s delay to show "Updating" screen
                }
            } catch (e) {
                console.error("Version check failed", e);
            }
        };

        // Check only once on mount (when app first opens)
        checkVersion();
    }, []);

    if (updating) {
        return (
            <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full space-y-6 border border-white/10">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <RefreshCw className={`h-8 w-8 text-blue-600 dark:text-blue-400 ${!showManualButton ? 'animate-spin' : ''}`} />
                    </div>
                   
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Güncelleme Mevcut
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                           Yeni versiyon yükleniyor, lütfen bekleyin...
                        </p>
                    </div>

                    {showManualButton && (
                        <div className="pt-2 animate-in slide-in-from-bottom-2">
                             <Button 
                                onClick={() => window.location.reload()} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                size="lg"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Şimdi Güncelle
                            </Button>
                            <p className="text-xs text-muted-foreground mt-3">
                                Otomatik güncelleme tamamlanamadıysa butona tıklayın.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null; 
}
