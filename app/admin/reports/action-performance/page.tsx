"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle, AlertTriangle, Filter, Check, ArrowUpDown, FileSpreadsheet, Activity, Target, BrainCircuit, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRangeFilter } from "@/lib/types";
import { getWorkingDaysPassed, cn } from "@/lib/utils";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ActionPerformanceRow {
    id: string;
    storeName: string;
    auditorName: string;
    regionalManagerName?: string;
    auditDate: Date;
    totalActions: number;
    rejectedActions: number;
    returnDate: Date | null;
    daysTaken: number | null;
    status: 'on_time' | 'late' | 'pending' | 'no_action';
    isOverdue?: boolean;
}

interface RevisedAuditRow {
    id: string; // auditId
    storeName: string;
    regionalManagerName?: string;
    auditorName: string;
    auditDate: Date;
    rejectedItemsCount: number;
    resubmittedItemsCount: number;
    pendingRevisionCount: number;
    firstRejectedAt: Date | null;
    lastResubmittedAt: Date | null;
    avgResubmitDays: number | null; 
    statusLabel: string;
}

// Utility to parse irregular timestamp/date data
const parseDateObj = (rawDate: any, fallback: Date): Date => {
    if (!rawDate) return fallback;
    if (typeof rawDate.toDate === 'function') return rawDate.toDate();
    if (rawDate instanceof Date) return rawDate;
    if (typeof rawDate === 'object' && rawDate !== null && 'seconds' in rawDate) {
        return new Date(rawDate.seconds * 1000);
    }
    return new Date(rawDate);
}

