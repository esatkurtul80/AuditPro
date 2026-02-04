"use client";

import { useAuth } from "@/components/auth-provider";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Moon,
    Sun,
    Smartphone,
    Languages,
    ChevronRight,
    ChevronLeft,
    Bell,
    SunMedium,
    Archive,
    UserCog,
    LogOut
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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
                const swReady = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000))
                ]).catch(() => null);

                if (!swReady) {
                    setIsPushEnabled(true);
                    return; 
                }

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

    const handleLogout = async () => {
        try {
            await signOut();
            router.push("/login");
            toast.success("Çıkış yapıldı");
        } catch (error) {
            toast.error("Çıkış yapılırken bir hata oluştu");
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#f6f8f6] dark:bg-background transition-colors duration-200 font-sans">
            <div className="relative flex flex-col w-full max-w-md mx-auto min-h-screen overflow-x-hidden">



                {/* Sticky Header with Back Button */}
                <div className="sticky top-0 z-50 bg-white dark:bg-background border-b border-gray-200 dark:border-border">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            onClick={() => router.push("/denetmen/panel")}
                            className="flex items-center gap-2 text-gray-700 dark:text-foreground hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <ChevronLeft size={24} />
                            <span className="font-medium">Geri</span>
                        </button>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-foreground">Ayarlar</h1>
                        <div className="w-16"></div> {/* Spacer for centering */}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex flex-col gap-6 px-4 pt-6 pb-24">

                    {/* Profile Section */}
                    <div className="flex items-center gap-4 p-4 bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
                        <div className="relative shrink-0">
                            <div className="relative h-16 w-16 rounded-full ring-2 ring-[#13ec5b]/30 overflow-hidden">
                                {userProfile?.photoURL ? (
                                    <Image
                                        src={userProfile.photoURL}
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full bg-gray-100 dark:bg-accent text-gray-400">
                                        <UserCog size={32} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col flex-1 justify-center overflow-hidden">
                            <p className="text-xl font-bold leading-tight truncate text-gray-900 dark:text-foreground">
                                {userProfile?.displayName || "Denetmen"}
                            </p>
                            <p className="text-gray-500 dark:text-muted-foreground text-sm font-medium truncate">
                                {userProfile?.email || "email@example.com"}
                            </p>
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-gray-500 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider ml-4">Görünüm</h3>
                        <div className="flex flex-col bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-border">

                            {/* Theme Selector */}
                            <div className="p-3 border-b border-gray-100 dark:border-border">
                                <div className="flex h-10 w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-accent p-1 relative z-0">
                                    {/* Light */}
                                    <button
                                        onClick={() => setTheme("light")}
                                        className={cn(
                                            "relative flex cursor-pointer h-full grow items-center justify-center rounded-md transition-colors duration-200 text-sm font-medium gap-2 z-10",
                                            theme === 'light'
                                                ? "text-black"
                                                : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                                        )}
                                    >
                                        {theme === 'light' && (
                                            <motion.div
                                                layoutId="theme-indicator"
                                                className="absolute inset-0 bg-white dark:bg-background shadow-sm rounded-md -z-10"
                                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            />
                                        )}
                                        <Sun size={18} className="relative z-20" />
                                        <span className="truncate hidden sm:inline relative z-20">Açık</span>
                                    </button>

                                    {/* Dark */}
                                    <button
                                        onClick={() => setTheme("dark")}
                                        className={cn(
                                            "relative flex cursor-pointer h-full grow items-center justify-center rounded-md transition-colors duration-200 text-sm font-medium gap-2 z-10",
                                            theme === 'dark'
                                                ? "text-black dark:text-foreground"
                                                : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                                        )}
                                    >
                                        {theme === 'dark' && (
                                            <motion.div
                                                layoutId="theme-indicator"
                                                className="absolute inset-0 bg-white dark:bg-background shadow-sm rounded-md -z-10"
                                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            />
                                        )}
                                        <Moon size={18} className="relative z-20" />
                                        <span className="truncate hidden sm:inline relative z-20">Koyu</span>
                                    </button>

                                    {/* System */}
                                    <button
                                        onClick={() => setTheme("system")}
                                        className={cn(
                                            "relative flex cursor-pointer h-full grow items-center justify-center rounded-md transition-colors duration-200 text-sm font-medium gap-2 z-10",
                                            theme === 'system'
                                                ? "text-black dark:text-foreground"
                                                : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                                        )}
                                    >
                                        {theme === 'system' && (
                                            <motion.div
                                                layoutId="theme-indicator"
                                                className="absolute inset-0 bg-white dark:bg-background shadow-sm rounded-md -z-10"
                                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            />
                                        )}
                                        <Smartphone size={18} className="relative z-20" />
                                        <span className="truncate hidden sm:inline relative z-20">Sistem</span>
                                    </button>
                                </div>
                            </div>

                            {/* Language Selector (Inactive) */}
                            <button className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-accent/50 transition-colors w-full text-left opacity-70">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                    <Languages size={20} />
                                </div>
                                <div className="flex flex-col justify-center flex-1">
                                    <p className="text-base font-medium leading-normal text-gray-900 dark:text-foreground">Dil</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 dark:text-muted-foreground">Türkçe</span>
                                    <ChevronRight className="text-gray-400 dark:text-muted-foreground" size={20} />
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-gray-500 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider ml-4">Bildirimler</h3>
                        <div className="flex flex-col bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-border divide-y divide-gray-100 dark:divide-border">

                            {/* General Notifications */}
                            <div className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-accent/50 transition-colors w-full">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#13ec5b]/20 text-[#13ec5b] dark:text-[#13ec5b]">
                                        <Bell size={20} />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <p className="text-base font-medium leading-normal text-gray-900 dark:text-foreground">Bildirimlere İzin Ver</p>
                                        <p className="text-xs text-gray-500 dark:text-muted-foreground text-start">
                                            {permissionState === 'denied' 
                                                ? "İzin reddedildi. Ayarlardan açın." 
                                                : isPushEnabled 
                                                    ? "Bildirimler açık" 
                                                    : "Bildirim almak için açın"}
                                        </p>
                                    </div>
                                </div>
                                <div 
                                    onClick={async () => {
                                        const checked = !isPushEnabled;
                                        if (checked) {
                                            toast.info("Bildirim servisi başlatılıyor...");

                                            if (!("Notification" in window)) {
                                                toast.error("Tarayıcınız bildirimleri desteklemiyor.");
                                                return;
                                            }

                                            let currentPermission = Notification.permission;
                                            if (currentPermission !== "granted") {
                                                currentPermission = await Notification.requestPermission();
                                            }

                                            if (currentPermission !== "granted") {
                                                setPermissionState(currentPermission);
                                                setIsPushEnabled(false);
                                                toast.error("İzin verilmedi! Lütfen telefon ayarlarından bildirimlere izin verin.");
                                                return;
                                            }

                                            localStorage.removeItem("notifications_manual_off");
                                            toast.loading("Uygulama yapılandırılıyor...");
                                            
                                            setTimeout(() => {
                                                window.location.href = window.location.origin + window.location.pathname + '?update_t=' + Date.now();
                                            }, 1000);
                                            
                                        } else {
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
                                            } catch (e) {
                                                console.error(e);
                                                toast.error("Kapatılırken hata oluştu.");
                                            }
                                        }
                                    }}
                                    className={cn(
                                        "w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out",
                                        isPushEnabled ? "bg-[#13ec5b]" : "bg-gray-200 dark:bg-gray-700"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all duration-200 shadow-sm",
                                        isPushEnabled ? "right-[2px]" : "left-[2px]"
                                    )}></div>
                                </div>
                            </div>

                            {/* Daily Summary */}
                            <div className="flex items-center justify-between px-4 py-3.5 opacity-70">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                        <SunMedium size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-base font-medium leading-normal text-gray-900 dark:text-foreground">Günlük Özet</p>
                                        <p className="text-xs text-gray-500 dark:text-muted-foreground">Sabah 09:00'da gönder</p>
                                    </div>
                                </div>
                                <div className="w-11 h-6 bg-[#13ec5b] rounded-full relative cursor-pointer">
                                    <div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full transition-all"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data & Account Section */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-gray-500 dark:text-muted-foreground text-xs font-semibold uppercase tracking-wider ml-4">Veri & Hesap</h3>
                        <div className="flex flex-col bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-border divide-y divide-gray-100 dark:divide-border">

                            {/* Archive (Inactive) */}
                            <button className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-accent/50 transition-colors w-full text-left opacity-70">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                        <Archive size={20} />
                                    </div>
                                    <p className="text-base font-medium leading-normal text-gray-900 dark:text-foreground">Tamamlananları Arşivle</p>
                                </div>
                                <ChevronRight className="text-gray-400 dark:text-muted-foreground" size={20} />
                            </button>

                            {/* Account Settings (Inactive) */}
                            <button className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-accent/50 transition-colors w-full text-left opacity-70">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                        <UserCog size={20} />
                                    </div>
                                    <p className="text-base font-medium leading-normal text-gray-900 dark:text-foreground">Hesap Yönetimi</p>
                                </div>
                                <ChevronRight className="text-gray-400 dark:text-muted-foreground" size={20} />
                            </button>

                            {/* Sign Out (Active) */}
                            <button
                                onClick={handleLogout}
                                className="flex items-center px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors w-full text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                        <LogOut size={20} />
                                    </div>
                                    <p className="text-base font-medium leading-normal text-red-600 dark:text-red-400">Çıkış Yap</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Version Info Footer */}
                    <div className="flex flex-col items-center justify-center py-6 gap-1">
                        <p className="text-xs text-gray-400 dark:text-muted-foreground">AuditPro {process.env.NEXT_PUBLIC_APP_VERSION}</p>
                        <p className="text-xs text-gray-400 dark:text-muted-foreground">Tüm hakları saklıdır.</p>
                    </div>

                </div>
            </div>
        </div>
    );
}
