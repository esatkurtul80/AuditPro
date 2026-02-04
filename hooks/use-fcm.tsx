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

    const retrieveToken = async () => {
        try {
            if (!messaging) {
                setStatus("messaging_init_failed");
                return;
            }

            setStatus("getting_token");
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
                setStatus("unsupported");
                return;
            }

            if (!messaging) {
                setStatus("messaging_init_failed");
                return;
            }

            if (Notification.permission === 'granted') {
                await retrieveToken();
            } else if (Notification.permission === 'denied') {
                setStatus("permission_denied");
            } else {
                setStatus("waiting_for_user");
            }
        };

        checkPermissionAndInit();
    }, [userProfile]);

    // Separate effect to handle "waiting_for_user" state with a user-friendly Toast
    useEffect(() => {
        if (status === 'waiting_for_user' && typeof window !== 'undefined') {
            // Prevent spamming
            if (sessionStorage.getItem('fcm_prompt_shown')) return;
            
            sessionStorage.setItem('fcm_prompt_shown', 'true');

            // Small delay to let the app settle
            setTimeout(() => {
                toast("Bildirim İzni", {
                    description: "Bildirimleri alabilmek için izin vermelisiniz.",
                    action: {
                        label: "İzin Ver",
                        onClick: () => requestPermission()
                    },
                    duration: 10000, // Stay longer
                });
            }, 3000);
        }
    }, [status]);

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
