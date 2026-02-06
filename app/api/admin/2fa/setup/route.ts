"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin, adminAuth, adminDb } from "@/lib/firebase-admin";
import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";

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

        // 3. Check if 2FA is already FULLY set up (verified)
        if (userData.totpSecret) {
            // 2FA is already active and verified - DO NOT show QR again!
            return NextResponse.json({ 
                alreadySetUp: true,
                message: "2FA zaten aktif. Kod girişi gerekiyor." 
            });
        }

        // 4. Check if there's a pending secret (user started but didn't complete setup)
        let secret = userData.totpSecretPending;
        
        if (!secret) {
            // Generate new TOTP Secret only if no pending exists
            secret = authenticator.generateSecret();
            
            // Save pending secret to Firestore
            await adminDb().collection("users").doc(uid).update({
                totpSecretPending: secret,
                totpSetupStartedAt: new Date().toISOString()
            });
        }

        // 5. Generate OTPAuth URL (for Google Authenticator)
        // Include user email to make it unique per user
        const appName = "AuditPro Admin";
        const otpAuthUrl = authenticator.keyuri(
            userData.email || uid,
            appName,
            secret
        );

        // 6. Generate QR Code as Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

        return NextResponse.json({
            alreadySetUp: false,
            qrCode: qrCodeDataUrl,
            manualKey: secret,
            message: "QR kodunu taratın ve doğrulama kodunu girin."
        });

    } catch (error: any) {
        console.error("2FA Setup Error:", error);
        return NextResponse.json(
            { error: "2FA kurulumu başarısız", details: error.message },
            { status: 500 }
        );
    }
}
