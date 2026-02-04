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

    // 3. Auto-Reload on Version Mismatch (Silent or with small toast)
    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Avoid checking on localhost to prevent annoying loops during dev
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
                
                const response = await fetch('/api/version?t=' + new Date().getTime());
                if (!response.ok) return;
                
                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = process.env.NEXT_PUBLIC_APP_VERSION;

                if (serverVersion && localVersion && serverVersion !== localVersion) {
                    console.log(`🚀 Update detected: ${localVersion} -> ${serverVersion}`);
                    
                    // Simple logic: Just reload the page.
                    // The new page load will fetch the new index.html which references the new JS bundles.
                    // We can add a small "Updating..." visual if needed, but instant reload is cleaner for "Force Update"
                    
                    // Prevent infinite loops if server version is somehow broken or misconfigured
                    const lastReload = sessionStorage.getItem('last_version_reload');
                    const now = Date.now();
                    if (lastReload && (now - parseInt(lastReload)) < 10000) {
                        console.warn("Rapid reload detected, pausing update loop.");
                        return;
                    }

                    sessionStorage.setItem('last_version_reload', now.toString());
                    
                    // Clear SW cache explicitly before reload to ensure fresh assets
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const reg of regs) await reg.unregister();
                    }
                    if ('caches' in window) {
                         const keys = await caches.keys();
                         await Promise.all(keys.map(key => caches.delete(key)));
                    }

                    window.location.reload();
                }
            } catch (e) {
                console.error("Version check failed", e);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 60 * 1000); // Check every minute
        
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') checkVersion();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    return null; // Invisible component
}
