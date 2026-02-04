"use client";
import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "@/lib/firebase";
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

    // Auto-request permission on mount if needed
    useEffect(() => {
        if (!userProfile) return;
        
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
    }, [userProfile]);

    const retrieveToken = async () => {
        try {
            if (!messaging) {
                console.error("❌ Messaging not initialized");
                setStatus("messaging_init_failed");
                return;
            }

            // CRITICAL: Ensure SW is registered before getting token
            if ('serviceWorker' in navigator) {
                let registration = await navigator.serviceWorker.getRegistration();
                
                if (!registration) {
                    console.log("🔧 No SW found, registering firebase-messaging-sw.js...");
                    try {
                        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                        console.log("✅ SW registered successfully");
                        // Wait for SW to activate
                        await navigator.serviceWorker.ready;
                    } catch (swError) {
                        console.error("❌ SW registration failed:", swError);
                        setStatus("sw_registration_failed");
                        toast.error("Bildirim servisi başlatılamadı.");
                        return;
                    }
                } else {
                    console.log("✅ SW already registered");
                }
            }

            setStatus("getting_token");
            console.log("🔑 Requesting FCM token...");
            const currentToken = await getToken(messaging, {
                vapidKey: 'BP2IptNxmsaooq_2x5kUt6_AJkDxbM6y4a0D8Nsq6HACu4_ix3HLZOQLLEZ5BWtG_EeB-XOf3rsYb60E7quU2Bc'
            });

            if (currentToken) {
                setToken(currentToken);
                setStatus("active");
                console.log("FCM Token retrieved:", currentToken);

                if (userProfile?.uid) {
                    try {
                        await updateDoc(doc(db, "users", userProfile.uid), {
                            fcmTokens: arrayUnion(currentToken),
                            fcmToken: currentToken, // Legacy support (ensure latest token is here too)
                            lastTokenUpdate: new Date().toISOString()
                        });
                        console.log("Token saved to Firestore");
                        // Only show if not just initializing silently (optional, but good for debugging now)
                        // toast.success("Bildirim servisi aktif edildi."); 
                    } catch (saveError) {
                         console.error("Error saving token to DB:", saveError);
                         toast.error("Bildirim servisi hatası: Token kaydedilemedi.");
                    }
                }
            } else {
                setStatus("no_token");
                console.warn("No registration token available. Request permission to generate one.");
            }
        } catch (err: any) {
            console.error('Token error:', err);
            setError(err.message || "Unknown error");
            setStatus("error");
            toast.error("Bildirim servisi başlatılamadı.");
        }
    };

    useEffect(() => {
        if (!userProfile) {
            setStatus("waiting_for_login");
            return;
        }

        const checkPermissionAndInit = async () => {
            if (typeof window !== "undefined" && (!('serviceWorker' in navigator) || !('PushManager' in window))) {
                console.warn("⚠️ Push notifications not supported");
                setStatus("unsupported");
                return;
            }

            if (!messaging) {
                console.error("❌ Messaging not initialized");
                setStatus("messaging_init_failed");
                return;
            }

            const perm = Notification.permission;
            console.log("🔍 Current permission:", perm);

            if (perm === 'granted') {
                console.log("✅ Permission granted, retrieving token...");
                await retrieveToken();
            } else if (perm === 'denied') {
                console.warn("🚫 Permission denied by user");
                setStatus("permission_denied");
            } else {
                console.log("❓ Permission default, waiting for user action");
                setStatus("waiting_for_user");
            }
        };

        checkPermissionAndInit();
    }, [userProfile]);

    // Separate effect to handle "waiting_for_user" state with a user-friendly Toast
    // Separate effect to handle "waiting_for_user" state - REMOVED preferring auto-prompt
    // useEffect(() => {
    //     if (status === 'waiting_for_user' && typeof window !== 'undefined') {
    //         ...
    //     }
    // }, [status]);

    useEffect(() => {
        if (messaging) {
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);

                // Denetmenler için audit_completed bildirimlerini (foreground) engelle
                if (userProfile?.role === "denetmen") {
                    const title = payload.notification?.title || payload.data?.title;
                    // Başlık kontrolü yapıyoruz çünkü payload.data.type her zaman gelmeyebilir
                    if (title && (title === "Denetim Tamamlandı" || title.includes("Tarihli Mağaza Denetimi"))) {
                        console.log("Blocking audit_completed notification for auditor");
                        return;
                    }
                }

                toast(payload.notification?.title || "Bildirim", {
                    description: payload.notification?.body,
                });
            });
            return () => unsubscribe();
        }

    }, [userProfile]);

    return { token, status, error, requestPermission };
}
