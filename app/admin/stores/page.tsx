"use client";

import { useEffect, useState } from "react";
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

import { Loader2, Plus, Trash2, Store as StoreIcon, MapPin, ArrowUpDown, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const DAYS_OF_WEEK = [
    "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"
];

export default function AdminStoresPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [regionalManagers, setRegionalManagers] = useState<UserProfile[]>([]);
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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [storesSnapshot, managersSnapshot] = await Promise.all([
                getDocs(collection(db, "stores")),
                getDocs(query(collection(db, "users"), where("role", "==", "bolge-muduru")))
            ]);

            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];

            const managersData = managersSnapshot.docs.map((doc) => ({
                uid: doc.id,
                ...doc.data(),
            })) as UserProfile[];

            setStores(storesData);
            setRegionalManagers(managersData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
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

    const columns: ColumnDef<Store>[] = [
        {
            accessorKey: "name",
            id: "Mağaza Adı",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Mağaza Adı
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
        },
        {
            accessorKey: "city",
            header: "İl",
            cell: ({ row }) => <span>{row.original.city || "-"}</span>
        },
        {
            accessorKey: "type",
            header: "Tür",
            cell: ({ row }) => <Badge variant="outline">{row.original.type || "-"}</Badge>
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
            header: "Bölge Müdürü",
            cell: ({ row }) => {
                const managerId = row.getValue("regionalManagerId") as string;
                return managerId ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                        {getManagerName(managerId)}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground text-sm italic">Atanmadı</span>
                );
            }
        },
        {
            accessorKey: "shipmentDay",
            header: "Sevkiyat Günü",
            cell: ({ row }) => <span>{row.original.shipmentDay || "-"}</span>
        },
        {
            accessorKey: "shipmentTime",
            header: "Sevkiyat Saati",
            cell: ({ row }) => <span>{row.original.shipmentTime || "-"}</span>
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
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold">Mağazalar</h1>
                    <p className="text-muted-foreground mt-2">
                        Tüm mağazaları görüntüleyin ve yönetin
                    </p>
                </div>
                <Button size="lg" onClick={openCreateDialog}>
                    <Plus className="mr-2 h-5 w-5" />
                    Yeni Mağaza
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Mağaza Listesi</CardTitle>
                            <CardDescription>
                                Toplam {stores.length} mağaza
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={stores}
                        searchKey="Mağaza Adı"
                        searchPlaceholder="Mağaza ara..."
                        onRowClick={handleRowClick}
                    />
                </CardContent>
            </Card>

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
        </div>
    );
}