export default function ActionPerformanceReport() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ActionPerformanceRow[]>([]);
    const [revisedData, setRevisedData] = useState<RevisedAuditRow[]>([]);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState("performance");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Parallel fetching for performance
                const auditsQuery = query(
                    collection(db, "audits"),
                    where("status", "==", "tamamlandi"),
                    orderBy("completedAt", "desc")
                );

                const [auditsSnapshot, storesSnapshot, usersSnapshot] = await Promise.all([
                    getDocs(auditsQuery),
                    getDocs(collection(db, "stores")),
                    getDocs(query(collection(db, "users"), where("role", "==", "bolge-muduru")))
                ]);

                // Create Data Maps
                const storeMap = new Map<string, Store>();
                storesSnapshot.docs.forEach(doc => {
                    storeMap.set(doc.id, { id: doc.id, ...doc.data() } as Store);
                });

                const userMap = new Map<string, string>(); // uid -> displayName
                usersSnapshot.docs.forEach(doc => {
                    const userData = doc.data() as UserProfile;
                    const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                    const name = fullName || userData.displayName || userData.email;
                    userMap.set(doc.id, name);
                });

                const processedData: ActionPerformanceRow[] = [];
                const processedRevisedData: RevisedAuditRow[] = [];

                auditsSnapshot.docs.forEach(doc => {
                    const audit = { id: doc.id, ...doc.data() } as Audit;
                    if (!audit.completedAt) return;

                    let auditDate: Date = parseDateObj(audit.completedAt, new Date());

                    // Find Regional Manager
                    let regionalManagerName = "-";
                    const store = storeMap.get(audit.storeId);
                    if (store && store.regionalManagerId) {
                        const rmName = userMap.get(store.regionalManagerId);
                        if (rmName) regionalManagerName = rmName;
                    }

                    // For Action Performance Table
                    let totalActions = 0;
                    let rejectedActions = 0;
                    let actionsPending = false;
                    let firstSubmissionDate: Date | null = null;
                    let hasActionItems = false;

                    // For Revised Analysis Table
                    let rejectedItemsCount = 0;
                    let resubmittedItemsCount = 0;
                    let totalResubmitDays = 0;
                    let itemsWithResubmitDays = 0;
                    let firstRejectedAt: Date | null = null;
                    let lastResubmittedAt: Date | null = null;

                    audit.sections.forEach(section => {
                        section.answers.forEach(answer => {
                            const isActionNeeded = answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf" && (answer.earnedPoints || 0) < (answer.maxPoints || 0);

                            if (isActionNeeded) {
                                hasActionItems = true;
                                totalActions++;

                                // Check submission status
                                const status = answer.actionData?.status;
                                if (!status || status === "pending_store") {
                                    actionsPending = true;
                                } else if (status === "rejected") {
                                    rejectedActions++;
                                }

                                // Check submission date for Performance
                                if (answer.actionData?.submittedAt) {
                                    const subDate = parseDateObj(answer.actionData.submittedAt, new Date());
                                    if (!firstSubmissionDate || subDate < firstSubmissionDate) {
                                        firstSubmissionDate = subDate;
                                    }
                                }

                                // Extraction for Revised Actions
                                if (answer.actionData?.rejectedAt) {
                                    rejectedItemsCount++;
                                    const rejectDate = parseDateObj(answer.actionData.rejectedAt, auditDate);
                                    if (!firstRejectedAt || rejectDate < firstRejectedAt) firstRejectedAt = rejectDate;
    
                                    let hasResubmitted = false;
                                    let resubmitDate: Date | null = null;
                                    
                                    if (answer.actionData.submittedAt) {
                                        const subDate = parseDateObj(answer.actionData.submittedAt, new Date());
                                        if (subDate >= rejectDate) {
                                            hasResubmitted = true;
                                            resubmitDate = subDate;
                                        }
                                    }
                                    
                                    const currentStatus = answer.actionData.status;
                                    if (!hasResubmitted && (currentStatus === "pending_admin" || currentStatus === "approved")) {
                                        hasResubmitted = true;
                                        if(currentStatus === "approved" && answer.actionData.approvedAt) {
                                            resubmitDate = parseDateObj(answer.actionData.approvedAt, new Date());
                                        }
                                    }
    
                                    if (hasResubmitted) {
                                        resubmittedItemsCount++;
                                        if (resubmitDate) {
                                            if (!lastResubmittedAt || resubmitDate > lastResubmittedAt) lastResubmittedAt = resubmitDate;
                                            
                                            const daysTaken = getWorkingDaysPassed(rejectDate, resubmitDate);
                                            totalResubmitDays += Math.max(0, daysTaken);
                                            itemsWithResubmitDays++;
                                        }
                                    }
                                }
                            }
                        });
                    });

                    // Build Revised Analytics row if there was any rejection in this audit
                    if (rejectedItemsCount > 0) {
                        const pendingRevisionCount = rejectedItemsCount - resubmittedItemsCount;
                        let statusLabel = "";
                        if (pendingRevisionCount === 0) {
                            statusLabel = "Tümüne Dönüş Yapıldı";
                        } else if (resubmittedItemsCount === 0) {
                            statusLabel = "Dönüş Bekliyor";
                        } else {
                            statusLabel = `${pendingRevisionCount} Madde Bekliyor`;
                        }
                        
                        processedRevisedData.push({
                            id: audit.id,
                            storeName: audit.storeName,
                            regionalManagerName: regionalManagerName,
                            auditorName: audit.auditorName,
                            auditDate: auditDate,
                            rejectedItemsCount,
                            resubmittedItemsCount,
                            pendingRevisionCount,
                            firstRejectedAt,
                            lastResubmittedAt,
                            avgResubmitDays: itemsWithResubmitDays > 0 ? Math.round(totalResubmitDays / itemsWithResubmitDays) : null,
                            statusLabel
                        });
                    }

                    if (!hasActionItems) return; // Skip audits with no actions for performance tab

                    let status: ActionPerformanceRow['status'] = 'pending';
                    let daysTaken: number | null = null;
                    let isOverdue = false;
                    const daysSinceAudit = getWorkingDaysPassed(auditDate, new Date());

                    if (actionsPending) {
                        status = 'pending';
                        if (daysSinceAudit > 3) {
                            isOverdue = true;
                        }
                    } else if (firstSubmissionDate) {
                        daysTaken = getWorkingDaysPassed(auditDate, firstSubmissionDate);
                        status = daysTaken <= 3 ? 'on_time' : 'late';
                    } else {
                        // Fallback
                        status = 'pending';
                        if (daysSinceAudit > 3) isOverdue = true;
                    }

                    processedData.push({
                        id: audit.id,
                        storeName: audit.storeName,
                        auditorName: audit.auditorName,
                        regionalManagerName: regionalManagerName,
                        auditDate: auditDate,
                        totalActions: totalActions,
                        rejectedActions: rejectedActions,
                        returnDate: firstSubmissionDate,
                        daysTaken: daysTaken,
                        status: status,
                        isOverdue: isOverdue
                    });
                });

                setData(processedData);
                setRevisedData(processedRevisedData);

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter Logic for Performance Report
    const filteredData = data.filter(item => {
        if (dateRange?.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            if (item.auditDate < fromDate) return false;
        }
        if (dateRange?.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            if (item.auditDate > toDate) return false;
        }
        if (statusFilter.length > 0) {
            if (!statusFilter.includes(item.status)) {
                return false;
            }
        }
        return true;
    });

    // Filter Logic for Revised Actions Report
    const filteredRevisedData = revisedData.filter(item => {
        if (dateRange?.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            if (item.auditDate < fromDate) return false; 
        }
        if (dateRange?.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            if (item.auditDate > toDate) return false;
        }
        return true;
    });

    // Calculations for Revised Insight Cards
    const totalRejectedEver = filteredRevisedData.reduce((acc, row) => acc + row.rejectedItemsCount, 0);
    
    let sumDays = 0; 
    let countDays = 0;
    filteredRevisedData.forEach(r => { 
        if(r.avgResubmitDays !== null) { 
            sumDays += r.avgResubmitDays; 
            countDays++; 
        }
    });
    const overallAvgDays = countDays > 0 ? (sumDays / countDays).toFixed(1) : "-";

    const storeRejectionsMap = new Map<string, number>();
    filteredRevisedData.forEach(item => {
        storeRejectionsMap.set(item.storeName, (storeRejectionsMap.get(item.storeName) || 0) + item.rejectedItemsCount);
    });
    let maxRejections = 0;
    let topRejectedStore = "-";
    storeRejectionsMap.forEach((count, storeName) => {
        if (count > maxRejections) {
            maxRejections = count;
            topRejectedStore = storeName;
        }
    });

    // Columns Definition
    const performanceColumns: ColumnDef<ActionPerformanceRow>[] = [
        {
            accessorKey: "storeName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Mağaza Adı" />,
            cell: ({ row }) => <span className="font-medium text-base">{row.original.storeName}</span>,
            meta: { title: "Mağaza Adı" } as any,
        },
        {
            accessorKey: "regionalManagerName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bölge Müdürü" />,
            cell: ({ row }) => <span className="text-sm text-foreground">{row.original.regionalManagerName}</span>,
            meta: { title: "Bölge Müdürü" } as any,
        },
        {
            accessorKey: "auditorName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Denetmen" />,
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.auditorName}</span>,
            meta: { title: "Denetmen" } as any,
        },
        {
            accessorKey: "auditDate",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 hover:bg-transparent font-semibold text-foreground"
                    >
                        Denetim Tarihi
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <span className="text-sm">{row.original.auditDate.toLocaleDateString("tr-TR")}</span>,
            enableColumnFilter: false,
            meta: { title: "Denetim Tarihi" } as any,
        },
        {
            accessorKey: "totalActions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aksiyon" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                        {row.original.totalActions} adet
                    </Badge>
                    {row.original.rejectedActions > 0 && (
                        <span className="text-[10px] text-rose-600 font-bold">
                            {row.original.rejectedActions} Reddedildi
                        </span>
                    )}
                </div>
            ),
            enableColumnFilter: false,
            meta: { title: "Aksiyon Sayısı" } as any,
        },
        {
            accessorKey: "returnDate",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 hover:bg-transparent font-semibold text-foreground"
                    >
                        Dönüş Tarihi
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => row.original.returnDate ? <span className="text-sm">{row.original.returnDate.toLocaleDateString("tr-TR")}</span> : <span className="text-muted-foreground text-sm">-</span>,
            enableColumnFilter: false,
            meta: { title: "Dönüş Tarihi" } as any,
        },
        {
            accessorKey: "daysTaken",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Süre (İş Günü)" />,
            cell: ({ row }) => {
                const val = row.original.daysTaken;
                if (val !== null) return <span className="font-bold text-sm">{val} Gün</span>;
                const daysPassing = getWorkingDaysPassed(row.original.auditDate, new Date());
                return <span className="text-xs text-muted-foreground italic">({daysPassing} gün geçti)</span>
            },
            enableColumnFilter: false,
            meta: { title: "Süre" } as any,
        },
        {
            accessorKey: "status",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 hover:bg-transparent font-semibold text-foreground"
                    >
                        Durum
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const status = row.original.status;
                const overdue = row.original.isOverdue;

                if (status === 'on_time') {
                    return (
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-sm font-semibold border border-emerald-200 w-fit">
                            <CheckCircle2 className="w-4 h-4" /> Zamanında
                        </div>
                    );
                }
                if (status === 'late') {
                    return (
                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-sm font-semibold border border-amber-200 w-fit">
                            <Clock className="w-4 h-4" /> Geç Döndü
                        </div>
                    );
                }
                if (status === 'pending') {
                    if (overdue) {
                        return (
                            <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-1 rounded-md text-sm font-semibold border border-rose-200 w-fit animate-pulse">
                                <AlertTriangle className="w-4 h-4" /> Gecikti
                            </div>
                        );
                    }
                    return (
                        <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-sm font-semibold border border-blue-200 w-fit">
                            <Clock className="w-4 h-4" /> Bekleniyor
                        </div>
                    );
                }
                return null;
            },
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
            meta: { title: "Durum" } as any,
        }
    ];

    const revisedColumns: ColumnDef<RevisedAuditRow>[] = [
        {
            accessorKey: "storeName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Mağaza Adı" />,
            cell: ({ row }) => <span className="font-medium text-base">{row.original.storeName}</span>,
            meta: { title: "Mağaza Adı" } as any,
        },
        {
            accessorKey: "regionalManagerName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bölge Müdürü" />,
            cell: ({ row }) => <span className="text-sm text-foreground">{row.original.regionalManagerName}</span>,
            meta: { title: "Bölge Müdürü" } as any,
        },
        {
            accessorKey: "auditDate",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 hover:bg-transparent font-semibold text-foreground whitespace-nowrap"
                    >
                        Denetim Tarihi
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <span className="text-sm whitespace-nowrap">{row.original.auditDate.toLocaleDateString("tr-TR")}</span>,
            enableColumnFilter: false,
            meta: { title: "Denetim Tarihi" } as any,
        },
        {
            accessorKey: "rejectedItemsCount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="İade Özeti" />,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 items-start">
                    <Badge variant="destructive" className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 items-center justify-between min-w-[120px] shadow-sm">
                        <span>Ret Gören:</span>
                        <span className="font-bold ml-2 font-mono">{row.original.rejectedItemsCount}</span>
                    </Badge>
                    <Badge variant="secondary" className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 items-center justify-between min-w-[120px] shadow-sm">
                        <span>Dönüş Yapan:</span>
                        <span className="font-bold ml-2 font-mono">{row.original.resubmittedItemsCount}</span>
                    </Badge>
                </div>
            ),
            meta: { title: "İade Özeti" } as any,
        },
        {
            accessorKey: "statusLabel",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Revize Durumu" />,
            cell: ({ row }) => {
                const pending = row.original.pendingRevisionCount;
                if (pending === 0) {
                    return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Tümü Çözüldü</Badge>
                }
                if (row.original.resubmittedItemsCount === 0) {
                    return <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-50"><XCircle className="w-3 h-3 mr-1" /> Dönüş Bekliyor</Badge>
                }
                return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50"><RefreshCw className="w-3 h-3 mr-1" /> {pending} Madde Bekliyor</Badge>
            },
            meta: { title: "Revize Durumu" } as any,
        },
        {
            accessorKey: "avgResubmitDays",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ort. Dönüş Hızı" />,
            cell: ({ row }) => {
                const days = row.original.avgResubmitDays;
                if (days === null) return <span className="text-xs text-muted-foreground italic pl-6">-</span>;
                return <span className="font-bold text-sm bg-muted pl-4 px-2 py-1 rounded-md">{days} İş Günü</span>
            },
            enableColumnFilter: false,
            meta: { title: "Ort. Dönüş Hızı" } as any,
        }
    ];

    const statusOptions = [
        { label: "Zamanında", value: "on_time", icon: CheckCircle2 },
        { label: "Geç Döndü", value: "late", icon: Clock },
        { label: "Bekleniyor", value: "pending", icon: Clock },
    ];

    const handleExportExcel = () => {
        if (activeTab === "performance") {
            const worksheet = XLSX.utils.json_to_sheet(filteredData.map(row => ({
                "Mağaza Adı": row.storeName,
                "Bölge Müdürü": row.regionalManagerName || "-",
                "Denetmen": row.auditorName,
                "Oluşturulma Tarihi": row.auditDate.toLocaleDateString("tr-TR"),
                "Aksiyon Sayısı": row.totalActions,
                "Reddedilen Aksiyon": row.rejectedActions,
                "Dönüş Tarihi": row.returnDate ? row.returnDate.toLocaleDateString("tr-TR") : "-",
                "Süre (İş Günü)": row.daysTaken !== null ? row.daysTaken : `Geçen: ${getWorkingDaysPassed(row.auditDate, new Date())}`,
                "Durum": row.status === 'on_time' ? "Zamanında" : row.status === 'late' ? "Geç Döndü" : "Bekleniyor",
                "Gecikme Durumu": row.isOverdue ? "Gecikti" : "Normal"
            })));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Aksiyon Performansı");
            XLSX.writeFile(workbook, `Aksiyon_Performans_Raporu_${new Date().toLocaleDateString("tr-TR")}.xlsx`);
        } else {
            const worksheet = XLSX.utils.json_to_sheet(filteredRevisedData.map(row => ({
                "Mağaza Adı": row.storeName,
                "Bölge Müdürü": row.regionalManagerName || "-",
                "Denetim Tarihi": row.auditDate.toLocaleDateString("tr-TR"),
                "Denetmen": row.auditorName,
                "Toplam Reddedilen Madde": row.rejectedItemsCount,
                "Tekrar Dönüş Yapılan": row.resubmittedItemsCount,
                "Hala Bekleyen Madde": row.pendingRevisionCount,
                "Güncel Revize Durumu": row.statusLabel,
                "Ortalama Dönüş Hızı": row.avgResubmitDays !== null ? `${row.avgResubmitDays} Gün` : "-"
            })));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Revize Analizi");
            XLSX.writeFile(workbook, `Aksiyon_İade_Revize_Raporu_${new Date().toLocaleDateString("tr-TR")}.xlsx`);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2 text-primary">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Clock className="h-6 w-6 text-primary" />
                                </div>
                                Aksiyon Yönetim ve Performans Raporları
                            </CardTitle>
                            <CardDescription className="text-base text-muted-foreground mt-2">
                                Mağazaların aksiyonlara dönüş hızlarını ve iade (revize) oranlarını yönetin.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b pb-4">
                            <TabsList className="bg-muted/50 p-1 w-full sm:w-auto h-auto min-h-12 overflow-x-auto flex flex-nowrap rounded-lg">
                                <TabsTrigger 
                                    value="performance" 
                                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6 py-2.5 text-sm font-semibold flex items-center whitespace-nowrap min-w-max"
                                >
                                    <Activity className="w-4 h-4 mr-2" />
                                    Aksiyon Hız Performansı
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="revised" 
                                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6 py-2.5 text-sm font-semibold flex items-center whitespace-nowrap min-w-max"
                                >
                                    <BrainCircuit className="w-4 h-4 mr-2" />
                                    Revize (İade) Analizi
                                </TabsTrigger>
                            </TabsList>
                            <div className="flex flex-wrap items-center gap-2 bg-white/80 dark:bg-background/80 p-1 rounded-lg border shadow-sm w-full lg:w-auto">
                                <DateRangePicker
                                    value={dateRange}
                                    onChange={setDateRange}
                                    className="w-full sm:w-auto sm:min-w-[260px] border-none shadow-none text-sm"
                                />

                                <div className="hidden lg:block h-6 w-px bg-gray-200" />

                                {activeTab === "performance" && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 border-dashed flex-shrink-0 ml-auto lg:ml-0">
                                                <Filter className="mr-2 h-4 w-4" />
                                                Durum
                                                {statusFilter.length > 0 && (
                                                    <>
                                                        <Separator orientation="vertical" className="mx-2 h-4" />
                                                        <Badge
                                                            variant="secondary"
                                                            className="rounded-sm px-1 font-normal lg:hidden"
                                                        >
                                                            {statusFilter.length}
                                                        </Badge>
                                                        <div className="hidden space-x-1 lg:flex">
                                                            {statusFilter.length > 2 ? (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="rounded-sm px-1 font-normal"
                                                                >
                                                                    {statusFilter.length} seçildi
                                                                </Badge>
                                                            ) : (
                                                                statusOptions
                                                                    .filter((option) => statusFilter.includes(option.value))
                                                                    .map((option) => (
                                                                        <Badge
                                                                            key={option.value}
                                                                            variant="secondary"
                                                                            className="rounded-sm px-1 font-normal"
                                                                        >
                                                                            {option.label}
                                                                        </Badge>
                                                                    ))
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0" align="end">
                                            <Command>
                                                <CommandInput placeholder="Durum ara..." />
                                                <CommandList>
                                                    <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                                                    <CommandGroup>
                                                        {statusOptions.map((option) => {
                                                            const isSelected = statusFilter.includes(option.value);
                                                            return (
                                                                <CommandItem
                                                                    key={option.value}
                                                                    onSelect={() => {
                                                                        if (isSelected) {
                                                                            setStatusFilter(statusFilter.filter((value) => value !== option.value));
                                                                        } else {
                                                                            setStatusFilter([...statusFilter, option.value]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                            isSelected
                                                                                ? "bg-primary text-primary-foreground"
                                                                                : "opacity-50 [&_svg]:invisible"
                                                                        )}
                                                                    >
                                                                        <Check className={cn("h-4 w-4")} />
                                                                    </div>
                                                                    {option.icon && (
                                                                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                    <span>{option.label}</span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                    {statusFilter.length > 0 && (
                                                        <>
                                                            <CommandSeparator />
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => setStatusFilter([])}
                                                                    className="justify-center text-center"
                                                                >
                                                                    Filtreyi Temizle
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                )}

                                {(dateRange?.from || dateRange?.to) && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                                        className={cn("h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-full flex-shrink-0", activeTab === "revised" ? "ml-auto lg:ml-0" : "")}
                                        title="Tarihi Temizle"
                                    >
                                        <XCircle className="h-4 w-4" />
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn("h-8 gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300", activeTab === "revised" ? "" : "")}
                                    onClick={handleExportExcel}
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Excel
                                </Button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground animate-pulse">Veriler yükleniyor...</p>
                            </div>
                        ) : (
                            <>
                                <TabsContent value="performance" className="mt-0">
                                    <DataTable
                                        columns={performanceColumns}
                                        data={filteredData}
                                        searchKey="storeName"
                                        searchPlaceholder="Mağaza adına göre ara..."
                                    />
                                </TabsContent>

                                <TabsContent value="revised" className="mt-0 space-y-6">
                                    
                                    {/* Action Insights Panel for Revised Actions */}
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <Card className="shadow-none border border-border/60 bg-gradient-to-br from-white to-gray-50 dark:from-background dark:to-muted/20">
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground mb-1">Toplam Geçmiş İadeler</p>
                                                        <h3 className="text-3xl font-bold tracking-tight text-foreground">{totalRejectedEver}</h3>
                                                        <p className="text-xs text-muted-foreground mt-2 flex items-center leading-relaxed">
                                                            Şimdiye kadar idari birimden "Ret" görmüş (<span className="text-rose-500 font-semibold mx-1">kötü dönüşlü</span>) aksiyonların toplamı.
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                                                        <Target className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="shadow-none border border-border/60 bg-gradient-to-br from-white to-amber-50/50 dark:from-background dark:to-amber-950/20">
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground mb-1">En Çok İade Alan Mağaza</p>
                                                        <h3 className="text-xl font-bold tracking-tight text-amber-700 dark:text-amber-500 line-clamp-1">{topRejectedStore}</h3>
                                                        <p className="text-xs text-amber-600/70 mt-3 font-medium flex items-center">
                                                            <AlertCircle className="w-3 h-3 mr-1"/> Toplam {maxRejections} defa yetersiz kalite/yanıt.
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
                                                        <AlertTriangle className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        <Card className="shadow-none border border-border/60 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-background">
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-500 mb-1 flex items-center gap-2">
                                                            Mağaza Revize Hızı <RefreshCw className="w-3 h-3"/>
                                                        </p>
                                                        <div className="flex items-baseline gap-1">
                                                            <h3 className="text-3xl font-bold tracking-tight text-emerald-600">{overallAvgDays}</h3>
                                                            <span className="text-sm font-semibold text-emerald-600/70">İş Günü</span>
                                                        </div>
                                                        <p className="text-xs text-emerald-600/70 mt-2 font-medium">
                                                            Mağazaların reddedildikten sonra tekrar düzeltip yollama ortalama hızı.
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <DataTable
                                        columns={revisedColumns}
                                        data={filteredRevisedData}
                                        searchKey="storeName"
                                        searchPlaceholder="Mağaza adına göre ara..."
                                    />
                                </TabsContent>
                            </>
                        )}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
