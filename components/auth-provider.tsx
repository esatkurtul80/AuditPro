"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    indexedDBLocalPersistence,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithEmailAndPassword
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, Timestamp, arrayUnion } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { NameEntryModal } from "@/components/name-entry-modal";
import { toast } from "sonner";

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNameModal, setShowNameModal] = useState(false);

    useEffect(() => {
        // Safety Timeout: Force loading to false after 5 seconds to prevent PWA hang
        const safetyTimer = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.warn("Auth Listener timed out. Forcing app to load.");
                    return false;
                }
                return prev;
            });
        }, 5000);

        // 1. Persistence Setup (Non-blocking attempt)
        setPersistence(auth, indexedDBLocalPersistence).catch(e => console.error("Persistence error:", e));

        // 2. Auth State Listener (Critical for ending loading state)
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const profile = userDoc.data() as UserProfile;
                        setUserProfile(profile);
                        if (profile.role !== "pending" && profile.role !== "magaza" && (!profile.firstName || !profile.lastName)) {
                            setShowNameModal(true);
                        }

                        // FCM Token Logic - Non-blocking
                        if (typeof window !== "undefined" && "serviceWorker" in navigator && Notification.permission !== "denied") {
                            import("@/lib/firebase").then(async ({ messaging }) => {
                                if (messaging) {
                                    const { getToken, onMessage } = await import("firebase/messaging");

                                    // Get Token
                                    getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
                                        .then(token => {
                                            if (token) {
                                                const hostname = window.location.hostname;
                                                const isProduction = hostname === 'tugbadenetim.info' ||
                                                    hostname === 'tugba-auditpro.web.app' ||
                                                    hostname === 'tugba-auditpro.firebaseapp.com';

                                                console.log('🔔 FCM Token Check:', {
                                                    hostname,
                                                    isProduction,
                                                    tokenPreview: token.substring(0, 20) + '...',
                                                    willSave: isProduction
                                                });

                                                if (isProduction) {
                                                    console.log('✅ SAVING token to production database');
                                                    setDoc(userDocRef, {
                                                        fcmTokens: arrayUnion(token),
                                                        fcmToken: token,
                                                        lastLogin: Timestamp.now()
                                                    }, { merge: true });
                                                } else {
                                                    console.warn('⚠️ LOCALHOST DETECTED - Token NOT saved to production database');
                                                }
                                            }
                                        })
                                        .catch(err => console.log("FCM Token Error:", err));

                                    // Foreground Listener
                                    onMessage(messaging, (payload) => {
                                        console.log("Foreground Message:", payload);
                                        const { title, body } = payload.notification || {};
                                        if (title) toast.info(title, { description: body, duration: 5000 });
                                    });
                                }
                            }).catch(err => console.error("FCM Import Error:", err));
                        }
                    } else {
                        // Create New User
                        const usersSnapshot = await getDocs(collection(db, "users"));
                        const isFirstUser = usersSnapshot.empty;

                        const newProfile: UserProfile = {
                            uid: user.uid,
                            email: user.email!,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            role: isFirstUser ? "admin" : "pending",
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now(),
                        };

                        await setDoc(userDocRef, newProfile);
                        setUserProfile(newProfile);
                    }
                } catch (err: any) {
                    console.error("Profile fetch error:", err);
                    // Retry Logic for Safari/Network glitches
                    // If error is 'unavailable' or network related, try once more after 1s
                    if (err.code === 'unavailable' || err.message?.includes('offline')) {
                        console.log("Retrying profile fetch in 1s...");
                        setTimeout(async () => {
                            try {
                                const retryRef = doc(db, "users", user.uid);
                                const retrySnap = await getDoc(retryRef);
                                if (retrySnap.exists()) {
                                    setUserProfile(retrySnap.data() as UserProfile);
                                }
                            } catch (retryErr: any) {
                                toast.error(`Profil hatası (Tekrarlandı): ${retryErr.message}`);
                            }
                        }, 1000);
                    } else {
                        toast.error(`Profil bilgileri alınamadı: ${err.message || 'Bilinmeyen hata'}`);
                    }
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false); // END LOADING STATE HERE
            clearTimeout(safetyTimer); // Clear safety timer if we loaded successfully
        });

        // 3. Check Redirect Result (Independent check)
        getRedirectResult(auth)
            .then((result) => {
                if (result) {
                    console.log("Redirect login success:", result.user.email);
                    toast.success("Giriş başarılı!");
                }
            })
            .catch((error) => {
                console.error("Redirect login error:", error);
                if (error.code !== 'auth/popup-closed-by-user') {
                    toast.error(`Giriş Hatası: ${error.message}`);
                }
            });

        return () => {
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    // Secondary Watchdog: Absolute fail-safe for Mobile PWA Hang
    useEffect(() => {
        if (loading) {
            const watchdog = setTimeout(() => {
                console.warn("⚠️ Watchdog: Loading stuck for 12s. Forcing release.");
                setLoading(false);
            }, 12000); // Increased to 12s for slow 3G/Safari
            return () => clearTimeout(watchdog);
        }
    }, [loading]);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            // HYBRID STRATEGY: 
            // Localhost: Use Popup (More stable, avoids domain issues)
            // Production/PWA: Use Redirect (Required for PWA/Mobile user experience)
            if (window.location.hostname === 'localhost') {
                await signInWithPopup(auth, provider);
                // Notification permission logic logic is handled in onAuthStateChanged
            } else {
                await signInWithRedirect(auth, provider);
            }
        } catch (error: any) {
            console.error("Login trigger error:", error);
            toast.error(`Giriş başlatılamadı: ${error.message}`);
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                loading,
                signInWithGoogle,
                signInWithEmail,
                signOut
            }}
        >
            {children}
            {showNameModal && userProfile && (
                <NameEntryModal
                    userId={userProfile.uid}
                    onComplete={(firstName, lastName) => {
                        setUserProfile({
                            ...userProfile,
                            firstName,
                            lastName,
                        });
                        setShowNameModal(false);
                    }}
                />
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
