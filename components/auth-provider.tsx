"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  Timestamp,
  arrayUnion,
  query,
  limit,
} from "firebase/firestore";
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

  const loadingFailsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 0) FAILSAFE: auth state gecikirse sonsuz loading olmasın (PWA/iOS koruması)
    loadingFailsafeRef.current = setTimeout(() => {
      console.warn("Auth init timeout: forcing loading=false to avoid white screen.");
      setLoading(false);
    }, 12000); // 12s - istersen 8-10s yapabilirsin

    // 1) Persistence Setup (Robust Strategy)
    setPersistence(auth, indexedDBLocalPersistence)
      .catch((err) => {
        console.warn(
          "IndexedDB persistence failed (likely locked tab), falling back to LocalStorage:",
          err
        );
        return setPersistence(auth, browserLocalPersistence);
      })
      .catch((e) => console.error("Persistence error (Both failed):", e));

    // 2) Auth State Listener (Critical)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      try {
        if (firebaseUser) {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);

            if (
              profile.role !== "pending" &&
              profile.role !== "magaza" &&
              (!profile.firstName || !profile.lastName)
            ) {
              setShowNameModal(true);
            }

            // FCM Token Logic - Non-blocking (PWA safe)
            if (typeof window !== "undefined") {
              void (async () => {
                try {
                  const { isSupported, getToken, onMessage, getMessaging } =
                    await import("firebase/messaging");

                  const supported = await isSupported();
                  if (!supported) return;

                  // ✅ messaging'i yeniden atamak yerine local değişkende yönet
                  let msg: any = null;

                  // Tercihen lib/firebase messaging instance'ı kullan
                  try {
                    const firebaseMod = await import("@/lib/firebase");
                    msg = (firebaseMod as any).messaging ?? null;
                  } catch (e) {
                    console.warn("Could not import messaging from lib/firebase", e);
                  }

                  // Yoksa burada üret
                  if (!msg) {
                    try {
                      const { getApps } = await import("firebase/app");
                      const app = getApps()[0];
                      if (app) msg = getMessaging(app);
                    } catch (e) {
                      console.warn("Could not create messaging instance", e);
                      return;
                    }
                  }

                  if (!msg) return;

                  // Get Token
                  try {
                    const token = await getToken(msg, {
                      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                    });

                    if (token) {
                      const hostname = window.location.hostname;
                      const isProduction =
                        hostname === "tugbadenetim.info" ||
                        hostname === "tugba-auditpro.web.app" ||
                        hostname === "tugba-auditpro.firebaseapp.com";

                      console.log("🔔 FCM Token Check:", {
                        hostname,
                        isProduction,
                        tokenPreview: token.substring(0, 20) + "...",
                        willSave: isProduction,
                      });

                      if (isProduction) {
                        await setDoc(
                          userDocRef,
                          {
                            fcmTokens: arrayUnion(token),
                            fcmToken: token,
                            lastLogin: Timestamp.now(),
                          },
                          { merge: true }
                        );
                      } else {
                        console.warn(
                          "⚠️ LOCALHOST/DEV detected - Token NOT saved to production database"
                        );
                      }
                    }
                  } catch (err) {
                    console.log("FCM Token Error:", err);
                  }

                  // Foreground Listener
                  onMessage(msg, (payload) => {
                    console.log("Foreground Message:", payload);
                    const { title, body } = payload.notification || {};
                    if (title) toast.info(title, { description: body, duration: 5000 });
                  });
                } catch (err) {
                  console.error("FCM Import/Runtime Error:", err);
                }
              })();
            }
          } else {
            // Create New User
            // ✅ Koleksiyon taramak yerine limit(1) ile daha hafif kontrol
            const usersQ = query(collection(db, "users"), limit(1));
            const usersSnapshot = await getDocs(usersQ);
            const isFirstUser = usersSnapshot.empty;

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: isFirstUser ? "admin" : "pending",
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };

            await setDoc(doc(db, "users", firebaseUser.uid), newProfile);
            setUserProfile(newProfile);
          }
        } else {
          setUserProfile(null);
        }
      } catch (err: any) {
        console.error("Profile fetch error:", err);

        // Retry Logic (network/unavailable)
        if (err?.code === "unavailable" || err?.message?.includes("offline")) {
          console.log("Retrying profile fetch in 1s...");
          setTimeout(async () => {
            try {
              const cu = auth.currentUser;
              if (!cu) return;

              const retryRef = doc(db, "users", cu.uid);
              const retrySnap = await getDoc(retryRef);
              if (retrySnap.exists()) {
                setUserProfile(retrySnap.data() as UserProfile);
              }
            } catch (retryErr: any) {
              toast.error(`Profil hatası (Tekrarlandı): ${retryErr.message}`);
            }
          }, 1000);
        } else {
          toast.error(`Profil bilgileri alınamadı: ${err.message || "Bilinmeyen hata"}`);
        }
      } finally {
        // ✅ Her koşulda loading'i kapat (ve failsafe'i temizle)
        if (loadingFailsafeRef.current) clearTimeout(loadingFailsafeRef.current);
        setLoading(false);
      }
    });

    // 3) Check Redirect Result (Independent check)
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Redirect login success:", result.user.email);
          toast.success("Giriş başarılı!");
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
        if (error.code !== "auth/popup-closed-by-user") {
          toast.error(`Giriş Hatası: ${error.message}`);
        }
      });

    return () => {
      unsubscribe();
      if (loadingFailsafeRef.current) clearTimeout(loadingFailsafeRef.current);
    };
  }, []);

  // 4) PWA Visibility Handler: Force Token Refresh on Resume
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch (e) {
          console.error("Token refresh failed on resume:", e);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const host = window.location.hostname;
      const isLocal =
        host === "localhost" || host.startsWith("192.168.") || host === "127.0.0.1";

      if (isLocal) {
        await signInWithPopup(auth, provider);
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
        signOut,
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
