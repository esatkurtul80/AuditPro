"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin, adminAuth, adminDb } from "@/lib/firebase-admin";
import { authenticator } from "@otplib/preset-default";

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

        // 3. Get code from request body
        const body = await request.json();
        const { code } = body;

        if (!code || typeof code !== "string" || code.length !== 6) {
            return NextResponse.json({ error: "Geçersiz kod formatı" }, { status: 400 });
        }

        // 4. Determine which secret to use
        const secret = userData.totpSecret || userData.totpSecretPending;

        if (!secret) {
            return NextResponse.json({ 
                error: "2FA kurulu değil. Önce kurulum yapın.",
                needsSetup: true 
            }, { status: 400 });
        }

        // 5. Verify TOTP Code
        const isValid = authenticator.verify({ token: code, secret });

        if (!isValid) {
            return NextResponse.json({ 
                error: "Kod hatalı. Lütfen tekrar deneyin.",
                valid: false 
            }, { status: 401 });
        }

        // 6. If this was a pending setup, activate it now
        if (!userData.totpSecret && userData.totpSecretPending) {
            await adminDb().collection("users").doc(uid).update({
                totpSecret: userData.totpSecretPending,
                totpSecretPending: null,
                totpSetupCompletedAt: new Date().toISOString()
            });
        }

        return NextResponse.json({
            valid: true,
            message: "Doğrulama başarılı. Ayarlara erişebilirsiniz."
        });

    } catch (error: any) {
        console.error("2FA Verify Error:", error);
        return NextResponse.json(
            { error: "Doğrulama başarısız", details: error.message },
            { status: 500 }
        );
    }
}
