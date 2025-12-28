"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { NameEntryModal } from "@/components/name-entry-modal";

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNameModal, setShowNameModal] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                // Kullanıcı profilini Firestore'dan al
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const profile = userDoc.data() as UserProfile;
                    setUserProfile(profile);
                    // Check if user needs to enter name (excluding store users)
                    if (profile.role !== "pending" && profile.role !== "magaza" && (!profile.firstName || !profile.lastName)) {
                        setShowNameModal(true);
                    }
                } else {
                    // İlk kez giriş yapan kullanıcı için profil oluştur
                    // Sistemdeki toplam kullanıcı sayısını kontrol et
                    const usersSnapshot = await getDocs(collection(db, "users"));
                    const isFirstUser = usersSnapshot.empty;

                    const newProfile: UserProfile = {
                        uid: user.uid,
                        email: user.email!,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        role: isFirstUser ? "admin" : "pending", // İlk kullanıcı admin, diğerleri pending olur
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

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        await signInWithPopup(auth, provider);
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
