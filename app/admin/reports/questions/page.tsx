"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { startOfMonth, endOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar as CalendarIcon, Download, AlertCircle, AlertTriangle, CheckCircle, TrendingDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit } from "@/lib/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, UserProfile } from "@/lib/types";

// --- Types ---

interface QuestionStats {
    id: string;
    text: string;
    sectionName: string;
    totalAnswers: number;
    failCount: number; // "hayir" count
    successCount: number; // "evet" count
    exemptCount: number; // "muaf" count
    pointsLost: number;
    maxStreak: number; // Maximum consecutive failures across all stores
    storesWithStreak: string[]; // Stores that had the max streak
}

interface StoreStreakTracker {
    [questionId: string]: number;
}

// Helper component for column header with sorting and faceted filtering
const DataTableColumnHeader = ({ column, title, showFilter = true, className }: { column: any; title: string, showFilter?: boolean, className?: string }) => {
    // Generate unique options from the column data for the faceted filter
    const facets = column.getFacetedUniqueValues();
    const options = Array.from(facets.keys())
        .filter((key: any) => key !== undefined && key !== null && key !== "")
        .sort()
        .map((key: any) => ({
            label: String(key),
            value: String(key),
        }));

    return (
        <div className={cn("flex items-center space-x-2", className)}>
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                <span>{title}</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            {showFilter && (
                <div className="flex items-center">
                    <DataTableFacetedFilter
                        column={column}
                        title={title}
                        options={options}
                    />
                </div>
            )}
        </div>
    );
};

