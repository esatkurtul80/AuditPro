"use client";

import { useEffect, useState } from "react";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    getDocs,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store } from "@/lib/types";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    CheckCircle2,
    XCircle,
    MapPinOff,
    MapPin,
    PlayCircle,
    FileText,
    ClipboardList,
    Store as StoreIcon,
    Clock,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { SpecialReportGenerator } from "@/components/admin/special-report-generator";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ReportPanelDashboard() {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [specialReportAudit, setSpecialReportAudit] = useState<Audit | null>(null);

    useEffect(() => {
        let unsub: () => void;

        const init = async () => {
            // Fetch stores once
            const storeSnap = await getDocs(collection(db, "stores"));
            const storeData = storeSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Store[];
            setStores(storeData);

            // Live audits
            const q = query(collection(db, "audits"), orderBy("createdAt", "desc"));
            unsub = onSnapshot(q, (snap) => {
                const all = snap.docs.map((d) => ({
                    ...(d.data() as Audit),
                    id: d.id,
                })).filter((a) => !a.isDeleted);
                setAudits(all);
                setLoading(false);
            });
        };

        init();
        return () => { if (unsub) unsub(); };
    }, []);

    const today = new Date();

    const todayAudits = audits.filter((a) => {
        const d = a.createdAt?.toDate();
        if (!d) return false;
        return (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
        );
    });

    const liveAudits = audits.filter((a) => {
        if (a.status !== "devam_ediyor" || !a.startedAt) return false;
        const d = a.startedAt.toDate();
        return (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
        );
    });

    const calcDistance = (loc1?: string | null, loc2?: string | null): number | null => {
        if (!loc1 || !loc2) return null;
        try {
            const [lat1, lon1] = loc1.split(",").map(Number);
            const [lat2, lon2] = loc2.split(",").map(Number);
            if ([lat1, lon1, lat2, lon2].some(isNaN)) return null;
            const R = 6371000;
            const phi1 = (lat1 * Math.PI) / 180;
            const phi2 = (lat2 * Math.PI) / 180;
            const dPhi = ((lat2 - lat1) * Math.PI) / 180;
            const dLam = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dPhi / 2) ** 2 +
                Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        } catch {
            return null;
        }
    };

    const scoreColor = (pct: number) => {
        if (pct >= 90) return "bg-emerald-500";
        if (pct >= 75) return "bg-blue-500";
        if (pct >= 50) return "bg-amber-500";
        return "bg-red-500";
    };

    const quickStats = {
        total: todayAudits.length,
        completed: todayAudits.filter((a) => a.status === "tamamlandi").length,
        live: liveAudits.length,
        uniqueStores: new Set(todayAudits.map((a) => a.storeId)).size,
    };

    return (
        <div className="container mx-auto py-6 px-4 space-y-6 animate-in fade-in duration-300">
            {/* Page Title */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Günlük Denetim Paneli</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {today.toLocaleDateString("tr-TR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Toplam Denetim", value: quickStats.total, icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
                    { label: "Tamamlanan", value: quickStats.completed, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
                    { label: "Aktif Denetim", value: quickStats.live, icon: PlayCircle, color: "text-amber-600 bg-amber-50" },
                    { label: "Denetlenen Mağaza", value: quickStats.uniqueStores, icon: StoreIcon, color: "text-purple-600 bg-purple-50" },
                ].map((s) => (
                    <Card key={s.label} className="border shadow-sm">
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                                <p className="text-3xl font-bold mt-1 tabular-nums">{loading ? "—" : s.value}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${s.color}`}>
                                <s.icon className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Live Audits */}
            {liveAudits.length > 0 && (
                <Card className="border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                            </span>
                            <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
                                Online Denetimler
                            </CardTitle>
                            <Badge className="ml-auto bg-emerald-600 text-white">{liveAudits.length} Aktif</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-emerald-200 dark:border-emerald-800">
                                        <TableHead>Mağaza</TableHead>
                                        <TableHead>Denetmen</TableHead>
                                        <TableHead>Başlangıç</TableHead>
                                        <TableHead>Konum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {liveAudits.map((audit) => {
                                        const store = stores.find((s) => s.id === audit.storeId);
                                        const dist = calcDistance(audit.location, store?.location);
                                        const isApproved = dist !== null && dist <= 100;
                                        return (
                                            <TableRow key={audit.id} className="border-emerald-100 dark:border-emerald-800 hover:bg-emerald-50/70">
                                                <TableCell className="font-medium">{audit.storeName}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        {audit.auditorName}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {audit.startedAt?.toDate().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                                </TableCell>
                                                <TableCell>
                                                    {!store?.location ? (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5" />Konum Yok</span>
                                                    ) : isApproved ? (
                                                        <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Onaylandı</span>
                                                    ) : (
                                                        <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />Onaylanmadı</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Today's Audits - Special Reports */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        Mağazaların Özel Raporları
                    </CardTitle>
                    <CardDescription>Bugün tamamlanan denetimlerin özel raporu</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Clock className="h-8 w-8 animate-pulse" />
                                <span className="text-sm">Yükleniyor...</span>
                            </div>
                        </div>
                    ) : todayAudits.filter((a) => a.status === "tamamlandi").length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
                            <TrendingUp className="h-12 w-12 opacity-20" />
                            <p className="text-sm font-medium">Bugün tamamlanan denetim yok</p>
                            <p className="text-xs">Tamamlanan denetimler burada görünecek</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mağaza</TableHead>
                                        <TableHead>Denetim Türü</TableHead>
                                        <TableHead>Denetmen</TableHead>
                                        <TableHead>Puan</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todayAudits
                                        .filter((a) => a.status === "tamamlandi")
                                        .map((audit) => {
                                            const pct = audit.maxScore
                                                ? Math.round((audit.totalScore / audit.maxScore) * 100)
                                                : 0;
                                            return (
                                                <TableRow key={audit.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-medium">{audit.storeName}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs font-normal">
                                                            {audit.auditTypeName}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{audit.auditorName}</TableCell>
                                                    <TableCell>
                                                        <Badge className={`${scoreColor(pct)} text-white font-mono min-w-[3rem] justify-center`}>
                                                            {pct}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground font-mono">
                                                        {audit.completedAt?.toDate().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                                onClick={() => setSpecialReportAudit(audit)}
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                                Özel Rapor
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-8" asChild>
                                                                <Link href={`/audits/${audit.id}/summary`}>
                                                                    Detay
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Special Report Dialog */}
            {specialReportAudit && (
                <Dialog open={!!specialReportAudit} onOpenChange={(o) => !o && setSpecialReportAudit(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                        <DialogTitle className="sr-only">Özel Rapor Önizleme</DialogTitle>
                        <SpecialReportGenerator
                            audit={specialReportAudit}
                            onClose={() => setSpecialReportAudit(null)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
