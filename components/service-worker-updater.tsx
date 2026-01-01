"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
    useEffect(() => {
        // Disabled aggressive auto-update check to prevent loops
        /*
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
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
        */
    }, []);

    return null;
}
