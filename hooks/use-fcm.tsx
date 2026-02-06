"use client";
import { useEffect, useState } from "react";
import { getToken, onMessage, getMessaging, isSupported } from "firebase/messaging";
import app, { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

export function useFcm() {
    const { userProfile } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("initializing");
    const [error, setError] = useState<string | null>(null);

    const requestPermission = async () => {
        try {
            setStatus("requesting_permission");
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                await retrieveToken();
            } else {
                setStatus("permission_denied");
                console.warn("Bildirim izni verilmedi.");
            }
        } catch (err: any) {
            console.error('Permission error:', err);
            setError(err.message);
            setStatus("error");
        }
    };

    // Auto-request permission on mount
    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            const manuallyDisabled = localStorage.getItem("notifications_manual_off") === "true";
            
            // If user manually disabled, respect that
            if (manuallyDisabled) {
                console.log("📴 Notifications manually disabled by user");
                return;
            }

            // Auto-prompt if permission is default (fresh install or never asked)
            if (Notification.permission === "default") {
                console.log("🔔 First launch or default permission, requesting...");
                requestPermission();
            } else if (Notification.permission === "granted") {
                // Permission granted but might not have subscription yet
                console.log("✅ Permission granted, ensuring token...");
                retrieveToken();
            }
        }
    }, [userProfile]); // Added userProfile dependency to retry on login

    const retrieveToken = async () => {
        try {
            // 1. Check Support First
            const supported = await isSupported();
            if (!supported) {
                console.log("ℹ️ Messaging not supported in this browser.");
                setStatus("unsupported");
                return;
            }

            // 2. Initialize Messaging Manually (Robust)
            const messaging = getMessaging(app);
            if (!messaging) {
                console.error("❌ Messaging failed to initialize");
                setStatus("messaging_init_failed");
                return;
            }

            // 3. Ensure Service Worker
            if ('serviceWorker' in navigator) {
                let registration = await navigator.serviceWorker.getRegistration();
                
                if (!registration) {
                    try {
                        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                        console.log("✅ SW registered successfully");
                        // Wait for SW to activate
                        await navigator.serviceWorker.ready;
                    } catch (swError) {
                        console.error("❌ SW registration failed:", swError);
                        setStatus("sw_registration_failed");
                        return;
                    }
                }
            }

            setStatus("getting_token");
            const currentToken = await getToken(messaging, {
                vapidKey: 'BP2IptNxmsaooq_2x5kUt6_AJkDxbM6y4a0D8Nsq6HACu4_ix3HLZOQLLEZ5BWtG_EeB-XOf3rsYb60E7quU2Bc'
            });

            if (currentToken) {
                setToken(currentToken);
                setStatus("active");
                // console.log("FCM Token retrieved:", currentToken);

                if (userProfile?.uid) {
                    try {
                        await updateDoc(doc(db, "users", userProfile.uid), {
                            fcmTokens: arrayUnion(currentToken),
                            fcmToken: currentToken,
                            lastTokenUpdate: new Date().toISOString()
                        });
                        console.log("Token saved to Firestore");
                    } catch (saveError) {
                         console.error("Error saving token to DB:", saveError);
                    }
                }
            } else {
                setStatus("no_token");
                console.warn("No registration token available.");
            }
        } catch (err: any) {
            // Suppress "AbortError" or common connection issues to avoid console spam
            if (err?.code === 'messaging/failed-service-worker-registration') {
                 console.warn("FCM SW Issue (Localhost/HTTP?):", err.message);
            } else {
                console.error('Token retrieval error:', err);
                setError(err.message || "Unknown error");
            }
            setStatus("error");
        }
    };

    // Message Listener
    useEffect(() => {
        const setupListener = async () => {
             const supported = await isSupported();
             if (supported) {
                 const messaging = getMessaging(app);
                 if (messaging) {
                    const unsubscribe = onMessage(messaging, (payload) => {
                        console.log('Message received: ', payload);

                        // Denetmen filtering
                        if (userProfile?.role === "denetmen") {
                            const title = payload.notification?.title || payload.data?.title;
                            if (title && (title === "Denetim Tamamlandı" || title.includes("Tarihli Mağaza Denetimi"))) {
                                return;
                            }
                        }

                        toast(payload.notification?.title || "Bildirim", {
                            description: payload.notification?.body,
                        });
                    });
                    return () => unsubscribe();
                 }
             }
        };
        
        setupListener();
    }, [userProfile]);

    return { token, status, error, requestPermission };
}
