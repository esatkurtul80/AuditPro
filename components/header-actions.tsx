"use client";

import { Bell, Moon, Sun, User, LogOut, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { OnlineStatusBadge } from "./online-status-badge";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification } from "@/lib/types";
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
import { useTheme } from "next-themes";
import { toast } from "sonner";

// Separate component for header actions so it can be reused
export function HeaderActions({ compact = false }: { compact?: boolean }) {
    const { userProfile, signOut, loading } = useAuth();
    const router = useRouter();
    const isOnline = useOnlineStatus();
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (userProfile?.uid) {
            // Listen to user notifications
            const notifQuery = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("read", "==", false),
                orderBy("createdAt", "desc"),
                limit(5)
            );
            const unsubscribeNotif = onSnapshot(notifQuery, (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Notification[];
                setNotifications(notifs);
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

    const handleNotificationClick = (notification?: Notification) => {
        if (notification) {
            router.push(`/admin/notifications?highlight=${notification.id}`);
        } else {
            router.push("/admin/notifications?filter=pending_user");
        }
    };

    const viewAllNotifications = () => {
        router.push("/admin/notifications");
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
        toast.success("Çıkış yapıldı");
    };

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    const getInitials = (name: string) => {
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getNotificationTypeBadge = (type: string) => {
        switch (type) {
            case "audit_edited":
                return <Badge className="bg-blue-500 text-white text-[10px]">Denetim Düzenlendi</Badge>;
            case "pending_user":
                return <Badge className="bg-yellow-500 text-white text-[10px]">Kullanıcı Onayı</Badge>;
            default:
                return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
        }
    };

    const iconSize = compact ? "h-4 w-4" : "h-5 w-5";
    const avatarSize = compact ? "h-8 w-8" : "h-10 w-10";

    return compact ? (
        // Mobile/Tablet: Grouped layout with gap before profile
        <div className="flex items-center gap-2">
            {/* First 3 buttons: Online Status, Notifications, Theme */}
            <div className="flex items-center gap-0">
                {/* Online Status */}
                <div className="flex items-center justify-center w-6 md:w-auto md:mr-2">
                    <OnlineStatusBadge isOnline={isOnline} compact={compact} />
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
                            >
                                <Bell className={iconSize} />
                                {unreadCount > 0 && (
                                    <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                            <DropdownMenuLabel className="flex items-center justify-between">
                                <Badge
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-secondary/80"
                                    onClick={() => router.push("/admin/notifications")}
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
                                                    {getNotificationTypeBadge(notification.type)}
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

                {/* Theme Toggle */}
                <div className="flex items-center justify-center w-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="h-8 w-8"
                        suppressHydrationWarning
                        title={mounted ? (theme === "dark" ? "Açık Tema" : "Koyu Tema") : "Koyu Tema"}
                    >
                        <Sun className={`${iconSize} rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0`} />
                        <Moon className={`absolute ${iconSize} rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100`} />
                        <span className="sr-only">Tema değiştir</span>
                    </Button>
                </div>
            </div>

            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`relative ${avatarSize} rounded-full p-0`}
                    >
                        {loading ? (
                            <Skeleton className={`${avatarSize} rounded-full`} />
                        ) : (
                            <Avatar className={avatarSize}>
                                <AvatarFallback className="bg-primary text-primary-foreground">
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
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
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
    ) : (
        // Desktop: Original spacing
        <div className="flex items-center gap-1">
            {/* Online Status */}
            <OnlineStatusBadge isOnline={isOnline} compact={compact} />

            {/* Notifications Button */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        title={unreadCount > 0 ? `${unreadCount} yeni bildirim` : "Bildirimler"}
                    >
                        <Bell className={iconSize} />
                        {unreadCount > 0 && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                {unreadCount}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between">
                        <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-secondary/80"
                            onClick={() => router.push("/admin/notifications")}
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
                                            {getNotificationTypeBadge(notification.type)}
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

            {/* Theme Toggle */}
            <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                suppressHydrationWarning
                title={theme === "dark" ? "Açık Tema" : "Koyu Tema"}
            >
                <Sun className={`${iconSize} rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0`} />
                <Moon className={`absolute ${iconSize} rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100`} />
                <span className="sr-only">Tema değiştir</span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`relative ${avatarSize} rounded-full p-0`}
                    >
                        {loading ? (
                            <Skeleton className={`${avatarSize} rounded-full`} />
                        ) : (
                            <Avatar className={avatarSize}>
                                <AvatarFallback className="bg-primary text-primary-foreground">
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
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
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
