"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import { StatCard } from "@/components/stat-card";

import { DateRangePicker } from "@/components/ui/date-range-picker";

import { useDebounce } from "@/hooks/use-debounce";
import {
    Card,
    CardContent,
    CardDescription,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Store as StoreIcon,
    ClipboardList,
    CheckCircle2,
    PlayCircle,
    Loader2,
    Search,
    X,
    Edit,
    Trash2,
    Clock,
    Check,
    ChevronsUpDown,
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
    DashboardStats,
    DateRangeFilter,
} from "@/lib/types";
import { softDeleteAudit } from "@/lib/firebase-utils";
import { toast } from "sonner";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";


export default function AdminDashboard() {

    const [loading, setLoading] = useState(true);
    // const [stats, setStats] = useState<DashboardStats | null>(null); // Removed, derived from data
    const [counts, setCounts] = useState({ users: 0, stores: 0 });
    const [audits, setAudits] = useState<Audit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);

    // Default to today
    const [dateRange, setDateRange] = useState<DateRangeFilter>({
        from: new Date(),
        to: new Date(),
    });

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [auditTypeFilter, setAuditTypeFilter] = useState<string>("all");
    const [storeFilter, setStoreFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [auditToDelete, setAuditToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [openStatusCombobox, setOpenStatusCombobox] = useState(false);
    const [openTypeCombobox, setOpenTypeCombobox] = useState(false);
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);

    useEffect(() => {
        loadData();
    }, []); // Run only once

    const loadData = async () => {
        try {
            setLoading(true);

            // Load counts
            const usersSnapshot = await getDocs(collection(db, "users"));
            const storesSnapshot = await getDocs(collection(db, "stores"));

            setCounts({
                users: usersSnapshot.size,
                stores: storesSnapshot.size
            });

            // Load ALL audits and filter in memory (existing audits don't have isDeleted field)
            const auditsSnapshot = await getDocs(collection(db, "audits"));
            const auditsData = auditsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Audit[];

            // Filter out deleted ones
            const activeAudits = auditsData.filter(audit => !audit.isDeleted);
            setAudits(activeAudits.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));

            // Load stores data for dropdown
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

    const filterAudits = (audits: Audit[]) => {
        let filtered = audits;

        if (debouncedSearch) {
            filtered = filtered.filter(
                (audit) =>
                    audit.auditTypeName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    audit.storeName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    audit.auditorName.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((audit) => audit.status === statusFilter);
        }

        if (auditTypeFilter !== "all") {
            filtered = filtered.filter((audit) => audit.auditTypeId === auditTypeFilter);
        }

        if (storeFilter !== "all") {
            filtered = filtered.filter((audit) => audit.storeId === storeFilter);
        }

        if (dateRange.from || dateRange.to) {
            filtered = filtered.filter((audit) => {
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
                    const toDate = new Date(dateRange.to);
                    toDate.setHours(23, 59, 59, 999);
                    // We compare with original auditDate for end of day, or just checkDate <= toDate (normalized)
                    // Let's use normalized checkDate <= normalized toDate
                    const normalizedTo = new Date(dateRange.to);
                    normalizedTo.setHours(0, 0, 0, 0);
                    if (checkDate > normalizedTo) return false;
                }
                return true;
            });
        }

        return filtered;
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

    const clearFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setAuditTypeFilter("all");
        setStoreFilter("all");
        setDateRange({ from: undefined, to: undefined });
    };

    const formatDate = (timestamp: Timestamp) => {
        return timestamp.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const filteredAudits = filterAudits(audits);
    const totalPages = Math.ceil(filteredAudits.length / itemsPerPage);
    const paginatedAudits = filteredAudits.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const dateFilteredAudits = dateRange.from || dateRange.to
        ? audits.filter((audit) => {
            const auditDate = audit.createdAt.toDate();
            if (dateRange.from && auditDate < dateRange.from) return false;
            if (dateRange.to && auditDate > dateRange.to) return false;
            return true;
        })
        : audits;

    const quickStats = {
        total: dateFilteredAudits.length,
        ongoing: dateFilteredAudits.filter((a) => a.status === "devam_ediyor").length,
        completed: dateFilteredAudits.filter((a) => a.status === "tamamlandi").length,
    };

    const statusOptions = [
        { value: "all", label: "Tüm Durumlar" },
        { value: "devam_ediyor", label: "Devam Ediyor" },
        { value: "tamamlandi", label: "Tamamlandı" },
    ];

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-inter font-bold tracking-tight">Yönetim Paneli</h1>
                        <p className="text-muted-foreground mt-2 font-inter">
                            Sistem istatistikleri ve denetim yönetimi
                        </p>
                    </div>
                    <div className="flex items-center gap-4">

                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                    </div>
                </div>

                {/* Dashboard Statistics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Toplam Kullanıcılar"
                        value={counts.users}
                        icon={Users}
                        description="Sistemdeki tüm kullanıcılar"
                        iconColor="text-blue-600"
                        iconBg="bg-blue-100"
                    />
                    <StatCard
                        title="Toplam Mağazalar"
                        value={counts.stores}
                        icon={StoreIcon}
                        description="Kayıtlı mağaza sayısı"
                        iconColor="text-green-600"
                        iconBg="bg-green-100"
                    />
                    <StatCard
                        title="Yapılan Denetimler"
                        value={filteredAudits.length}
                        icon={ClipboardList}
                        description={
                            dateRange.from || dateRange.to
                                ? "Seçili tarih aralığında"
                                : "Toplam denetim sayısı"
                        }
                        iconColor="text-purple-600"
                        iconBg="bg-purple-100"
                    />
                    <StatCard
                        title="Devam Eden"
                        value={filteredAudits.filter(a => a.status === "devam_ediyor").length}
                        icon={Clock}
                        description={
                            dateRange.from || dateRange.to
                                ? "Seçili tarih aralığında"
                                : "Tamamlanmamış denetimler"
                        }
                        iconColor="text-orange-600"
                        iconBg="bg-orange-100"
                    />
                </div>

                {/* Quick Access Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Toplam Denetimler
                                    </p>
                                    <h3 className="text-3xl font-bold mt-2">{quickStats.total}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {dateRange.from || dateRange.to
                                            ? "Seçili tarih aralığında"
                                            : "Tüm zamanlar"}
                                    </p>
                                </div>
                                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Devam Eden
                                    </p>
                                    <h3 className="text-3xl font-bold mt-2 text-yellow-600">
                                        {quickStats.ongoing}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tamamlanmamış
                                    </p>
                                </div>
                                <PlayCircle className="h-10 w-10 text-yellow-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Tamamlanan
                                    </p>
                                    <h3 className="text-3xl font-bold mt-2 text-green-600">
                                        {quickStats.completed}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Başarıyla tamamlandı
                                    </p>
                                </div>
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Audits Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tüm Denetimler</CardTitle>
                        <CardDescription>
                            Sistemdeki tüm denetimleri görüntüleyin ve yönetin
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search and Filters */}
                        <div className="grid gap-4 md:grid-cols-5">
                            <div className="relative md:col-span-2">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {/* Status Filter */}
                            <Popover open={openStatusCombobox} onOpenChange={setOpenStatusCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStatusCombobox}
                                        className="w-full justify-between"
                                    >
                                        {statusFilter !== "all"
                                            ? statusOptions.find((status) => status.value === statusFilter)?.label
                                            : "Durum"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Durum ara..." />
                                        <CommandList>
                                            <CommandEmpty>Durum bulunamadı.</CommandEmpty>
                                            <CommandGroup>
                                                {statusOptions.map((status) => (
                                                    <CommandItem
                                                        key={status.value}
                                                        value={status.label}
                                                        onSelect={() => {
                                                            setStatusFilter(status.value)
                                                            setOpenStatusCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                statusFilter === status.value ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {status.label}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Audit Type Filter */}
                            <Popover open={openTypeCombobox} onOpenChange={setOpenTypeCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openTypeCombobox}
                                        className="w-full justify-between"
                                    >
                                        {auditTypeFilter !== "all"
                                            ? auditTypes.find((type) => type.id === auditTypeFilter)?.name
                                            : "Tür"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Tür ara..." />
                                        <CommandList>
                                            <CommandEmpty>Tür bulunamadı.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="Tüm Türler"
                                                    onSelect={() => {
                                                        setAuditTypeFilter("all")
                                                        setOpenTypeCombobox(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            auditTypeFilter === "all" ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    Tüm Türler
                                                </CommandItem>
                                                {auditTypes.map((type) => (
                                                    <CommandItem
                                                        key={type.id}
                                                        value={type.name}
                                                        onSelect={() => {
                                                            setAuditTypeFilter(type.id)
                                                            setOpenTypeCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                auditTypeFilter === type.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {type.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Store Filter */}
                            <Popover open={openStoreCombobox} onOpenChange={setOpenStoreCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStoreCombobox}
                                        className="w-full justify-between"
                                    >
                                        {storeFilter !== "all"
                                            ? stores.find((store) => store.id === storeFilter)?.name
                                            : "Mağaza"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Mağaza ara..." />
                                        <CommandList>
                                            <CommandEmpty>Mağaza bulunamadı.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="Tüm Mağazalar"
                                                    onSelect={() => {
                                                        setStoreFilter("all")
                                                        setOpenStoreCombobox(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            storeFilter === "all" ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    Tüm Mağazalar
                                                </CommandItem>
                                                {stores.map((store) => (
                                                    <CommandItem
                                                        key={store.id}
                                                        value={store.name}
                                                        onSelect={() => {
                                                            setStoreFilter(store.id)
                                                            setOpenStoreCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                storeFilter === store.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {store.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {filteredAudits.length} denetim bulundu
                            </p>
                            {(searchTerm ||
                                statusFilter !== "all" ||
                                auditTypeFilter !== "all" ||
                                storeFilter !== "all" ||
                                dateRange.from ||
                                dateRange.to) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="gap-2"
                                    >
                                        <X className="h-4 w-4" />
                                        Temizle
                                    </Button>
                                )}
                        </div>

                        {/* Table */}
                        {filteredAudits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold">Denetim bulunamadı</h3>
                                <p className="text-muted-foreground mt-2">
                                    Filtreleri değiştirmeyi deneyin
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Denetim Türü</TableHead>
                                                <TableHead>Mağaza</TableHead>
                                                <TableHead>Denetmen</TableHead>
                                                <TableHead>Durum</TableHead>
                                                <TableHead>Puan</TableHead>
                                                <TableHead>Tarih</TableHead>
                                                <TableHead className="text-right">İşlemler</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedAudits.map((audit) => (
                                                <TableRow key={audit.id}>
                                                    <TableCell className="font-medium">
                                                        {audit.auditTypeName}
                                                    </TableCell>
                                                    <TableCell>{audit.storeName}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {audit.auditorName || "Bilinmeyen Kullanıcı"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {audit.status === "devam_ediyor" ? (
                                                            <Badge className="bg-yellow-500">
                                                                <PlayCircle className="mr-1 h-3 w-3" />
                                                                Devam Ediyor
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-green-500">
                                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                                Tamamlandı
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold">
                                                            {audit.totalScore || 0}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {formatDate(audit.createdAt)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Link href={`/audits/view?id=${audit.id}`}>
                                                                <Button variant="ghost" size="sm">
                                                                    Görüntüle
                                                                </Button>
                                                            </Link>
                                                            <Link href={`/audits/view?id=${audit.id}`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                    Düzenle
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => {
                                                                    setAuditToDelete(audit.id);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Sil
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Önceki
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(
                                                    (page) =>
                                                        page === 1 ||
                                                        page === totalPages ||
                                                        Math.abs(page - currentPage) <= 1
                                                )
                                                .map((page, idx, arr) => (
                                                    <React.Fragment key={page}>
                                                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                                                            <span className="px-2">...</span>
                                                        )}
                                                        <Button
                                                            variant={
                                                                currentPage === page ? "default" : "outline"
                                                            }
                                                            size="sm"
                                                            onClick={() => setCurrentPage(page)}
                                                        >
                                                            {page}
                                                        </Button>
                                                    </React.Fragment>
                                                ))}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                            }
                                            disabled={currentPage === totalPages}
                                        >
                                            Sonraki
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Denetimi sil?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu denetim çöp kutusuna taşınacak. Daha sonra geri yükleyebilir veya
                            kalıcı olarak silebilirsiniz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSoftDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Çöp Kutusuna Taşı
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
