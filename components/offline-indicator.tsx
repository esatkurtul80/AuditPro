"use client";

import { useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();
    const wasOffline = useRef(false);
    const hadPendingWrites = useRef(false);

    useEffect(() => {
        if (!isOnline) {
            wasOffline.current = true;
            // Removed offline toast - status shown in header
        } else {
            // Removed online toast - sync progress shown in banner
            wasOffline.current = false;
            hadPendingWrites.current = false;
        }
    }, [isOnline]);

    // Don't render anything - offline status is shown in TopHeader
    return null;
}
