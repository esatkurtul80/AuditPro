"use client";

import { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, XCircle, ListFilter } from "lucide-react";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRangeFilter } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// Helper component for column header with sorting and faceted filtering
const DataTableColumnHeader = ({ column, title }: { column: any; title: string }) => {
    // Generate unique options from the column data for the faceted filter
    const facets = column.getFacetedUniqueValues();
    const options = Array.from(facets.keys())
        .filter((key) => key !== undefined && key !== null && key !== "")
        .sort()
        .map((key) => ({
            label: String(key),
            value: String(key),
        }));

    return (
        <div className="flex items-center space-x-2">
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                <span>{title}</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            {/* Use the new Faceted Filter component with ListFilter icon styled trigger */}
            <div className="flex items-center">
                <DataTableFacetedFilter
                    column={column}
                    title={title}
                    options={options}
                />
            </div>
        </div>
    );
};

// Helper function to calculate working days passed (excluding Sundays)
const getWorkingDaysPassed = (startDate: Date, endDate: Date) => {
    let count = 0;
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current < end) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() !== 0) { // 0 is Sunday
            count++;
        }
    }
    return count;
};

// Helper function to calculate deadline date (3 working days)
const calculateDeadlineDate = (startDate: Date) => {
    let date = new Date(startDate);
    let daysAdded = 0;
    while (daysAdded < 3) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0) {
            daysAdded++;
        }
    }
    return date;
};

