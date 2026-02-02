"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar as CalendarIcon, Download, Loader2, Filter, FileSpreadsheet, Briefcase, Home, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, LeaveType, AccommodationType } from "@/lib/types";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Interface for fetched schedule items
interface ScheduleItem {
    id: string;
    auditorId: string;
    auditorName?: string; // Enriched
    storeId?: string;
    storeName: string;
    date: Date;
    type?: 'audit' | 'leave' | 'blocked';
    leaveTypeId?: string;
    leaveTypeName?: string; // Enriched
    note?: string;
    accommodationTypeId?: string | null;
    accommodationTypeName?: string; // Enriched
    status: 'draft' | 'published';
}

export default function AuditorTimesheetPage() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

    // Filters
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [selectedAuditor, setSelectedAuditor] = useState<string>("all");
    const [showDrafts, setShowDrafts] = useState(false);

    // Reference Data
    const [auditors, setAuditors] = useState<UserProfile[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>([]);

    // Init Data Loading
    useEffect(() => {
        const fetchRefData = async () => {
            try {
                // Fetch Auditors
                const auditorsQuery = query(collection(db, "users"), where("role", "==", "denetmen"));
                const auditorsSnap = await getDocs(auditorsQuery);
                const auditorsList = auditorsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
                setAuditors(auditorsList);

                // Fetch Leave Types
                const leaveSnap = await getDocs(collection(db, "leave_types"));
                const leaveList = leaveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveType));
                setLeaveTypes(leaveList);

                // Fetch Accommodation Types
                const accSnap = await getDocs(collection(db, "accommodation_types"));
                const accList = accSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccommodationType));
                setAccommodationTypes(accList);
            } catch (error) {
                console.error("Error fetching reference data:", error);
                toast.error("Referans veriler yüklenirken hata oluştu.");
            }
        };

        if (userProfile?.role === "admin") {
            fetchRefData();
        }
    }, [userProfile]);

    // Fetch Report Data
    useEffect(() => {
        const fetchData = async () => {
            if (!userProfile || !dateRange.from || !dateRange.to) return;

            setLoading(true);
            try {
                // First get all schedules within date range
                // Convert dates to Timestamps for query
                const start = Timestamp.fromDate(new Date(dateRange.from.setHours(0, 0, 0, 0)));
                const end = Timestamp.fromDate(new Date(dateRange.to.setHours(23, 59, 59, 999)));

                const q = query(
                    collection(db, "audit_schedules"),
                    where("date", ">=", start),
                    where("date", "<=", end)
                );

                const snapshot = await getDocs(q);

                let items = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        date: data.date.toDate(),
                    } as ScheduleItem;
                });

                // Filter for Published only (unless showDrafts is true)
                if (!showDrafts) {
                    items = items.filter(item => item.status === 'published');
                }

                // Filter by Auditor
                if (selectedAuditor !== "all") {
                    items = items.filter(item => item.auditorId === selectedAuditor);
                }

                // Sort by Date then Auditor
                items.sort((a, b) => a.date.getTime() - b.date.getTime());

                // Enrich Data
                const enrichedItems = items.map(item => {
                    const auditor = auditors.find(a => a.uid === item.auditorId);
                    const leaveType = item.leaveTypeId ? leaveTypes.find(l => l.id === item.leaveTypeId) : null;
                    const accType = item.accommodationTypeId ? accommodationTypes.find(a => a.id === item.accommodationTypeId) : null;

                    return {
                        ...item,
                        auditorName: auditor ? `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim() || auditor.displayName || item.auditorId : item.auditorId,
                        leaveTypeName: leaveType?.name,
                        accommodationTypeName: accType?.name
                    };
                });

                // Group by Date and Auditor
                const groupedItems: ScheduleItem[] = [];
                enrichedItems.forEach(item => {
                    const existingItemIndex = groupedItems.findIndex(g =>
                        isSameDay(g.date, item.date) && g.auditorId === item.auditorId
                    );

                    if (existingItemIndex > -1) {
                        // Merge with existing item
                        const existing = groupedItems[existingItemIndex];

                        // If it's another audit store, append name
                        if (item.type !== 'leave' && existing.type !== 'leave') {
                            existing.storeName = `${existing.storeName} - ${item.storeName}`;
                        } else if (item.type === 'leave' && existing.type === 'leave') {
                            existing.leaveTypeName = `${existing.leaveTypeName} - ${item.leaveTypeName}`;
                        }

                        // Merge accommodation
                        if (!existing.accommodationTypeName && item.accommodationTypeName) {
                            existing.accommodationTypeName = item.accommodationTypeName;
                        }

                        // If any is draft in the group, showing mixed status is tricky. 
                        // But usually grouped items have same status if set by day.
                        // Let's keep status of the first found item or if any is published, mark published?
                        // For now, simple merge.

                        groupedItems[existingItemIndex] = existing;
                    } else {
                        groupedItems.push({ ...item }); // push clone
                    }
                });

                setScheduleItems(groupedItems);
            } catch (error) {
                console.error("Error fetching report data:", error);
                toast.error("Rapor verisi alınamadı.");
            } finally {
                setLoading(false);
            }
        };

        // Only fetch if we have ref data loaded (to enrich)
        if (auditors.length > 0) {
            fetchData();
        }
    }, [dateRange, selectedAuditor, showDrafts, auditors, leaveTypes, accommodationTypes, userProfile]);

    // Calculate Stats
    const stats = useMemo(() => {
        let totalAudits = 0;
        const accommodationCounts: Record<string, number> = {};
        const leaveCounts: Record<string, number> = {};

        scheduleItems.forEach(item => {
            // Count Audits
            if (item.type !== 'leave' && item.type !== 'blocked') {
                const storeCount = item.storeName.split(' - ').length;
                totalAudits += storeCount;
            }

            // Count Leaves
            if (item.type === 'leave' && item.leaveTypeName) {
                item.leaveTypeName.split(' - ').forEach(lType => {
                    leaveCounts[lType] = (leaveCounts[lType] || 0) + 1;
                });
            }

            // Count Accommodations
            if (item.accommodationTypeName) {
                accommodationCounts[item.accommodationTypeName] = (accommodationCounts[item.accommodationTypeName] || 0) + 1;
            }
        });

        return { totalAudits, accommodationCounts, leaveCounts };
    }, [scheduleItems]);


    const exportToExcel = () => {
        if (scheduleItems.length === 0) {
            toast.error("Dışa aktarılacak veri yok.");
            return;
        }

        const exportData = scheduleItems.map(item => ({
            "Tarih": format(item.date, "dd.MM.yyyy"),
            "Denetmen": item.auditorName,
            "Faaliyet / Mağaza": item.type === 'leave' ? (item.leaveTypeName || "İzin") : item.storeName,
            "Konaklama": item.accommodationTypeName || "",
            "Durum": item.status === 'published' ? 'Yayınlandı' : 'Taslak'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Puantaj");

        // Column widths
        const wscols = [
            { wch: 12 }, // Date
            { wch: 20 }, // Auditor
            { wch: 40 }, // Activity
            { wch: 15 }, // Accommodation
            { wch: 12 }  // Status
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `Denetmen_Puantaj_Raporu_${format(new Date(), "yyyyMMdd")}.xlsx`);
        toast.success("Excel dosyası indirildi.");
    };

    return (
        <>
            <div className="container mx-auto py-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Denetmen Puantaj Raporu</h1>
                    <p className="text-muted-foreground mt-1">
                        Denetmenlerin mağaza ziyaretlerini, izinlerini ve konaklamalarını tarih bazlı görüntüleyin.
                    </p>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <CardTitle>Puantaj Listesi</CardTitle>
                                <CardDescription>
                                    Seçili kriterlere göre {scheduleItems.length} kayıt listeleniyor. (Gün bazlı gruplanmış)
                                </CardDescription>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto">
                                {/* Start Date Mixer */}
                                <div className="grid gap-2 w-full sm:w-auto">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full sm:w-[150px] justify-start text-left font-normal",
                                                    !dateRange.from && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateRange.from ? (
                                                    format(dateRange.from, "d MMM y", { locale: tr })
                                                ) : (
                                                    <span>Başlangıç</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={dateRange.from}
                                                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                                initialFocus
                                                locale={tr}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* End Date Picker */}
                                <div className="grid gap-2 w-full sm:w-auto">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full sm:w-[150px] justify-start text-left font-normal",
                                                    !dateRange.to && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateRange.to ? (
                                                    format(dateRange.to, "d MMM y", { locale: tr })
                                                ) : (
                                                    <span>Bitiş</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={dateRange.to}
                                                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                                initialFocus
                                                locale={tr}
                                                disabled={(date) => dateRange.from ? date < dateRange.from : false}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Auditor Selector */}
                                <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder="Denetmen Seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Denetmenler</SelectItem>
                                        {auditors.map(auditor => (
                                            <SelectItem key={auditor.uid} value={auditor.uid}>
                                                {auditor.firstName} {auditor.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Show Drafts Toggle */}
                                <div className="flex items-center space-x-2 border rounded-md px-3 py-2 bg-slate-50">
                                    <Checkbox
                                        id="show-drafts"
                                        checked={showDrafts}
                                        onCheckedChange={(c) => setShowDrafts(!!c)}
                                    />
                                    <Label htmlFor="show-drafts" className="text-sm cursor-pointer whitespace-nowrap">
                                        Taslakları Dahil Et
                                    </Label>
                                </div>

                                {/* Reset Filter Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setDateRange({
                                            from: startOfMonth(new Date()),
                                            to: endOfMonth(new Date()),
                                        });
                                        setSelectedAuditor("all");
                                        setShowDrafts(false);
                                    }}
                                    className="shrink-0"
                                    title="Filtreleri Sıfırla"
                                >
                                    <Filter className="h-4 w-4" />
                                </Button>

                                {/* Excel Export Button */}
                                <Button onClick={exportToExcel} variant="secondary" className="gap-2 w-full sm:w-auto bg-green-50 text-green-700 hover:bg-green-100 border-green-200 border ml-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Excel
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Summary Stats */}
                    {!loading && scheduleItems.length > 0 && (
                        <div className="px-6 pb-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Total Audits */}
                                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Briefcase className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium text-muted-foreground">Toplam Denetim</span>
                                    </div>
                                    <div className="text-2xl font-bold">{stats.totalAudits}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Mağaza ziyareti</p>
                                </div>

                                {/* Accommodation Breakdown */}
                                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Home className="h-4 w-4 text-purple-600" />
                                        <span className="text-sm font-medium text-muted-foreground">Konaklama Durumu</span>
                                    </div>
                                    {Object.keys(stats.accommodationCounts).length > 0 ? (
                                        <div className="space-y-1">
                                            {Object.entries(stats.accommodationCounts).map(([type, count]) => (
                                                <div key={type} className="flex justify-between text-sm">
                                                    <span>{type}:</span>
                                                    <span className="font-semibold">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground italic">Konaklama yok</div>
                                    )}
                                </div>

                                {/* Leave Breakdown */}
                                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarDays className="h-4 w-4 text-orange-600" />
                                        <span className="text-sm font-medium text-muted-foreground">İzin Kullanımı</span>
                                    </div>
                                    {Object.keys(stats.leaveCounts).length > 0 ? (
                                        <div className="space-y-1">
                                            {Object.entries(stats.leaveCounts).map(([type, count]) => (
                                                <div key={type} className="flex justify-between text-sm">
                                                    <span>{type}:</span>
                                                    <span className="font-semibold">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground italic">İzin yok</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : scheduleItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <Filter className="h-12 w-12 mb-2 opacity-20" />
                                <p>Bu kriterlere uygun kayıt bulunamadı.</p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-1/4 text-center">Tarih</TableHead>
                                            <TableHead className="w-1/4 text-center">Denetmen</TableHead>
                                            <TableHead className="w-1/4 text-center">Faaliyet / Mağaza</TableHead>
                                            <TableHead className="w-1/4 text-center">Konaklama</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {scheduleItems.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-muted/50">
                                                <TableCell className="font-medium whitespace-nowrap text-center">
                                                    {format(item.date, "dd.MM.yyyy")}
                                                </TableCell>
                                                <TableCell className="font-medium text-center">
                                                    {item.auditorName}
                                                </TableCell>

                                                <TableCell className="text-center">
                                                    {item.type === 'leave' ? (
                                                        <span className="font-semibold text-slate-700">{item.leaveTypeName || "İzin"}</span>
                                                    ) : (
                                                        <span className="font-semibold text-slate-900">{item.storeName}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.accommodationTypeName ? (
                                                        <div className="flex items-center justify-center gap-1.5 text-blue-600 font-medium text-xs bg-blue-50 px-2 py-1 rounded-full w-fit mx-auto">
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 h-5 px-1.5">Konaklama</Badge>
                                                            {item.accommodationTypeName}
                                                        </div>
                                                    ) : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
