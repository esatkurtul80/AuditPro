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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Pencil,
    MapPinOff,
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
import { NotificationFeed } from "@/components/announcements/notification-feed";

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

    // Helper to calculate distance between two coordinates in meters
    const calculateDistance = (loc1: string | undefined, loc2: string | undefined): number | null => {
        if (!loc1 || !loc2) return null;

        try {
            const [lat1, lon1] = loc1.split(',').map(Number);
            const [lat2, lon2] = loc2.split(',').map(Number);

            if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;

            const R = 6371e3; // Earth radius in meters
            const phi1 = lat1 * Math.PI / 180;
            const phi2 = lat2 * Math.PI / 180;
            const deltaPhi = (lat2 - lat1) * Math.PI / 180;
            const deltaLambda = (lon2 - lon1) * Math.PI / 180;

            const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                      Math.cos(phi1) * Math.cos(phi2) *
                      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c; // Distance in meters
        } catch (e) {
            console.error("Error calculating distance:", e);
            return null;
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
        // ... previous columns
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
            id: "locationStatus",
            meta: { title: "Konum" },
            enableSorting: false,
            enableColumnFilter: false,
            header: ({ column }: { column: Column<Audit> }) => <DataTableColumnHeader column={column} title="Konum" showFilter={false} />,
            cell: ({ row }: { row: Row<Audit> }) => {
                const auditLoc = row.original.location;
                // Find store location from preloaded stores list
                const store = stores.find(s => s.id === row.original.storeId);
                const storeLoc = store?.location;

                // Debug
                // console.log("Audit:", row.original.id, "Loc:", auditLoc, "Store:", store?.name, "StoreLoc:", storeLoc);

                if (!storeLoc) {
                    return (
                        <div className="flex items-center gap-1 text-muted-foreground" title="Mağazanın konum bilgisi eksik">
                            <MapPinOff className="h-4 w-4" />
                            <span className="text-xs hidden lg:inline">Mağaza Konumsuz</span>
                        </div>
                    );
                }

                if (!auditLoc) {
                    return (
                        <div className="flex items-center gap-1 text-muted-foreground" title="Denetim sırasında konum alınamamış">
                            <MapPinOff className="h-4 w-4" />
                            <span className="text-xs hidden lg:inline">Denetim Konumsuz</span>
                        </div>
                    );
                }

                const distance = calculateDistance(auditLoc, storeLoc);
                
                if (distance === null) return <span className="text-muted-foreground">-</span>;
                
                const isApproved = distance <= 100; // 100 meters threshold

                return (
                    <div className="flex items-center gap-1" title={`${Math.round(distance)}m`}>
                        {isApproved ? (
                            <>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium text-green-600 hidden lg:inline">Onaylandı</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs font-medium text-red-600 hidden lg:inline">Onaylanmadı ({Math.round(distance)}m)</span>
                            </>
                        )}
                    </div>
                );
            },
        },
        // ... rest of columns
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
                            <DropdownMenuItem asChild>
                                <Link href={`/audits/${row.original.id}?mode=edit`} className="cursor-pointer">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Düzenle
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

                {/* Notifications */}
                <NotificationFeed />

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
                        
                        {/* ONLINE AUDITS - SMALL TABLE */}
                        {audits.filter(a => {
                            if (a.status !== "devam_ediyor" || !a.startedAt) return false;
                            const startDate = a.startedAt.toDate();
                            const now = new Date();
                            return startDate.getDate() === now.getDate() &&
                                   startDate.getMonth() === now.getMonth() &&
                                   startDate.getFullYear() === now.getFullYear();
                        }).length > 0 && (
                            <div className="border rounded-md overflow-hidden bg-green-50/50 dark:bg-green-900/10 mb-6 animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-3 border-b bg-green-100/50 dark:bg-green-900/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                        </div>
                                        <h3 className="font-semibold text-sm text-green-700 dark:text-green-400">Online Denetimler</h3>
                                    </div>
                                    <Badge variant="outline" className="bg-white/50 dark:bg-black/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                        {audits.filter(a => {
                                            if (a.status !== "devam_ediyor" || !a.startedAt) return false;
                                            const startDate = a.startedAt.toDate();
                                            const now = new Date();
                                            return startDate.getDate() === now.getDate() &&
                                                   startDate.getMonth() === now.getMonth() &&
                                                   startDate.getFullYear() === now.getFullYear();
                                        }).length} Aktif
                                    </Badge>
                                </div>
                                <div className="max-h-[300px] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-green-100 dark:border-green-800">
                                                <TableHead className="w-[30%] text-green-800 dark:text-green-300">Mağaza</TableHead>
                                                <TableHead className="w-[20%] text-green-800 dark:text-green-300">Konum</TableHead>
                                                <TableHead className="w-[25%] text-green-800 dark:text-green-300">Denetmen</TableHead>
                                                <TableHead className="w-[15%] text-green-800 dark:text-green-300">Başlangıç</TableHead>
                                                <TableHead className="w-[10%] text-right text-green-800 dark:text-green-300">Durum</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {audits.filter(a => {
                                                if (a.status !== "devam_ediyor" || !a.startedAt) return false;
                                                const startDate = a.startedAt.toDate();
                                                const now = new Date();
                                                return startDate.getDate() === now.getDate() &&
                                                       startDate.getMonth() === now.getMonth() &&
                                                       startDate.getFullYear() === now.getFullYear();
                                            }).map((audit) => {
                                                const store = stores.find(s => s.id === audit.storeId);
                                                const storeLoc = store?.location;
                                                const auditLoc = audit.location;
                                                const distance = calculateDistance(auditLoc, storeLoc);
                                                const isApproved = distance !== null && distance <= 100;

                                                return (
                                                    <TableRow key={audit.id} className="hover:bg-green-100/40 dark:hover:bg-green-900/20 border-green-100 dark:border-green-800 transition-colors">
                                                        <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                                                            {audit.storeName}
                                                        </TableCell>
                                                        <TableCell>
                                                            {(() => {
                                                                if (!storeLoc) return <span className="text-xs text-muted-foreground">Mağaza Konumsuz</span>;
                                                                if (!auditLoc) return <span className="text-xs text-muted-foreground">Denetim Konumsuz</span>;
                                                                if (distance === null) return <span className="text-xs text-muted-foreground">Hata</span>;

                                                                return isApproved ? (
                                                                    <div className="flex items-center gap-1 text-green-600" title={`${Math.round(distance)}m`}>
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                        <span className="text-xs font-semibold hidden lg:inline">Onaylandı</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-red-600" title={`${Math.round(distance)}m`}>
                                                                        <XCircle className="h-4 w-4" />
                                                                        <span className="text-xs font-semibold hidden lg:inline">Onaylanmadı ({Math.round(distance)}m)</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                                <span className="font-medium text-slate-700 dark:text-slate-300">{audit.auditorName || "İsimsiz"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                            {audit.startedAt?.toDate().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 animate-pulse">
                                                                Çevrimiçi
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
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
