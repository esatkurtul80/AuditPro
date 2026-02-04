"use client";

import { useFcm } from "@/hooks/use-fcm";

export function FcmInitializer() {
    const { status, error, token, requestPermission } = useFcm();

    // User requested to remove the visible UI.
    // The logic (useFcm) will still run to handle foreground messages and token.
    return null;
}
