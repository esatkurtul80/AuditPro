import { NextResponse } from "next/server";
import { adminMessaging, adminDb, initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export const dynamic = 'force-dynamic'; // Force dynamic execution

export async function POST(req: Request) {
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

        const body = await req.json();
        const { title, message, url, recipients, userIds: legacyUserIds } = body;

        // Validate: Need either userIds (legacy) or recipients
        let targetUserIds: string[] = [];
        
        if (!title || !message) {
             return NextResponse.json({ error: "Missing required fields (title, message)" }, { status: 400 });
        }

        // --- RESOLVE RECIPIENTS IF PROVIDED ---
        if (recipients && Array.isArray(recipients)) {
             const resolvedIds = new Set<string>();
             
             for (const recipient of recipients) {
                if (recipient.type === "user") {
                    resolvedIds.add(recipient.id);
                } else if (recipient.type === "role_group") {
                     let role = "";
                     if (recipient.value === "denetmen") role = "denetmen";
                     if (recipient.value === "magaza") role = "magaza";
                     if (recipient.value === "bolge-muduru") role = "bolge-muduru";
                     if (recipient.value === "admin") role = "admin";

                     if (role) {
                         const snap = await db.collection("users").where("role", "==", role).get();
                         snap.forEach(d => resolvedIds.add(d.id));
                     } else if (recipient.value === "all") {
                         const snap = await db.collection("users").get();
                         snap.forEach(d => resolvedIds.add(d.id));
                     }
                } else if (recipient.type === "store") {
                     const snap = await db.collection("users").where("storeId", "==", recipient.id).get();
                     snap.forEach(d => resolvedIds.add(d.id));
                } else if (recipient.id.startsWith("city_")) {
                     // Resolve stores in city, then users
                     const storeSnap = await db.collection("stores").where("city", "==", recipient.value).get();
                     const storeIds = storeSnap.docs.map(d => d.id);
                     if (storeIds.length > 0) {
                         // Firestore in query limited to 10/30. Better to just query users via storeId if valid?
                         // Or query users where role=magaza and filter?
                         // Admin SDK can filter manually faster.
                         const usersSnap = await db.collection("users").where("role", "==", "magaza").get();
                         usersSnap.forEach(d => {
                             const data = d.data();
                             if (storeIds.includes(data.storeId)) {
                                 resolvedIds.add(d.id);
                             }
                         });
                     }
                }
             }
             targetUserIds = Array.from(resolvedIds);
        } else if (legacyUserIds && Array.isArray(legacyUserIds)) {
            targetUserIds = legacyUserIds;
        }

        if (targetUserIds.length === 0) {
             return NextResponse.json({ message: "No target users found" }); // Not an error, just empty
        }

        const userIds = targetUserIds; // Alias for rest of logic


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



        if (uniqueTokens.length === 0) {
            return NextResponse.json({ message: "No tokens found for target users" });
        }

        // 2. Send Multicast Message
        const messageId = `msg-${Date.now()}`;
        const response = await messaging.sendEachForMulticast({
            tokens: uniqueTokens,
            // Android: High Priority to wake up
            // Android: High Priority to wake up
            android: {
                priority: 'high',
                ttl: 2419200,
                notification: {
                    title: title,
                    body: message,
                    sound: 'default',
                    channelId: 'auditpro_notifications', // Matches legacy channel if exists
                    icon: 'https://tugbadenetim.info/login-assets-new/logo.png', // Must be absolute URL for some clients
                    color: '#2563eb'
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



            // Use batch processing to clean up
            let batch = db.batch();
            let operationCount = 0;
            const failedUsersSet = new Set<string>();

            for (const chunk of chunks) {
                // If we've processed 500 operations, commit and start new batch
                if (operationCount >= 400) {
                     await batch.commit();
                     batch = db.batch();
                     operationCount = 0;
                }

                const usersSnapshot = await db.collection("users")
                    .where(admin.firestore.FieldPath.documentId(), "in", chunk)
                    .get();

                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    const invalidTokensForUser = [];

                    // Check single token
                    if (data.fcmToken && failedTokens.includes(data.fcmToken)) {
                         invalidTokensForUser.push(data.fcmToken);
                    }

                    // Check array tokens
                    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                        const badTokens = data.fcmTokens.filter((t: string) => failedTokens.includes(t));
                        invalidTokensForUser.push(...badTokens);
                    }

                    if (invalidTokensForUser.length > 0) {
                        // Collect user name
                        const name = data.displayName || data.email || `User (${doc.id})`;
                        failedUsersSet.add(name);

                        const uniqueBadTokens = [...new Set(invalidTokensForUser)];
                        const updates: any = {};
                        
                        updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(...uniqueBadTokens);
                        
                        // Also clear legacy field if it matches
                        if (data.fcmToken && uniqueBadTokens.includes(data.fcmToken)) {
                            updates.fcmToken = admin.firestore.FieldValue.delete();
                        }
                        
                        batch.update(doc.ref, updates);
                        operationCount++;
                    }
                });
            }

            if (operationCount > 0) {
                await batch.commit();
            }



            return NextResponse.json({
                success: true,
                successCount: response.successCount,
                failureCount: response.failureCount,
                failedUserNames: Array.from(failedUsersSet)
            });
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
