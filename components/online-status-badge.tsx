import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface OnlineStatusBadgeProps {
    isOnline: boolean;
    compact?: boolean;
}

export function OnlineStatusBadge({ isOnline, compact = false }: OnlineStatusBadgeProps) {
    if (compact) {
        // Just a small dot for mobile/compact mode
        return (
            <div
                className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"
                    }`}
                title={isOnline ? "Çevrimiçi" : "Çevrimdışı"}
            />
        );
    }

    return (
        <Badge
            variant={isOnline ? "default" : "destructive"}
            className={`${isOnline ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
                } text-white`}
        >
            {isOnline ? (
                <>
                    <Wifi className="mr-1 h-3 w-3" />
                    Çevrimiçi
                </>
            ) : (
                <>
                    <WifiOff className="mr-1 h-3 w-3" />
                    Çevrimdışı
                </>
            )}
        </Badge>
    );
}
