"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, UserProfile } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { ColumnDef } from "@tanstack/react-table";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Loader2, Plus, Trash2, Store as StoreIcon, MapPin, Map, ArrowUpDown, Check, ChevronsUpDown, Upload, Download, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


const StoreMap = dynamic(
    () => import("@/components/store-map").then((m) => ({ default: m.StoreMap })),
    { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> }
);

const TURKISH_CITIES = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
    "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
    "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
    "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
    "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
    "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop",
    "Şırnak", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
];

const turkishSort = (rowA: any, rowB: any, columnId: string) => {
    const a = String(rowA.getValue(columnId) || "");
    const b = String(rowB.getValue(columnId) || "");
    return a.localeCompare(b, 'tr-TR');
};

const DAYS_OF_WEEK = [
    "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"
];

export default function AdminStoresPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [regionalManagers, setRegionalManagers] = useState<UserProfile[]>([]);
    const [assignedStoreIds, setAssignedStoreIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false); // For new store dialog
    const [sheetOpen, setSheetOpen] = useState(false); // For edit store sheet
    const [selectedStore, setSelectedStore] = useState<Store | null>(null); // Store being edited
    const [formData, setFormData] = useState({
        name: "",
        location: "",
        regionalManagerId: "",
        city: "",
        type: "" as "ŞUBE" | "AVM" | "MİGROS" | "",
        address: "",
        openingDate: "",
        ipAddress: "",
        shipmentDay: "",
        shipmentTime: "",
        email: "",
        phone: "",
        phoneShortCode: "",
    });
    const [openCombobox, setOpenCombobox] = useState(false);
    const [openEditCombobox, setOpenEditCombobox] = useState(false);
    const [openCityCreateCombobox, setOpenCityCreateCombobox] = useState(false);
    const [openCityEditCombobox, setOpenCityEditCombobox] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    
    // Bulk Upload State
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkUploading, setBulkUploading] = useState(false);

    // Map State
    const [mapOpen, setMapOpen] = useState(false);
    const [mapCityFilter, setMapCityFilter] = useState<string>("all");
    const [mapManagerFilter, setMapManagerFilter] = useState<string>("all");
    const [mapCityOpen, setMapCityOpen] = useState(true);
    const [mapManagerOpen, setMapManagerOpen] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [storesSnapshot, managersSnapshot, magazaUsersSnapshot] = await Promise.all([
                getDocs(collection(db, "stores")),
                getDocs(query(collection(db, "users"), where("role", "==", "bolge-muduru"))),
                getDocs(query(collection(db, "users"), where("role", "==", "magaza")))
            ]);

            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];

            const managersData = managersSnapshot.docs.map((doc) => ({
                uid: doc.id,
                ...doc.data(),
            })) as UserProfile[];

            const assignedIds = new Set<string>();
            magazaUsersSnapshot.docs.forEach((doc) => {
                const storeId = doc.data().storeId;
                if (storeId) assignedIds.add(storeId);
            });

            setStores(storesData);
            setRegionalManagers(managersData);
            setAssignedStoreIds(assignedIds);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const wsData = [
            ["Mağaza Adı*", "İl*", "Mağaza Türü (ŞUBE, AVM, MİGROS)", "Konum (Lat, Lng)", "Adres", "Açılış Tarihi (YYYY-AA-GG)", "IP Adresi", "Sevkiyat Günü", "Sevkiyat Saati", "Mail Adresi", "Telefon Numarası", "Telefon Kısa Kod", "Bölge Müdürü E-posta"],
            ["İstanbul - Kadıköy", "İstanbul", "ŞUBE", "40.9901, 29.0292", "Kadıköy Merkez", "2024-01-01", "192.168.1.5", "Pazartesi", "08:00", "kadikoy@magaza.com", "02161234567", "2161", "bolgemuduru1@ornek.com"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Add minimal styling/column widths
        ws["!cols"] = [
            { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 35 }
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Magazalar_Sablon");
        XLSX.writeFile(wb, "magaza_ekleme_sablonu.xlsx");
    };

    const handleBulkUpload = async () => {
        if (!bulkFile) {
            toast.error("Lütfen bir Excel dosyası seçin");
            return;
        }

        setBulkUploading(true);
        try {
            const data = await bulkFile.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Read as json array of arrays to skip header row easily
            const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
            
            if (rows.length < 2) {
                toast.error("Dosyada geçerli veri bulunamadı");
                return;
            }

            // Map standard column indexes (based on template)
            // 0: Adı, 1: İl, 2: Tür, 3: Konum, 4: Adres, 5: Açılış Tarihi, 6: IP, 7: Sevk Gün, 8: Sevk Saat, 9: Mail, 10: Telefon, 11: Kısa Kod, 12: Bölge Müdürü E-posta
            let successCount = 0;
            let errorCount = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows or rows without store name
                
                const storeName = String(row[0] || "").trim();
                const city = String(row[1] || "").trim();
                const typeRaw = String(row[2] || "").trim().toUpperCase();
                // Validate enum
                let type: "ŞUBE" | "AVM" | "MİGROS" | "" = "";
                if (typeRaw === "ŞUBE" || typeRaw === "AVM" || typeRaw === "MİGROS") {
                    type = typeRaw;
                }
                
                const location = String(row[3] || "").trim();
                const address = String(row[4] || "").trim();
                const rawDate = row[5];
                let openingDate = "";
                if (rawDate) {
                    if (typeof rawDate === "number") {
                         // Excel date serial number handling
                         const dateObj = XLSX.SSF.parse_date_code(rawDate);
                         openingDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
                    } else {
                         openingDate = String(rawDate).trim();
                    }
                }
                const ipAddress = String(row[6] || "").trim();
                const shipmentDay = String(row[7] || "").trim();
                
                 // Format time nicely if it arrived as decimal from excel
                let shipmentTime = "";
                const rawTime = row[8];
                if (typeof rawTime === "number" && rawTime < 1) {
                    const totalMinutes = Math.round(rawTime * 24 * 60);
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    shipmentTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                } else {
                    shipmentTime = String(rawTime || "").trim();
                }

                const email = String(row[9] || "").trim();
                const phone = String(row[10] || "").trim();
                const phoneShortCode = String(row[11] || "").trim();
                const rmEmail = String(row[12] || "").trim().toLowerCase();

                let regionalManagerId = "";
                if (rmEmail) {
                    const manager = regionalManagers.find(m => m.email?.toLowerCase() === rmEmail);
                    if (manager) {
                        regionalManagerId = manager.uid;
                    }
                }

                try {
                    await addDoc(collection(db, "stores"), {
                        name: storeName,
                        city,
                        type,
                        location,
                        address,
                        openingDate,
                        ipAddress,
                        shipmentDay,
                        shipmentTime,
                        email,
                        phone,
                        phoneShortCode,
                        regionalManagerId,
                        createdAt: Timestamp.now(),
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Error adding store ${storeName}:`, err);
                    errorCount++;
                }
            }

            toast.success(`Yükleme tamamlandı. Başarılı: ${successCount}, Başarısız: ${errorCount}`);
            setBulkOpen(false);
            setBulkFile(null);
            loadData();
        } catch (error) {
            console.error("Error processing Excel:", error);
            toast.error("Dosya okunurken bir hata oluştu");
        } finally {
            setBulkUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error("Mağaza adı gerekli");
            return;
        }

        try {
            await addDoc(collection(db, "stores"), {
                ...formData,
                createdAt: Timestamp.now(),
            });
            toast.success("Mağaza oluşturuldu");
            setDialogOpen(false);
            resetFormData();
            loadData();
        } catch (error) {
            console.error("Error saving store:", error);
            toast.error("Kaydetme hatası");
        }
    };

    const handleUpdate = async () => {
        if (!selectedStore) return;
        if (!formData.name.trim()) {
            toast.error("Mağaza adı gerekli");
            return;
        }

        try {
            await updateDoc(doc(db, "stores", selectedStore.id), {
                ...formData,
            });
            toast.success("Değişiklikler kaydedildi");
            setSheetOpen(false);
            loadData();
        } catch (error) {
            console.error("Error updating store:", error);
            toast.error("Güncelleme hatası");
        }
    };

    const handleDelete = async () => {
        if (!selectedStore) return;

        try {
            await deleteDoc(doc(db, "stores", selectedStore.id));
            setStores(stores.filter((s) => s.id !== selectedStore.id));
            setSheetOpen(false);
            setDeleteAlertOpen(false);
            loadData();
        } catch (error) {
            console.error("Error deleting store:", error);
            setDeleteAlertOpen(false);
        }
    };

    const resetFormData = () => {
        setFormData({
            name: "",
            location: "",
            regionalManagerId: "",
            city: "",
            type: "",
            address: "",
            openingDate: "",
            ipAddress: "",
            shipmentDay: "",
            shipmentTime: "",
            email: "",
            phone: "",
            phoneShortCode: "",
        });
    };

    const openCreateDialog = () => {
        resetFormData();
        setDialogOpen(true);
    };

    const handleRowClick = (store: Store) => {
        setSelectedStore(store);
        setFormData({
            name: store.name || "",
            location: store.location || "",
            regionalManagerId: store.regionalManagerId || "",
            city: store.city || "",
            type: store.type || "",
            address: store.address || "",
            openingDate: store.openingDate || "",
            ipAddress: store.ipAddress || "",
            shipmentDay: store.shipmentDay || "",
            shipmentTime: store.shipmentTime || "",
            email: store.email || "",
            phone: store.phone || "",
            phoneShortCode: store.phoneShortCode || "",
        });
        setSheetOpen(true);
    };

    const getManagerName = (id: string) => {
        const manager = regionalManagers.find(m => m.uid === id);
        if (!manager) return "Atama Bekliyor";
        const firstName = manager.firstName || "";
        const lastName = manager.lastName || "";
        const fullName = (firstName + " " + lastName).trim();
        return fullName || manager.email || id;
    };

    // Map pins computation
    const mapPins = useMemo(() => {
        return stores
            .filter(s => {
                if (!s.location || !s.location.includes(',')) return false;
                if (mapCityFilter !== "all" && s.city !== mapCityFilter) return false;
                if (mapManagerFilter !== "all" && s.regionalManagerId !== mapManagerFilter) return false;
                return true;
            })
            .map(s => {
                const [latStr, lngStr] = s.location!.split(',').map(x => x.trim());
                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);
                if (isNaN(lat) || isNaN(lng)) return null;
                return {
                    id: s.id,
                    name: s.name || s.id,
                    city: s.city || "",
                    lat,
                    lng,
                    managerName: getManagerName(s.regionalManagerId || ""),
                    type: s.type,
                    address: s.address,
                };
            })
            .filter(Boolean) as { id: string; name: string; city: string; lat: number; lng: number; managerName: string; type?: string; address?: string; }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stores, mapCityFilter, mapManagerFilter, regionalManagers]);

    const mapCities = useMemo(() => Array.from(new Set(stores.map(s => s.city).filter(Boolean))).sort() as string[], [stores]);
    const storesWithLocation = useMemo(() => stores.filter(s => s.location && s.location.includes(',')), [stores]);

    const dayWeights: { [key: string]: number } = {
        "Pazartesi": 1,
        "Salı": 2,
        "Çarşamba": 3,
        "Perşembe": 4,
        "Cuma": 5,
        "Cumartesi": 6,
        "Pazar": 7,
    };

    const columns: ColumnDef<Store>[] = [
        {
            accessorKey: "name",
            id: "Mağaza Adı",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Mağaza Adı" />,
            meta: { 
                title: "Mağaza Adı",
                filterOptions: stores
                    .map(s => ({ label: s.name || s.id, value: s.name || s.id }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'tr-TR', { sensitivity: 'base' }))
            },
            cell: ({ row }) => {
                const isUnassigned = !assignedStoreIds.has(row.original.id);
                return (
                    <span className="flex items-center gap-1.5 font-medium">
                        {row.original.name}
                        {isUnassigned && (
                            <span
                                className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0"
                                title="Bu mağazaya kullanıcı atanmamış"
                            />
                        )}
                    </span>
                );
            },
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: turkishSort
        },
        {
            accessorKey: "city",
            header: ({ column }) => <DataTableColumnHeader column={column} title="İl" />,
            meta: { 
                title: "İl",
                filterOptions: Array.from(new Set(stores.map(s => s.city).filter(Boolean)))
                    .map(city => ({ label: city as string, value: city as string }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'tr-TR', { sensitivity: 'base' }))
            },
            cell: ({ row }) => <span>{row.original.city || "-"}</span>,
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: turkishSort
        },
        {
            accessorKey: "type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tür" />,
            meta: { title: "Tür" },
            cell: ({ row }) => <Badge variant="outline">{row.original.type || "-"}</Badge>,
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: turkishSort
        },
        {
            accessorKey: "location",
            header: "Konum",
            cell: ({ row }) => {
                const location = row.getValue("location") as string;
                if (location && location.includes(',')) {
                    const [lat, lng] = location.split(',').map(s => s.trim());
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            <MapPin className="h-4 w-4" />
                            Konum
                        </button>
                    );
                }
                return <span className="text-muted-foreground">{location || "-"}</span>;
            }
        },
        {
            accessorKey: "regionalManagerId",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bölge Müdürü" />,
            meta: { 
                title: "Bölge Müdürü",
                filterOptions: regionalManagers.map(m => ({ label: getManagerName(m.uid), value: m.uid }))
            },
            cell: ({ row }) => {
                const managerId = row.getValue("regionalManagerId") as string;
                return managerId ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                        {getManagerName(managerId)}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground text-sm italic">Atanmadı</span>
                );
            },
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: (rowA, rowB, columnId) => {
                const a = getManagerName(rowA.getValue(columnId) as string);
                const b = getManagerName(rowB.getValue(columnId) as string);
                return a.localeCompare(b, 'tr-TR');
            }
        },
        {
            accessorKey: "shipmentDay",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sevkiyat Günü" />,
            meta: { 
                title: "Sevkiyat Günü",
                filterOptions: [
                    { label: "Pazartesi", value: "Pazartesi" },
                    { label: "Salı", value: "Salı" },
                    { label: "Çarşamba", value: "Çarşamba" },
                    { label: "Perşembe", value: "Perşembe" },
                    { label: "Cuma", value: "Cuma" },
                    { label: "Cumartesi", value: "Cumartesi" },
                    { label: "Pazar", value: "Pazar" },
                ]
            },
            cell: ({ row }) => <span>{row.original.shipmentDay || "-"}</span>,
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: (rowA, rowB, columnId) => {
                const a = String(rowA.getValue(columnId) || "-");
                const b = String(rowB.getValue(columnId) || "-");
                const weightA = dayWeights[a] || 99;
                const weightB = dayWeights[b] || 99;
                if (weightA !== weightB) return weightA - weightB;
                return a.localeCompare(b, 'tr-TR');
            }
        },
        {
            accessorKey: "shipmentTime",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sevkiyat Saati" />,
            meta: { title: "Sevkiyat Saati" },
            cell: ({ row }) => <span>{row.original.shipmentTime || "-"}</span>,
            filterFn: (row, id, value) => {
                return Array.isArray(value) && value.includes(row.getValue(id));
            },
            sortingFn: turkishSort
        },
    ];

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-4 md:py-8 px-4 md:px-6">
            <Card>
                <CardContent className="p-6 pt-0">
                    <DataTable
                        columns={columns}
                        data={stores}
                        initialSorting={[{ id: "Mağaza Adı", desc: false }]}
                        onRowClick={handleRowClick}
                        mapElement={
                            <Button
                                size="lg"
                                variant="outline"
                                onClick={() => setMapOpen(true)}
                                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                            >
                                <Map className="mr-2 h-5 w-5" />
                                Harita
                            </Button>
                        }
                        actionElement={(table) => (
                            <div className="flex gap-2">
                                <Button
                                    size="lg"
                                    onClick={() => {
                                        const filteredStores = table.getSortedRowModel().rows.map((row: any) => row.original);
                                        const worksheet = XLSX.utils.json_to_sheet(filteredStores.map((store: Store) => ({
                                            "Mağaza Adı": store.name || "",
                                            "İl": store.city || "-",
                                            "Tür": store.type || "-",
                                            "Bölge Müdürü": store.regionalManagerId ? getManagerName(store.regionalManagerId) : "Atanmadı",
                                            "Sevkiyat Günü": store.shipmentDay || "-",
                                            "Sevkiyat Saati": store.shipmentTime || "-",
                                            "Açılış Tarihi": store.openingDate || "-",
                                            "Adres": store.address || "-",
                                            "Konum": store.location || "-",
                                            "IP Adresi": store.ipAddress || "-",
                                            "Mail Adresi": store.email || "-",
                                            "Telefon Numarası": store.phone || "-",
                                            "Kısa Kod": store.phoneShortCode || "-"
                                        })));
                                        const workbook = XLSX.utils.book_new();
                                        XLSX.utils.book_append_sheet(workbook, worksheet, "Mağazalar");
                                        XLSX.writeFile(workbook, `Magazalar_Listesi_${new Date().toLocaleDateString("tr-TR")}.xlsx`);
                                    }}
                                    variant="outline"
                                    className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800"
                                >
                                    <FileSpreadsheet className="mr-2 h-5 w-5" />
                                    Excel İndir
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={() => setBulkOpen(true)}
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                                >
                                    <FileSpreadsheet className="mr-2 h-5 w-5" />
                                    Toplu Mağaza Ekle
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={openCreateDialog}
                                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    Yeni Mağaza
                                </Button>
                            </div>
                        )}
                    />

                    {/* Map Modal */}
                    <Dialog open={mapOpen} onOpenChange={setMapOpen}>
                        <DialogContent
                            className="flex flex-col p-0 gap-0 overflow-hidden"
                            style={{ width: "95vw", maxWidth: "95vw", height: "90vh", maxHeight: "90vh" }}
                        >
                            {/* Header */}
                            <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                                <DialogTitle className="flex items-center gap-2">
                                    <Map className="h-5 w-5 text-blue-600" />
                                    Mağaza Haritası
                                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                                        {mapPins.length} mağaza gösteriliyor
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="sr-only">Mağazaların harita üzerindeki konumları</DialogDescription>
                            </DialogHeader>

                            {/* Body: sidebar + map */}
                            <div className="flex flex-1 min-h-0 overflow-hidden">

                                {/* LEFT SIDEBAR */}
                                <div className="w-64 flex-shrink-0 border-r bg-muted/20 flex flex-col h-full">

                                    {/* Scrollable filter list */}
                                    <div className="flex-1 overflow-y-auto">

                                        {/* City accordion */}
                                        <div className="border-b">
                                            <button
                                                onClick={() => setMapCityOpen(o => !o)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    İl
                                                    {mapCityFilter !== "all" && (
                                                        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                                                    )}
                                                </span>
                                                <ChevronsUpDown className={`h-4 w-4 text-muted-foreground transition-transform ${mapCityOpen ? "rotate-180" : ""}`} />
                                            </button>
                                            {mapCityOpen && (
                                                <div className="pb-2 px-2 space-y-0.5">
                                                    <button
                                                        onClick={() => setMapCityFilter("all")}
                                                        className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${mapCityFilter === "all" ? "bg-blue-600 text-white font-medium" : "hover:bg-muted text-foreground"}`}
                                                    >
                                                        Tüm İller
                                                    </button>
                                                    {mapCities.map(city => (
                                                        <button
                                                            key={city}
                                                            onClick={() => setMapCityFilter(city === mapCityFilter ? "all" : city)}
                                                            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${mapCityFilter === city ? "bg-blue-600 text-white font-medium" : "hover:bg-muted text-foreground"}`}
                                                        >
                                                            {city}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Manager accordion */}
                                        <div className="border-b">
                                            <button
                                                onClick={() => setMapManagerOpen(o => !o)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    Bölge Müdürü
                                                    {mapManagerFilter !== "all" && (
                                                        <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                                                    )}
                                                </span>
                                                <ChevronsUpDown className={`h-4 w-4 text-muted-foreground transition-transform ${mapManagerOpen ? "rotate-180" : ""}`} />
                                            </button>
                                            {mapManagerOpen && (
                                                <div className="pb-2 px-2 space-y-0.5">
                                                    <button
                                                        onClick={() => setMapManagerFilter("all")}
                                                        className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${mapManagerFilter === "all" ? "bg-orange-500 text-white font-medium" : "hover:bg-muted text-foreground"}`}
                                                    >
                                                        Tüm Müdürler
                                                    </button>
                                                    {regionalManagers.map(m => (
                                                        <button
                                                            key={m.uid}
                                                            onClick={() => setMapManagerFilter(m.uid === mapManagerFilter ? "all" : m.uid)}
                                                            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${mapManagerFilter === m.uid ? "bg-orange-500 text-white font-medium" : "hover:bg-muted text-foreground"}`}
                                                            title={getManagerName(m.uid)}
                                                        >
                                                            <span className="block truncate">{getManagerName(m.uid)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    {/* Fixed footer */}
                                    <div className="flex-shrink-0 p-3 border-t bg-muted/10 space-y-1.5">
                                        {(mapCityFilter !== "all" || mapManagerFilter !== "all") && (
                                            <button
                                                onClick={() => { setMapCityFilter("all"); setMapManagerFilter("all"); }}
                                                className="w-full flex items-center justify-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-md py-1.5 transition-colors"
                                            >
                                                <X className="h-3 w-3" /> Filtreleri Temizle
                                            </button>
                                        )}
                                        <p className="text-xs text-center text-muted-foreground">
                                            {storesWithLocation.length} / {stores.length} konum mevcut
                                        </p>
                                    </div>
                                </div>


                                {/* MAP */}
                                <div className="flex-1 min-w-0">
                                    <StoreMap pins={mapPins} />
                                </div>

                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Bulk Upload Dialog */}
                    <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Toplu Mağaza Yükle</DialogTitle>
                                <DialogDescription>
                                    Önce şablonu indirin, Excel ile mağaza bilgilerini eksiksiz (Mağaza Adı ve İl zorunludur) doldurun ve ardından dosyayı buradan yükleyin.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Button 
                                    onClick={handleDownloadTemplate} 
                                    variant="outline" 
                                    className="w-full justify-start text-blue-600 border-blue-200 bg-blue-50"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Örnek Şablonu İndir
                                </Button>
                                
                                <div className="space-y-2 mt-4">
                                    <Label>Doldurulmuş Excel Dosyası (.xlsx)</Label>
                                    <Input 
                                        type="file" 
                                        accept=".xlsx, .xls"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) setBulkFile(file);
                                        }}
                                        className="cursor-pointer"
                                    />
                                    {bulkFile && (
                                        <div className="text-sm text-muted-foreground flex items-center justify-between">
                                            <span>Seçilen dosya: {bulkFile.name}</span>
                                            <Button variant="ghost" size="sm" onClick={() => setBulkFile(null)} className="h-6 w-6 p-0 text-red-500">X</Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkUploading}>İptal</Button>
                                <Button onClick={handleBulkUpload} disabled={!bulkFile || bulkUploading} className="min-w-[100px]">
                                    {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yükle"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Yeni Mağaza</DialogTitle>
                                <DialogDescription>
                                    Sisteme yeni bir mağaza ekleyin
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mağaza Adı</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Örn: İstanbul - Kadıköy"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bulunduğu İl</Label>
                                        <Popover open={openCityCreateCombobox} onOpenChange={setOpenCityCreateCombobox}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openCityCreateCombobox}
                                                    className="w-full justify-between"
                                                >
                                                    {formData.city
                                                        ? formData.city
                                                        : "İl Seçin..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="İl ara..." />
                                                    <CommandList>
                                                        <CommandEmpty>İl bulunamadı.</CommandEmpty>
                                                        <CommandGroup>
                                                            {TURKISH_CITIES.map((city) => (
                                                                <CommandItem
                                                                    key={city}
                                                                    value={city}
                                                                    onSelect={(currentValue) => {
                                                                        setFormData({ ...formData, city: currentValue === formData.city ? "" : currentValue })
                                                                        setOpenCityCreateCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.city === city ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {city}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mağaza Türü</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tür Seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ŞUBE">ŞUBE</SelectItem>
                                                <SelectItem value="AVM">AVM</SelectItem>
                                                <SelectItem value="MİGROS">MİGROS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Konum (Lat, Lng)</Label>
                                        <Input
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="Örn: 41.0082, 28.9784"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Adres</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Açık adres"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Açılış Tarihi</Label>
                                        <Input
                                            type="date"
                                            value={formData.openingDate}
                                            onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>IP Adresi</Label>
                                        <Input
                                            value={formData.ipAddress}
                                            onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                                            placeholder="192.168.1.1"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Sevkiyat Günü</Label>
                                        <Select
                                            value={formData.shipmentDay}
                                            onValueChange={(value) => setFormData({ ...formData, shipmentDay: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Gün Seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DAYS_OF_WEEK.map((day) => (
                                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sevkiyat Saati</Label>
                                        <Input
                                            type="time"
                                            value={formData.shipmentTime}
                                            onChange={(e) => setFormData({ ...formData, shipmentTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mail Adresi</Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="magaza@ornek.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Telefon Numarası</Label>
                                        <Input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="0212 345 67 89"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Telefon Kısa Kod</Label>
                                    <Input
                                        value={formData.phoneShortCode}
                                        onChange={(e) => setFormData({ ...formData, phoneShortCode: e.target.value })}
                                        placeholder="Örn: 1234"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Bölge Müdürü</Label>
                                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openCombobox}
                                                className="w-full justify-between"
                                            >
                                                {formData.regionalManagerId
                                                    ? getManagerName(formData.regionalManagerId)
                                                    : "Bölge Müdürü Seçin..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Bölge müdürü ara..." />
                                                <CommandList>
                                                    <CommandEmpty>Bölge müdürü bulunamadı.</CommandEmpty>
                                                    <CommandGroup>
                                                        {regionalManagers.map((manager) => (
                                                            <CommandItem
                                                                key={manager.uid}
                                                                value={manager.uid}
                                                                onSelect={(currentValue) => {
                                                                    setFormData({ ...formData, regionalManagerId: currentValue === formData.regionalManagerId ? "" : currentValue })
                                                                    setOpenCombobox(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        formData.regionalManagerId === manager.uid ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {getManagerName(manager.uid)}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmit}>Kaydet</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetContent className="sm:max-w-[600px] flex flex-col h-full">
                            <SheetHeader>
                                <SheetTitle>Mağaza Düzenle</SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mağaza Adı</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bulunduğu İl</Label>
                                        <Popover open={openCityEditCombobox} onOpenChange={setOpenCityEditCombobox}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openCityEditCombobox}
                                                    className="w-full justify-between"
                                                >
                                                    {formData.city
                                                        ? formData.city
                                                        : "İl Seçin..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="İl ara..." />
                                                    <CommandList>
                                                        <CommandEmpty>İl bulunamadı.</CommandEmpty>
                                                        <CommandGroup>
                                                            {TURKISH_CITIES.map((city) => (
                                                                <CommandItem
                                                                    key={city}
                                                                    value={city}
                                                                    onSelect={(currentValue) => {
                                                                        setFormData({ ...formData, city: currentValue === formData.city ? "" : currentValue })
                                                                        setOpenCityEditCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.city === city ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {city}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mağaza Türü</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tür Seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ŞUBE">ŞUBE</SelectItem>
                                                <SelectItem value="AVM">AVM</SelectItem>
                                                <SelectItem value="MİGROS">MİGROS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Konum (Lat, Lng)</Label>
                                        <Input
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="Örn: 41.0082, 28.9784"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Adres</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>

                                {formData.location && (
                                    <div className="w-full h-64 rounded-lg overflow-hidden border">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            loading="lazy"
                                            allowFullScreen
                                            referrerPolicy="no-referrer-when-downgrade"
                                            src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDrcsSzuafX8CWoawutRcC-ur1IYlKPPdU&q=${encodeURIComponent(formData.location)}`}
                                        ></iframe>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Açılış Tarihi</Label>
                                        <Input
                                            type="date"
                                            value={formData.openingDate}
                                            onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bölge Müdürü</Label>
                                        <Popover open={openEditCombobox} onOpenChange={setOpenEditCombobox}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openEditCombobox}
                                                    className="w-full justify-between"
                                                >
                                                    {formData.regionalManagerId
                                                        ? getManagerName(formData.regionalManagerId)
                                                        : "Bölge Müdürü Seçin..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Bölge müdürü ara..." />
                                                    <CommandList>
                                                        <CommandEmpty>Bölge müdürü bulunamadı.</CommandEmpty>
                                                        <CommandGroup>
                                                            {regionalManagers.map((manager) => (
                                                                <CommandItem
                                                                    key={manager.uid}
                                                                    value={manager.uid}
                                                                    onSelect={(currentValue) => {
                                                                        setFormData({ ...formData, regionalManagerId: currentValue === formData.regionalManagerId ? "" : currentValue })
                                                                        setOpenEditCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.regionalManagerId === manager.uid ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {getManagerName(manager.uid)}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>IP Adresi</Label>
                                    <Input
                                        type="text"
                                        placeholder="192.168.1.1"
                                        pattern="^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$"
                                        value={formData.ipAddress}
                                        onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Sevkiyat Günü</Label>
                                        <Select
                                            value={formData.shipmentDay}
                                            onValueChange={(value) => setFormData({ ...formData, shipmentDay: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Gün Seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DAYS_OF_WEEK.map((day) => (
                                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sevkiyat Saati</Label>
                                        <Input
                                            type="time"
                                            value={formData.shipmentTime}
                                            onChange={(e) => setFormData({ ...formData, shipmentTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mail Adresi</Label>
                                        <Input
                                            type="email"
                                            placeholder="magaza@ornek.com"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Telefon Numarası</Label>
                                        <Input
                                            type="tel"
                                            placeholder="0212 345 67 89"
                                            pattern="[0-9]{10,11}"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Telefon Kısa Kod</Label>
                                    <Input
                                        value={formData.phoneShortCode}
                                        onChange={(e) => setFormData({ ...formData, phoneShortCode: e.target.value })}
                                    />
                                </div>
                            </div>

                            <SheetFooter className="border-t pt-4 mt-auto flex flex-row gap-2">
                                <Button className="flex-1" onClick={handleUpdate}>
                                    Değişiklikleri Kaydet
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => setDeleteAlertOpen(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Mağazayı Sil
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>

                    <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Mağazayı silmek istediğinize emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. Bu mağazayı kalıcı olarak silmek istediğinize emin misiniz?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                    Sil
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}
