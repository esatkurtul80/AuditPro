"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    getDocs,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bell,
    Loader2,
    Trash2,
    Check,
    Filter,
    ExternalLink,
    CheckCheck,
    ChevronDown,
    ChevronUp,
    ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const ITEMS_PER_PAGE = 20;

type NotificationWithVirtual = Notification & { isVirtual?: boolean };

export default function NotificationsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userProfile } = useAuth();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>("all");
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (userProfile?.uid && userProfile.role === "admin") {
            const unsubscribeNotifs = loadNotifications();
            const unsubscribePending = loadPendingUsers();

            return () => {
                if (unsubscribeNotifs) unsubscribeNotifs();
                if (unsubscribePending) unsubscribePending();
            };
        }
    }, [userProfile, filterType]);

    useEffect(() => {
        const highlightId = searchParams.get("highlight");
        const filterParam = searchParams.get("filter");

        if (filterParam) {
            setFilterType(filterParam);
        }

        if (highlightId) {
            setExpandedIds(prev => {
                const newSet = new Set(prev);
                newSet.add(highlightId);
                return newSet;
            });
            // Auto scroll could be added here if needed
            setTimeout(() => {
                const element = document.getElementById(`notification-${highlightId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    }, [searchParams]);

    const loadPendingUsers = () => {
        const pendingQuery = query(
            collection(db, "users"),
            where("role", "==", "pending")
        );

        return onSnapshot(pendingQuery, (snapshot) => {
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt || Timestamp.now()
            }));
            setPendingUsers(users);
        });
    };

    const loadNotifications = () => {
        if (!userProfile?.uid) return;

        let notificationsQuery = query(
            collection(db, "notifications"),
            where("userId", "==", userProfile.uid),
            orderBy("createdAt", "desc"),
            limit(ITEMS_PER_PAGE)
        );

        if (filterType !== "all" && filterType !== "pending_user") {
            notificationsQuery = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("type", "==", filterType),
                orderBy("createdAt", "desc"),
                limit(ITEMS_PER_PAGE)
            );
        }

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            const notifs = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Notification[];

            setNotifications(notifs);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
            setLoading(false);
        });

        return unsubscribe;
    };

    const loadMore = async () => {
        if (!userProfile?.uid || !lastDoc) return;

        let moreQuery = query(
            collection(db, "notifications"),
            where("userId", "==", userProfile.uid),
            orderBy("createdAt", "desc"),
            startAfter(lastDoc),
            limit(ITEMS_PER_PAGE)
        );

        if (filterType !== "all" && filterType !== "pending_user") {
            moreQuery = query(
                collection(db, "notifications"),
                where("userId", "==", userProfile.uid),
                where("type", "==", filterType),
                orderBy("createdAt", "desc"),
                startAfter(lastDoc),
                limit(ITEMS_PER_PAGE)
            );
        }

        const snapshot = await getDocs(moreQuery);
        const moreNotifs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Notification[];

        setNotifications([...notifications, ...moreNotifs]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
    };

    const combinedNotifications = useMemo(() => {
        let items: NotificationWithVirtual[] = [...notifications];

        // Add virtual notifications for pending users
        if (filterType === "all" || filterType === "pending_user") {
            const virtualNotifs = pendingUsers.map(user => ({
                id: `virtual_pending_${user.id}`,
                userId: userProfile?.uid || "",
                type: "pending_user",
                title: "Kullanıcı Onayı Bekliyor",
                message: `${user.displayName || user.email} sisteme kayıt oldu ve onay bekliyor.`,
                read: false,
                createdAt: user.createdAt,
                isVirtual: true,
                relatedId: user.id
            } as NotificationWithVirtual));

            items = [...items, ...virtualNotifs];
        }

        // Sort by date desc
        return items.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt as any);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt as any);
            return dateB.getTime() - dateA.getTime();
        });
    }, [notifications, pendingUsers, filterType, userProfile]);

    const markAsRead = async (notificationId: string) => {
        try {
            await updateDoc(doc(db, "notifications", notificationId), {
                read: true,
            });
            // toast.success("Bildirim okundu olarak işaretlendi"); 
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifs = notifications.filter((n) => !n.read);
            const promises = unreadNotifs.map((n) =>
                updateDoc(doc(db, "notifications", n.id), { read: true })
            );
            await Promise.all(promises);
            toast.success("Tüm bildirimler okundu olarak işaretlendi");
        } catch (error) {
            console.error("Error marking all as read:", error);
            toast.error("Bildirimler güncellenirken hata oluştu");
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            await deleteDoc(doc(db, "notifications", notificationId));
            toast.success("Bildirim silindi");
        } catch (error) {
            console.error("Error deleting notification:", error);
            toast.error("Bildirim silinirken hata oluştu");
        }
    };

    const handleNotificationClick = (notification: NotificationWithVirtual) => {
        // If virtual (pending user), go to users page
        if (notification.isVirtual) {
            router.push("/admin/users?filter=pending");
            return;
        }

        // Mark as read if not read
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Toggle expand for audit_edited
        if (notification.type === "audit_edited" && notification.changes && notification.changes.length > 0) {
            const newExpanded = new Set(expandedIds);
            if (newExpanded.has(notification.id)) {
                newExpanded.delete(notification.id);
            } else {
                newExpanded.add(notification.id);
            }
            setExpandedIds(newExpanded);
        } else if (notification.relatedId) {
            // Default action for other types
            if (notification.type === "audit_edited") {
                router.push(`/audits/${notification.relatedId}?mode=view`);
            }
        }

    };

    const navigateToAudit = (e: React.MouseEvent, auditId: string) => {
        e.stopPropagation();
        router.push(`/audits/${auditId}?mode=view`);
    }

    const getNotificationTypeBadge = (type: string) => {
        switch (type) {
            case "audit_edited":
                return <Badge className="bg-blue-500">Denetim Düzenlendi</Badge>;
            case "action_rejected":
                return <Badge className="bg-red-500">Aksiyon Reddedildi</Badge>;
            case "action_approved":
                return <Badge className="bg-green-500">Aksiyon Onaylandı</Badge>;
            case "new_audit":
                return <Badge className="bg-purple-500">Yeni Denetim</Badge>;
            case "pending_user":
                return <Badge className="bg-yellow-500">Kullanıcı Onayı</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }
        return formatDistance(date, new Date(), {
            addSuffix: true,
            locale: tr,
        });
    };

    const formatFullDate = (timestamp: any) => {
        if (!timestamp) return "";
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }
        return new Intl.DateTimeFormat("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    };


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (

        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center justify-end">
                <div className="flex gap-2">
                    {notifications.some((n) => !n.read) && (
                        <Button
                            onClick={markAllAsRead}
                            variant="outline"
                            size="sm"
                        >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Tümünü Okundu İşaretle
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Tüm Bildirimler</CardTitle>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filtrele" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="audit_edited">
                                        Denetim Düzenlendi
                                    </SelectItem>
                                    <SelectItem value="action_rejected">
                                        Aksiyon Reddedildi
                                    </SelectItem>
                                    <SelectItem value="action_approved">
                                        Aksiyon Onaylandı
                                    </SelectItem>
                                    <SelectItem value="new_audit">Yeni Denetim</SelectItem>
                                    <SelectItem value="pending_user">
                                        Kullanıcı Onayı
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <CardDescription>
                        {combinedNotifications.length} bildirim bulundu
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {combinedNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Bell className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold">
                                Bildirim bulunamadı
                            </h3>
                            <p className="text-muted-foreground mt-2">
                                Henüz hiç bildiriminiz yok
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {combinedNotifications.map((notification) => (
                                <div
                                    id={`notification-${notification.id}`}
                                    key={notification.id}
                                    className={`rounded-lg border transition-all ${!notification.read && !notification.isVirtual
                                        ? "bg-blue-50/50 border-blue-200"
                                        : "bg-background"
                                        }`}
                                >
                                    <div
                                        className="p-4 cursor-pointer hover:bg-accent/50 flex items-start justify-between gap-4"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {getNotificationTypeBadge(
                                                    notification.type
                                                )}
                                                {!notification.read && !notification.isVirtual && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600"
                                                    >
                                                        YENİ
                                                    </Badge>
                                                )}
                                                {notification.isVirtual && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-600"
                                                    >
                                                        BEKLEYEN
                                                    </Badge>
                                                )}
                                            </div>
                                            <h4 className="font-semibold text-base">
                                                {notification.title}
                                            </h4>
                                            <p className="text-sm text-foreground">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(notification.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {notification.type === "audit_edited" && notification.changes && (
                                                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                                                    {expandedIds.has(notification.id) ? "Gizle" : "Detaylar"}
                                                    {expandedIds.has(notification.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </Button>
                                            )}

                                            {!notification.isVirtual && !notification.read && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    title="Okundu işaretle"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}

                                            {!notification.isVirtual && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(notification.id);
                                                    }}
                                                    title="Sil"
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedIds.has(notification.id) && notification.changes && (
                                        <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                                            <div className="mt-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <h5 className="font-semibold text-sm">Yapılan Değişiklikler</h5>
                                                        <span className="text-xs text-muted-foreground font-normal">
                                                            {formatFullDate(notification.createdAt)}
                                                        </span>
                                                    </div>
                                                    {notification.relatedId && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={(e) => navigateToAudit(e, notification.relatedId!)}
                                                        >
                                                            <ExternalLink className="mr-2 h-4 w-4" />
                                                            Denetime Git
                                                        </Button>
                                                    )}
                                                </div>

                                                <div className="rounded-md border bg-background overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Bölüm / Soru</TableHead>
                                                                <TableHead>Eski Cevap</TableHead>
                                                                <TableHead>Yeni Cevap</TableHead>
                                                                <TableHead className="text-right">Puan Değişimi</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {notification.changes.map((change, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell>
                                                                        <div className="font-medium text-xs text-muted-foreground">{change.sectionName}</div>
                                                                        <div className="text-sm line-clamp-2" title={change.questionText}>{change.questionText}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="secondary" className="font-normal">
                                                                            {change.oldAnswer}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="font-normal border-blue-200 bg-blue-50 text-blue-700">
                                                                            {change.newAnswer}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <span className="text-muted-foreground line-through text-xs">{change.oldScore}</span>
                                                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                            <span className={`font-bold ${change.newScore > change.oldScore ? 'text-green-600' :
                                                                                change.newScore < change.oldScore ? 'text-red-600' : ''
                                                                                }`}>
                                                                                {change.newScore}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {hasMore && combinedNotifications.length >= ITEMS_PER_PAGE && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        onClick={loadMore}
                                        variant="outline"
                                    >
                                        Daha Fazla Yükle
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

    );
}
