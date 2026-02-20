"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff } from "lucide-react";

interface LocationStatusBadgeProps {
    compact?: boolean;
}

export function LocationStatusBadge({ compact = false }: LocationStatusBadgeProps) {
    const [permissionStatus, setPermissionStatus] = useState<PermissionState | "unknown">("unknown");
    const [gpsActive, setGpsActive] = useState(false);

    useEffect(() => {
        // Check initial permission
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: "geolocation" }).then((result) => {
                setPermissionStatus(result.state);

                // If granted, we can try to confirm GPS is actually on by a quick non-blocking check
                // or just rely on permission 'granted' as Green.
                // However, 'granted' permission doesn't guarantee 'GPS On'.
                // Ideally, we want to know if "Location Services" are enabled.
                // Browsers don't expose "GPS On/Off" directly without trying to get position.
                // But the user asked: "if location is closed red, open green".
                
                result.onchange = () => {
                    setPermissionStatus(result.state);
                };
            });
        }

        // Try to verify actual location service availability if we can
        // But doing getCurrentPosition constantly is bad for battery.
        // Let's assume Permission 'granted' = Green, 'denied'/'prompt' = Red for now?
        // Or if 'prompt' => maybe Yellow/Red? user said "red if closed".
        
    }, []);

    // Determine status color
    // If granted -> Green
    // If denied -> Red
    // If prompt -> Red (since not active yet)
    // If unknown -> Gray?
    const isReady = permissionStatus === 'granted';

    return (
        <Badge
            className={`${compact ? "flex" : "flex"} ${isReady ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                } text-white h-8 w-8 rounded-full p-0 items-center justify-center mx-1 transition-all duration-300 shadow-sm`}
            title={isReady ? "Konum Servisi Açık" : "Konum Servisi Kapalı/İzin Yok"}
            suppressHydrationWarning
        >
            {isReady ? (
                <MapPin className="h-4 w-4" />
            ) : (
                <MapPinOff className="h-4 w-4" />
            )}
        </Badge>
    );
}
