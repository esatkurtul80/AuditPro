"use client";

import { useAuth } from "@/components/auth-provider";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Moon,
    Sun,
    Smartphone,
    Bell,
    LogOut,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

export function AuditorSettingsView() {
    const { userProfile, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
    const [isPushEnabled, setIsPushEnabled] = useState(false);

    // Check actual subscription status
    const checkNotificationStatus = async () => {
        if (!("Notification" in window)) return;
        
        const perm = Notification.permission;
        setPermissionState(perm);

        if ('serviceWorker' in navigator && perm === 'granted') {
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.active) {
                     const sub = await reg.pushManager.getSubscription();
                     setIsPushEnabled(!!sub);
                } else {
                    setIsPushEnabled(false);
                }
            } catch (e) {
                console.error("SW check failed", e);
                setIsPushEnabled(true); 
            }
        } else {
            setIsPushEnabled(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        checkNotificationStatus();

        window.addEventListener("focus", checkNotificationStatus);
        window.addEventListener("visibilitychange", () => {
             if (document.visibilityState === 'visible') checkNotificationStatus();
        });

        return () => {
            window.removeEventListener("focus", checkNotificationStatus);
             window.removeEventListener("visibilitychange", checkNotificationStatus);
        };
    }, []);

    const handleNotificationToggle = async (enabled: boolean) => {
        if (!mounted) return;

        if (enabled) {
            // Enable notifications
            try {
                const perm = await Notification.requestPermission();
                
                if (perm === 'granted') {
                    localStorage.removeItem("notifications_manual_off");
                    toast.success("Bildirimler etkinleştiriliyor...");
                    
                    if ('serviceWorker' in navigator) {
                        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    }
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    toast.error("Bildirim izni verilmedi.");
                }
            } catch (error) {
                console.error("Notification permission error:", error);
                toast.error("Bildirim etkinleştirilemedi.");
            }
        } else {
            // Disable notifications
            try {
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const reg of regs) {
                        await reg.unregister();
                    }
                }
                localStorage.setItem("notifications_manual_off", "true");
                setIsPushEnabled(false);
                toast.success("Bildirimler kapatıldı.");
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                console.error("Notification disable error:", error);
                toast.error("Bildirimler kapatılamadı.");
            }
        }
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
        toast.success("Çıkış yapıldı");
    };

    const getThemeIcon = () => {
        if (!mounted) return <Smartphone className="h-5 w-5" />;
        
        switch (theme) {
            case 'dark': return <Moon className="h-5 w-5" />;
            case 'light': return <Sun className="h-5 w-5" />;
            default: return <Smartphone className="h-5 w-5" />;
        }
    };

    const getThemeLabel = () => {
        if (!mounted) return 'Sistem';
        
        switch (theme) {
            case 'dark': return 'Karanlık';
            case 'light': return 'Aydınlık';
            default: return 'Sistem';
        }
    };

    const getNotificationStatusText = () => {
        if (permissionState === 'denied') return 'İzin Reddedildi';
        if (permissionState === 'default') return 'İzin Verilmedi';
        return isPushEnabled ? 'Açık' : 'Kapalı';
    };

    const getNotificationStatusColor = () => {
        if (permissionState === 'denied') return 'text-red-500';
        if (permissionState === 'default') return 'text-gray-500';
        return isPushEnabled ? 'text-green-500' : 'text-gray-500';
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <div className="flex items-center justify-between p-4">
                    <h1 className="text-2xl font-bold">Ayarlar</h1>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6 pb-24">
                {/* Notification Permissions Section */}
                <section>
                    <h2 className="text-lg font-semibold mb-3 px-1">Bildirim İzinleri</h2>
                    <div className="bg-card rounded-lg border">
                        <button
                            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                            onClick={() => {
                                if (permissionState === 'denied') {
                                    toast.error("İzin reddedildi. Ayarlar > Uygulamalar > AuditPro > Bildirimler kısmından izni açın.");
                                } else {
                                    handleNotificationToggle(!isPushEnabled);
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    isPushEnabled ? "bg-green-500/20" : "bg-gray-500/20"
                                )}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium">Bildirimler</p>
                                    <p className={cn("text-sm", getNotificationStatusColor())}>
                                        {getNotificationStatusText()}
                                    </p>
                                </div>
                            </div>
                            <Switch 
                                checked={isPushEnabled && permissionState === 'granted'} 
                                disabled={permissionState === 'denied'}
                                onCheckedChange={handleNotificationToggle}
                            />
                        </button>
                    </div>
                </section>

                {/* Appearance Section */}
                <section>
                    <h2 className="text-lg font-semibold mb-3 px-1">Görünüm</h2>
                    <div className="bg-card rounded-lg border">
                        <button
                            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg"
                            onClick={() => {
                                const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                                setTheme(nextTheme);
                                toast.success(`Tema: ${nextTheme === 'light' ? 'Aydınlık' : nextTheme === 'dark' ? 'Karanlık' : 'Sistem'}`);
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full">
                                    {getThemeIcon()}
                                </div>
                                <div className="text-left">
                                    <p className="font-medium">Tema</p>
                                    <p className="text-sm text-muted-foreground">{getThemeLabel()}</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                </section>

                {/* Account Section */}
                <section>
                    <h2 className="text-lg font-semibold mb-3 px-1">Hesap</h2>
                    <div className="bg-card rounded-lg border">
                        <button
                            className="w-full flex items-center justify-between p-4 hover:bg-destructive/10 transition-colors rounded-lg text-destructive"
                            onClick={handleLogout}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive/10 rounded-full">
                                    <LogOut className="h-5 w-5" />
                                </div>
                                <p className="font-medium">Çıkış Yap</p>
                            </div>
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
