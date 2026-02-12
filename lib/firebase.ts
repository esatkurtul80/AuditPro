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
    // Dynamic Auth Domain: Use 'firebaseapp.com' for Localhost and Local IPs to prevent CORS/Auth errors,
    // Use 'tugbadenetim.info' for Production/PWA to ensure First-Party Cookies and Trust.
    authDomain: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') || window.location.hostname === '127.0.0.1'))
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
// Initialize Firebase services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

let messaging: any = null;

if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    // Dynamic import to avoid SSR/build issues and ensure we check support
    import("firebase/messaging").then(async ({ getMessaging, isSupported }) => {
        try {
            if (await isSupported()) {
                 if ("serviceWorker" in navigator) {
                     // Check for manual opt-out
                     const isManuallyDisabled = localStorage.getItem("notifications_manual_off") === "true";
                     
                     if (isManuallyDisabled) {
                     } else {
                         // Register Service Worker provided by the app
                         // Note: Firebase usually registers its own SW if not provided, but we are explicit here
                         navigator.serviceWorker.register('/firebase-messaging-sw.js')
                         .then((registration) => {
                             messaging = getMessaging(app);
                         })
                         .catch((err) => {
                             // Fallback: try getting messaging without explicit SW registration if it fails?
                             // actually getMessaging() might work if SW is already registered by browser
                             messaging = getMessaging(app);
                         });
                     }
                 }
            } else {
            }
        } catch (e) {
             console.error("Firebase messaging initialization error", e);
        }
    });
}

export { messaging };

export default app;
