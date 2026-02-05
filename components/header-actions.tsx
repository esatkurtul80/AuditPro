"use client";

import { Bell, User, LogOut, Settings, WifiOff, CheckSquare, Clock, AlertCircle, CheckCircle, CalendarDays, CalendarOff, Home, Sparkles, Send } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { OnlineStatusBadge } from "./online-status-badge";
import { LocationStatusBadge } from "./location-status-badge";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification as NotificationModel } from "@/lib/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "sonner";
import { cn } from "@/lib/utils";


// Separate component for header actions so it can be reused
export function HeaderActions({ compact = false }: { compact?: boolean }) {
    const { userProfile, signOut, loading } = useAuth();
    const router = useRouter();
    const isOnline = useOnlineStatus();

    const [notifications, setNotifications] = useState<NotificationModel[]>([]);
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

    const [isPushEnabled, setIsPushEnabled] = useState(false);

    const checkPermissionState = async () => {
        if (!("Notification" in window)) return;
        
        const perm = Notification.permission;
        setNotificationPermission(perm);

        if (perm === 'granted' && 'serviceWorker' in navigator) {
             const reg = await navigator.serviceWorker.getRegistration();
             const sub = await reg?.pushManager?.getSubscription();
             setIsPushEnabled(!!sub);
             console.log("🔔 HeaderActions Check: Perm=", perm, "Sub=", !!sub);
        } else {
            setIsPushEnabled(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        checkPermissionState();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("👁️ App visible, checking permissions...");
                checkPermissionState();
            }
        };

        window.addEventListener("focus", checkPermissionState);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("focus", checkPermissionState);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (userProfile?.uid) {
            // Listen to user notifications
            const notifQuery = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("read", "==", false),
                orderBy("createdAt", "desc"),
                limit(99)
            );
            const unsubscribeNotif = onSnapshot(notifQuery, (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as NotificationModel[];

                // Denetmenler için audit_completed bildirimlerini gizle
                const filteredNotifs = userProfile.role === "denetmen"
                    ? notifs.filter(n => n.type !== "audit_completed")
                    : notifs;

                setNotifications(filteredNotifs);
            });

            // Also listen to pending users if admin
            let unsubscribePending: (() => void) | undefined;
            if (userProfile.role === "admin") {
                const pendingQuery = query(
                    collection(db, "users"),
                    where("role", "==", "pending")
                );
                unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
                    const users = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setPendingUsers(users);
                });
            }

            return () => {
                unsubscribeNotif();
                if (unsubscribePending) unsubscribePending();
            };
        }
    }, [userProfile]);

    const unreadCount = notifications.length + pendingUsers.length;

    const handleNotificationClick = (notification?: NotificationModel) => {
        if (notification) {
            router.push(`/notifications?highlight=${notification.id}`);
        } else {
            // Pending user notification (no specific notification obj)
            router.push("/admin/users?filter=pending");
        }
    };

    const viewAllNotifications = () => {
        router.push("/notifications");
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
        toast.success("Çıkış yapıldı");
    };



    const getInitials = (name: string) => {
        if (!name) return "U";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getNotificationTypeBadge = (notification: NotificationModel) => {
        switch (notification.type) {
            case "action_rejected":
            case "rejected_action":
                return <Badge className="bg-red-500 text-white text-[10px]">Aksiyon Reddedildi</Badge>;
            case "pending_user":
                return <Badge className="bg-yellow-500 text-white text-[10px]">Kullanıcı Onayı</Badge>;
            case "admin_message":
                return <Badge variant="outline" className="text-[10px]">{notification.senderName || "Yönetici Mesajı"}</Badge>;
            default:
                return <Badge variant="outline" className="text-[10px]">{notification.type}</Badge>;
        }
    };

    const iconSize = compact ? "h-4 w-4" : "h-5 w-5";
    const avatarSize = compact ? "h-8 w-8" : "h-10 w-10";
    const isStoreUser = userProfile?.role === "magaza" || !!userProfile?.storeId;

    if (compact && isStoreUser) {
        return (
            <Badge
                variant={isOnline ? "default" : "destructive"}
                className={`${isOnline ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} text-white transition-colors`}
            >
                {isOnline ? (
                    <>
                        <div className="h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse" />
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

    return compact ? (
        <div className="flex items-center gap-2">


            {/* First 3 buttons: Online Status, Notifications, Theme */}
            <div className="flex items-center gap-0">
                <div className="flex items-center justify-center w-6 md:w-auto md:mr-2 gap-1">
                    <OnlineStatusBadge isOnline={isOnline} compact={compact} />
                    <LocationStatusBadge compact={compact} />
                </div>





                {/* Notifications Button */}
                <div className="flex items-center justify-center w-6">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative h-8 w-8"
                                title={unreadCount > 0 ? `${unreadCount} yeni bildirim` : "Bildirimler"}
                                suppressHydrationWarning
                            >
                                <Bell className={iconSize} />
                                {unreadCount > 0 && (
                                    <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        {/* Dropdown Content... */}
                        <DropdownMenuContent align="end" sideOffset={8} className="w-72 md:w-80 anim-slide-down-in anim-slide-down-out">
                            <DropdownMenuLabel className="flex items-center justify-between">
                                <Badge
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-secondary/80"
                                    onClick={() => router.push("/notifications")}
                                >
                                    Bildirimler
                                </Badge>
                                {unreadCount > 0 && (
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {unreadCount} yeni
                                    </span>
                                )}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {unreadCount > 0 ? (
                                <>
                                    {/* Pending users notification */}
                                    {pendingUsers.length > 0 && (
                                        <DropdownMenuItem
                                            className="cursor-pointer p-3 focus:bg-accent"
                                            onClick={() => handleNotificationClick()}
                                        >
                                            <div className="flex flex-col gap-1 w-full">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-semibold text-sm text-primary">Yeni Kullanıcı Onayı</span>
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50">
                                                        YENİ
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-foreground">
                                                    <span className="font-medium">
                                                        {pendingUsers.map(u => u.displayName || u.email).join(", ")}
                                                    </span>
                                                    <span className="text-muted-foreground"> onay bekliyor.</span>
                                                </p>
                                            </div>
                                        </DropdownMenuItem>
                                    )}

                                    {/* System notifications */}
                                    {notifications.slice(0, 3).map((notification) => (
                                        <DropdownMenuItem
                                            key={notification.id}
                                            className="cursor-pointer p-3 focus:bg-accent"
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div className="flex flex-col gap-1 w-full">
                                                <div className="flex items-center justify-between mb-1">
                                                    {getNotificationTypeBadge(notification)}
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50">
                                                        YENİ
                                                    </Badge>
                                                </div>
                                                <p className="font-semibold text-sm">{notification.title}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {notification.message}
                                                </p>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="cursor-pointer p-2 text-center justify-center text-primary font-medium"
                                        onClick={viewAllNotifications}
                                    >
                                        Tüm Bildirimleri Gör
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <div className="p-8 text-center">
                                    <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        Yeni bildiriminiz yok
                                    </p>
                                </div>
                            )}


                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>




            </div>

            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`relative ${avatarSize} rounded-full p-0`}
                        suppressHydrationWarning
                    >
                        {loading ? (
                            <Skeleton className={`${avatarSize} rounded-full`} />
                        ) : (
                            <Avatar className={avatarSize}>
                                <AvatarFallback className="bg-blue-600 text-white">
                                    {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "U"}
                                </AvatarFallback>
                            </Avatar>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">
                                {userProfile?.displayName || "Kullanıcı"}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {userProfile?.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                        if (userProfile?.role === "denetmen") {
                            router.push("/denetmen/settings");
                        } else if (userProfile?.role === "magaza" || userProfile?.storeId) {
                            router.push("/magaza/panel?tab=settings");
                        } else {
                            router.push("/settings");
                        }
                    }}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Ayarlar</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Çıkış Yap</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div >
    ) : (
        <div className="flex items-center gap-1">


            {/* Online Status */}
            <div className="flex items-center gap-1">
                <OnlineStatusBadge isOnline={isOnline} compact={compact} />
                <LocationStatusBadge compact={compact} />
            </div>



            {/* Notifications Button */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        title={unreadCount > 0 ? `${unreadCount} yeni bildirim` : "Bildirimler"}
                        suppressHydrationWarning
                    >
                        <Bell className={iconSize} />
                        {unreadCount > 0 && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                {unreadCount}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-72 md:w-80 anim-slide-down-in anim-slide-down-out">
                    <DropdownMenuLabel className="flex items-center justify-between">
                        <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-secondary/80"
                            onClick={() => router.push("/notifications")}
                        >
                            Bildirimler
                        </Badge>
                        {unreadCount > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">
                                {unreadCount} yeni
                            </span>
                        )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {unreadCount > 0 ? (
                        <>
                            {/* Pending users notification */}
                            {pendingUsers.length > 0 && (
                                <DropdownMenuItem
                                    className="cursor-pointer p-3 focus:bg-accent"
                                    onClick={() => handleNotificationClick()}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm text-primary">Yeni Kullanıcı Onayı</span>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50">
                                                YENİ
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-foreground">
                                            <span className="font-medium">
                                                {pendingUsers.map(u => u.displayName || u.email).join(", ")}
                                            </span>
                                            <span className="text-muted-foreground"> onay bekliyor.</span>
                                        </p>
                                    </div>
                                </DropdownMenuItem>
                            )}

                            {/* System notifications */}
                            {notifications.slice(0, 3).map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className="cursor-pointer p-3 focus:bg-accent"
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="flex items-center justify-between mb-1">
                                            {getNotificationTypeBadge(notification)}
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50">
                                                YENİ
                                            </Badge>
                                        </div>
                                        <p className="font-semibold text-sm">{notification.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>
                                </DropdownMenuItem>
                            ))}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer p-2 text-center justify-center text-primary font-medium"
                                onClick={viewAllNotifications}
                            >
                                Tüm Bildirimleri Gör
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <div className="p-8 text-center">
                            <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Yeni bildiriminiz yok
                            </p>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>



            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`relative ${avatarSize} rounded-full p-0`}
                        suppressHydrationWarning
                    >
                        {loading && !userProfile ? (
                            <Skeleton className={`${avatarSize} rounded-full`} />
                        ) : (
                            <Avatar className={avatarSize}>
                                <AvatarFallback className="bg-blue-600 text-white">
                                    {userProfile ? getInitials(userProfile.displayName || userProfile.email || "User") : "U"}
                                </AvatarFallback>
                            </Avatar>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">
                                {userProfile?.displayName || "Kullanıcı"}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {userProfile?.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                        if (userProfile?.role === "denetmen") {
                            router.push("/denetmen/settings");
                        } else if (userProfile?.role === "magaza" || userProfile?.storeId) {
                            router.push("/magaza/panel?tab=settings");
                        } else {
                            router.push("/settings");
                        }
                    }}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Ayarlar</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Çıkış Yap</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
