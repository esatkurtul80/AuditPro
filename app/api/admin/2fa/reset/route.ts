"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin, adminAuth, adminDb } from "@/lib/firebase-admin";

// This endpoint allows an admin to reset their OWN 2FA
// They must be authenticated to do this
export async function POST(request: NextRequest) {
    try {
        // Initialize Firebase Admin
        initAdmin();

        // 1. Verify Admin Session
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // 2. Check Admin Role
        const userDoc = await adminDb().collection("users").doc(uid).get();
        const userData = userDoc.data();
        if (!userData || userData.role !== "admin") {
            return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
        }

        // 3. Clear 2FA secrets
        await adminDb().collection("users").doc(uid).update({
            totpSecret: null,
            totpSecretPending: null,
            totpSetupStartedAt: null,
            totpSetupCompletedAt: null,
            totpResetAt: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            message: "2FA başarıyla sıfırlandı. Yeniden kurulum yapabilirsiniz."
        });

    } catch (error: any) {
        console.error("2FA Reset Error:", error);
        return NextResponse.json(
            { error: "2FA sıfırlama başarısız", details: error.message },
            { status: 500 }
        );
    }
}
