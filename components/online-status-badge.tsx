import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface OnlineStatusBadgeProps {
    isOnline: boolean;
    compact?: boolean;
}

export function OnlineStatusBadge({ isOnline, compact = false }: OnlineStatusBadgeProps) {
    return (
        <>
            {compact && (
                <div
                    className={`md:hidden h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-700" : "bg-red-600"
                        }`}
                    title={isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                />
            )}

            <Badge
                variant={isOnline ? "default" : "destructive"}
                className={`${compact ? "hidden md:flex" : "flex"} ${isOnline ? "bg-green-700 hover:bg-green-800" : "bg-red-600 hover:bg-red-700"
                    } text-white`}
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