export default function QuestionAnalysisPage() {
    // --- State ---
    const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

    const [loading, setLoading] = useState(false);
    const [audits, setAudits] = useState<Audit[]>([]);

    // Filters
    const [stores, setStores] = useState<Store[]>([]);
    const [regionalManagers, setRegionalManagers] = useState<UserProfile[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
    const [selectedManagerId, setSelectedManagerId] = useState<string>("all");

    // --- Data Fetching ---
    useEffect(() => {
        const fetchAudits = async () => {
            setLoading(true);
            try {
                let q = query(
                    collection(db, "audits"),
                    where("status", "==", "tamamlandi")
                );

                const snapshot = await getDocs(q);
                let fetchedAudits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Audit));

                // Client-side date filtering
                if (startDate && endDate) {
                    const endOfToDate = new Date(endDate);
                    endOfToDate.setHours(23, 59, 59, 999);

                    const startOfFromDate = new Date(startDate);
                    startOfFromDate.setHours(0, 0, 0, 0);

                    fetchedAudits = fetchedAudits.filter(a => {
                        if (!a.completedAt) return false;
                        const d = a.completedAt.toDate();
                        return d >= startOfFromDate && d <= endOfToDate;
                    });
                }

                fetchedAudits.sort((a, b) => a.completedAt!.toMillis() - b.completedAt!.toMillis());
                setAudits(fetchedAudits);
            } catch (error) {
                console.error("Error fetching audits:", error);
                toast.error("Veriler yüklenirken hata oluştu.");
            } finally {
                setLoading(false);
            }
        };

        if (startDate && endDate) {
            fetchAudits();
        }
    }, [startDate, endDate]);

    // Fetch Stores and Regional Managers
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Stores
                const storesSnap = await getDocs(collection(db, "stores"));
                const storesData = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
                setStores(storesData);

                // Fetch Regional Managers
                const usersQuery = query(collection(db, "users"), where("role", "==", "bolge-muduru"));
                const usersSnap = await getDocs(usersQuery);
                const usersData = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
                setRegionalManagers(usersData);
            } catch (error) {
                console.error("Error fetching filter data:", error);
            }
        };
        fetchData();
    }, []);

    // Filter audits based on selected filters
    const filteredAudits = useMemo(() => {
        return audits.filter(audit => {
            // Region Filter
            if (selectedManagerId !== "all") {
                const store = stores.find(s => s.id === audit.storeId);
                if (store?.regionalManagerId !== selectedManagerId) return false;
            }
            // Store Filter
            if (selectedStoreId !== "all") {
                if (audit.storeId !== selectedStoreId) return false;
            }
            return true;
        });
    }, [audits, selectedStoreId, selectedManagerId, stores]);

    // --- Analysis Engine ---
    const stats = useMemo(() => {
        const questionMap = new Map<string, QuestionStats>();
        const storeStreaks: Record<string, StoreStreakTracker> = {};
        const storeMaxStreaks: Record<string, Record<string, number>> = {};

        filteredAudits.forEach(audit => {
            const storeId = audit.storeId;
            if (!storeStreaks[storeId]) storeStreaks[storeId] = {};
            if (!storeMaxStreaks[storeId]) storeMaxStreaks[storeId] = {};

            audit.sections.forEach(section => {
                section.answers.forEach(answer => {
                    if (!questionMap.has(answer.questionId)) {
                        questionMap.set(answer.questionId, {
                            id: answer.questionId,
                            text: answer.questionText,
                            sectionName: section.sectionName,
                            totalAnswers: 0,
                            failCount: 0,
                            successCount: 0,
                            exemptCount: 0,
                            pointsLost: 0,
                            maxStreak: 0,
                            storesWithStreak: []
                        });
                    }

                    const q = questionMap.get(answer.questionId)!;
                    q.totalAnswers++;

                    const isFail = answer.answer === "hayir";
                    const isSuccess = answer.answer === "evet";

                    if (isFail) {
                        q.failCount++;
                        q.pointsLost += (answer.maxPoints - answer.earnedPoints);
                    } else if (isSuccess) {
                        q.successCount++;
                    } else {
                        q.exemptCount++;
                    }

                    const currentStoreStreak = storeStreaks[storeId][answer.questionId] || 0;

                    if (isFail) {
                        const newStreak = currentStoreStreak + 1;
                        storeStreaks[storeId][answer.questionId] = newStreak;
                        if (newStreak > (storeMaxStreaks[storeId][answer.questionId] || 0)) {
                            storeMaxStreaks[storeId][answer.questionId] = newStreak;
                        }
                    } else if (isSuccess) {
                        storeStreaks[storeId][answer.questionId] = 0;
                    }
                });
            });
        });

        questionMap.forEach((q) => {
            let maxS = 0;
            let stores: string[] = [];

            for (const sId in storeMaxStreaks) {
                const streak = storeMaxStreaks[sId][q.id] || 0;
                if (streak > maxS) {
                    maxS = streak;
                    stores = [sId];
                } else if (streak === maxS && streak > 0) {
                    stores.push(sId);
                }
            }
            q.maxStreak = maxS;
        });

        return Array.from(questionMap.values());
    }, [filteredAudits]);

    const exportToExcel = async (dataToExport: QuestionStats[]) => {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(dataToExport.map(s => ({
            "Soru": s.text,
            "Bölüm": s.sectionName,
            "Toplam Cevap": s.totalAnswers,
            "Hata (Hayır) Sayısı": s.failCount,
            "Başarısızlık Oranı (%)": ((s.failCount / s.totalAnswers) * 100).toFixed(1),
            "Toplam Puan Kaybı": s.pointsLost,
            "Maksimum Arka Arkaya Hata": s.maxStreak
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Soru Analizi");
        XLSX.writeFile(wb, `soru-analiz-raporu-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const columns: ColumnDef<QuestionStats>[] = [
        {
            accessorKey: "sectionName",
            meta: { title: "Bölüm" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Bölüm" showFilter={true} />,
            cell: ({ row }) => <div className="text-muted-foreground text-xs whitespace-nowrap font-medium">{row.original.sectionName}</div>,
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "text",
            meta: { title: "Soru Metni" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Soru Metni" showFilter={true} />,
            cell: ({ row }) => (
                <div className="font-medium text-xs md:text-sm whitespace-normal break-words min-w-[400px] max-w-[700px]">
                    {row.original.text}
                </div>
            ),
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "totalAnswers",
            meta: { title: "Top. Cevap" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Top. Cevap" showFilter={false} className="justify-center w-full" />,
            cell: ({ row }) => <div className="text-center whitespace-nowrap">{row.original.totalAnswers}</div>
        },
        {
            accessorKey: "failCount",
            meta: { title: "Hata" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Hata (Hayır)" showFilter={false} className="justify-center w-full" />,
            cell: ({ row }) => (
                <div className="text-center whitespace-nowrap flex flex-col items-center">
                    <Badge variant={row.original.failCount > 0 ? "destructive" : "secondary"}>
                        {row.original.failCount}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">
                        %{((row.original.failCount / row.original.totalAnswers) * 100).toFixed(0)}
                    </div>
                </div>
            )
        },
        {
            accessorKey: "pointsLost",
            meta: { title: "Puan Kaybı" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Puan Kaybı" showFilter={false} className="justify-center w-full" />,
            cell: ({ row }) => (
                <div className="text-center font-semibold text-orange-600 whitespace-nowrap">
                    {row.original.pointsLost > 0 ? `-${row.original.pointsLost}` : "0"}
                </div>
            )
        },
        {
            accessorKey: "maxStreak",
            meta: { title: "Max Seri Hata" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Max Seri Hata" showFilter={false} className="justify-center w-full" />,
            cell: ({ row }) => (
                <div className="text-center whitespace-nowrap flex justify-center">
                    {row.original.maxStreak > 1 ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">
                            {row.original.maxStreak} Kez
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Soru Analiz Raporu</h1>
                <p className="text-muted-foreground">
                    Denetim sorularının performans ve hata analizi
                </p>
            </div>

            {/* Summary Cards */}
            {stats.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="relative overflow-hidden border border-emerald-200 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-emerald-50 dark:from-zinc-900 dark:to-emerald-950/30">
                        <div className="absolute top-0 right-0 p-4 opacity-15 transform translate-x-2 -translate-y-2">
                            <CheckCircle className="w-28 h-28 text-emerald-500" />
                        </div>
                        <div className="p-6 flex flex-col justify-between h-full relative z-10 border-l-[6px] border-emerald-500 pl-6">
                            <div>
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">Toplam Soru</h3>
                                <div className="text-5xl font-black text-foreground tracking-tighter">
                                    {stats.reduce((acc, curr) => acc + curr.totalAnswers, 0)}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm font-bold text-emerald-700 bg-emerald-100/50 dark:bg-emerald-900/50 px-3 py-1.5 rounded-md w-fit backdrop-blur-sm">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Cevaplanan
                            </div>
                        </div>
                    </Card>

                    <Card className="relative overflow-hidden border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-red-50 dark:from-zinc-900 dark:to-red-950/30">
                        <div className="absolute top-0 right-0 p-4 opacity-15 transform translate-x-2 -translate-y-2">
                            <AlertCircle className="w-28 h-28 text-red-500" />
                        </div>
                        <div className="p-6 flex flex-col justify-between h-full relative z-10 border-l-[6px] border-red-500 pl-6">
                            <div>
                                <h3 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">En Çok "Hayır"</h3>
                                <div className="text-5xl font-black text-red-600 tracking-tighter">
                                    {Math.max(...stats.map(s => s.failCount))}
                                </div>
                            </div>
                            <div className="mt-4 text-sm font-medium text-foreground/80 line-clamp-2 italic border-t-2 pt-3 border-red-100 dark:border-red-900/50">
                                {stats.sort((a, b) => b.failCount - a.failCount)[0]?.text || "-"}
                            </div>
                        </div>
                    </Card>

                    <Card className="relative overflow-hidden border border-orange-200 dark:border-orange-800 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-orange-50 dark:from-zinc-900 dark:to-orange-950/30">
                        <div className="absolute top-0 right-0 p-4 opacity-15 transform translate-x-2 -translate-y-2">
                            <TrendingDown className="w-28 h-28 text-orange-500" />
                        </div>
                        <div className="p-6 flex flex-col justify-between h-full relative z-10 border-l-[6px] border-orange-500 pl-6">
                            <div>
                                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-2">Puan Kaybı</h3>
                                <div className="text-5xl font-black text-orange-600 tracking-tighter">
                                    {Math.max(...stats.map(s => s.pointsLost))}
                                    <span className="text-xl font-bold text-muted-foreground ml-2">Puan</span>
                                </div>
                            </div>
                            <div className="mt-4 text-sm font-medium text-foreground/80 line-clamp-2 italic border-t-2 pt-3 border-orange-100 dark:border-orange-900/50">
                                {stats.sort((a, b) => b.pointsLost - a.pointsLost)[0]?.text || "-"}
                            </div>
                        </div>
                    </Card>

                    <Card className="relative overflow-hidden border border-yellow-200 dark:border-yellow-800 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-yellow-50 dark:from-zinc-900 dark:to-yellow-950/30">
                        <div className="absolute top-0 right-0 p-4 opacity-15 transform translate-x-2 -translate-y-2">
                            <AlertTriangle className="w-28 h-28 text-yellow-500" />
                        </div>
                        <div className="p-6 flex flex-col justify-between h-full relative z-10 border-l-[6px] border-yellow-500 pl-6">
                            <div>
                                <h3 className="text-sm font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-2">Max Seri Hata</h3>
                                <div className="text-5xl font-black text-yellow-600 tracking-tighter">
                                    {Math.max(...stats.map(s => s.maxStreak))}
                                    <span className="text-xl font-bold text-muted-foreground ml-2">Kez</span>
                                </div>
                            </div>
                            <div className="mt-4 text-sm font-medium text-foreground/80 line-clamp-2 italic border-t-2 pt-3 border-yellow-100 dark:border-yellow-900/50">
                                {stats.sort((a, b) => b.maxStreak - a.maxStreak)[0]?.text || "-"}
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <Card>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={stats}
                        enableGlobalFilter={true}
                        searchPlaceholder="Soru metni veya bölüm ara..."
                        alignToolbar="end"
                        pageSizeOptions={[10, 20, 50, 100, 200]}
                        toolbar={(table) => (
                            <div className="flex items-center gap-2">
                                <Select value={selectedManagerId} onValueChange={(val) => {
                                    setSelectedManagerId(val);
                                    setSelectedStoreId("all"); // Reset store when region changes
                                }}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Bölge Müdürü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Bölgeler</SelectItem>
                                        {regionalManagers.map(manager => (
                                            <SelectItem key={manager.uid} value={manager.uid}>
                                                {manager.firstName} {manager.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Mağaza Seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Mağazalar</SelectItem>
                                        {stores
                                            .filter(store => selectedManagerId === "all" || store.regionalManagerId === selectedManagerId)
                                            .map(store => (
                                                <SelectItem key={store.id} value={store.id}>
                                                    {store.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>

                                <span className="text-muted-foreground mx-1">|</span>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[180px] justify-start text-left font-normal",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "d MMM y", { locale: tr }) : <span>Başlangıç Tarihi</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>

                                <span className="text-muted-foreground">-</span>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[180px] justify-start text-left font-normal",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "d MMM y", { locale: tr }) : <span>Bitiş Tarihi</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            initialFocus
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    variant="outline"
                                    onClick={() => exportToExcel(table.getFilteredRowModel().rows.map((row: any) => row.original))}
                                    disabled={table.getFilteredRowModel().rows.length === 0}
                                    className="ml-2"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Excel İndir
                                </Button>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
