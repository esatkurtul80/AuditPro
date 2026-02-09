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
  updateDoc,
  serverTimestamp,
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

  // 2. Initial Cache Load (Instant Layout)
  useEffect(() => {
      try {
          const cached = localStorage.getItem("cached_user_profile");
          if (cached) {
              const parsed = JSON.parse(cached);
              // Basic validation
              if (parsed && parsed.role) {
                  console.log("Loaded cached profile:", parsed.role);
                  setUserProfile(parsed);
              }
          }
      } catch (e) {
          console.warn("Failed to load cached profile:", e);
      }
  }, []);

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
            
            // Cache the fresh profile
            localStorage.setItem("cached_user_profile", JSON.stringify(profile));

            if (
              profile.role !== "pending" &&
              profile.role !== "magaza" &&
              (!profile.firstName || !profile.lastName)
            ) {
              setShowNameModal(true);
            }

            // FCM Token Logic removed (Handled by useFcm hook)

            // 3. Update Sync
            // Always update last login time and basic info
            // Added: appVersion tracking for Admin Dashboard
            await updateDoc(userDocRef, {
                lastLogin: serverTimestamp(),
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || "",
                photoURL: firebaseUser.photoURL || "",
                // Track which version the user is currently using
                appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "unknown"
            });
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
              appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "unknown", // Added appVersion for new users
            };

            await setDoc(doc(db, "users", firebaseUser.uid), newProfile);
            setUserProfile(newProfile);
            // Cache new profile
            localStorage.setItem("cached_user_profile", JSON.stringify(newProfile));
          }
        } else {
          setUserProfile(null);
          localStorage.removeItem("cached_user_profile");
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
                const refreshedProfile = retrySnap.data() as UserProfile;
                setUserProfile(refreshedProfile);
                localStorage.setItem("cached_user_profile", JSON.stringify(refreshedProfile));
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

  // 5) Presence Tracking: Update isOnline status in Firestore
  useEffect(() => {
    if (!userProfile?.uid) return;

    let lastOnlineUpdate = 0;
    let currentStatus: boolean | null = null;

    const updatePresence = async (isOnline: boolean, force = false) => {
      // Skip if status hasn't changed
      if (currentStatus === isOnline && !force) return;
      
      const now = Date.now();
      // Only debounce "online" updates to avoid spam, but always allow "offline"
      if (isOnline && now - lastOnlineUpdate < 2000) return;
      
      if (isOnline) lastOnlineUpdate = now;
      currentStatus = isOnline;

      try {
        await updateDoc(doc(db, "users", userProfile.uid), {
          isOnline,
          lastActive: Timestamp.now()
        });
        console.log(`Presence updated: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      } catch (error) {
        console.error("Presence update error:", error);
      }
    };

    // Set online immediately
    updatePresence(true, true);

    const handleVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      console.log(`Visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      updatePresence(isVisible);
    };

    // Mobile PWA: pagehide fires more reliably than beforeunload
    const handlePageHide = () => {
      console.log("Page hide event");
      updatePresence(false);
    };

    const handleFocus = () => updatePresence(true);
    const handleBlur = () => {
      // On mobile, blur might fire for various reasons, rely on visibility instead
      if (document.visibilityState === "hidden") {
        updatePresence(false);
      }
    };

    // Heartbeat every 30 seconds to maintain online status
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") {
        updatePresence(true, true);
      }
    }, 30000);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      clearInterval(heartbeat);
      updatePresence(false);
    };
  }, [userProfile?.uid]);

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
    // Set offline before signing out
    if (userProfile?.uid) {
      try {
        await updateDoc(doc(db, "users", userProfile.uid), {
          isOnline: false,
          lastActive: Timestamp.now()
        });
      } catch (e) {
        console.error("Failed to update presence on signout:", e);
      }
    }
    localStorage.removeItem("cached_user_profile");
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
