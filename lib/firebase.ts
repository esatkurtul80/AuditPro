// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAWNOeyW0mHSqhjcLqdhPoL4TmOzyP7f6w",
    authDomain: "tugba-auditpro.firebaseapp.com",
    projectId: "tugba-auditpro",
    storageBucket: "tugba-auditpro.firebasestorage.app",
    messagingSenderId: "187720079346",
    appId: "1:187720079346:web:fcc9bd140dc790196bbd6b",
    measurementId: "G-EK65S7WF6R"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
