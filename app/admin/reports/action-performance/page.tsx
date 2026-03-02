"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle, AlertTriangle, Filter, Check, ArrowUpDown, FileSpreadsheet } from "lucide-react";
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

export default function ActionPerformanceReport() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ActionPerformanceRow[]>([]);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [statusFilter, setStatusFilter] = useState<string[]>([]);

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

                auditsSnapshot.docs.forEach(doc => {
                    const audit = { id: doc.id, ...doc.data() } as Audit;
                    if (!audit.completedAt) return;

                    // Fix timestamp issue
                    let auditDate: Date;
                    if (audit.completedAt instanceof Timestamp) {
                        auditDate = audit.completedAt.toDate();
                    } else if (typeof (audit.completedAt as any).toDate === 'function') {
                        auditDate = (audit.completedAt as any).toDate();
                    } else {
                        auditDate = new Date(audit.completedAt as any);
                    }

                    // Find Regional Manager
                    let regionalManagerName = "-";
                    const store = storeMap.get(audit.storeId);
                    if (store && store.regionalManagerId) {
                        const rmName = userMap.get(store.regionalManagerId);
                        if (rmName) regionalManagerName = rmName;
                    }

                    // Analyze Actions
                    let totalActions = 0;
                    let rejectedActions = 0;
                    let actionsPending = false;
                    let firstSubmissionDate: Date | null = null;
                    let hasActionItems = false;

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

                                // Check submission date
                                if (answer.actionData?.submittedAt) {
                                    // Handle Timestamp or Date safely
                                    let subDate: Date;
                                    const rawDate = answer.actionData.submittedAt;

                                    if (rawDate && typeof (rawDate as any).toDate === 'function') {
                                        subDate = (rawDate as any).toDate();
                                    } else if (rawDate instanceof Date) {
                                        subDate = rawDate;
                                    } else if (typeof rawDate === 'object' && rawDate !== null && 'seconds' in rawDate) {
                                        subDate = new Date((rawDate as any).seconds * 1000);
                                    } else {
                                        subDate = new Date(rawDate as any);
                                    }

                                    if (!firstSubmissionDate || subDate < firstSubmissionDate) {
                                        firstSubmissionDate = subDate;
                                    }
                                }
                            }
                        });
                    });

                    if (!hasActionItems) return; // Skip audits with no actions

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

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter Logic
    const filteredData = data.filter(item => {
        // Date Filter
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

        // Status Filter
        if (statusFilter.length > 0) {

            if (!statusFilter.includes(item.status)) {
                return false;
            }
        }

        return true;
    });

    const columns: ColumnDef<ActionPerformanceRow>[] = [
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
                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 text-[9px] font-bold">
                            {row.original.rejectedActions} Reddedildi
                        </Badge>
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

    const statusOptions = [
        { label: "Zamanında", value: "on_time", icon: CheckCircle2 },
        { label: "Geç Döndü", value: "late", icon: Clock },
        { label: "Bekleniyor", value: "pending", icon: Clock },
    ];

    const handleExportExcel = () => {
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
    };

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2 text-primary">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Clock className="h-6 w-6 text-primary" />
                        </div>
                        Aksiyon Performans Raporu
                    </CardTitle>
                    <CardDescription className="text-base text-muted-foreground mt-2">
                        Mağazaların denetim sonrasında aksiyonlara ne kadar sürede dönüş yaptığını analiz edin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse">Veriler yükleniyor...</p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={filteredData}
                            searchKey="storeName"
                            searchPlaceholder="Mağaza adına göre ara..."
                            toolbar={
                                <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-background p-1 rounded-lg border shadow-sm">
                                    <DateRangePicker
                                        value={dateRange}
                                        onChange={setDateRange}
                                        className="w-full sm:w-[220px] border-none shadow-none text-sm"
                                    />

                                    <div className="hidden sm:block h-6 w-px bg-gray-200" />

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 border-dashed flex-shrink-0">
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
                                        <PopoverContent className="w-[200px] p-0" align="start">
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

                                    {(dateRange?.from || dateRange?.to) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDateRange({ from: undefined, to: undefined })}
                                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-full flex-shrink-0"
                                            title="Tarihi Temizle"
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="ml-auto h-8 gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                        onClick={handleExportExcel}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Excel
                                    </Button>
                                </div>
                            }
                        />
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
