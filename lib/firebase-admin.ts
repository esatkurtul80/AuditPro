import "server-only";
import * as admin from "firebase-admin";

const formatPrivateKey = (key: string | undefined) => {
    return key?.replace(/\\n/g, "\n");
};

export function initAdmin() {
    try {
        // Attempt to get the existing default app
        const app = admin.app();
        return app;
    } catch (e) {
        // If it throws, it means default app doesn't exist. Proceed to initialize.
        // We also check admin.apps just for debugging context in logs
        // console.log("Initializing new admin app. Existing apps:", admin.apps.length);
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.SC_FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.SC_FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
        // Detailed logging for debugging (be careful not to log full private key in prod logs)
        console.error("Missing Env Vars details:", {
            hasProjectId: !!projectId,
            hasClientEmail: !!clientEmail,
            hasPrivateKey: !!privateKey
        });
        throw new Error(`Missing Firebase Admin Env Vars: ProjectId=${!!projectId}, Email=${!!clientEmail}, Key=${!!privateKey}`);
    }

    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    } catch (error: any) {
        // Handle race conditions where app might have been initialized by another request
        if (error.code === 'app/duplicate-app') {
            return admin.app();
        }
        throw error;
    }
}

export const adminAuth = admin.auth;
export const adminDb = admin.firestore;
export const adminMessaging = admin.messaging;
