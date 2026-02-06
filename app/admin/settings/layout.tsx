"use client";

import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ShieldCheck, KeyRound, Loader2, AlertCircle, Smartphone, Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Image from "next/image";

interface SettingsLayoutProps {
    children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const { user } = useAuth();
    
    const [isVerified, setIsVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);
    
    // Setup state
    const [needsSetup, setNeedsSetup] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [manualKey, setManualKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Verification input
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const check2FAStatus = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/admin/2fa/setup", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                const data = await res.json();

                if (data.alreadySetUp) {
                    setNeedsSetup(false);
                    setQrCode(null);
                } else {
                    setNeedsSetup(true);
                    setQrCode(data.qrCode);
                    setManualKey(data.manualKey);
                }
            } catch (err) {
                console.error("2FA Check Error:", err);
                setError("2FA durumu kontrol edilemedi.");
            } finally {
                setIsLoading(false);
            }
        };

        check2FAStatus();
    }, [user]);

    const handleVerify = async () => {
        if (code.length !== 6) {
            setError("Lütfen 6 haneli kodu girin.");
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/admin/2fa/verify", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ code })
            });

            const data = await res.json();

            if (data.valid) {
                setIsVerified(true);
                toast.success("Doğrulama başarılı!");
            } else {
                setError(data.error || "Kod hatalı.");
            }
        } catch (err) {
            console.error("Verify Error:", err);
            setError("Doğrulama sırasında bir hata oluştu.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCopyKey = () => {
        if (manualKey) {
            navigator.clipboard.writeText(manualKey);
            setCopied(true);
            toast.success("Anahtar kopyalandı!");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleReset2FA = async () => {
        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/admin/2fa/reset", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();

            if (data.success) {
                toast.success("2FA sıfırlandı. Sayfa yenileniyor...");
                setTimeout(() => window.location.reload(), 1000);
            } else {
                setError(data.error || "2FA sıfırlama başarısız.");
            }
        } catch (err) {
            console.error("Reset Error:", err);
            setError("2FA sıfırlama sırasında bir hata oluştu.");
        }
    };

    // If verified, render children
    if (isVerified) {
        return <>{children}</>;
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Güvenlik kontrolü yapılıyor...</p>
                </div>
            </div>
        );
    }

    // 2FA Verification / Setup Screen
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-6">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">İki Faktörlü Doğrulama</CardTitle>
                    <CardDescription>
                        {needsSetup 
                            ? "Hesabınızı korumak için 2FA kurulumunu tamamlayın"
                            : "Ayarlara erişmek için doğrulama kodu girin"
                        }
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {needsSetup && qrCode && (
                        <>
                            {/* QR Code Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Smartphone className="h-4 w-4" />
                                    <span>Google Authenticator ile QR kodu taratın</span>
                                </div>
                                
                                <div className="flex justify-center p-4 bg-white rounded-lg border">
                                    <Image 
                                        src={qrCode} 
                                        alt="QR Code" 
                                        width={180} 
                                        height={180}
                                        className="rounded"
                                    />
                                </div>
                            </div>

                            {/* Manual Key */}
                            {manualKey && (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground text-center">
                                        veya manuel olarak girin:
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-center py-2 px-3 bg-muted rounded-md font-mono text-sm tracking-wider">
                                            {manualKey}
                                        </code>
                                        <Button 
                                            variant="outline" 
                                            size="icon"
                                            onClick={handleCopyKey}
                                            className="shrink-0"
                                        >
                                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Code Input */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Doğrulama Kodu</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                                    className="pl-10 text-center text-xl font-mono tracking-[0.4em] h-12"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button 
                            onClick={handleVerify}
                            disabled={isVerifying || code.length !== 6}
                            className="w-full h-11"
                        >
                            {isVerifying ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Doğrulanıyor...</>
                            ) : (
                                "Doğrula ve Devam Et"
                            )}
                        </Button>
                    </div>
                </CardContent>

                <CardFooter className="flex-col gap-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground text-center">
                        {needsSetup 
                            ? "Bu işlem sadece bir kez yapılır. Sonraki girişlerde sadece kod istenecek."
                            : "Kodu aldıktan sonra 30 saniye içinde girmeniz gerekir."
                        }
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
