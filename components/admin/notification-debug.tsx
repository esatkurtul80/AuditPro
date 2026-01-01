"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export function NotificationDebug() {
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runDiagnostics = async () => {
        setLoading(true);
        const info: any = {
            timestamp: new Date().toISOString(),
            environment: {
                hostname: window.location.hostname,
                isProduction: false,
                protocol: window.location.protocol,
            },
            permissions: {
                notification: Notification.permission,
            },
            serviceWorker: {
                supported: 'serviceWorker' in navigator,
                registered: false,
                active: false,
            },
            fcm: {
                tokenExists: false,
                token: null,
            }
        };

        // Check production
        info.environment.isProduction =
            info.environment.hostname === 'tugbadenetim.info' ||
            info.environment.hostname === 'tugba-auditpro.web.app' ||
            info.environment.hostname === 'tugba-auditpro.firebaseapp.com';

        // Check Service Worker
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            info.serviceWorker.registered = !!registration;
            info.serviceWorker.active = !!registration?.active;
            info.serviceWorker.scope = registration?.scope;
        }

        // Check FCM Token
        try {
            const { messaging } = await import('@/lib/firebase');
            if (messaging) {
                const { getToken } = await import('firebase/messaging');
                const token = await getToken(messaging, {
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                });

                if (token) {
                    info.fcm.tokenExists = true;
                    info.fcm.token = token.substring(0, 30) + '...';
                    info.fcm.fullToken = token;
                }
            }
        } catch (err: any) {
            info.fcm.error = err.message;
        }

        setDebugInfo(info);
        setLoading(false);
    };

    const sendTestNotification = async () => {
        try {
            const response = await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🔧 Test Bildirimi',
                    message: 'Debug tool test mesajı - ' + new Date().toLocaleTimeString(),
                    userIds: [debugInfo?.fcm?.userUid || 'test'],
                    url: '/'
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.success(`Başarılı: ${result.successCount}, Başarısız: ${result.failureCount}`);
            } else {
                toast.error('Test başarısız: ' + (result.error || result.message));
            }
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        }
    };

    const StatusBadge = ({ status, trueLabel = "Evet", falseLabel = "Hayır" }: any) => {
        return status ? (
            <Badge className="bg-green-500 gap-1"><CheckCircle2 className="w-3 h-3" />{trueLabel}</Badge>
        ) : (
            <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{falseLabel}</Badge>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Bildirim Sistemi Debug
                </CardTitle>
                <CardDescription>
                    FCM token, Service Worker ve bildirim izinlerini kontrol edin
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={runDiagnostics} disabled={loading}>
                    {loading ? 'Kontrol Ediliyor...' : '🔍 Sistem Kontrolü Yap'}
                </Button>

                {debugInfo && (
                    <div className="space-y-4">
                        {/* Environment */}
                        <div className="border rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold">Ortam</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Hostname:</div>
                                <div className="font-mono text-xs">{debugInfo.environment.hostname}</div>
                                <div>Production:</div>
                                <StatusBadge status={debugInfo.environment.isProduction} />
                                <div>Protocol:</div>
                                <div className="font-mono text-xs">{debugInfo.environment.protocol}</div>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="border rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold">İzinler</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Bildirim İzni:</div>
                                <Badge variant={
                                    debugInfo.permissions.notification === 'granted' ? 'default' :
                                        debugInfo.permissions.notification === 'denied' ? 'destructive' : 'secondary'
                                }>
                                    {debugInfo.permissions.notification}
                                </Badge>
                            </div>
                        </div>

                        {/* Service Worker */}
                        <div className="border rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold">Service Worker</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Destekleniyor:</div>
                                <StatusBadge status={debugInfo.serviceWorker.supported} />
                                <div>Kayıtlı:</div>
                                <StatusBadge status={debugInfo.serviceWorker.registered} />
                                <div>Aktif:</div>
                                <StatusBadge status={debugInfo.serviceWorker.active} />
                                {debugInfo.serviceWorker.scope && (
                                    <>
                                        <div>Scope:</div>
                                        <div className="font-mono text-xs">{debugInfo.serviceWorker.scope}</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* FCM */}
                        <div className="border rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold">FCM Token</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Token Var:</div>
                                <StatusBadge status={debugInfo.fcm.tokenExists} />
                                {debugInfo.fcm.token && (
                                    <>
                                        <div>Token Preview:</div>
                                        <div className="font-mono text-xs break-all col-span-2">
                                            {debugInfo.fcm.token}
                                        </div>
                                    </>
                                )}
                                {debugInfo.fcm.error && (
                                    <>
                                        <div>Hata:</div>
                                        <div className="text-red-500 text-xs col-span-2">{debugInfo.fcm.error}</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Test Button */}
                        {debugInfo.fcm.tokenExists && debugInfo.environment.isProduction && (
                            <Button onClick={sendTestNotification} variant="outline" className="w-full">
                                📨 Test Bildirimi Gönder
                            </Button>
                        )}

                        {/* Copy Full Token */}
                        {debugInfo.fcm.fullToken && (
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(debugInfo.fcm.fullToken);
                                    toast.success('Token kopyalandı!');
                                }}
                                variant="ghost"
                                size="sm"
                                className="w-full"
                            >
                                📋 Full Token'ı Kopyala
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
