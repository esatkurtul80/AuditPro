"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    collection,
    getDocs,
    query,
    where,
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

export default function AdminActionsPage() {
    const [auditsWithActions, setAuditsWithActions] = useState<Audit[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedStore, setSelectedStore] = useState<string>("all");
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);
    const [openStatusCombobox, setOpenStatusCombobox] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Mağazaları yükle
            const storesSnapshot = await getDocs(collection(db, "stores"));
            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];
            setStores(storesData);

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
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        return timestamp.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getActionCount = (audit: Audit) => {
        let count = 0;
        audit.sections.forEach((section) => {
            section.answers.forEach((answer) => {
                if (answer.answer === "hayir") count++;
            });
        });
        return count;
    };

    const filteredAudits = auditsWithActions.filter((audit) => {
        if (selectedStore !== "all" && audit.storeId !== selectedStore) {
            return false;
        }
        // Status filtresi gelecekte actions field'ı eklendiğinde kullanılabilir
        return true;
    });

    const statusOptions = [
        { value: "all", label: "Tümü" },
        { value: "pending", label: "Aksiyon Bekleniyor" },
        { value: "review", label: "Onay Bekleniyor" },
        { value: "completed", label: "Tamamlandı" },
        { value: "rejected", label: "Reddedildi" },
    ];

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold">Aksiyon Takip Paneli</h1>
                <p className="text-muted-foreground mt-2">
                    Tüm denetimlerdeki aksiyonları takip edin ve onaylayın
                </p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filtreler</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label>Mağaza</Label>
                            <Popover open={openStoreCombobox} onOpenChange={setOpenStoreCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStoreCombobox}
                                        className="w-full justify-between"
                                    >
                                        {selectedStore !== "all"
                                            ? stores.find((store) => store.id === selectedStore)?.name
                                            : "Tüm Mağazalar"}
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
                                                        setSelectedStore("all")
                                                        setOpenStoreCombobox(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedStore === "all" ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    Tüm Mağazalar
                                                </CommandItem>
                                                {stores.map((store) => (
                                                    <CommandItem
                                                        key={store.id}
                                                        value={store.name}
                                                        onSelect={() => {
                                                            setSelectedStore(store.id)
                                                            setOpenStoreCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedStore === store.id ? "opacity-100" : "opacity-0"
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
                        <div>
                            <Label>Durum</Label>
                            <Popover open={openStatusCombobox} onOpenChange={setOpenStatusCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStatusCombobox}
                                        className="w-full justify-between"
                                    >
                                        {statusOptions.find((status) => status.value === selectedStatus)?.label}
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
                                                            setSelectedStatus(status.value)
                                                            setOpenStatusCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedStatus === status.value ? "opacity-100" : "opacity-0"
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
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Aksiyon Gerektiren Denetimler</CardTitle>
                    <CardDescription>
                        {filteredAudits.length} denetim listeleniyor
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    ) : filteredAudits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold">Aksiyon gerektiren denetim yok</h3>
                            <p className="text-muted-foreground mt-2">
                                Harika! Tüm aksiyonlar tamamlanmış.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Denetim Türü</TableHead>
                                    <TableHead>Mağaza</TableHead>
                                    <TableHead>Denetmen</TableHead>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Aksiyon Sayısı</TableHead>
                                    <TableHead>Puan</TableHead>
                                    <TableHead className="text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAudits.map((audit) => (
                                    <TableRow key={audit.id}>
                                        <TableCell className="font-medium">
                                            {audit.auditTypeName}
                                        </TableCell>
                                        <TableCell>{audit.storeName}</TableCell>
                                        <TableCell>{audit.auditorName}</TableCell>
                                        <TableCell>{formatDate(audit.completedAt)}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-orange-500">
                                                <AlertTriangle className="mr-1 h-3 w-3" />
                                                {getActionCount(audit)} Madde
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    audit.totalScore >= 80
                                                        ? "default"
                                                        : "destructive"
                                                }
                                            >
                                                {audit.totalScore || 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/audits/actions?id=${audit.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    İncele
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
