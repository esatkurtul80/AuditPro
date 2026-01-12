"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserProfile } from "@/lib/types";

interface StoreAuditHistoryDialogProps {
    storeId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    storeName?: string;
    auditors: UserProfile[]; // Add prop
}

interface MiniAuditRecord {
    id: string;
    createdAt: Date;
    auditorName?: string;
    auditorId?: string; // To fetch name if not present, though usually stored
    score?: number;
    totalScore?: number;
}

export function StoreAuditHistoryDialog({ storeId, open, onOpenChange, storeName, auditors }: StoreAuditHistoryDialogProps) {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<MiniAuditRecord[]>([]);

    useEffect(() => {
        if (open && storeId) {
            fetchHistory(storeId);
        } else {
            setHistory([]);
        }
    }, [open, storeId]);

    const fetchHistory = async (id: string) => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "audits"),
                where("storeId", "==", id),
                orderBy("createdAt", "desc"),
                limit(10)
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    createdAt: (d.createdAt as Timestamp)?.toDate() || new Date(),
                    auditorName: d.auditorName || "Bilinmiyor",
                    auditorId: d.auditorId, // Capture ID
                    score: d.totalScore ?? d.score
                } as MiniAuditRecord;
            });
            setHistory(data);
        } catch (error) {
            console.error("Error fetching store history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to color code score
    const getScoreColor = (score?: number) => {
        if (score === undefined) return "bg-gray-100 text-gray-700 hover:bg-gray-100";
        if (score >= 90) return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200";
        if (score >= 70) return "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200";
        return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200";
    };

    const getAuditorDisplayName = (auditorId?: string, fallbackName?: string) => {
        if (!auditorId) return fallbackName || "-";
        const auditor = auditors.find(a => a.uid === auditorId);
        if (auditor) {
            return `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim();
        }
        return fallbackName || "-";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{storeName || "Mağaza"} - Denetim Geçmişi</DialogTitle>
                    <DialogDescription>
                        Bu mağazaya yapılan son 10 denetim özeti.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            Bu mağaza için henüz denetim kaydı bulunamadı.
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-slate-500 font-semibold">
                                    <tr>
                                        <th className="px-3 py-2">Tarih</th>
                                        <th className="px-3 py-2">Denetmen</th>
                                        <th className="px-3 py-2 text-center">Puan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {history.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 font-medium text-slate-700">
                                                {format(record.createdAt, "dd MMM yyyy", { locale: tr })}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                                {getAuditorDisplayName(record.auditorId, record.auditorName)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <Badge variant="outline" className={getScoreColor(record.score)}>
                                                    {record.score}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
