"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    Timestamp,
    onSnapshot,
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
import { useRouter, useSearchParams } from "next/navigation";
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

// Helper function to calculate store response time (excluding Sundays)
const getStoreResponseTime = (audit: Audit): number | null => {
    if (!audit.completedAt) return null;

    // Find the first submitted action (when store first responded)
    let earliestSubmission: Date | null = null;

    audit.sections.forEach(section => {
        section.answers.forEach(answer => {
            const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);
            if (isActionNeeded && answer.actionData?.submittedAt) {
                const submissionDate = answer.actionData.submittedAt.toDate();
                if (!earliestSubmission || submissionDate < earliestSubmission) {
                    earliestSubmission = submissionDate;
                }
            }
        });
    });

    if (!earliestSubmission) return null;

    return getWorkingDaysPassed(audit.completedAt.toDate(), earliestSubmission);
};

// Helper function to get the latest submission date (Response Date)
const getLastSubmissionDate = (audit: Audit): Date | null => {
    let latestSubmission: Date | null = null;
    audit.sections.forEach(section => {
        section.answers.forEach(answer => {
            const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);
            if (isActionNeeded && answer.actionData?.submittedAt) {
                const submissionDate = answer.actionData.submittedAt.toDate();
                if (!latestSubmission || submissionDate > latestSubmission) {
                    latestSubmission = submissionDate;
                }
            }
        });
    });
    return latestSubmission;
};


