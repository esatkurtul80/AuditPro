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

                if (userProfile?.uid) {
                    await updateDoc(doc(db, "users", userProfile.uid), {
                        fcmTokens: arrayUnion(currentToken)
                    });
                }
            } else {
                setStatus("no_token");
            }
        } catch (err: any) {
            console.error('Token error:', err);
            setError(err.message || "Unknown error");
            setStatus("error");
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

        if (messaging) {
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);
                toast(payload.notification?.title || "Bildirim", {
                    description: payload.notification?.body,
                });
            });
            return () => unsubscribe();
        }

    }, [userProfile]);

    return { token, status, error, requestPermission };
}
