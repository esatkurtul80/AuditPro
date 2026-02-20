import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface OnlineStatusBadgeProps {
    isOnline: boolean;
    compact?: boolean;
}

export function OnlineStatusBadge({ isOnline, compact = false }: OnlineStatusBadgeProps) {
    return (
        <>
            <Badge
                className={`${compact ? "flex" : "flex"} ${isOnline ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    } text-white h-8 w-8 rounded-full p-0 items-center justify-center transition-all duration-300 shadow-sm`}
                title={isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                suppressHydrationWarning
            >
                {isOnline ? (
                        <Wifi className="h-4 w-4" />
                ) : (
                        <WifiOff className="h-4 w-4" />
                )}
            </Badge>
        </>
    );
}
