"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement } from "@/lib/types";
import { getAnnouncementReadStatus } from "@/lib/announcement-utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ChevronDown, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReadStatusProps {
    announcementId: string;
    recipients: any[];
}

export function ReadStatus({ announcementId, recipients }: ReadStatusProps) {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(true);
    const [readOpen, setReadOpen] = useState(false);
    const [unreadOpen, setUnreadOpen] = useState(false);

    // Real-time listener for announcement updates
    useEffect(() => {
        if (!announcementId) return;

        const unsubscribe = onSnapshot(
            doc(db, "announcements", announcementId),
            (snapshot) => {
                if (snapshot.exists()) {
                    setAnnouncement({
                        id: snapshot.id,
                        ...snapshot.data(),
                    } as Announcement);
                }
                setLoading(false);
            },
            (error) => {
                if (error.code !== 'permission-denied') {
                    console.error("Error listening to announcement:", error);
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [announcementId]);

    if (loading || !announcement) {
        return (
            <div className="space-y-2 animate-pulse">
                <div className="h-8 w-32 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
            </div>
        );
    }

    const status = getAnnouncementReadStatus(announcement, recipients);

    return (
        <div className="space-y-3 border-t pt-4 mt-4">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Okuma Durumu</h4>
                <Badge variant="secondary" className="ml-auto">
                    {status.hasRoleGroupRecipients
                        ? `${status.readCount} kişi okudu`
                        : `${status.readCount} / ${status.totalRecipients}`
                    }
                </Badge>
            </div>

            {/* Read Users */}
            <Collapsible open={readOpen} onOpenChange={setReadOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Okuyanlar</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {status.readCount}
                        </Badge>
                    </div>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform text-muted-foreground",
                            readOpen && "transform rotate-180"
                        )}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                    {status.readUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">
                            Henüz kimse okumadı
                        </p>
                    ) : (
                        status.readUsers.map((user) => (
                            <div
                                key={user.userId}
                                className="flex items-center justify-between px-3 py-2 rounded bg-muted/30"
                            >
                                <span className="text-sm">{user.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(
                                        new Date(user.readAt.seconds * 1000),
                                        { addSuffix: true, locale: tr }
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </CollapsibleContent>
            </Collapsible>

            {/* Unread Users - only show if we have specific user recipients */}
            {/* Unread Users */}
            <Collapsible open={unreadOpen} onOpenChange={setUnreadOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Okumayanlar</span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {status.unreadCount}
                        </Badge>
                    </div>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform text-muted-foreground",
                            unreadOpen && "transform rotate-180"
                        )}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                    {status.unreadUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">
                            Herkes okudu yada grup alıcısı
                        </p>
                    ) : (
                        status.unreadUsers.map((user) => (
                            <div
                                key={user.userId}
                                className="flex items-center px-3 py-2 rounded bg-muted/30"
                            >
                                <span className="text-sm">{user.userName}</span>
                            </div>
                        ))
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
