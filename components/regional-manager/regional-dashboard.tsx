"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { collection, getDocs, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { applyScoreRule, calcAuditScore } from "@/lib/utils";
import { Store, Audit } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {

} from "@/components/ui/dialog";
import {
    Store as StoreIcon,
    ClipboardList,
    CheckCircle2,
    PlayCircle,
    Clock,
    ChevronRight,
    TrendingUp,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { useRouter } from "next/navigation";
import { Eye, FileText, Zap } from "lucide-react";
import { toast } from "sonner";

export function RegionalDashboard() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [myStores, setMyStores] = useState<Store[]>([]);
    const [globalPendingAudits, setGlobalPendingAudits] = useState<any[]>([]);
    const [recentAudits, setRecentAudits] = useState<any[]>([]);
    const [liveAudits, setLiveAudits] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedStore, setSelectedStore] = useState<string>("all");

    const router = useRouter();

    useEffect(() => {
        if (userProfile?.uid) {
            loadDashboardData();
        }
    }, [userProfile, selectedMonth, selectedYear, selectedStore]);

    // Real-time listener for completed audits (action status updates)
    useEffect(() => {
        if (!userProfile?.uid || myStores.length === 0) return;

        const allStoreIds = myStores.map(s => s.id);
        const targetStoreIds = selectedStore === "all" ? allStoreIds : [selectedStore];
        const storeChunk = targetStoreIds.slice(0, 30);

        let q = query(
            collection(db, "audits"),
            where("storeId", "in", storeChunk),
            where("status", "==", "tamamlandi"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const audits = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                storeName: myStores.find(s => s.id === doc.data().storeId)?.name || "Bilinmeyen Mağaza"
            }));
            setRecentAudits(audits);
        });

        return () => unsub();
    }, [userProfile, myStores, selectedStore, selectedMonth, selectedYear]);

    // Real-time listener for in-progress audits — two separate queries to avoid Firestore disjunction limit
    useEffect(() => {
        if (!userProfile?.uid || myStores.length === 0) return;

        const storeIds = myStores.map(s => s.id).slice(0, 30);
        const mergedMap = new Map<string, any>();

        const makeQuery = (status: string) => query(
            collection(db, "audits"),
            where("storeId", "in", storeIds),
            where("status", "==", status)
        );

        const handleSnap = (snap: any) => {
            snap.docs.forEach((d: any) => {
                mergedMap.set(d.id, {
                    id: d.id,
                    ...d.data(),
                    storeName: myStores.find(s => s.id === d.data().storeId)?.name || "Bilinmeyen Mağaza"
                });
            });
            // Remove docs that no longer match this status snapshot
            snap.docChanges().forEach((change: any) => {
                if (change.type === "removed") mergedMap.delete(change.doc.id);
            });
            setLiveAudits(Array.from(mergedMap.values()));
        };

        const unsub1 = onSnapshot(makeQuery("devam_ediyor"), handleSnap);
        const unsub2 = onSnapshot(makeQuery("baslatildi"), handleSnap);

        return () => { unsub1(); unsub2(); };
    }, [userProfile, myStores]);

    const loadDashboardData = async () => {
        if (!userProfile?.uid) return;

        try {
            // Get my assigned stores
            const storesQuery = query(
                collection(db, "stores"),
                where("regionalManagerId", "==", userProfile.uid)
            );
            const storesSnapshot = await getDocs(storesQuery);
            const storesData = storesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Store[];

            setMyStores(storesData);

            if (storesData.length === 0) {
                setLoading(false);
                return;
            }

            const allStoreIds = storesData.map(s => s.id);
            const targetStoreIds = selectedStore === "all" ? allStoreIds : [selectedStore];

            // 1. Fetch Global Pending Audits (for persistent lists)
            // We need audits that have actions pending, regardless of date.
            // Since we can't easily filter by "hasPendingActions" in Firestore without index,
            // we will fetch recent audits involved with these stores (e.g. last 3 months or limit 100 per store?)
            // Better strategy: "Pending" audits are usually recent. 
            // BUT user said "ay gözetmeksizin" (regardless of month).
            // So we should try to fetch *all* incomplete audits if possible, or use a "status" field if available.
            // Our Audit type has 'status'. If 'status' is 'tamamlandi', actions might still be pending (action workflow is post-audit).
            // We'll fetch significantly more audits to cover potential backlogs, or filter in memory.
            // Let's fetch last 200 audits for these stores to be safe for "active" items.
            
            // NOTE: A better backend approach would be a collectionGroup query on 'actions', but actions are inside 'sections' array.
            // So we stick to fetching audits.
            
            let globalAuditsQuery = query(
                collection(db, "audits"),
                where("storeId", "in", allStoreIds.slice(0, 30)), // Firestore 'in' limit is 30. If >30 stores, we need multiple queries.
                orderBy("createdAt", "desc"),
                limit(100)
            );

            // If more than 30 stores, we might miss some. For now assuming <30 stores per RM.
            // If we need robust scaling, we'd loop chunks.
             if (allStoreIds.length > 30) {
                console.warn("More than 30 stores assigned, only fetching first 30 for global lists.");
             }

            const globalSnapshot = await getDocs(globalAuditsQuery);
            const globalAudits = globalSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                storeName: storesData.find(s => s.id === doc.data().storeId)?.name || ""
            }));
            
            setGlobalPendingAudits(globalAudits);


            // 2. Fetch Dashboard Audits (Date Filtered) - Existing Logic
            let auditsData: any[] = [];
            // ... existing date filtering logic ...
            if (targetStoreIds.length <= 10) {
                 let auditsQuery = query(
                    collection(db, "audits"),
                    where("storeId", "in", targetStoreIds)
                );
                // ... existing date filters ...
                if (selectedYear !== "all") {
                    const year = parseInt(selectedYear);
                    let start, end;
                    if (selectedMonth !== "all") {
                        const month = parseInt(selectedMonth);
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0, 23, 59, 59);
                    } else {
                        start = new Date(year, 0, 1);
                        end = new Date(year, 11, 31, 23, 59, 59);
                    }
                    auditsQuery = query(auditsQuery, where("createdAt", ">=", start), where("createdAt", "<=", end));
                    auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"));
                } else {
                     auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"), limit(50));
                }

                const auditsSnapshot = await getDocs(auditsQuery);
                auditsData = auditsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                 // Fallback for many stores
                 // ... existing fallback ...
                   let auditsQuery = query(collection(db, "audits")); // Simplify for brevity in replace
                   // Re-using existing logic logic roughly...
                   if (selectedYear !== "all") {
                        const year = parseInt(selectedYear);
                        let start, end;
                         if (selectedMonth !== "all") {
                            const month = parseInt(selectedMonth);
                            start = new Date(year, month, 1);
                            end = new Date(year, month + 1, 0, 23, 59, 59);
                        } else {
                            start = new Date(year, 0, 1);
                            end = new Date(year, 11, 31, 23, 59, 59);
                        }
                         auditsQuery = query(auditsQuery, where("createdAt", ">=", start), where("createdAt", "<=", end), orderBy("createdAt", "desc"), limit(100));
                   } else {
                         auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"), limit(50));
                   }
                   const snapshot = await getDocs(auditsQuery);
                   auditsData = snapshot.docs.map(d => ({id: d.id, ...d.data()})).filter((a:any) => targetStoreIds.includes(a.storeId));
            }

            // Enrich audit data with store names — recentAudits is now handled by onSnapshot listener
            // setRecentAudits is intentionally not called here
        } catch (error) {
            console.error("Error loading dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    // Filter audits for current month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Only completed audits in current month for average calculation
    const currentMonthAudits = recentAudits.filter(audit => {
        if (audit.status !== "tamamlandi") return false;
        if (!audit.createdAt?.seconds) return false;
        const auditDate = new Date(audit.createdAt.seconds * 1000);
        return auditDate >= currentMonthStart && auditDate <= currentMonthEnd;
    });

    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const years = Array.from({ length: 11 }, (_, i) => 2026 + i);

    // Calculate current month average score — Algorithm B (single source: calcAuditScore)
    const currentMonthAverage = currentMonthAudits.length > 0
        ? applyScoreRule(
            currentMonthAudits.reduce((acc, audit) => acc + calcAuditScore((audit as any).sections, audit.totalScore), 0) / currentMonthAudits.length
        )
        : 0;

    // Get current month name in Turkish
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const currentMonthName = monthNames[now.getMonth()];

    return (
        <div className="container mx-auto py-1 px-4 space-y-6 pb-24">
            {/* Stats Cards - Compact Horizontal Layout */}
            <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                {/* Mağazalarım */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                    <StoreIcon className="h-5 w-5" />
                                </div>
                                <h4 className="text-sm text-muted-foreground font-medium">Mağazalarım</h4>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">{myStores.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Son Denetimler - Current Month */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm text-muted-foreground font-medium">Denetimler</h4>
                                    <span className="text-[10px] text-muted-foreground/70">{currentMonthName}</span>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">{currentMonthAudits.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Ortalama Puan - Current Month Average */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm text-muted-foreground font-medium">Aylık Mağaza Puan Ortalaması</h4>
                                    <span className="text-[10px] text-muted-foreground/70">{currentMonthName}</span>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">
                                {currentMonthAudits.length > 0 ? currentMonthAverage : "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Live Audits Section — real-time via onSnapshot */}
            {liveAudits.length > 0 && (
                <Card className="border shadow-sm overflow-hidden border-green-200 dark:border-green-900">
                    <CardHeader className="px-4 py-3 border-b bg-green-50/60 dark:bg-green-950/20">
                        <div className="flex items-center gap-2">
                            {/* Pulsing green dot */}
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <CardTitle className="text-base text-green-700 dark:text-green-400">
                                Anlık Denetimler
                            </CardTitle>
                            <Badge className="ml-auto bg-green-500 hover:bg-green-600 text-white text-[10px] px-1.5 py-0">
                                {liveAudits.length} aktif
                            </Badge>
                        </div>
                        <CardDescription className="text-xs text-green-700/70 dark:text-green-500/70">
                            Şu anda devam eden denetimler gerçek zamanlı gösterilmektedir.
                        </CardDescription>
                    </CardHeader>
                    <div className="divide-y divide-green-100 dark:divide-green-900/40">
                        {liveAudits.map((audit: any) => {
                            const startTime = audit.startedAt?.seconds
                                ? format(new Date(audit.startedAt.seconds * 1000), "HH:mm", { locale: tr })
                                : audit.createdAt?.seconds
                                    ? format(new Date(audit.createdAt.seconds * 1000), "HH:mm", { locale: tr })
                                    : null;
                            return (
                                <div key={audit.id} className="flex items-center justify-between px-4 py-3 hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                                            <PlayCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{audit.storeName}</p>
                                            <p className="text-[11px] text-muted-foreground">{audit.auditorName || "Denetmen"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {startTime && (
                                            <div className="flex items-center gap-1 text-[11px] text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full font-medium">
                                                <Clock className="h-3 w-3" />
                                                {startTime}{String.fromCharCode(39)}de başladı
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Persistent Lists - Unified Waiting & Overdue Table */}
            <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="px-4 py-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <CardTitle className="text-base">Dönüş Bekleyen Mağazalar</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Mağaza tarafından aksiyon alınması gereken ve süresi geçen tüm denetimler.
                    </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                            <tr>
                                <th className="px-4 py-3 font-medium">Mağaza</th>
                                <th className="px-4 py-3 font-medium text-center">Durum</th>
                                <th className="px-4 py-3 font-medium text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {(() => {
                                // Filter logic: All pending store actions regardless of score
                                // FIXED: Only include COMPLETED audits. In-progress audits are not "Waiting for Return".
                                const pendingList = globalPendingAudits.filter(audit => {
                                     // Check Audit Status
                                     if (audit.status !== "tamamlandi") return false;

                                     // Check Action Status (Pending Store)
                                    const hasPendingStoreAction = audit.sections?.some((s: any) => 
                                        s.answers?.some((a: any) => {
                                            // Ensure answer is not empty to avoid "unanswered questions" triggering this in edge cases
                                            if (!a.answer || a.answer.trim() === "") return false;

                                            const needsAction = (a.earnedPoints || 0) < (a.maxPoints || 0) && a.answer !== "muaf" && a.answer !== "evet"; 
                                            if (!needsAction) return false;
                                            
                                            // If status is specifically pending_admin or approved, it is NOT pending store.
                                            // We explicitly check for the "done" states to be safe.
                                            const status = a.actionData?.status;
                                            if (status === "pending_admin" || status === "approved" || status === "pending_review") return false;

                                            // Default to pending_store if no status (and needs action)
                                            return true; 
                                        })
                                    );
                                    return hasPendingStoreAction;
                                });

                                if (pendingList.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic">
                                                Bekleyen aksiyon bulunmuyor.
                                            </td>
                                        </tr>
                                    );
                                }

                                // Sort logic: Overdue first, then by date (oldest first usually implies urgency, but requested logic implies date sort)
                                // Let's sort: Overdue items (descending by overdue days), then others (ascending by deadline - closest deadline first)
                                const sortedList = [...pendingList].sort((a, b) => {
                                    const getDeadline = (audit: any) => audit.actionDeadline?.seconds ? audit.actionDeadline.seconds * 1000 : 0;
                                    const now = Date.now();
                                    
                                    const da = getDeadline(a);
                                    const db = getDeadline(b);

                                    const isOverdueA = da > 0 && da < now;
                                    const isOverdueB = db > 0 && db < now;

                                    if (isOverdueA && !isOverdueB) return -1;
                                    if (!isOverdueA && isOverdueB) return 1;
                                    
                                    // If both overdue or both pending, sort by deadline (earliest deadline first)
                                    return da - db;
                                });

                                return sortedList.map(audit => {
                                    const deadlineMs = audit.actionDeadline?.seconds * 1000 || 0;
                                    const diffMs = deadlineMs - Date.now();
                                    const isOverdue = diffMs < 0;
                                    const daysDiff = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));

                                    return (
                                        <tr key={audit.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-4 py-3 font-medium">{audit.storeName}</td>
                                            <td className="px-4 py-3 text-center">
                                                {isOverdue ? (
                                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 whitespace-nowrap">
                                                        {daysDiff > 0 ? `${daysDiff} gün gecikti` : 'Bugün son gün geçti'}
                                                    </Badge>
                                                ) : daysDiff === 0 ? (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 whitespace-nowrap font-semibold">
                                                        Dönüş için son gün
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 whitespace-nowrap">
                                                        {daysDiff} gün kaldı
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-xs"
                                                    onClick={() => router.push(`/audits/${audit.id}/actions`)}
                                                >
                                                    İncele
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </Card>



            




            {/* Recent Audits */}
            <Card className="py-0.5 gap-1">
                <CardHeader className="pb-0 pt-2 px-3">
                    <div className="flex flex-col gap-2">
                        <div>
                            <CardTitle className="text-base">Son Denetimler</CardTitle>
                            <CardDescription className="text-xs">
                                Mağazalarınızda yapılan en son denetimler
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Mağaza" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Mağazalar</SelectItem>
                                    {myStores.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="flex-1 sm:w-[110px] h-8 text-xs">
                                        <SelectValue placeholder="Ay" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Aylar</SelectItem>
                                        {months.map((m, i) => (
                                            <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="flex-1 sm:w-[110px] h-8 text-xs">
                                        <SelectValue placeholder="Yıl" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Yıllar</SelectItem>
                                        {years.map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-3 pb-2 pt-0">
                    {recentAudits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <ClipboardList className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Henüz denetim kaydı bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentAudits.map((audit) => {
                                // Central Algorithm B
                                const scorePercent = calcAuditScore((audit as any).sections, audit.totalScore);

                                return (() => {
                                    // Determine if store has action items and their status
                                    const actionItems = audit.sections?.flatMap((section: any) =>
                                        section.answers?.filter((a: any) =>
                                            a.answer && a.answer.trim() !== "" && a.answer !== "muaf" && (a.earnedPoints || 0) < (a.maxPoints || 0)
                                        ) || []
                                    ) || [];

                                    const hasActions = actionItems.length > 0;

                                    // Granular status counts
                                    const pendingStoreCount = actionItems.filter((a: any) =>
                                        !a.actionData?.status || a.actionData?.status === "pending_store"
                                    ).length;
                                    const pendingAdminCount = actionItems.filter((a: any) =>
                                        a.actionData?.status === "pending_admin" || a.actionData?.status === "pending_review"
                                    ).length;
                                    const approvedCount = actionItems.filter((a: any) =>
                                        a.actionData?.status === "approved"
                                    ).length;
                                    const rejectedCount = actionItems.filter((a: any) =>
                                        a.actionData?.status === "rejected"
                                    ).length;

                                    // Rejected question texts for display
                                    const rejectedItems = actionItems.filter((a: any) =>
                                        a.actionData?.status === "rejected"
                                    );

                                    const allApproved = hasActions && approvedCount === actionItems.length;
                                    const storeResponded = hasActions && pendingStoreCount === 0 && rejectedCount === 0;
                                    const waitingAdminApproval = hasActions && pendingAdminCount > 0 && pendingStoreCount === 0;

                                    // Deadline calculation
                                    let deadlineDays: number | null = null;
                                    let deadlinePassed = false;
                                    if (hasActions && audit.actionDeadline) {
                                        const deadlineMs = audit.actionDeadline.seconds * 1000;
                                        const now = Date.now();
                                        const diffMs = deadlineMs - now;
                                        deadlineDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                                        deadlinePassed = diffMs < 0;
                                    }

                                    return (
                                    <div key={audit.id} className="block mb-2 last:mb-0">
                                        <div className="flex flex-col p-3 border-2 border-border/80 rounded-xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all group gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                    <p className="text-sm font-medium truncate">{audit.storeName}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{audit.auditorName || "Denetmen"}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* Status Badge */}
                                                        {hasActions && pendingStoreCount > 0 && rejectedCount === 0 && (
                                                            <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-[10px] px-1.5 py-0">
                                                                <Clock className="mr-1 h-2.5 w-2.5" />
                                                                Dönüş Bekliyor
                                                            </Badge>
                                                        )}
                                                        {hasActions && waitingAdminApproval && (
                                                            <Badge variant="outline" className="text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-[10px] px-1.5 py-0">
                                                                <Clock className="mr-1 h-2.5 w-2.5" />
                                                                Onay Bekliyor
                                                            </Badge>
                                                        )}
                                                        {hasActions && allApproved && (
                                                            <Badge variant="outline" className="text-green-600 border-green-400 bg-green-50 dark:bg-green-950/30 text-[10px] px-1.5 py-0">
                                                                ✓ Tüm Dönüşler Onaylandı
                                                            </Badge>
                                                        )}
                                                        {hasActions && !allApproved && approvedCount > 0 && rejectedCount > 0 && pendingStoreCount === 0 && pendingAdminCount === 0 && (
                                                            <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-[10px] px-1.5 py-0">
                                                                {approvedCount} Onaylandı · {rejectedCount} Reddedildi
                                                            </Badge>
                                                        )}
                                                        {hasActions && rejectedCount > 0 && pendingStoreCount > 0 && (
                                                            <Badge variant="outline" className="text-red-600 border-red-400 bg-red-50 dark:bg-red-950/30 text-[10px] px-1.5 py-0">
                                                                ✕ {rejectedCount} Soru Reddedildi
                                                            </Badge>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {audit.createdAt?.seconds ? format(new Date(audit.createdAt.seconds * 1000), "d MMM yyyy", { locale: tr }) : "-"}
                                                        </span>
                                                    </div>
                                                    {hasActions && deadlineDays !== null && pendingStoreCount > 0 && (
                                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mt-0.5 ${
                                                            deadlinePassed
                                                                ? 'text-red-600 border-red-500 bg-red-50 dark:bg-red-950/30'
                                                                : deadlineDays === 0
                                                                    ? 'text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-950/30 font-semibold'
                                                                    : 'text-muted-foreground border-muted-foreground/40'
                                                        }`}>
                                                            {deadlinePassed
                                                                ? `⚠ Son dönüş tarihi ${deadlineDays} gün geçti`
                                                                : deadlineDays === 0
                                                                    ? '⚠ Dönüş için son gün'
                                                                    : `Son dönüş tarihine ${deadlineDays} gün kaldı`
                                                            }
                                                        </Badge>
                                                    )}
                                                    {/* Rejected question list inside card */}
                                                    {rejectedItems.length > 0 && (
                                                        <div className="mt-1.5 p-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200/70">
                                                            <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 mb-1">Reddedilen Sorular:</p>
                                                            {rejectedItems.map((a: any, i: number) => (
                                                                <p key={i} className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                                                                    • {a.questionText || "Soru"}
                                                                    {a.actionData?.adminNote && (
                                                                        <span className="block text-red-400 dark:text-red-500 pl-3">Red Sebebi: {a.actionData.adminNote}</span>
                                                                    )}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-3">
                                                    <div className="text-right">
                                                        <div className="text-base font-bold">{scorePercent}</div>
                                                        <div className="text-[10px] text-muted-foreground">Puan</div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col gap-2 pt-2 border-t">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="flex-1 h-8 text-xs"
                                                        onClick={() => router.push(`/audits/${audit.id}?mode=view`)}
                                                    >
                                                        <Eye className="mr-1.5 h-3 w-3" />
                                                        İncele
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="flex-1 h-8 text-xs"
                                                        onClick={() => router.push(`/audits/${audit.id}/report`)}
                                                    >
                                                        <FileText className="mr-1.5 h-3 w-3" />
                                                        Özel Rapor
                                                    </Button>
                                                </div>
                                                {hasActions && (waitingAdminApproval || storeResponded || rejectedCount > 0) && (
                                                    <Button 
                                                        variant="default" 
                                                        size="sm" 
                                                        className="w-full h-8 text-xs bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                                                        onClick={() => router.push(`/audits/${audit.id}/actions`)}
                                                    >
                                                        <Zap className="mr-1.5 h-3 w-3" />
                                                        Mağaza Dönüşü
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })();
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
