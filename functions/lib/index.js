"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionDeadlineReminder = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
/**
 * Scheduled Cloud Function: runs every day at 12:00 Turkey time (UTC+3 = 09:00 UTC)
 * Finds audits whose actionDeadline is TOMORROW and notifies regional manager + store users.
 */
exports.actionDeadlineReminder = functions
    .region("europe-west1")
    .pubsub.schedule("0 9 * * *") // 09:00 UTC  =  12:00 Turkey (UTC+3)
    .timeZone("UTC")
    .onRun(async (_context) => {
    functions.logger.info("Action deadline reminder started");
    // --- Compute tomorrow's date range (Turkey time UTC+3) ---
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const now = new Date();
    const nowTurkey = new Date(now.getTime() + turkeyOffset);
    const tomorrowStart = new Date(Date.UTC(nowTurkey.getUTCFullYear(), nowTurkey.getUTCMonth(), nowTurkey.getUTCDate() + 1, 0, 0, 0, 0) - turkeyOffset);
    const tomorrowEnd = new Date(Date.UTC(nowTurkey.getUTCFullYear(), nowTurkey.getUTCMonth(), nowTurkey.getUTCDate() + 1, 23, 59, 59, 999) - turkeyOffset);
    // Query audits where actionDeadline = tomorrow
    const auditsSnap = await db.collection("audits")
        .where("status", "==", "tamamlandi")
        .where("actionDeadline", ">=", admin.firestore.Timestamp.fromDate(tomorrowStart))
        .where("actionDeadline", "<=", admin.firestore.Timestamp.fromDate(tomorrowEnd))
        .get();
    if (auditsSnap.empty) {
        functions.logger.info("No audits with deadline tomorrow");
        return null;
    }
    // Fetch all stores once
    const storesSnap = await db.collection("stores").get();
    const storeMap = {};
    storesSnap.forEach(doc => {
        const d = doc.data();
        storeMap[doc.id] = { name: d.name || "Mağaza", regionalManagerId: d.regionalManagerId };
    });
    for (const auditDoc of auditsSnap.docs) {
        const audit = auditDoc.data();
        const store = storeMap[audit.storeId];
        if (!store)
            continue;
        const storeName = store.name.toUpperCase();
        const title = "⏰ Aksiyon Dönüşü Hatırlatma";
        const message = `${storeName} MAĞAZA AKSİYON DÖNÜŞÜNE 1 GÜN KALDI`;
        const url = `/audits/${auditDoc.id}/actions`;
        const targetUserIds = new Set();
        // Regional Manager
        if (store.regionalManagerId)
            targetUserIds.add(store.regionalManagerId);
        // Store users
        const storeUsersSnap = await db.collection("users")
            .where("storeId", "==", audit.storeId)
            .where("role", "==", "magaza")
            .get();
        storeUsersSnap.forEach(d => targetUserIds.add(d.id));
        const userIds = Array.from(targetUserIds);
        if (userIds.length === 0)
            continue;
        // 1. Firestore notifications
        const batch = db.batch();
        userIds.forEach(userId => {
            const ref = db.collection("notifications").doc();
            batch.set(ref, {
                userId,
                type: "action_deadline_reminder",
                title,
                message,
                read: false,
                relatedId: auditDoc.id,
                createdAt: admin.firestore.Timestamp.now(),
            });
        });
        await batch.commit();
        // 2. Push notification via FCM
        const tokens = [];
        const chunkSize = 10;
        for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const usersSnap = await db.collection("users")
                .where(admin.firestore.FieldPath.documentId(), "in", chunk)
                .get();
            usersSnap.forEach(userDoc => {
                const userData = userDoc.data();
                if (userData.fcmToken)
                    tokens.push(userData.fcmToken);
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    userData.fcmTokens.forEach((t) => tokens.push(t));
                }
            });
        }
        const uniqueTokens = [...new Set(tokens)];
        if (uniqueTokens.length > 0) {
            await messaging.sendEachForMulticast({
                tokens: uniqueTokens,
                notification: { title, body: message },
                android: {
                    priority: "high",
                    notification: { title, body: message, sound: "default", channelId: "auditpro_notifications" }
                },
                apns: {
                    payload: { aps: { alert: { title, body: message }, sound: "default", "content-available": 1 } },
                    headers: { "apns-push-type": "alert", "apns-priority": "10" }
                },
                webpush: { fcmOptions: { link: `https://tugbadenetim.info${url}` }, headers: { Urgency: "high" } },
                data: { title, body: message, url: `https://tugbadenetim.info${url}` }
            });
        }
        functions.logger.info(`Sent reminder for audit ${auditDoc.id} → ${store.name}`);
    }
    return null;
});
//# sourceMappingURL=index.js.map