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

                // Support legacy single token
                if (data.fcmToken) {
                    tokens.push(data.fcmToken);
                }

                // Support new multiple tokens array
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    data.fcmTokens.forEach((t: string) => tokens.push(t));
                }
            });
        }

        // Deduplicate tokens
        const uniqueTokens = Array.from(new Set(tokens));

        console.log('📊 TOKEN SUMMARY:', {
            totalTokensCollected: tokens.length,
            uniqueTokens: uniqueTokens.length,
            duplicatesRemoved: tokens.length - uniqueTokens.length,
            targetUserCount: userIds.length,
            tokensPreview: uniqueTokens.map(t => t.substring(0, 20) + '...')
        });

        if (uniqueTokens.length === 0) {
            return NextResponse.json({ message: "No tokens found for target users" });
        }

        // 2. Send Multicast Message
        const messageId = `msg-${Date.now()}`;
        console.log('🚀 Sending notification to', uniqueTokens.length, 'devices...');
        const response = await messaging.sendEachForMulticast({
            tokens: uniqueTokens,
            // Android: High Priority to wake up
            // Android: High Priority to wake up
            android: {
                priority: 'high',
                ttl: 2419200,
                notification: {
                    sound: 'default'
                }
            },
            // iOS (APNs): Critical settings for PWA
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: message,
                        },
                        sound: "default",
                        "content-available": 1,
                    }
                },
                headers: {
                    "apns-push-type": "alert",
                    "apns-priority": "10",
                }
            },
            // WebPush: Add notification key so Browser handles it (No SW manual show needed)
            webpush: {
                fcmOptions: {
                    link: url || "/"
                },
                headers: {
                    "Urgency": "high"
                }
            },
            // Root Notification: Critical for iOS/Android System Display
            notification: {
                title: title,
                body: message,
            },
            data: {
                title: title,
                body: message,
                icon: "/login-assets-new/logo.png",
                url: url || "/",
                messageId: messageId
            }
        });

        // 3. Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(uniqueTokens[idx]);
                    console.error("Token failed:", uniqueTokens[idx], "Error:", resp.error?.code, resp.error?.message);
                }
            });

            console.log(`Removing ${failedTokens.length} invalid tokens from database...`);

            // Remove failed tokens from all users
            for (const chunk of chunks) {
                const usersSnapshot = await db.collection("users")
                    .where(admin.firestore.FieldPath.documentId(), "in", chunk)
                    .get();

                const batch = db.batch();
                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    let needsUpdate = false;

                    // Check if this user has any failed tokens
                    const userFailedTokens = failedTokens.filter(ft =>
                        ft === data.fcmToken || (data.fcmTokens && data.fcmTokens.includes(ft))
                    );

                    if (userFailedTokens.length > 0) {
                        needsUpdate = true;
                        const updates: any = {};

                        // Remove from fcmTokens array if present
                        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                            updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(...userFailedTokens);
                        }

                        // Clear single token if it failed
                        if (userFailedTokens.includes(data.fcmToken)) {
                            updates.fcmToken = admin.firestore.FieldValue.delete();
                        }

                        batch.update(doc.ref, updates);
                    }
                });

                await batch.commit();
            }

            console.log("✅ Invalid tokens removed successfully");
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
