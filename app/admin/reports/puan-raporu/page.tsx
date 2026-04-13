"use client";

import { useEffect, useState, useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { ColumnDef } from "@tanstack/react-table";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, Audit, DateRangeFilter, UserProfile } from "@/lib/types";
import { Loader2, CheckCircle2, ThumbsUp, MinusCircle, AlertCircle, Calendar, FileSpreadsheet, ArrowUpDown, User, BrainCircuit, Activity, Target, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// --- TYPES ---
interface ScoreAudit extends Audit {
    date: Date;
}

interface StoreScoreRow {
    storeId: string;
    storeName: string;
    regionalManagerName: string;
    score1?: number;
    score2?: number;
    score3?: number;
    score4?: number;
    date1?: Date;
    date2?: Date;
    date3?: Date;
    date4?: Date;
    average: number;
    hasAudits: boolean;
}

interface MonthlyScoreRow {
    storeId: string;
    storeName: string;
    regionalManagerName: string;
    months: {
        [key: number]: number | null;
    };
}

interface RegionalScoreRow {
    regionalManagerId: string;
    regionalManagerName: string;
    totalStores: number;
    auditedStores: number;
    auditCoverage: number;
    totalAudits: number;
    averageScore: number;
    highestScore: number | null;
    lowestScore: number | null;
    scoreVariance: number;
}

// --- CONSTANTS ---
const MONTH_NAMES = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// --- HELPERS ---
const turkishSort = (rowA: any, rowB: any, columnId: string) => {
    const a = String(rowA.getValue(columnId) || "");
    const b = String(rowB.getValue(columnId) || "");
    return a.localeCompare(b, 'tr-TR');
};

const getScoreBadge = (score: number) => {
    if (score >= 95) return { label: "ÇOK İYİ", color: "bg-emerald-500 hover:bg-emerald-600", icon: CheckCircle2, textColor: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (score >= 90) return { label: "İYİ", color: "bg-blue-500 hover:bg-blue-600", icon: ThumbsUp, textColor: "text-blue-700 bg-blue-50 border-blue-200" };
    if (score >= 85) return { label: "ORTA", color: "bg-amber-500 hover:bg-amber-600", icon: MinusCircle, textColor: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "ZAYIF", color: "bg-red-500 hover:bg-red-600", icon: AlertCircle, textColor: "text-red-700 bg-red-50 border-red-200" };
};

export default function PuanRaporuPage() {
    const [loading, setLoading] = useState(true);
    const [auditData, setAuditData] = useState<ScoreAudit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [regionalManagers, setRegionalManagers] = useState<UserProfile[]>([]);

    // Filters
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    // Processed Data
    const [scoreRows, setScoreRows] = useState<StoreScoreRow[]>([]);
    const [monthlyRows, setMonthlyRows] = useState<MonthlyScoreRow[]>([]);
    const [regionalRows, setRegionalRows] = useState<RegionalScoreRow[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Stores
                const storesSnap = await getDocs(collection(db, "stores"));
                const storesList = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
                setStores(storesList);

                // 2. Fetch Regional Managers (bölge müdürleri)
                const managersQuery = query(collection(db, "users"), where("role", "==", "bolge-muduru"));
                const managersSnap = await getDocs(managersQuery);
                const managersList = managersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
                setRegionalManagers(managersList);

                // 3. Fetch Audits
                const auditsQuery = query(collection(db, "audits"), where("status", "==", "tamamlandi"));
                const auditsSnap = await getDocs(auditsQuery);
                const auditsList = auditsSnap.docs.map(d => {
                    const data = d.data();
                    let date = new Date();
                    if (data.startedAt instanceof Timestamp) date = data.startedAt.toDate();
                    else if (data.createdAt instanceof Timestamp) date = data.createdAt.toDate();

                    return {
                        id: d.id,
                        ...data,
                        date: date
                    } as ScoreAudit;
                });

                setAuditData(auditsList);
            } catch (error) {
                console.error("Data loading error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Build manager lookup map
    const managerMap = useMemo(() => {
        const map: Record<string, string> = {};
        regionalManagers.forEach(m => {
            map[m.uid] = m.displayName || `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
        });
        return map;
    }, [regionalManagers]);

    // Helper to get manager name for a store
    const getManagerName = (store: Store) => {
        if (!store.regionalManagerId) return "-";
        return managerMap[store.regionalManagerId] || "-";
    };

    // --- Tab 1 Processing ---
    useEffect(() => {
        if (loading) return;

        const filteredAudits = auditData.filter(a => {
            if (dateRange.from) {
                const auditDate = new Date(a.date);
                auditDate.setHours(0, 0, 0, 0);
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                if (auditDate < from) return false;
            }
            if (dateRange.to) {
                const auditDate = new Date(a.date);
                auditDate.setHours(0, 0, 0, 0);
                const to = new Date(dateRange.to);
                to.setHours(23, 59, 59, 999);
                if (auditDate > to) return false;
            }
            return true;
        });

        const rows: StoreScoreRow[] = stores.map(store => {
            const storeAudits = filteredAudits
                .filter(a => a.storeId === store.id)
                .sort((a, b) => b.date.getTime() - a.date.getTime());

            const last4 = storeAudits.slice(0, 4);
            const scores = last4.map(a => a.totalScore || 0);

            const avg = storeAudits.length > 0
                ? storeAudits.reduce((sum, a) => sum + (a.totalScore || 0), 0) / storeAudits.length
                : 0;

            return {
                storeId: store.id,
                storeName: store.name,
                regionalManagerName: getManagerName(store),
                score1: scores[0],
                score2: scores[1],
                score3: scores[2],
                score4: scores[3],
                date1: last4[0]?.date,
                date2: last4[1]?.date,
                date3: last4[2]?.date,
                date4: last4[3]?.date,
                average: avg,
                hasAudits: storeAudits.length > 0
            };
        });

        setScoreRows(rows);
    }, [auditData, stores, dateRange, loading, managerMap]);

    // --- Tab 2 Processing ---
    useEffect(() => {
        if (loading) return;

        const yearInt = parseInt(selectedYear);
        const yearAudits = auditData.filter(a => a.date.getFullYear() === yearInt);

        const rows: MonthlyScoreRow[] = stores.map(store => {
            const monthsData: { [key: number]: number[] } = {};
            for (let i = 0; i < 12; i++) monthsData[i] = [];

            yearAudits
                .filter(a => a.storeId === store.id)
                .forEach(a => {
                    const month = a.date.getMonth();
                    monthsData[month].push(a.totalScore || 0);
                });

            const monthsAvg: { [key: number]: number | null } = {};
            for (let i = 0; i < 12; i++) {
                const scores = monthsData[i];
                monthsAvg[i] = scores.length > 0
                    ? scores.reduce((a, b) => a + b, 0) / scores.length
                    : null;
            }

            return {
                storeId: store.id,
                storeName: store.name,
                regionalManagerName: getManagerName(store),
                months: monthsAvg
            };
        });

        setMonthlyRows(rows);
    }, [auditData, stores, selectedYear, loading, managerMap]);

    // --- Tab 3 Processing ---
    useEffect(() => {
        if (loading) return;

        const filteredAudits = auditData.filter(a => {
            if (dateRange.from) {
                const auditDate = new Date(a.date);
                auditDate.setHours(0, 0, 0, 0);
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                if (auditDate < from) return false;
            }
            if (dateRange.to) {
                const auditDate = new Date(a.date);
                auditDate.setHours(0, 0, 0, 0);
                const to = new Date(dateRange.to);
                to.setHours(23, 59, 59, 999);
                if (auditDate > to) return false;
            }
            return true;
        });

        const rows: RegionalScoreRow[] = regionalManagers.map(manager => {
            const managerStores = stores.filter(s => s.regionalManagerId === manager.uid);
            const totalStores = managerStores.length;
            
            const managerAudits = filteredAudits.filter(a => managerStores.some(s => s.id === a.storeId));
            const totalAudits = managerAudits.length;

            const auditedStoreIds = new Set(managerAudits.map(a => a.storeId));
            const auditedStores = auditedStoreIds.size;
            const auditCoverage = totalStores > 0 ? (auditedStores / totalStores) * 100 : 0;

            const scores = managerAudits.map(a => a.totalScore || 0);
            
            const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            const highestScore = scores.length > 0 ? Math.max(...scores) : null;
            const lowestScore = scores.length > 0 ? Math.min(...scores) : null;

            // Variance & Standard Deviation
            let scoreVariance = 0;
            if (scores.length > 1) {
                const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length;
                scoreVariance = Math.sqrt(variance);
            }

            return {
                regionalManagerId: manager.uid,
                regionalManagerName: manager.displayName || `${manager.firstName || ""} ${manager.lastName || ""}`.trim() || manager.email,
                totalStores,
                auditedStores,
                auditCoverage,
                totalAudits,
                averageScore,
                highestScore,
                lowestScore,
                scoreVariance
            };
        });

        // Sort by average score DESC
        rows.sort((a, b) => b.averageScore - a.averageScore);

        setRegionalRows(rows);
    }, [auditData, stores, dateRange, loading, regionalManagers]);

    // Filtering is now handled directly by the DataTable component.

    // --- Export Functions ---
    const handleExportScores = (exportData: StoreScoreRow[] = scoreRows) => {
        const dataToExport = exportData.map(row => ({
            "Mağaza Adı": row.storeName,
            "Bölge Müdürü": row.regionalManagerName,
            "1. Puan": row.score1 !== undefined ? row.score1.toFixed(0) : "-",
            "1. Puan Tarihi": row.date1 ? row.date1.toLocaleDateString("tr-TR") : "-",
            "2. Puan": row.score2 !== undefined ? row.score2.toFixed(0) : "-",
            "2. Puan Tarihi": row.date2 ? row.date2.toLocaleDateString("tr-TR") : "-",
            "3. Puan": row.score3 !== undefined ? row.score3.toFixed(0) : "-",
            "3. Puan Tarihi": row.date3 ? row.date3.toLocaleDateString("tr-TR") : "-",
            "4. Puan": row.score4 !== undefined ? row.score4.toFixed(0) : "-",
            "4. Puan Tarihi": row.date4 ? row.date4.toLocaleDateString("tr-TR") : "-",
            "Ortalama": row.hasAudits ? row.average.toFixed(0) : "-"
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Son Denetim Puanları");
        XLSX.writeFile(wb, "Son_Denetim_Puanlari.xlsx");
    };

    const handleExportMonthly = (exportData: MonthlyScoreRow[] = monthlyRows) => {
        const dataToExport = exportData.map(row => {
            const rowData: any = {
                "Mağaza Adı": row.storeName,
                "Bölge Müdürü": row.regionalManagerName
            };
            MONTH_NAMES.forEach((month, index) => {
                const score = row.months[index];
                rowData[month] = score !== null ? score.toFixed(0) : "-";
            });
            return rowData;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, `Aylık_Gelişim_${selectedYear}`);
        XLSX.writeFile(wb, `Aylik_Gelisim_${selectedYear}.xlsx`);
    };

    const handleExportRegional = (exportData: RegionalScoreRow[] = regionalRows) => {
        const dataToExport = exportData.map(row => ({
            "Bölge Müdürü": row.regionalManagerName,
            "Sorumlu Mağaza": row.totalStores,
            "Denetlenen Mağaza": row.auditedStores,
            "Kapsama (%)": row.auditCoverage.toFixed(0) + "%",
            "Toplam Denetim": row.totalAudits,
            "Ortalama Puan": row.averageScore.toFixed(1),
            "En Yüksek": row.highestScore !== null ? row.highestScore.toFixed(0) : "-",
            "En Düşük": row.lowestScore !== null ? row.lowestScore.toFixed(0) : "-",
            "Tutarlılık (Sapma)": row.scoreVariance.toFixed(1)
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Bolge_Puan_Analizi");
        XLSX.writeFile(wb, "Bolge_Puan_Analizi.xlsx");
    };

    // --- Columns Definitions ---
    const scoreColumns: ColumnDef<StoreScoreRow>[] = [
        {
            accessorKey: "storeName",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Mağaza Adı
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div className="font-semibold">{row.original.storeName}</div>,
            sortingFn: turkishSort
        },
        {
            accessorKey: "regionalManagerName",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Bölge Müdürü" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className={row.original.regionalManagerName === "-" ? "text-muted-foreground" : ""}>
                        {row.original.regionalManagerName}
                    </span>
                </div>
            ),
            sortingFn: turkishSort,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "score1",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        1. Puan
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            meta: { title: "1. Puan" },
            cell: ({ row }) => {
                const score = row.original.score1;
                const date = row.original.date1;
                if (score === undefined) return <div className="text-center text-muted-foreground">-</div>;
                const badgeInfo = getScoreBadge(score);
                return (
                    <div className="flex flex-col items-center justify-center">
                        <Badge className={cn("font-mono text-base px-3 py-1 text-white border-0", badgeInfo.color)}>
                            {score.toFixed(0)}
                        </Badge>
                        {date && <span className="text-[10px] text-muted-foreground mt-1">{date.toLocaleDateString("tr-TR")}</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: "score2",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        2. Puan
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            meta: { title: "2. Puan" },
            cell: ({ row }) => {
                const score = row.original.score2;
                const date = row.original.date2;
                if (score === undefined) return <div className="text-center text-muted-foreground">-</div>;
                const badgeInfo = getScoreBadge(score);
                return (
                    <div className="flex flex-col items-center justify-center">
                        <Badge className={cn("font-mono text-base px-3 py-1 text-white border-0", badgeInfo.color)}>
                            {score.toFixed(0)}
                        </Badge>
                        {date && <span className="text-[10px] text-muted-foreground mt-1">{date.toLocaleDateString("tr-TR")}</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: "score3",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        3. Puan
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            meta: { title: "3. Puan" },
            cell: ({ row }) => {
                const score = row.original.score3;
                const date = row.original.date3;
                if (score === undefined) return <div className="text-center text-muted-foreground">-</div>;
                const badgeInfo = getScoreBadge(score);
                return (
                    <div className="flex flex-col items-center justify-center">
                        <Badge className={cn("font-mono text-base px-3 py-1 text-white border-0", badgeInfo.color)}>
                            {score.toFixed(0)}
                        </Badge>
                        {date && <span className="text-[10px] text-muted-foreground mt-1">{date.toLocaleDateString("tr-TR")}</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: "score4",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        4. Puan
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            meta: { title: "4. Puan" },
            cell: ({ row }) => {
                const score = row.original.score4;
                const date = row.original.date4;
                if (score === undefined) return <div className="text-center text-muted-foreground">-</div>;
                const badgeInfo = getScoreBadge(score);
                return (
                    <div className="flex flex-col items-center justify-center">
                        <Badge className={cn("font-mono text-base px-3 py-1 text-white border-0", badgeInfo.color)}>
                            {score.toFixed(0)}
                        </Badge>
                        {date && <span className="text-[10px] text-muted-foreground mt-1">{date.toLocaleDateString("tr-TR")}</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: "average",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="font-bold text-primary">
                        Ortalama
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                if (!row.original.hasAudits) return <div className="text-center">-</div>;
                const avg = row.original.average;
                const badgeInfo = getScoreBadge(avg);
                const Icon = badgeInfo.icon;

                return (
                    <div className="flex justify-center">
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-md border text-white text-sm font-bold border-0", badgeInfo.color)}>
                            <Icon className="w-4 h-4" />
                            {avg.toFixed(0)}
                        </div>
                    </div>
                );
            }
        }
    ];

    const monthlyColumns: ColumnDef<MonthlyScoreRow>[] = [
        {
            accessorKey: "storeName",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Mağaza Adı
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            meta: { title: "Mağaza Adı" },
            cell: ({ row }) => <div className="font-semibold min-w-[150px] sticky left-0 bg-card group-hover:bg-accent z-10 p-2 border-r transition-colors">{row.original.storeName}</div>,
            sortingFn: turkishSort
        },
        {
            accessorKey: "regionalManagerName",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Bölge Müdürü" />
            ),
            meta: { title: "Bölge Müdürü" },
            cell: ({ row }) => (
                <div className="flex items-center gap-1 min-w-[130px] text-sm">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={row.original.regionalManagerName === "-" ? "text-muted-foreground text-xs" : "text-xs font-medium"}>
                        {row.original.regionalManagerName}
                    </span>
                </div>
            ),
            sortingFn: turkishSort,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
        },

        ...MONTH_NAMES.map((month, index) => ({
            id: `month-${index}`,
            header: ({ column }: { column: any }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="whitespace-nowrap px-1 h-8 text-xs sm:text-sm">
                        {month}
                        <ArrowUpDown className="ml-1 h-3 w-3 shrink-0 opacity-70" />
                    </Button>
                </div>
            ),
            meta: { title: month },
            cell: ({ row }: { row: any }) => {
                const score = row.original.months[index];
                if (score === null) return <div className="text-center text-muted-foreground/30 font-medium">-</div>;

                const badgeInfo = getScoreBadge(score);
                return (
                    <div className="flex justify-center" title={`${month}: ${score.toFixed(1)} Puan`}>
                        <div className={cn("w-full max-w-[50px] text-center text-xs font-bold py-1 rounded", badgeInfo.color.split(" ")[0], "text-white")}>
                            {score.toFixed(0)}
                        </div>
                    </div>
                );
            }
        }))
    ];

    const regionalColumns: ColumnDef<RegionalScoreRow>[] = [
        {
            accessorKey: "regionalManagerName",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Bölge Müdürü
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div className="font-semibold text-primary/90">{row.original.regionalManagerName}</div>,
        },
        {
            accessorKey: "auditCoverage",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Mağaza Kapsama
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const cov = row.original.auditCoverage;
                return (
                    <div className="flex flex-col items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto">
                        <div className="text-xs font-medium text-muted-foreground">{row.original.auditedStores} / {row.original.totalStores} Mağaza</div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={cn("h-full", cov >= 80 ? "bg-emerald-500" : cov >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${cov}%` }} />
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: "totalAudits",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Top. Denetim
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-center font-mono font-medium">{row.original.totalAudits}</div>,
        },
        {
            accessorKey: "averageScore",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="font-bold text-primary">
                        Ortalama
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                if (row.original.totalAudits === 0) return <div className="text-center">-</div>;
                const avg = row.original.averageScore;
                const badgeInfo = getScoreBadge(avg);
                return (
                    <div className="flex justify-center">
                        <div className={cn("flex items-center justify-center px-3 py-1.5 rounded-md text-white text-sm font-bold min-w-[3.5rem] border-0", badgeInfo.color)}>
                            {avg.toFixed(1)}
                        </div>
                    </div>
                );
            }
        },
        {
            id: "minmax",
            header: () => <div className="text-center">Min / Max</div>,
            cell: ({ row }) => {
                if (row.original.totalAudits === 0) return <div className="text-center text-muted-foreground">-</div>;
                return (
                    <div className="flex items-center justify-center gap-2 text-sm font-mono">
                        <span className="text-red-500 font-medium">{row.original.lowestScore?.toFixed(0)}</span>
                        <span className="text-muted-foreground/30">/</span>
                        <span className="text-emerald-500 font-medium">{row.original.highestScore?.toFixed(0)}</span>
                    </div>
                );
            }
        },
        {
            accessorKey: "scoreVariance",
            header: ({ column }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Tutarlılık (Sapma)
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const audits = row.original.totalAudits;
                if (audits < 2) return <div className="text-center w-full text-xs text-muted-foreground">Yetersiz Veri</div>;
                
                const variance = row.original.scoreVariance;
                const isConsistent = variance <= 5;
                const isVolatile = variance >= 10;
                
                return (
                    <div className="flex flex-col items-center justify-center w-full gap-1 text-sm">
                        <div className={cn("font-mono font-medium", isConsistent ? "text-emerald-500" : isVolatile ? "text-red-500" : "text-amber-500")}>
                            ± {variance.toFixed(1)}
                        </div>
                        {isConsistent && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/20 w-[95px] text-center">Yüksek Tutarlılık</span>}
                        {isVolatile && <span className="text-[10px] bg-red-500/10 text-red-600 px-2 py-0.5 rounded border border-red-500/20 w-[95px] text-center">Tutarsız Bölge</span>}
                        {!isConsistent && !isVolatile && <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded border border-amber-500/20 w-[95px] text-center">Normal</span>}
                    </div>
                );
            }
        }
    ];

    const activeManagers = [...regionalRows].filter(r => r.totalAudits > 0);
    const topManager = activeManagers.length > 0 ? [...activeManagers].sort((a,b) => b.averageScore - a.averageScore)[0] : null;
    const needsImprovementManager = activeManagers.length > 0 ? [...activeManagers].sort((a,b) => a.averageScore - b.averageScore)[0] : null;
    const multiAuditManagers = [...regionalRows].filter(r => r.totalAudits > 1);
    const highestVarianceManager = multiAuditManagers.length > 0 ? [...multiAuditManagers].sort((a,b) => b.scoreVariance - a.scoreVariance)[0] : null;

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Puan Raporu</h1>
                <p className="text-muted-foreground">Mağazaların denetim puanları ve aylık gelişim analizi.</p>
            </div>

            <Tabs defaultValue="scores" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="scores">Son Denetim Puanları</TabsTrigger>
                    <TabsTrigger value="monthly">Aylık Gelişim Tablosu</TabsTrigger>
                    <TabsTrigger value="regional" className="gap-2">
                        <BrainCircuit className="w-4 h-4 text-primary" />
                        Bölge Puan Analizi
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="scores" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>Mağaza Puan Analizi</CardTitle>
                                        <CardDescription>Belirtilen tarih aralığındaki son 4 denetim ve genel ortalama.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(96).color)}>
                                        <CheckCircle2 className="w-4 h-4" /> 100-95 ÇOK İYİ
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(91).color)}>
                                        <ThumbsUp className="w-4 h-4" /> 94-90 İYİ
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(86).color)}>
                                        <MinusCircle className="w-4 h-4" /> 89-85 ORTA
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(80).color)}>
                                        <AlertCircle className="w-4 h-4" /> 84 ve ALTI ZAYIF
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={scoreColumns}
                                data={scoreRows}
                                enableGlobalFilter={true}
                                searchPlaceholder="Mağaza veya Bölge Müdürü ara..."
                                initialSorting={[{ id: "storeName", desc: false }]}
                                pageSizeOptions={[10, 20, 50, 100, 200]}
                                defaultPageSize={200}
                                toolbar={(table) => (
                                    <div className="flex w-full">
                                        <Button variant="outline" onClick={() => handleExportScores(table.getSortedRowModel().rows.map((r: any) => r.original))} className="ml-auto gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel İndir
                                        </Button>
                                    </div>
                                )}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>Aylık Gelişim Matrisi</CardTitle>
                                        <CardDescription>Mağazaların yıl içindeki aylık puan ortalamaları.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                                            <SelectTrigger className="w-[120px]">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                <SelectValue placeholder="Yıl" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 11 }, (_, i) => 2026 + i).map(y => (
                                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(96).color)}>
                                        <CheckCircle2 className="w-4 h-4" /> 100-95 ÇOK İYİ
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(91).color)}>
                                        <ThumbsUp className="w-4 h-4" /> 94-90 İYİ
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(86).color)}>
                                        <MinusCircle className="w-4 h-4" /> 89-85 ORTA
                                    </Badge>
                                    <Badge className={cn("gap-1.5 text-white border-0 px-3 py-1 text-sm", getScoreBadge(80).color)}>
                                        <AlertCircle className="w-4 h-4" /> 84 ve ALTI ZAYIF
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <DataTable
                                    columns={monthlyColumns}
                                    data={monthlyRows}
                                    enableGlobalFilter={true}
                                    searchPlaceholder="Mağaza veya Bölge Müdürü ara..."
                                    initialSorting={[{ id: "storeName", desc: false }]}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                    defaultPageSize={200}
                                    toolbar={(table) => (
                                        <div className="flex w-full gap-2">
                                            <Button variant="outline" onClick={() => handleExportMonthly(table.getSortedRowModel().rows.map((r: any) => r.original))} className="ml-auto gap-2">
                                                <FileSpreadsheet className="h-4 w-4" />
                                                Excel İndir
                                            </Button>
                                        </div>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="regional" className="space-y-4">
                    {/* Insights Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-gradient-to-br from-emerald-500/10 via-card to-card border-none ring-1 ring-emerald-500/20 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="w-16 h-16 text-emerald-500" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                                    <Target className="w-4 h-4" /> En Yüksek Performans
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {topManager ? (
                                    <>
                                        <div className="text-xl font-bold truncate pr-4">{topManager.regionalManagerName}</div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Ortalama Puan: <span className="font-bold text-emerald-600">{topManager.averageScore.toFixed(1)}</span> ({topManager.auditedStores} Mağaza)
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground mt-2">Denetim verisi yok.</div>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-amber-500/10 via-card to-card border-none ring-1 ring-amber-500/20 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ShieldAlert className="w-16 h-16 text-amber-500" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4" /> Gelişime Açık Bölge
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {needsImprovementManager ? (
                                    <>
                                        <div className="text-xl font-bold truncate pr-4">{needsImprovementManager.regionalManagerName}</div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Ortalama Puan: <span className="font-bold text-amber-600">{needsImprovementManager.averageScore.toFixed(1)}</span> ({needsImprovementManager.auditedStores} Mağaza)
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground mt-2">Denetim verisi yok.</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-blue-500/10 via-card to-card border-none ring-1 ring-blue-500/20 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="w-16 h-16 text-blue-500" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> En Yüksek Tutarsızlık
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {highestVarianceManager ? (
                                    <>
                                        <div className="text-xl font-bold truncate pr-4">{highestVarianceManager.regionalManagerName}</div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Sapma Oranı: <span className="font-bold text-blue-600">±{highestVarianceManager.scoreVariance.toFixed(1)}</span> (Min: {highestVarianceManager.lowestScore?.toFixed(0)} - Max: {highestVarianceManager.highestScore?.toFixed(0)})
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground mt-2">Yeterli denetim (2+) verisi yok.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>Bölge Yönetimi Performans Listesi</CardTitle>
                                        <CardDescription>Bölge Müdürlerinin mağaza kapsama, ortalama başarı ve tutarlılık (standart sapma) verileri.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={regionalColumns}
                                data={regionalRows}
                                enableGlobalFilter={true}
                                searchPlaceholder="Bölge Müdürü ara..."
                                initialSorting={[{ id: "averageScore", desc: true }]}
                                pageSizeOptions={[10, 20]}
                                defaultPageSize={20}
                                toolbar={(table) => (
                                    <div className="flex w-full gap-2">
                                        <Button variant="outline" onClick={() => handleExportRegional(table.getSortedRowModel().rows.map((r: any) => r.original))} className="ml-auto gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel İndir
                                        </Button>
                                    </div>
                                )}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
