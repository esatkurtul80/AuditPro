"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
    CheckCircle2,
    Clock,
    Users,
    Search,
    Loader2,
} from "lucide-react";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface BroadcastItem {
    id: string;
    title: string;
    message: string;
    targetType: string;
    totalTarget: number;
    successCount: number;
    senderName: string;
    senderId: string;
    createdAt: Timestamp;
}

interface UserNotifEntry {
    userId: string;
    displayName: string;
    read: boolean;
    readAt?: Timestamp | null;
}

interface BroadcastDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    broadcast: BroadcastItem | null;
}

export function BroadcastDetailDialog({
    open,
    onOpenChange,
    broadcast,
}: BroadcastDetailDialogProps) {
    const [entries, setEntries] = useState<UserNotifEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"all" | "read" | "unread">("all");

    useEffect(() => {
        if (!open || !broadcast) return;
        setLoading(true);
        setEntries([]);
        setSearch("");
        setTab("all");

        const fetchEntries = async () => {
            try {
                // Find all notifications matching this broadcast (same title + message, near same createdAt)
                const broadcastTime = broadcast.createdAt.toDate();
                const windowStart = new Date(broadcastTime.getTime() - 60 * 1000); // -1 min
                const windowEnd = new Date(broadcastTime.getTime() + 5 * 60 * 1000); // +5 min

                const notifQuery = query(
                    collection(db, "notifications"),
                    where("title", "==", broadcast.title),
                    where("type", "==", "admin_message")
                );

                const notifSnap = await getDocs(notifQuery);

                // Filter by time window
                const matchingNotifs = notifSnap.docs.filter((d) => {
                    const createdAt = d.data().createdAt?.toDate?.();
                    return createdAt && createdAt >= windowStart && createdAt <= windowEnd;
                });

                // Fetch user display names in parallel (with a cache for deduplication)
                const userCache: Record<string, string> = {};
                const results: UserNotifEntry[] = await Promise.all(
                    matchingNotifs.map(async (notifDoc) => {
                        const data = notifDoc.data();
                        const userId: string = data.userId;

                        if (!userCache[userId]) {
                            try {
                                const userDoc = await getDoc(doc(db, "users", userId));
                                if (userDoc.exists()) {
                                    const ud = userDoc.data();
                                    userCache[userId] =
                                        ud.displayName || ud.email || userId.substring(0, 8);
                                } else {
                                    userCache[userId] = userId.substring(0, 8);
                                }
                            } catch {
                                userCache[userId] = userId.substring(0, 8);
                            }
                        }

                        return {
                            userId,
                            displayName: userCache[userId],
                            read: !!data.read,
                            readAt: data.readAt || null,
                        };
                    })
                );

                // Sort: unread first, then alphabetical
                results.sort((a, b) => {
                    if (a.read === b.read) return a.displayName.localeCompare(b.displayName, "tr");
                    return a.read ? 1 : -1;
                });

                setEntries(results);
            } catch (err) {
                console.error("BroadcastDetailDialog fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEntries();
    }, [open, broadcast]);

    if (!broadcast) return null;

    const filtered = entries.filter((e) => {
        const matchSearch = e.displayName.toLowerCase().includes(search.toLowerCase());
        if (tab === "read") return matchSearch && e.read;
        if (tab === "unread") return matchSearch && !e.read;
        return matchSearch;
    });

    const readCount = entries.filter((e) => e.read).length;
    const unreadCount = entries.filter((e) => !e.read).length;
    const readRate = entries.length > 0 ? Math.round((readCount / entries.length) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        Bildirim Detayı
                    </DialogTitle>
                    <DialogDescription className="line-clamp-2">
                        <span className="font-medium text-foreground">{broadcast.title}</span>
                        {" — "}
                        {broadcast.createdAt
                            ? format(broadcast.createdAt.toDate(), "d MMM yyyy HH:mm", { locale: tr })
                            : ""}
                    </DialogDescription>
                </DialogHeader>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/50 rounded-lg p-3 border">
                        <div className="text-xl font-bold">{entries.length}</div>
                        <div className="text-xs text-muted-foreground">Gönderildi</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-100 dark:border-green-900">
                        <div className="text-xl font-bold text-green-600">{readCount}</div>
                        <div className="text-xs text-green-700 dark:text-green-400">Okundu</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 border border-orange-100 dark:border-orange-900">
                        <div className="text-xl font-bold text-orange-600">{unreadCount}</div>
                        <div className="text-xs text-orange-700 dark:text-orange-400">Okunmadı</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Okunma Oranı</span>
                        <span className="font-semibold text-foreground">{readRate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${readRate}%` }}
                        />
                    </div>
                </div>

                {/* Search + Tabs */}
                <div className="flex flex-col gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9 h-9"
                            placeholder="Kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1">
                        {(["all", "unread", "read"] as const).map((t) => (
                            <Button
                                key={t}
                                size="sm"
                                variant={tab === t ? "default" : "outline"}
                                className="h-7 text-xs px-3"
                                onClick={() => setTab(t)}
                            >
                                {t === "all" ? `Tümü (${entries.length})` : t === "read" ? `Okudu (${readCount})` : `Okumadı (${unreadCount})`}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* User List */}
                <ScrollArea className="h-[280px] rounded-md border bg-muted/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            {search ? "Kullanıcı bulunamadı." : "Kayıt yok."}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {filtered.map((entry) => (
                                <div
                                    key={entry.userId}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                entry.read
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                                            }`}
                                        >
                                            {entry.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium truncate">
                                            {entry.displayName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {entry.read ? (
                                            <Badge
                                                variant="outline"
                                                className="bg-green-50 text-green-700 border-green-200 gap-1 text-[10px] px-2"
                                            >
                                                <CheckCircle2 className="h-3 w-3" />
                                                Okundu
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="bg-orange-50 text-orange-700 border-orange-200 gap-1 text-[10px] px-2"
                                            >
                                                <Clock className="h-3 w-3" />
                                                Bekleniyor
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Kapat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