// Main Content Component
function AdminActionsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'pending_store';
    const [auditsWithActions, setAuditsWithActions] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });

    useEffect(() => {
        // Real-time listener for audits with actions
        const auditsQuery = query(
            collection(db, "audits"),
            where("status", "==", "tamamlandi")
        );

        const unsubscribe = onSnapshot(
            auditsQuery,
            async (snapshot) => {
                let auditsData = snapshot.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() } as Audit))
                    .filter((audit) => {
                        // "hayır" cevabı olan veya checkbox sorusunda tam puan alamayan denetimleri al
                        return audit.sections.some((section) =>
                            section.answers.some((answer) =>
                                answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints)
                            )
                        );
                    })
                    .sort((a, b) => b.completedAt!.toMillis() - a.completedAt!.toMillis());

                // Fetch auditor names from users collection
                const auditorIds = [...new Set(auditsData.map(a => a.auditorId).filter(Boolean))];

                if (auditorIds.length > 0) {
                    try {
                        const userPromises = auditorIds.map(id => getDoc(doc(db, "users", id)));
                        const userSnapshots = await Promise.all(userPromises);

                        const userMap = new Map();
                        userSnapshots.forEach(snap => {
                            if (snap.exists()) {
                                const data = snap.data();
                                let name = data.displayName || data.email;

                                if (data.firstName && data.lastName &&
                                    data.firstName.trim().length > 1 &&
                                    data.lastName.trim().length > 1) {
                                    name = `${data.firstName} ${data.lastName}`;
                                }
                                userMap.set(snap.id, { name, isLive: true });
                            }
                        });

                        // Update auditor names in auditsData
                        auditsData = auditsData.map(audit => {
                            const userEntry = userMap.get(audit.auditorId);
                            const finalName = userEntry ? userEntry.name : audit.auditorName;
                            return {
                                ...audit,
                                auditorName: finalName
                            };
                        });
                    } catch (error) {
                        console.error("Error fetching auditor profiles:", error);
                    }
                }

                setAuditsWithActions(auditsData);
                setLoading(false);
            },
            (error) => {
                console.error("Error listening to audits:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Filter logic for date range and tab
    const filteredData = auditsWithActions.filter(audit => {
        // Date Range Filter
        if (audit.completedAt) {
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
        }

        // Tab Filter
        let hasMatchingAction = false;
        let allActionsApproved = true;
        let hasPendingStore = false;
        let hasPendingAdmin = false;

        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                const isActionNeeded = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);

                if (isActionNeeded) {
                    const status = answer.actionData?.status || "pending_store";

                    if (status !== "approved") {
                        allActionsApproved = false;
                    }

                    if (status === "pending_store" || status === "rejected") {
                        hasPendingStore = true;
                    }

                    if (status === "pending_admin") {
                        hasPendingAdmin = true;
                    }
                }
            });
        });

        if (currentTab === 'pending_store') {
            // Dönüş Yapmayanlar: Mağazadan dönüş beklenen aksiyonu olanlar
            return hasPendingStore;
        } else if (currentTab === 'pending_admin') {
            // Onay Bekleyenler: Admin onayı bekleyen aksiyonu olanlar
            return hasPendingAdmin;
        } else if (currentTab === 'approved') {
            // Onaylananlar: Tüm aksiyonları onaylanmış olanlar (hiç bekleyen yoksa)
            // Ancak, en az bir "hayır" cevabı olmalı (zaten onSnapshot'ta filtreleniyor)
            return allActionsApproved;
        }

        return true;
    });

    const columns: ColumnDef<Audit>[] = [
        {
            accessorKey: "storeName",
            meta: { title: "Mağaza Adı" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Mağaza Adı" />,
            cell: ({ row }: { row: any }) => <span className="text-base font-medium">{row.original.storeName}</span>
        },
        {
            accessorKey: "auditorName",
            meta: { title: "Denetmen" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Denetmen" />,
            cell: ({ row }: { row: any }) => <span className="text-base">{row.original.auditorName}</span>
        },
        {
            accessorKey: "auditTypeName",
            meta: { title: "Denetim Türü" },
            header: ({ column }: { column: any }) => <DataTableColumnHeader column={column} title="Denetim Türü" />,
            cell: ({ row }: { row: any }) => <span className="font-medium text-base">{row.original.auditTypeName}</span>
        },
        {
            id: "auditDate",
            meta: { title: "Denetim Tarihi" },
            header: ({ column }: { column: any }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        <span>Denetim Tarihi</span>
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            accessorFn: (row: any) => row.completedAt?.toMillis() ?? 0,
            cell: ({ row }: { row: any }) => {
                if (!row.original.completedAt) return "-";
                return (
                    <span className="text-base">
                        {row.original.completedAt.toDate().toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        })}
                    </span>
                );
            }
        },
        {
            id: "returnDate",
            meta: { title: "Dönüş Tarihi" },
            header: ({ column }: { column: any }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        <span>Dönüş Tarihi</span>
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            accessorFn: (row: any) => getLastSubmissionDate(row)?.getTime() ?? 0,
            cell: ({ row }: { row: any }) => {
                const date = getLastSubmissionDate(row.original);
                if (!date) return "-";
                return (
                    <span className="text-base">
                        {date.toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        })}
                    </span>
                );
            }
        },
        {
            id: "responseTime",
            meta: { title: "Dönüş Süresi" },
            header: ({ column }: { column: any }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        <span>Dönüş Süresi</span>
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            accessorFn: (row: any) => {
                const responseTime = getStoreResponseTime(row);
                return responseTime ?? -1; // Use -1 for sorting null values to the end
            },
            cell: ({ row }: { row: any }) => {
                const responseTime = getStoreResponseTime(row.original);

                if (responseTime === null) {
                    return (
                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100 w-fit">
                            -
                        </Badge>
                    );
                }

                // Color coding based on response time
                let badgeClass = "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
                if (responseTime > 3) {
                    badgeClass = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
                } else if (responseTime === 3) {
                    badgeClass = "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";
                } else if (responseTime === 2) {
                    badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
                }

                return (
                    <Badge variant="outline" className={cn("w-fit px-3 py-1 text-sm font-medium", badgeClass)}>
                        {responseTime} Gün
                    </Badge>
                );
            }
        },
        {
            id: "deadline",
            meta: { title: "Son Dönüş Tarihi" },
            accessorFn: (row: any) => {
                if (row.allActionsResolved) return Number.MAX_SAFE_INTEGER;
                if (!row.completedAt) return Number.MAX_SAFE_INTEGER;
                return calculateDeadlineDate(row.completedAt.toDate()).getTime();
            },
            header: ({ column }: { column: any }) => {
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
            cell: ({ row }: { row: any }) => {
                const audit = row.original;
                if (!audit.completedAt) return "-";

                const completedDate = audit.completedAt.toDate();
                const deadlineDate = calculateDeadlineDate(completedDate);

                const formattedDeadline = deadlineDate.toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long"
                });

                const tempDate = new Date();
                tempDate.setHours(0, 0, 0, 0);
                const targetDate = new Date(deadlineDate);
                targetDate.setHours(0, 0, 0, 0);

                if (tempDate < targetDate) {
                    // Future
                    return (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-sm font-medium">
                            {formattedDeadline}
                        </Badge>
                    );
                } else {
                    // Overdue or Today
                    return (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-3 py-1 text-sm font-medium">
                            {formattedDeadline}
                        </Badge>
                    );
                }
            }
        },
        {
            id: "actions",
            header: "Aksiyon",
            cell: ({ row }: { row: any }) => {
                const audit = row.original;
                let totalActions = 0;
                audit.sections.forEach((s: any) => s.answers.forEach((a: any) => {
                    if (a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints)) totalActions++;
                }));

                const badgeClass = totalActions > 10
                    ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                    : "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";

                return (
                    <Badge variant="outline" className={cn("w-fit px-3 py-1 text-sm font-medium", badgeClass)}>
                        {totalActions} Madde
                    </Badge>
                );
            }
        },
        {
            accessorKey: "totalScore",
            meta: { title: "Puan" },
            header: "Puan",
            cell: ({ row }: { row: any }) => {
                const score = row.original.totalScore || 0;
                const badgeClass = score >= 80
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : score >= 60
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        : "bg-red-100 text-red-800 hover:bg-red-100";

                return <Badge variant="secondary" className={cn(badgeClass, "rounded-full w-10 h-10 flex items-center justify-center text-base")}>{score}</Badge>;
            }
        },
        {
            id: "status",
            meta: { title: "Durum" },
            accessorFn: (row: any) => {
                const audit = row;
                let totalActions = 0;
                let approvedActions = 0;
                let pendingStoreActions = 0;
                let pendingAdminActions = 0;
                let rejectedActions = 0;

                audit.sections.forEach((s: any) => s.answers.forEach((a: any) => {
                    const isActionNeeded = a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints);
                    if (isActionNeeded) {
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
            header: "Durum",
            cell: ({ row }: { row: any }) => {
                const status = row.getValue("status") as string;
                // We can use the status string directly or recalculate if we need counts.
                // Re-calculating counts for detailed display:
                const audit = row.original;
                let totalActions = 0;
                let pendingAdminActions = 0;
                let rejectedActions = 0;
                let pendingStoreActions = 0;

                audit.sections.forEach((s: any) => s.answers.forEach((a: any) => {
                    const isActionNeeded = a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints);
                    if (isActionNeeded) {
                        totalActions++;
                        const s = a.actionData?.status || "pending_store";
                        if (s === "pending_admin") pendingAdminActions++;
                        else if (s === "rejected") rejectedActions++;
                        else if (s === "pending_store") pendingStoreActions++;
                    }
                }));

                if (status === "Onaylandı") {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 w-fit px-3 py-1 text-sm font-medium">
                                <Check className="h-4 w-4 mr-1" /> Onaylandı
                            </Badge>
                            <span className="text-xs text-muted-foreground">{totalActions} madde tamamlandı</span>
                        </div>
                    );
                }
                if (status === "Düzeltme Bekleniyor") {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 w-fit px-3 py-1 text-sm font-medium">
                                Düzeltme Bekleniyor
                            </Badge>
                            <span className="text-xs text-muted-foreground">{rejectedActions} madde reddedildi</span>
                        </div>
                    );
                }
                if (status === "Onay Bekliyor") {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 w-fit px-3 py-1 text-sm font-medium">
                                Onay Bekliyor
                            </Badge>
                            <span className="text-xs text-muted-foreground">{pendingAdminActions} madde onaya hazır</span>
                        </div>
                    );
                }
                if (status === "Dönüş Yapılmadı") {
                    return (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100 w-fit px-3 py-1 text-sm font-medium">
                            Dönüş Yapılmadı
                        </Badge>
                    );
                }
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 w-fit px-3 py-1 text-sm font-medium">
                            Mağaza Bekleniyor
                        </Badge>
                        <span className="text-xs text-muted-foreground">{pendingStoreActions} cevaplanmadı</span>
                    </div>
                );
            }
        }
    ].filter(column => {
        // Durum sütununu 'approved' ve 'pending_store' sekmelerinde gizle
        if (column.id === 'status') {
            return currentTab !== 'approved' && currentTab !== 'pending_store';
        }
        // Dönüş Tarihi sütununu sadece 'approved' sekmesinde göster
        if (column.id === 'returnDate') {
            return currentTab === 'approved';
        }
        // Son Dönüş Tarihi sütununu 'approved' sekmesinde gizle
        if (column.id === 'deadline') {
            return currentTab !== 'approved';
        }
        return true;
    });

    const getTabTitle = () => {
        switch (currentTab) {
            case 'pending_store': return 'Dönüş Bekleyenler';
            case 'pending_admin': return 'Onay Bekleyenler';
            case 'approved': return 'Onaylananlar';
            default: return 'Aksiyonlar';
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">{getTabTitle()}</CardTitle>
                    <CardDescription>
                        {currentTab === 'pending_store' && "Mağazadan aksiyon dönüşü beklenen denetimler"}
                        {currentTab === 'pending_admin' && "Onayınızı bekleyen denetim aksiyonları"}
                        {currentTab === 'approved' && "Tüm aksiyonları tamamlanmış denetimler"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable
                            key={currentTab}
                            columns={columns}
                            data={filteredData}
                            searchKey="storeName"
                            searchPlaceholder="Mağaza ara..."
                            initialSorting={[
                                {
                                    id: currentTab === 'approved' ? "returnDate" : "deadline",
                                    desc: currentTab === 'approved' // Descending for return date (newest first), Ascending for deadline (soonest first)
                                }
                            ]}
                            rowClassName="h-16"
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

export default function AdminActionsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <AdminActionsContent />
        </Suspense>
    );
}
