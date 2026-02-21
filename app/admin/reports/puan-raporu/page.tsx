"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, Audit, DateRangeFilter } from "@/lib/types";
import { Loader2, Search, CheckCircle2, ThumbsUp, MinusCircle, AlertCircle, Calendar, FileSpreadsheet, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

import { ChevronLeft, ChevronRight } from "lucide-react";

// --- TYPES ---
interface ScoreAudit extends Audit {
    date: Date;
}

interface StoreScoreRow {
    storeId: string;
    storeName: string;
    score1?: number; // Most recent
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
    months: {
        [key: number]: number | null; // 0-11: Average Score
    };
}

// --- CONSTANTS ---
const MONTH_NAMES = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// --- HELPERS ---
const getScoreBadge = (score: number) => {
    if (score >= 95) return { label: "ÇOK İYİ", color: "bg-emerald-500 hover:bg-emerald-600", icon: CheckCircle2, textColor: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (score >= 90) return { label: "İYİ", color: "bg-blue-500 hover:bg-blue-600", icon: ThumbsUp, textColor: "text-blue-700 bg-blue-50 border-blue-200" };
    if (score >= 85) return { label: "ORTA", color: "bg-amber-500 hover:bg-amber-600", icon: MinusCircle, textColor: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "ZAYIF", color: "bg-red-500 hover:bg-red-600", icon: AlertCircle, textColor: "text-red-700 bg-red-50 border-red-200" };
};

const SimpleSparkline = ({ data }: { data: (number | null)[] }) => {
    // Filter out nulls for the trend
    const values = data.filter((v): v is number => v !== null);
    if (values.length < 2) return <div className="text-xs text-muted-foreground">-</div>;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // avoid divide by zero

    // SVG Layout
    const width = 80;
    const height = 30;
    const points = values.map((val, i) => {
        const x = (i / (values.length - 1)) * width;
        // Invert Y because SVG y=0 is top
        const normalizedVal = (val - min) / range;
        const y = height - (normalizedVal * height);
        return `${x},${y}`;
    }).join(" ");

    // Determine color based on trend (last vs first)
    const first = values[0];
    const last = values[values.length - 1];
    let strokeColor = "#64748b"; // slate-500 default
    if (last > first) strokeColor = "#10b981"; // emerald-500
    if (last < first) strokeColor = "#ef4444"; // red-500

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path
                d={`M ${points}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Last point dot */}
            <circle
                cx={width}
                cy={height - ((last - min) / range * height)}
                r="3"
                fill={strokeColor}
            />
        </svg>
    );
};

export default function PuanRaporuPage() {
    const [loading, setLoading] = useState(true);
    const [auditData, setAuditData] = useState<ScoreAudit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);

    // Filters
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    // Processed Data
    const [scoreRows, setScoreRows] = useState<StoreScoreRow[]>([]);
    const [monthlyRows, setMonthlyRows] = useState<MonthlyScoreRow[]>([]);



    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Stores
                const storesSnap = await getDocs(collection(db, "stores"));
                const storesList = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
                setStores(storesList);

                // 2. Fetch Audits
                // For a scalable solution, ideally use a composite index or backend function. 
                // Given constraints, fetching all 'completed' audits is acceptable if volume is < 5-10k.
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
                .sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first

            const last4 = storeAudits.slice(0, 4);
            const scores = last4.map(a => a.totalScore || 0);

            // Calculate Average of audits IN THE RANGE
            // Requirement says "iki tarih aralığındaki puan ortalamasını"
            const avg = storeAudits.length > 0
                ? storeAudits.reduce((sum, a) => sum + (a.totalScore || 0), 0) / storeAudits.length
                : 0;

            return {
                storeId: store.id,
                storeName: store.name,
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

    }, [auditData, stores, dateRange, loading]);

    // --- Tab 2 Processing ---
    useEffect(() => {
        if (loading) return;

        const yearInt = parseInt(selectedYear);
        const yearAudits = auditData.filter(a => a.date.getFullYear() === yearInt);

        const rows: MonthlyScoreRow[] = stores.map(store => {
            // Group store audits by month
            const monthsData: { [key: number]: number[] } = {};
            // Initialize months
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
                months: monthsAvg
            };
        });

        setMonthlyRows(rows);

    }, [auditData, stores, selectedYear, loading]);

    // --- Export Functions ---
    const handleExportScores = () => {
        const dataToExport = scoreRows.map(row => ({
            "Mağaza Adı": row.storeName,
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

    const handleExportMonthly = () => {
        const dataToExport = monthlyRows.map(row => {
            const rowData: any = { "Mağaza Adı": row.storeName };
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
            cell: ({ row }) => <div className="font-semibold">{row.original.storeName}</div>
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
                // Mini badge for dense table
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
                </TabsList>

                <TabsContent value="scores" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Mağaza Puan Analizi</CardTitle>
                                    <CardDescription>Belirtilen tarih aralığındaki son 4 denetim ve genel ortalama.</CardDescription>
                                </div>
                                <div>
                                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                                </div>
                            </div>

                            {/* Legend for Score Range */}
                            <div className="mt-4 flex flex-wrap gap-3 text-sm">
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
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={scoreColumns}
                                data={scoreRows}
                                searchKey="storeName"
                                searchPlaceholder="Mağaza ara..."
                                initialSorting={[{ id: "storeName", desc: false }]}
                                pageSizeOptions={[10, 20, 50, 100, 200]}
                                defaultPageSize={200}
                                toolbar={
                                    <div className="flex w-full">
                                        <Button variant="outline" onClick={handleExportScores} className="ml-auto gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel İndir
                                        </Button>
                                    </div>
                                }
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Aylık Gelişim Matrisi</CardTitle>
                                    <CardDescription>Mağazaların yıl içindeki aylık puan ortalamaları.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
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

                            {/* Same Legend */}
                            <div className="mt-4 flex flex-wrap gap-3 text-sm">
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
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <DataTable
                                    columns={monthlyColumns}
                                    data={monthlyRows}
                                    searchKey="storeName"
                                    searchPlaceholder="Mağaza ara..."
                                    initialSorting={[{ id: "storeName", desc: false }]}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                    defaultPageSize={200}
                                    toolbar={
                                        <div className="flex w-full gap-2">
                                            <Button variant="outline" onClick={handleExportMonthly} className="ml-auto gap-2">
                                                <FileSpreadsheet className="h-4 w-4" />
                                                Excel İndir
                                            </Button>
                                        </div>
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
