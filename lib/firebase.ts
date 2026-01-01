// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAWNOeyW0mHSqhjcLqdhPoL4TmOzyP7f6w",
    // Dynamic Auth Domain: Use 'firebaseapp.com' for Localhost to prevent CORS/Auth errors,
    // Use 'tugbadenetim.info' for Production/PWA to ensure First-Party Cookies and Trust.
    authDomain: (typeof window !== 'undefined' && window.location.hostname === 'localhost')
        ? "tugba-auditpro.firebaseapp.com"
        : "tugbadenetim.info",
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
let messaging: any = null;
if (typeof window !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
        // Register Service Worker FIRST
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then((registration) => {
                console.log('✅ Service Worker registered:', registration.scope);
                // Only initialize messaging after SW is registered
                messaging = getMessaging(app);
            })
            .catch((err) => {
                console.error('❌ Service Worker registration failed:', err);
            });
    } catch (e) {
        console.error("Firebase messaging support error", e);
    }
}
export { messaging };

export default app;
