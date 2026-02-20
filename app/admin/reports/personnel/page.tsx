"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { collection, getDocs, query, orderBy, Timestamp, getDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PersonnelEvaluation, Store, UserProfile, DateRangeFilter, PersonnelStatus, StorePersonnel } from "@/lib/types";
import { Loader2, FileSpreadsheet, Star, Settings2, Save, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

interface EvaluationRow extends PersonnelEvaluation {
    formattedDate: string;
    parsedDate: Date;
}

export default function PersonnelReportPage() {
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [auditors, setAuditors] = useState<UserProfile[]>([]);

    // Filters
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [selectedStore, setSelectedStore] = useState<string>("all");
    const [selectedAuditor, setSelectedAuditor] = useState<string>("all");

    // Processed Data
    const [filteredData, setFilteredData] = useState<EvaluationRow[]>([]);

    // Edit Status State
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
    const [selectedPersonnelName, setSelectedPersonnelName] = useState<string>("");
    const [selectedPersonnelStoreId, setSelectedPersonnelStoreId] = useState<string>("");
    const [newStatus, setNewStatus] = useState<PersonnelStatus>("active");
    const [targetStoreId, setTargetStoreId] = useState<string>("none");
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedPersonnelHistory, setSelectedPersonnelHistory] = useState<EvaluationRow[]>([]);
    const [historyPersonnelName, setHistoryPersonnelName] = useState("");

    // Grouping personnel
    const personnelGrouped = useMemo(() => {
        const map = new Map<string, {
            personnelId: string,
            personnelName: string,
            storeId: string,
            storeName: string,
            evaluations: EvaluationRow[],
            averageScore: number,
        }>();

        filteredData.forEach(ev => {
            if (!map.has(ev.personnelId)) {
                map.set(ev.personnelId, {
                    personnelId: ev.personnelId,
                    personnelName: ev.personnelName,
                    storeId: ev.storeId, // use the first found, or latest if we sort
                    storeName: ev.storeName || "",
                    evaluations: [],
                    averageScore: 0,
                });
            }
            map.get(ev.personnelId)!.evaluations.push(ev);
        });

        return Array.from(map.values()).map(p => {
            const total = p.evaluations.reduce((sum, e) => sum + (e.score || 0), 0);
            p.averageScore = Math.round(total / p.evaluations.length);
            // Sort inner evaluations by date desc
            p.evaluations.sort((a,b) => b.parsedDate.getTime() - a.parsedDate.getTime());
            return p;
        });
    }, [filteredData]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch stores
                const storesSnap = await getDocs(collection(db, "stores"));
                const storesList = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
                setStores(storesList);

                // Fetch auditors
                const usersSnap = await getDocs(collection(db, "users"));
                const auditorsList = usersSnap.docs
                    .map(d => d.data() as UserProfile)
                    .filter(u => u.role === "denetmen" || u.role === "admin");
                setAuditors(auditorsList);

                // Fetch evaluations
                // Ordering by createdAt desc if possible, otherwise we sort in memory
                const evalsQuery = query(collection(db, "personnel_evaluations"));
                const evalsSnap = await getDocs(evalsQuery);
                const evalsList = evalsSnap.docs.map(d => {
                    const data = d.data() as PersonnelEvaluation;
                    const parsedDate = data.createdAt.toDate();
                    return {
                        ...data,
                        id: d.id,
                        parsedDate,
                        formattedDate: parsedDate.toLocaleDateString("tr-TR")
                    };
                }).sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

                setEvaluations(evalsList);
            } catch (error) {
                console.error("Data loading error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        let result = [...evaluations];

        if (dateRange.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            result = result.filter(e => e.parsedDate >= from);
        }
        if (dateRange.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter(e => e.parsedDate <= to);
        }

        if (selectedStore !== "all") {
            result = result.filter(e => e.storeId === selectedStore);
        }

        if (selectedAuditor !== "all") {
            result = result.filter(e => e.auditorId === selectedAuditor);
        }

        setFilteredData(result);
    }, [evaluations, dateRange, selectedStore, selectedAuditor]);

    const handleExport = () => {
        const dataToExport = filteredData.map(row => ({
            "Tarih": row.formattedDate,
            "Mağaza": row.storeName || "-",
            "Personel Adı": row.personnelName,
            "Puan": row.score?.toString() || "-",
            "Yorum": row.comment || "-",
            "Değerlendiren": row.auditorName || "-"
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Personel Değerlendirmeleri");
        XLSX.writeFile(wb, "Personel_Degerlendirmeleri.xlsx");
    };

    const openStatusModal = async (row: EvaluationRow) => {
        setSelectedPersonnelId(row.personnelId);
        setSelectedPersonnelName(row.personnelName);
        setSelectedPersonnelStoreId(row.storeId);
        setNewStatus("active");
        setTargetStoreId("none");
        setIsStatusModalOpen(true);
        try {
            const docSnap = await getDoc(doc(db, "store_personnel", row.personnelId));
            if (docSnap.exists()){
                const data = docSnap.data() as StorePersonnel;
                setNewStatus(data.status);
                setTargetStoreId(data.targetStoreId || "none");
            }
        } catch (e) { console.error(e) }
    };

    const handleUpdateStatus = async () => {
        if (!selectedPersonnelId) return;
        setUpdatingStatus(true);
        try {
            const now = Timestamp.now();
            const updateData: any = { status: newStatus, updatedAt: now };
            if (newStatus === "transferred" && targetStoreId !== "none") {
                updateData.storeId = targetStoreId;
                updateData.targetStoreId = targetStoreId;
                updateData.status = "active"; // They become active in the new store
            }
            await updateDoc(doc(db, "store_personnel", selectedPersonnelId), updateData);
            toast.success("Personel durumu başarıyla güncellendi.");
            setIsStatusModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Durum güncellenirken bir hata oluştu.");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const columns: ColumnDef<EvaluationRow>[] = [
        {
            accessorKey: "formattedDate",
            header: "Tarih",
            meta: { title: "Tarih" },
            cell: ({ row }) => <div className="font-medium text-sm">{row.original.formattedDate}</div>
        },
        {
            accessorKey: "storeName",
            header: "Mağaza",
            meta: { title: "Mağaza" },
            cell: ({ row }) => <div className="font-medium">{row.original.storeName || "-"}</div>
        },
        {
            accessorKey: "personnelName",
            header: "Personel",
            meta: { title: "Personel" },
            cell: ({ row }) => <div className="font-bold">{row.original.personnelName}</div>
        },
        {
            accessorKey: "score",
            header: () => <div className="text-center">Puan</div>,
            meta: { title: "Puan" },
            cell: ({ row }) => {
                const score = row.original.score;
                if (score === undefined || score === null) return <div className="text-center">-</div>;
                
                let color = "bg-green-500";
                if (score < 50) color = "bg-red-500";
                else if (score < 80) color = "bg-amber-500";
                else if (score < 90) color = "bg-blue-500";

                return (
                    <div className="flex justify-center">
                        <Badge className={cn("text-white font-mono min-w-[3rem] justify-center", color)}>
                            {score}
                        </Badge>
                    </div>
                );
            }
        },
        {
            accessorKey: "comment",
            header: "Yorum",
            meta: { title: "Yorum" },
            cell: ({ row }) => (
                <div className="max-w-[400px] whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {row.original.comment || <span className="italic opacity-50">Yorum yapılmadı</span>}
                </div>
            )
        },
        {
            accessorKey: "auditorName",
            header: "Denetmen",
            meta: { title: "Denetmen" },
            cell: ({ row }) => <div className="text-sm">{row.original.auditorName || "-"}</div>
        },
    ];

    const personnelColumns: ColumnDef<any>[] = [
        {
            accessorKey: "personnelName",
            header: "Personel Adı",
            cell: ({ row }) => <div className="font-bold">{row.original.personnelName}</div>
        },
        {
            accessorKey: "storeName",
            header: "Son Çalıştığı Mağaza",
            cell: ({ row }) => <div className="font-medium text-muted-foreground">{row.original.storeName || "-"}</div>
        },
        {
            accessorKey: "averageScore",
            header: () => <div className="text-center">Ortalama Puan</div>,
            cell: ({ row }) => {
                const score = row.original.averageScore;
                if (score === undefined || score === null) return <div className="text-center">-</div>;
                
                let color = "bg-green-500";
                if (score < 50) color = "bg-red-500";
                else if (score < 80) color = "bg-amber-500";
                else if (score < 90) color = "bg-blue-500";

                return (
                    <div className="flex justify-center">
                        <Badge className={cn("text-white font-mono min-w-[3rem] justify-center", color)}>
                            {score}
                        </Badge>
                    </div>
                );
            }
        },
        {
            id: "history",
            header: () => <div className="text-center">Geçmiş</div>,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                            setHistoryPersonnelName(row.original.personnelName);
                            setSelectedPersonnelHistory(row.original.evaluations);
                            setIsHistoryModalOpen(true);
                        }} 
                        className="gap-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                    >
                        <Eye className="w-4 h-4" />
                        Görüntüle
                    </Button>
                </div>
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openStatusModal(row.original)} className="gap-2 text-muted-foreground hover:text-foreground">
                        <Settings2 className="w-4 h-4" />
                        Aksiyon
                    </Button>
                </div>
            )
        }
    ];

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Personel Değerlendirme Raporu</h1>
                <p className="text-muted-foreground">Sahadaki denetmenler tarafından personellere verilen bağımsız puan ve yorumların raporu.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Değerlendirmeler</CardTitle>
                            <CardDescription>Tarih, mağaza veya denetmene göre filtreleyin.</CardDescription>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-2">
                            <DateRangePicker value={dateRange} onChange={setDateRange} />
                            
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Tüm Mağazalar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Mağazalar</SelectItem>
                                    {stores.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Tüm Denetmenler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Denetmenler</SelectItem>
                                    {auditors.map(a => (
                                        <SelectItem key={a.uid} value={a.uid}>{a.displayName || a.firstName + ' ' + a.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="evaluations" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6 max-w-[400px]">
                            <TabsTrigger value="evaluations">Değerlendirmeler</TabsTrigger>
                            <TabsTrigger value="personnel">Personeller</TabsTrigger>
                        </TabsList>

                        <TabsContent value="evaluations" className="focus-visible:outline-none focus-visible:ring-0">
                            <DataTable
                                columns={columns}
                                data={filteredData}
                                searchKey="personnelName"
                                searchPlaceholder="Personel ara..."
                                pageSizeOptions={[10, 20, 50, 100]}
                                defaultPageSize={20}
                                toolbar={
                                    <div className="flex w-full">
                                        <Button variant="outline" onClick={handleExport} className="ml-auto gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel İndir
                                        </Button>
                                    </div>
                                }
                            />
                        </TabsContent>

                        <TabsContent value="personnel" className="focus-visible:outline-none focus-visible:ring-0">
                            <DataTable
                                columns={personnelColumns}
                                data={personnelGrouped}
                                searchKey="personnelName"
                                searchPlaceholder="Personel ara..."
                                pageSizeOptions={[10, 20, 50, 100]}
                                defaultPageSize={20}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Personel Durumunu Güncelle</DialogTitle>
                        <DialogDescription>
                            <span className="font-bold text-foreground">{selectedPersonnelName}</span> adlı personelin durumunu değiştirin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Durum Bildirimi</Label>
                            <Select value={newStatus} onValueChange={(val: any) => setNewStatus(val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Durum seç" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Mağazada Çalışıyor</SelectItem>
                                    <SelectItem value="resigned">İşten Ayrıldı</SelectItem>
                                    <SelectItem value="transferred">Başka Mağazaya Geçti</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newStatus === "transferred" && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label>Gittiği Mağaza</Label>
                                <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mağaza Seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" disabled>Lütfen Mağaza Seçin</SelectItem>
                                        {stores.filter(s => s.id !== selectedPersonnelStoreId).map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>İptal</Button>
                        <Button 
                            onClick={handleUpdateStatus} 
                            disabled={updatingStatus || (newStatus === "transferred" && targetStoreId === "none")}
                            className="bg-primary text-primary-foreground"
                        >
                            {updatingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{historyPersonnelName} - Değerlendirme Geçmişi</DialogTitle>
                        <DialogDescription>
                            Personelin aldığı tüm değerlendirmeler ve yorumlar.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                        <div className="space-y-4">
                            {selectedPersonnelHistory.length === 0 ? (
                                <p className="text-center text-muted-foreground">Değerlendirme bulunamadı.</p>
                            ) : (
                                selectedPersonnelHistory.map((ev, i) => {
                                    let color = "bg-green-500";
                                    if ((ev.score || 0) < 50) color = "bg-red-500";
                                    else if ((ev.score || 0) < 80) color = "bg-amber-500";
                                    else if ((ev.score || 0) < 90) color = "bg-blue-500";

                                    return (
                                        <Card key={i} className="bg-slate-50 dark:bg-slate-900/50">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 pb-2">
                                                <div>
                                                    <CardTitle className="text-sm font-medium">{ev.formattedDate}</CardTitle>
                                                    <CardDescription className="text-xs mt-1">{ev.storeName} - {ev.auditorName}</CardDescription>
                                                </div>
                                                <Badge className={cn("text-white font-mono min-w-[3rem] justify-center", color)}>
                                                    {ev.score ?? "-"}
                                                </Badge>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4">
                                                <p className="text-sm text-foreground whitespace-pre-wrap">
                                                    {ev.comment || <span className="italic opacity-50">Yorum girilmemiş.</span>}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
