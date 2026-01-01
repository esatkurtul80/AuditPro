"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Mevcut SW'yi kontrol et ve güncellemeye zorla
            navigator.serviceWorker.ready.then((registration) => {
                registration.update().then(() => {
                    console.log("Service Worker updated manually via .ready()");
                });
            });

            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.update();
                    console.log("Checking update for registration:", registration.scope);
                }
            });
        }
    }, []);

    return null;
}
