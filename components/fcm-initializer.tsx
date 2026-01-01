"use client";

import { useFcm } from "@/hooks/use-fcm";
import { AlertCircle, CheckCircle, Loader2, BellOff, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";

export function FcmInitializer() {
    const { status, error, token, requestPermission } = useFcm();
    const [minimized, setMinimized] = useState(false);

    // Auto-minimize after 3 seconds when status becomes active
    useEffect(() => {
        if (status === "active") {
            const timer = setTimeout(() => {
                setMinimized(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    // Only show if there's a problem that needs attention
    if (!status) return null;

    // Hide when everything is fine or initializing
    const hideStates = ["active", "initializing", "requesting_permission", "getting_token"];
    if (hideStates.includes(status) || minimized) return null;

    return (
        <div className={`fixed bottom-4 left-4 z-50 p-2 rounded-lg shadow-lg border text-xs font-medium bg-background/95 backdrop-blur transition-all duration-300 ${minimized ? 'w-10 h-10 flex items-center justify-center' : 'max-w-[300px]'}`}>

            {minimized ? (
                <Button variant="ghost" size="icon" className="h-full w-full p-0" onClick={() => setMinimized(false)}>
                    {status === "active" ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
                </Button>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 border-b pb-1 mb-1">
                        <span className="font-bold">Bildirim Durumu (Debug)</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setMinimized(true)}>
                            <XCircle className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {status === "initializing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        {status === "requesting_permission" && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
                        {status === "getting_token" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        {status === "active" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {(status === "permission_denied" || status === "unsupported" || status === "error") && <BellOff className="h-4 w-4 text-red-500" />}

                        <span>
                            {status === "initializing" && "Başlatılıyor..."}
                            {status === "unsupported" && "Tarayıcı desteklemiyor (HTTP?)"}
                            {status === "messaging_init_failed" && "Messaging modülü yüklenemedi"}
                            {status === "requesting_permission" && "İzin isteniyor..."}
                            {status === "permission_denied" && "İzin verilmedi (Ayarlardan açın)"}
                            {status === "getting_token" && "Token alınıyor..."}
                            {status === "active" && "Aktif (Token Alındı)"}
                            {status === "error" && "Hata!"}
                            {status === "no_token" && "Token üretilemedi"}
                            {status === "waiting_for_user" && "İzin bekleniyor"}
                            {status === "waiting_for_login" && "Giriş yapmanız bekleniyor"}
                        </span>
                    </div>

                    {status === "waiting_for_login" && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                            Bildirim almak için Google ile giriş yapın.
                        </div>
                    )}

                    {status === "waiting_for_user" && requestPermission && (
                        <Button
                            variant="default"
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1"
                            onClick={requestPermission}
                        >
                            Bildirim İzni Ver
                        </Button>
                    )}

                    {error && <div className="text-red-500 mt-1 break-words">{error}</div>}

                    {status === "active" && (
                        <div className="text-[10px] text-muted-foreground break-all mt-1">
                            Token sonu: ...{token?.slice(-6)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
