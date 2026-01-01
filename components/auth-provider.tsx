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
import { doc, getDoc, setDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { NameEntryModal } from "@/components/name-entry-modal";
import { toast } from "sonner"; // Toast ekledik

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


        const initializeAuth = async () => {
            // 1. Persistence: IndexedDB (PWA için en kararlı olan)
            try {
                await setPersistence(auth, indexedDBLocalPersistence);
            } catch (e) {
                console.error("Persistence error:", e);
            }

            // 2. Redirect Sonucunu Yakala (PWA Login Loop'u kırmak için kritik)
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    console.log("Redirect login success:", result.user.email);
                    toast.success("Giriş başarılı!");
                }
            } catch (error: any) {
                console.error("Redirect login error:", error);
                // Eğer hata varsa kullanıcıya gösterelim
                if (error.code !== 'auth/popup-closed-by-user') {
                    toast.error(`Giriş Hatası: ${error.message}`);
                }
            }

            // 3. Auth Durumunu Dinle
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                setUser(user);

                if (user) {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const profile = userDoc.data() as UserProfile;
                        setUserProfile(profile);
                        if (profile.role !== "pending" && profile.role !== "magaza" && (!profile.firstName || !profile.lastName)) {
                            setShowNameModal(true);
                        }

                        // FCM Token Logic
                        if (typeof window !== "undefined" && "serviceWorker" in navigator && Notification.permission !== "denied") {
                            try {
                                const { messaging } = await import("@/lib/firebase");
                                if (messaging) {
                                    const { getToken, onMessage } = await import("firebase/messaging");
                                    const currentToken = await getToken(messaging, {
                                        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                                    });
                                    if (currentToken) {
                                        await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
                                        console.log("FCM Token saved");
                                    }

                                    // Foreground Message Listener
                                    onMessage(messaging, (payload) => {
                                        console.log("Foreground Message received: ", payload);
                                        const { title, body } = payload.notification || {};
                                        if (title) {
                                            toast.info(title, {
                                                description: body,
                                                duration: 5000,
                                            });
                                        }
                                    });
                                }
                            } catch (err) {
                                console.log("FCM Token Error (e.g. missing VAPID or permission):", err);
                            }
                        }
                    } else {
                        // Yeni Kullanıcı Oluştur
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
                } else {
                    setUserProfile(null);
                }

                setLoading(false);
            });
            return unsubscribe;
        };

        const cleanup = initializeAuth();
        return () => {
            cleanup.then(unsubscribe => unsubscribe());
        };
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            // PWA İÇİN KRİTİK DEĞİŞİKLİK:
            // Artık authDomain (tugbadenetim.info) ile sitemiz aynı.
            // Bu yüzden "Redirect" yöntemi PWA içinde çalışması gereken en doğru yöntem.
            // Popup yöntemi iOS PWA'da pencere sorunları yaratır.
            await signInWithRedirect(auth, provider);
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
