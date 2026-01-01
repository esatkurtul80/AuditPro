import { NextResponse } from "next/server";
import { adminMessaging, adminDb, initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export const dynamic = 'force-dynamic'; // Force dynamic execution

export async function POST(req: Request) {
    console.log("🔔 /api/send-notification called");
    try {
        // Init Admin SDK
        try {
            initAdmin();
        } catch (initErr: any) {
            console.error("Firebase Admin Init Failed:", initErr);
            return NextResponse.json({ error: "Server Configuration Error: " + initErr.message }, { status: 500 });
        }

        const messaging = adminMessaging();
        const db = adminDb();

        const { title, message, userIds, url } = await req.json();

        if (!title || !message || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch tokens for users
        const tokens: string[] = [];
        const chunks = [];
        const chunkSize = 10;

        for (let i = 0; i < userIds.length; i += chunkSize) {
            chunks.push(userIds.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            const usersSnapshot = await db.collection("users")
                .where(admin.firestore.FieldPath.documentId(), "in", chunk)
                .get();

            usersSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.fcmToken) {
                    tokens.push(data.fcmToken);
                }
            });
        }

        // Deduplicate tokens
        const uniqueTokens = Array.from(new Set(tokens));

        if (uniqueTokens.length === 0) {
            return NextResponse.json({ message: "No tokens found for target users" });
        }

        // 2. Send Multicast Message
        const response = await messaging.sendEachForMulticast({
            tokens: uniqueTokens,
            notification: {
                title: title,
                body: message,
            },
            webpush: {
                fcmOptions: {
                    link: url || "/"
                },
                notification: {
                    icon: '/login-assets-new/logo.png',
                }
            },
            data: {
                url: url || "/"
            }
        });

        // 3. Cleanup invalid tokens (Optional but recommended)
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log("Failed tokens:", failedTokens.length);
            // We could remove them from DB here
        }

        return NextResponse.json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        });

    } catch (error: any) {
        console.error("Push Notification Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