export default function AdminActionsPage() {
    const [auditsWithActions, setAuditsWithActions] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const router = useRouter();

    useEffect(() => {
        loadData();
    }, []);

    // Filter logic removed in favor of column filtering
    const filteredData = auditsWithActions.filter(audit => {
        if (!audit.completedAt) return false;
        const completedDate = audit.completedAt.toDate();

        if (dateRange.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            if (completedDate < fromDate) return false;
        }

        if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            if (completedDate > toDate) return false;
        }

        return true;
    });

    const loadData = async () => {
        try {
            // Tamamlanmış denetimleri yükle
            const auditsQuery = query(
                collection(db, "audits"),
                where("status", "==", "tamamlandi")
            );

            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as Audit))
                .filter((audit) => {
                    // Sadece "hayır" cevabı olan denetimleri al
                    return audit.sections.some((section) =>
                        section.answers.some((answer) => answer.answer === "hayir")
                    );
                })
                .sort((a, b) => b.completedAt!.toMillis() - a.completedAt!.toMillis());

            setAuditsWithActions(auditsData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<Audit>[] = [
        {
            accessorKey: "auditTypeName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Denetim Türü" />,
            cell: ({ row }) => <span className="font-medium">{row.original.auditTypeName}</span>
        },
        {
            accessorKey: "auditorName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Denetmen" />,
        },
        {
            accessorKey: "storeName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Mağaza Adı" />,
        },
        {
            id: "deadline",
            accessorFn: (row) => {
                if (row.allActionsResolved) return Number.MAX_SAFE_INTEGER;
                if (!row.completedAt) return Number.MAX_SAFE_INTEGER;
                return calculateDeadlineDate(row.completedAt.toDate()).getTime();
            },
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        <span>Son Dönüş Tarihi</span>
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const audit = row.original;
                if (!audit.completedAt) return "-";

                const completedDate = audit.completedAt.toDate();
                const now = new Date();
                const daysPassed = getWorkingDaysPassed(completedDate, now);
                const deadlineDate = calculateDeadlineDate(completedDate);

                const formattedDeadline = deadlineDate.toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long"
                });

                // Calculate remaining days based on WORKING days
                // Start from now, count working days until deadline
                let remainingDays = 0;
                let tempDate = new Date();
                tempDate.setHours(0, 0, 0, 0);
                const targetDate = new Date(deadlineDate);
                targetDate.setHours(0, 0, 0, 0);

                if (tempDate < targetDate) {
                    // Future
                    while (tempDate < targetDate) {
                        tempDate.setDate(tempDate.getDate() + 1);
                        if (tempDate.getDay() !== 0) { // Exclude Sunday
                            remainingDays++;
                        }
                    }
                } else {
                    // Past or Today (calculate overdue)
                    let overdueDate = new Date(targetDate);
                    while (overdueDate < tempDate) {
                        overdueDate.setDate(overdueDate.getDate() + 1);
                        if (overdueDate.getDay() !== 0) {
                            remainingDays--; // Negative for overdue
                        }
                    }
                }

                // If today is deadline, remainingDays is 0 (handled above by loop not running if equals, wait loop is <)
                // If tempDate == targetDate, loop doesn't run, remainingDays = 0.

                // Determine badge style and text
                let badgeClass = "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
                let badgeText = `${remainingDays} Gün Kaldı`;
                let showWarning = false;

                if (remainingDays < 0) {
                    badgeClass = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 animate-pulse";
                    badgeText = `${Math.abs(remainingDays)} Gün Gecikti`;
                    showWarning = true;
                } else if (remainingDays === 0) {
                    badgeClass = "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";
                    badgeText = "Bugün Son Gün";
                    showWarning = true;
                } else if (remainingDays >= 3) {
                    badgeClass = "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
                }

                if (audit.allActionsResolved) {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-green-50 text-green-700 w-fit">
                                Tamamlandı
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formattedDeadline}</span>
                        </div>
                    )
                }

                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn("w-fit flex gap-1", badgeClass)}>
                            {showWarning && <AlertTriangle className="h-3 w-3" />}
                            {badgeText}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formattedDeadline}</span>
                    </div>
                );
            }
        },
        {
            id: "actions",
            header: "Aksiyon",
            cell: ({ row }) => {
                const audit = row.original;
                let totalActions = 0;
                audit.sections.forEach(s => s.answers.forEach(a => {
                    if (a.answer === "hayir") totalActions++;
                }));

                const badgeClass = totalActions > 10
                    ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                    : "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";

                return (
                    <Badge variant="outline" className={cn("w-fit", badgeClass)}>
                        {totalActions} Madde
                    </Badge>
                );
            }
        },
        {
            accessorKey: "totalScore",
            header: "Puan",
            cell: ({ row }) => {
                const score = row.original.totalScore || 0;
                const badgeClass = score >= 80
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : score >= 60
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        : "bg-red-100 text-red-800 hover:bg-red-100";

                return <Badge variant="secondary" className={badgeClass}>{score}</Badge>;
            }
        },
        {
            id: "status",
            accessorFn: (row) => {
                const audit = row;
                let totalActions = 0;
                let approvedActions = 0;
                let pendingStoreActions = 0;
                let pendingAdminActions = 0;
                let rejectedActions = 0;

                audit.sections.forEach(s => s.answers.forEach(a => {
                    if (a.answer === "hayir") {
                        totalActions++;
                        const status = a.actionData?.status || "pending_store";
                        if (status === "approved") approvedActions++;
                        else if (status === "pending_admin") pendingAdminActions++;
                        else if (status === "rejected") rejectedActions++;
                        else pendingStoreActions++;
                    }
                }));

                if (totalActions === 0) return "-";
                if (approvedActions === totalActions) return "Onaylandı";
                if (rejectedActions > 0) return "Düzeltme Bekleniyor";
                if (pendingAdminActions > 0) return "Onay Bekliyor";
                if (pendingStoreActions === totalActions) return "Dönüş Yapılmadı";
                return "Mağaza Bekleniyor";
            },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Durum" />,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                // We can use the status string directly or recalculate if we need counts.
                // Re-calculating counts for detailed display:
                const audit = row.original;
                let totalActions = 0;
                let pendingAdminActions = 0;
                let rejectedActions = 0;
                let pendingStoreActions = 0;

                audit.sections.forEach(s => s.answers.forEach(a => {
                    if (a.answer === "hayir") {
                        totalActions++;
                        const s = a.actionData?.status || "pending_store";
                        if (s === "pending_admin") pendingAdminActions++;
                        else if (s === "rejected") rejectedActions++;
                        else if (s === "pending_store") pendingStoreActions++;
                    }
                }));

                if (status === "Onaylandı") {
                    return (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                            <Check className="h-3 w-3 mr-1" /> Onaylandı
                        </Badge>
                    );
                }
                if (status === "Düzeltme Bekleniyor") {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 w-fit">
                                Düzeltme Bekleniyor
                            </Badge>
                            <span className="text-xs text-muted-foreground">{rejectedActions} madde reddedildi</span>
                        </div>
                    );
                }
                if (status === "Onay Bekliyor") {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 w-fit">
                                Onay Bekliyor
                            </Badge>
                            <span className="text-xs text-muted-foreground">{pendingAdminActions} madde onaya hazır</span>
                        </div>
                    );
                }
                if (status === "Dönüş Yapılmadı") {
                    return (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100 w-fit">
                            Dönüş Yapılmadı
                        </Badge>
                    );
                }
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 w-fit">
                            Mağaza Bekleniyor
                        </Badge>
                        <span className="text-xs text-muted-foreground">{pendingStoreActions} cevaplanmadı</span>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold">Aksiyon Takip Paneli</h1>
                <p className="text-muted-foreground mt-2">
                    Tüm denetimlerdeki aksiyonları takip edin ve onaylayın
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Aksiyon Gerektiren Denetimler</CardTitle>
                    <CardDescription>
                        {auditsWithActions.length} denetim listeleniyor
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={filteredData}
                            searchKey="storeName"
                            searchPlaceholder="Mağaza ara..."
                            initialSorting={[{ id: "deadline", desc: false }]}
                            onRowClick={(row) => router.push(`/audits/${row.id}/actions`)}
                            toolbar={
                                <div className="flex items-center space-x-2">
                                    <DateRangePicker
                                        value={dateRange}
                                        onChange={setDateRange}
                                        className="w-[300px]"
                                    />
                                    {(dateRange.from || dateRange.to) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDateRange({ from: undefined, to: undefined })}
                                            className="h-8 px-2 lg:px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Tarihi Temizle
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
