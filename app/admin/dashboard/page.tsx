"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import { StatCard } from "@/components/stat-card";
import { GridFadeIn, GridItem } from "@/components/stagger-animation";
import { Skeleton } from "@/components/ui/skeleton";

import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Store as StoreIcon,
    ClipboardList,
    CheckCircle2,
    PlayCircle,
    XCircle,
    MoreHorizontal,
    Eye,
    Clock,
    Trash2,
    X,
    Loader2,
} from "lucide-react";
import {
    collection,
    getDocs,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Audit,
    Store,
    AuditType,
    DateRangeFilter,
} from "@/lib/types";
import { softDeleteAudit } from "@/lib/firebase-utils";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef, Column, Row } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export default function AdminDashboard() {

    const [loading, setLoading] = useState(true);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);

    // Default to start of current month to today
    const [dateRange, setDateRange] = useState<DateRangeFilter>(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            from: firstDay,
            to: now,
        };
    });

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [auditToDelete, setAuditToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, []); // Run only once

    const loadData = async () => {
        try {
            setLoading(true);

            // Load counts (just for stats if needed, or we derive from audits)
            // We previously loaded users and stores to map names.
            const usersSnapshot = await getDocs(collection(db, "users"));
            const storesSnapshot = await getDocs(collection(db, "stores"));

            // Create a lookup map for users
            const usersMap = new Map();
            usersSnapshot.docs.forEach(doc => {
                usersMap.set(doc.id, doc.data());
            });

            // Load ALL audits and filter in memory
            const auditsSnapshot = await getDocs(collection(db, "audits"));
            const auditsData = auditsSnapshot.docs.map((doc) => {
                const data = doc.data() as Audit;
                let auditorName = data.auditorName;

                // Override auditorName with fresh data from users collection
                if (data.auditorId && usersMap.has(data.auditorId)) {
                    const user = usersMap.get(data.auditorId);
                    if (user.firstName && user.lastName) {
                        auditorName = `${user.firstName} ${user.lastName}`;
                    } else if (user.displayName) {
                        auditorName = user.displayName;
                    }
                }

                return {
                    ...data,
                    id: doc.id,
                    auditorName: auditorName
                };
            }) as Audit[];

            // Filter out deleted ones
            // Sorting will be handled by DataTable default sort
            const activeAudits = auditsData.filter(audit => !audit.isDeleted);
            setAudits(activeAudits);

            // Load stores data
            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];
            setStores(storesData);

            // Load audit types
            const auditTypesSnapshot = await getDocs(collection(db, "auditTypes"));
            const auditTypesData = auditTypesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AuditType[];
            setAuditTypes(auditTypesData);

        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleSoftDelete = async () => {
        if (!auditToDelete) return;

        try {
            setDeleting(true);
            await softDeleteAudit(auditToDelete);
            toast.success("Denetim çöp kutusuna taşındı");
            setDeleteDialogOpen(false);
            setAuditToDelete(null);
            await loadData();
        } catch (error) {
            console.error("Error deleting audit:", error);
            toast.error("Silme işlemi başarısız oldu");
        } finally {
            setDeleting(false);
        }
    };

    const calculateDuration = (start: Timestamp | null, end: Timestamp | null) => {
        if (!start || !end) return "-";

        const diffInMinutes = Math.floor((end.toMillis() - start.toMillis()) / (1000 * 60));
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;

        if (hours === 0) return `${minutes} dk`;
        return `${hours} sa ${minutes} dk`;
    };

    // Define Columns
    const columns: ColumnDef<Audit>[] = [
        {
            accessorKey: "auditTypeName",
            meta: { title: "Denetim Türü", filterOptions: auditTypes.map(type => ({ value: type.name, label: type.name })) },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Denetim Türü" />,
            cell: ({ row }: { row: Row<Audit> }) => <span className="font-medium">{row.original.auditTypeName}</span>,
            filterFn: (row: Row<Audit>, id: string, value: string[]) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "storeName",
            meta: { title: "Mağaza", filterOptions: stores.map(store => ({ value: store.name, label: store.name })) },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Mağaza" />,
            cell: ({ row }: { row: Row<Audit> }) => <span>{row.original.storeName}</span>,
            filterFn: (row: Row<Audit>, id: string, value: string[]) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "auditorName",
            meta: { title: "Denetmen" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Denetmen" />,
            cell: ({ row }: { row: Row<Audit> }) => <span className="text-sm text-muted-foreground">{row.original.auditorName || "Bilinmeyen Kullanıcı"}</span>,
            filterFn: (row: Row<Audit>, id: string, value: string[]) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "status",
            meta: {
                title: "Durum",
                filterOptions: [
                    { value: "devam_ediyor", label: "Devam Ediyor" },
                    { value: "tamamlandi", label: "Tamamlandı" },
                    { value: "iptal_edildi", label: "İptal Edildi" },
                ]
            },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Durum" />,
            cell: ({ row }: { row: Row<Audit> }) => {
                const status = row.original.status;
                if (status === "devam_ediyor") {
                    return (
                        <Badge className="bg-yellow-500">
                            <PlayCircle className="mr-1 h-3 w-3" />
                            Devam Ediyor
                        </Badge>
                    );
                }
                if (status === "iptal_edildi") {
                    return (
                        <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            İptal Edildi
                        </Badge>
                    );
                }
                return (
                    <Badge className="bg-green-700 hover:bg-green-800 text-white">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Tamamlandı
                    </Badge>
                );
            },
            filterFn: (row: Row<Audit>, id: string, value: string[]) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
        },
        {
            accessorKey: "totalScore",
            meta: { title: "Puan" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Puan" showFilter={false} />,
            cell: ({ row }: { row: Row<Audit> }) => <span className="font-semibold">{row.original.totalScore || 0}</span>,
        },
        {
            id: "createdAt",
            meta: { title: "Tarih" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Tarih" showFilter={false} />,
            accessorFn: (row: Audit) => row.createdAt?.toMillis() || 0,
            cell: ({ row }: { row: Row<Audit> }) => <span className="text-sm">{row.original.createdAt?.toDate().toLocaleDateString("tr-TR")}</span>,
        },
        {
            id: "startedAt",
            meta: { title: "Başlangıç" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Başlangıç" showFilter={false} />,
            accessorFn: (row: Audit) => row.startedAt?.toMillis() || 0,
            cell: ({ row }: { row: Row<Audit> }) => <span className="text-sm">{row.original.startedAt?.toDate().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }) || "-"}</span>,
        },
        {
            id: "completedAt",
            meta: { title: "Bitiş" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Bitiş" showFilter={false} />,
            accessorFn: (row: Audit) => row.completedAt?.toMillis() || 0,
            cell: ({ row }: { row: Row<Audit> }) => <span className="text-sm">{row.original.completedAt?.toDate().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }) || "-"}</span>,
        },
        {
            id: "duration",
            meta: { title: "Süre" },
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Süre" showFilter={false} />,
            accessorFn: (row: Audit) => (row.completedAt && row.startedAt) ? (row.completedAt.toMillis() - row.startedAt.toMillis()) : 0,
            cell: ({ row }: { row: Row<Audit> }) => <span className="text-sm font-medium">{calculateDuration(row.original.startedAt || null, row.original.completedAt || null)}</span>,
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menüyü aç</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/audits/${row.original.id}`} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Görüntüle
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600 cursor-pointer"
                                onClick={() => {
                                    setAuditToDelete(row.original.id);
                                    setDeleteDialogOpen(true);
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Çöp Kutusuna Taşı
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    // Filter audits based on date range before passing to table
    const dateFilteredAudits = audits.filter((audit) => {
        if (!dateRange.from && !dateRange.to) return true;

        const auditDate = audit.createdAt.toDate();
        // Reset times for accurate date comparison
        const checkDate = new Date(auditDate);
        checkDate.setHours(0, 0, 0, 0);

        if (dateRange.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            if (checkDate < fromDate) return false;
        }

        if (dateRange.to) {
            const normalizedTo = new Date(dateRange.to);
            normalizedTo.setHours(23, 59, 59, 999);
            if (auditDate > normalizedTo) return false;
        }
        return true;
    });

    // Stats derived from dateFilteredAudits
    const quickStats = {
        total: dateFilteredAudits.length,
        ongoing: dateFilteredAudits.filter((a) => a.status === "devam_ediyor").length,
        completed: dateFilteredAudits.filter((a) => a.status === "tamamlandi").length,
    };

    if (loading) {
        return (
            <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48 mb-2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <div className="space-y-2">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full" />
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">

                {/* Dashboard Statistics */}
                <GridFadeIn className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <GridItem>
                        <StatCard
                            title="Tamamlanan Denetimler"
                            value={quickStats.completed}
                            icon={CheckCircle2}
                            description={
                                dateRange.from || dateRange.to
                                    ? "Seçili tarih aralığında"
                                    : "Tüm zamanlar"
                            }
                            iconColor="text-green-600"
                            iconBg="bg-green-100"
                        />
                    </GridItem>
                    <GridItem>
                        <StatCard
                            title="Denetlenen Mağaza Sayısı"
                            value={new Set(dateFilteredAudits.map(a => a.storeId)).size}
                            icon={StoreIcon}
                            description="Farklı mağaza sayısı"
                            iconColor="text-blue-600"
                            iconBg="bg-blue-100"
                        />
                    </GridItem>
                    <GridItem>
                        <StatCard
                            title="Devam Eden"
                            value={quickStats.ongoing}
                            icon={Clock}
                            description={
                                dateRange.from || dateRange.to
                                    ? "Seçili tarih aralığında"
                                    : "Tamamlanmamış denetimler"
                            }
                            iconColor="text-orange-600"
                            iconBg="bg-orange-100"
                        />
                    </GridItem>
                    <GridItem>
                        <StatCard
                            title="Toplam Denetimler"
                            value={quickStats.total}
                            icon={ClipboardList}
                            description={
                                dateRange.from || dateRange.to
                                    ? "Seçili tarih aralığında"
                                    : "Toplam kayıt"
                            }
                            iconColor="text-purple-600"
                            iconBg="bg-purple-100"
                        />
                    </GridItem>
                </GridFadeIn>

                {/* Audits Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tüm Denetimler</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DataTable
                            columns={columns}
                            data={dateFilteredAudits}
                            enableGlobalFilter={true}
                            searchPlaceholder="Mağaza, Denetmen veya Tür ara..."
                            initialSorting={[{ id: "completedAt", desc: true }]}
                            toolbar={
                                <div className="flex items-center space-x-2">
                                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                                    {(dateRange.from || dateRange.to) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDateRange({ from: undefined, to: undefined })}
                                            className="h-8 px-2 lg:px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Tarihi Temizle
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu denetimi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ancak veritabanında "silindi" olarak işaretlenir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSoftDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Siliniyor...
                                </>
                            ) : (
                                "Evet, Sil"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
