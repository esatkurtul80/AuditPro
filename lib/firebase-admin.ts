import "server-only";
import * as admin from "firebase-admin";

const formatPrivateKey = (key: string | undefined) => {
    return key?.replace(/\\n/g, "\n");
};

export function initAdmin() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.SC_FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.SC_FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(`Missing Firebase Admin Env Vars: ProjectId=${!!projectId}, Email=${!!clientEmail}, Key=${!!privateKey}`);
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

export const adminAuth = admin.auth;
export const adminDb = admin.firestore;
export const adminMessaging = admin.messaging;
