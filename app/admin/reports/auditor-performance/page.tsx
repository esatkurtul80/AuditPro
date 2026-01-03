"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    Cell,
    LabelList,
    LineChart,
    Line
} from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, UserProfile, Section, Store, AuditType } from "@/lib/types";
import { Loader2, AlertTriangle, Clock, PlayCircle, FileDown, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { DateRangeFilter } from "@/lib/types";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for our calculated metrics
interface HawkDoveMetric {
    name: string;
    score: number; // Average score
    auditCount: number;
    role: "Yumuşak" | "Normal" | "Sert";
}

type ReportAudit = Audit & { date?: Date };

interface DurationMetric {
    duration: number; // minutes
    score: number;
    auditor: string;
    status: "Şüpheli" | "Normal";
    auditId: string;
    storeName: string;
    date: Date;
    startDate?: Date;  // Denetim başlangıç zamanı
    endDate?: Date;    // Denetim bitiş zamanı
    auditType: string;
    auditTypeName?: string; // Form Type
    suspiciousAnswerCount?: number;
    validAnswersCount?: number;
    sections: {
        name: string;
        answers: {
            text: string;
            duration: number;
            score: number;
        }[];
    }[];
}

interface DeviationMetric {
    category: string;
    [auditorName: string]: number | string; // Dynamic keys for auditors
}

interface AuditorStat {
    uid: string;
    name: string;
    email?: string;
    photoURL?: string | null;
    totalAudits: number;
    avgDuration: number;
    avgScore: number;
    audits: DurationMetric[];
}

interface StoreStat {
    id: string;
    name: string;
    totalAudits: number;
    avgDuration: number;
    avgScore: number;
}

interface MonthlyScore {
    month: number; // 0-11 (Ocak-Aralık)
    monthName: string;
    avgScore: number;
    auditCount: number;
}

// Export fonksiyonları
const exportToExcel = (data: QuestionDetail[], storeName: string, auditorName: string, date: string) => {
    // Veriyi Excel formatına uygun şekilde düzenle
    const excelData = data.map(item => ({
        'Bölüm': item.sectionName,
        'Soru': item.text,
        'Süre (sn)': item.duration.toFixed(1),
        'Puan': item.score
    }));

    // Worksheet oluştur
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sorular");

    // Dosyayı indir - Yeni format: MAĞAZA - DENETMEN TARİH Tarihli mağaza denetimi
    const fileName = `${storeName} - ${auditorName} ${date} Tarihli mağaza denetimi.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

const exportToPDF = async (
    data: QuestionDetail[],
    storeName: string,
    auditorName: string,
    date: string,
    durationMinutes: number,
    startTime?: Date,
    endTime?: Date
) => {
    const doc = new jsPDF();

    try {
        // Roboto Regular ve Bold fontlarını yükle
        const [regularResponse, boldResponse] = await Promise.all([
            fetch('/fonts/Roboto-Regular.ttf'),
            fetch('/fonts/Roboto-Bold.ttf')
        ]);

        const regularBlob = await regularResponse.blob();
        const boldBlob = await boldResponse.blob();

        // Regular font yükle
        const regularReader = new FileReader();
        await new Promise((resolve) => {
            regularReader.onloadend = () => {
                const base64Font = (regularReader.result as string).split(',')[1];
                doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
                doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                resolve(null);
            };
            regularReader.readAsDataURL(regularBlob);
        });

        // Bold font yükle
        const boldReader = new FileReader();
        await new Promise((resolve) => {
            boldReader.onloadend = () => {
                const base64Font = (boldReader.result as string).split(',')[1];
                doc.addFileToVFS('Roboto-Bold.ttf', base64Font);
                doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
                resolve(null);
            };
            boldReader.readAsDataURL(boldBlob);
        });

    } catch (error) {
        console.error('Font yükleme hatası:', error);
        // Hata durumunda times fontuna geri dön
        doc.setFont('times', 'normal');
    }

    // Toplam süreyi saat:dakika formatına çevir
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.floor(durationMinutes % 60);
    const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} dk`;

    // Başlangıç ve bitiş saatlerini formatla
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    // Başlık - Mağaza ve Tarih (Roboto Bold)
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text(`${storeName} - ${date}`, 14, 15);

    // Normal font'a geri dön
    doc.setFont('Roboto', 'normal');

    // Denetim bilgileri tablosu - 4 sütun 2 satır (başlık + değer)
    const infoTableBody: string[][] = [];

    const startTimeStr = (startTime && startTime instanceof Date && !isNaN(startTime.getTime()))
        ? formatTime(startTime)
        : '-';

    const endTimeStr = (endTime && endTime instanceof Date && !isNaN(endTime.getTime()))
        ? formatTime(endTime)
        : '-';

    infoTableBody.push([auditorName, startTimeStr, endTimeStr, formattedDuration]);

    autoTable(doc, {
        head: [['Denetmen Adı', 'Denetim Başlangıç Saati', 'Denetim Bitiş Saati', 'Toplam Denetim Süresi']],
        body: infoTableBody,
        startY: 20,
        theme: 'grid',
        styles: {
            font: 'Roboto',
            fontSize: 9,
            cellPadding: 3,
            halign: 'center',
            fontStyle: 'normal'
        },
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        margin: { left: 14, right: 14 }
    });

    // Bilgi tablosundan sonra pozisyon
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    const tableStartY = finalY + 5;

    autoTable(doc, {
        head: [['Bölüm', 'Soru', 'Süre (sn)', 'Puan']],
        body: data.map(item => [
            item.sectionName,
            item.text,
            item.duration.toFixed(1),
            item.score.toString()
        ]),
        startY: tableStartY,
        styles: {
            font: 'Roboto',
            fontSize: 9,
            cellPadding: 3
        },
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        margin: { top: tableStartY },
        didParseCell: function (data) {
            data.cell.styles.font = 'Roboto';
        }
    });

    // Dosyayı indir - Yeni format: MAĞAZA - DENETMEN TARİH Tarihli mağaza denetimi
    const fileName = `${storeName} - ${auditorName} ${date} Tarihli mağaza denetimi.pdf`;
    doc.save(fileName);
};

// Types for Question Details
interface QuestionDetail {
    sectionName: string;
    text: string;
    duration: number;
    score: number;
}

// Column definitions for Question Details DataTable
const questionDetailsColumns: ColumnDef<QuestionDetail>[] = [
    {
        accessorKey: "sectionName",
        header: "Bölüm",
        cell: ({ row }) => <div className="font-semibold whitespace-normal break-words">{row.original.sectionName}</div>,
        meta: { title: "Bölüm" },
        size: 150
    },
    {
        accessorKey: "text",
        header: "Soru",
        cell: ({ row }) => <div className="font-medium whitespace-normal break-words">{row.original.text}</div>,
        meta: { title: "Soru" },
        size: 500
    },
    {
        accessorKey: "duration",
        header: () => <div className="text-right">Süre (sn)</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <span className={(row.original.duration || 0) < 5 ? "text-red-500 font-bold" : "text-muted-foreground font-mono"}>
                    {(row.original.duration || 0).toFixed(1)} sn
                </span>
            </div>
        ),
        meta: { title: "Süre (sn)" },
        size: 120
    },
    {
        accessorKey: "score",
        header: () => <div className="text-right">Puan</div>,
        cell: ({ row }) => <div className="text-right font-mono">{row.original.score || 0}</div>,
        meta: { title: "Puan" },
        size: 100
    }
];

// Column definitions for Audit History DataTable
const auditHistoryColumns: ColumnDef<DurationMetric>[] = [
    {
        accessorKey: "date",
        header: "Tarih",
        cell: ({ row }) => row.original.date.toLocaleDateString('tr-TR'),
        meta: { title: "Tarih" }
    },
    {
        accessorKey: "storeName",
        header: "Mağaza",
        meta: { title: "Mağaza" }
    },
    {
        accessorKey: "auditTypeName",
        header: "Denetim Form Türü",
        cell: ({ row }) => row.original.auditTypeName || row.original.auditType,
        meta: { title: "Denetim Form Türü" }
    },
    {
        id: "suspiciousActivity",
        header: () => <div className="text-center">Şüpheli İşlem</div>,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80">
                    {row.original.suspiciousAnswerCount || 0} / {row.original.validAnswersCount || 0} Şüpheli
                </div>
            </div>
        ),
        meta: { title: "Şüpheli İşlem" }
    },
    {
        accessorKey: "duration",
        header: () => <div className="text-right">Süre (dk)</div>,
        cell: ({ row }) => <div className="text-right">{(row.original.duration || 0).toFixed(1)}</div>,
        meta: { title: "Süre (dk)" }
    },
    {
        accessorKey: "score",
        header: () => <div className="text-right">Puan</div>,
        cell: ({ row }) => <div className="text-right">{(row.original.score || 0).toFixed(0)}</div>,
        meta: { title: "Puan" }
    },
    {
        id: "actions",
        header: () => <div></div>,
        cell: ({ row }) => {
            const audit = row.original;

            // Flatten all questions from all sections into a single array
            const allQuestions: QuestionDetail[] = audit.sections.flatMap(sec =>
                sec.answers.map(ans => ({
                    sectionName: sec.name || 'Bölüm Yok',
                    text: ans.text,
                    duration: ans.duration,
                    score: ans.score
                }))
            );

            return (
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="sm">Soru Detayı</Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-3xl overflow-hidden flex flex-col gap-4 p-6">
                        <SheetHeader className="flex-shrink-0">
                            <SheetTitle>Soru Bazlı Süre Analizi</SheetTitle>
                            <SheetDescription>
                                {audit.storeName} - {audit.date.toLocaleDateString('tr-TR')}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 overflow-auto min-h-0">
                            <DataTable
                                columns={questionDetailsColumns}
                                data={allQuestions}
                                searchKey="text"
                                searchPlaceholder="Soru ara..."
                                toolbar={
                                    <div className="flex gap-2 ml-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportToPDF(
                                                allQuestions,
                                                audit.storeName,
                                                audit.auditor,
                                                audit.date.toLocaleDateString('tr-TR'),
                                                audit.duration || 0,
                                                audit.startDate,
                                                audit.endDate
                                            )}
                                            className="gap-2 bg-red-500 text-white border-red-600 hover:bg-red-600"
                                        >
                                            <FileDown className="h-4 w-4" />
                                            PDF
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportToExcel(
                                                allQuestions,
                                                audit.storeName,
                                                audit.auditor,
                                                audit.date.toLocaleDateString('tr-TR')
                                            )}
                                            className="gap-2 bg-green-600 text-white border-green-700 hover:bg-green-700"
                                        >
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel
                                        </Button>
                                    </div>
                                }
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            );
        },
        enableSorting: false,
        enableHiding: false,
        meta: { title: "İşlemler" }
    }
];

export default function AuditorPerformancePage() {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({
        from: undefined,
        to: undefined,
    });
    const [hawkDoveData, setHawkDoveData] = useState<HawkDoveMetric[]>([]);
    const [durationData, setDurationData] = useState<DurationMetric[]>([]);
    const [deviationData, setDeviationData] = useState<DeviationMetric[]>([]);
    const [globalAverage, setGlobalAverage] = useState(0);
    const [auditorNames, setAuditorNames] = useState<string[]>([]);

    // Raw data state (to allow refiltering without refetching)
    const [allAudits, setAllAudits] = useState<ReportAudit[]>([]);
    const [auditors, setAuditors] = useState<UserProfile[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [auditorMap, setAuditorMap] = useState<Record<string, string>>({});
    const [storeMap, setStoreMap] = useState<Record<string, string>>({});
    const [sectionMap, setSectionMap] = useState<Record<string, string>>({});

    // New Stats
    const [auditorStats, setAuditorStats] = useState<AuditorStat[]>([]);
    const [storeStats, setStoreStats] = useState<StoreStat[]>([]);

    // Dialog State
    const [selectedAuditor, setSelectedAuditor] = useState<AuditorStat | null>(null);

    // Aylık görünüm state'leri
    const [monthlyDialogOpen, setMonthlyDialogOpen] = useState(false);
    const [selectedAuditorForMonthly, setSelectedAuditorForMonthly] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [monthlyData, setMonthlyData] = useState<MonthlyScore[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    // Re-process data when dateRange changes
    useEffect(() => {
        if (!loading && allAudits.length > 0) {
            processAudits(allAudits);
        }
    }, [dateRange]);

    const loadData = async () => {
        try {
            // 1. Fetch Auditors (role = 'denetmen')
            const usersQuery = query(collection(db, "users"), where("role", "==", "denetmen"));
            const usersSnapshot = await getDocs(usersQuery);
            const fetchedAuditors = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
            setAuditors(fetchedAuditors);

            // Map auditor ID to Name
            const aMap: Record<string, string> = {};
            fetchedAuditors.forEach(a => {
                let name = a.displayName || a.email || "Bilinmeyen";
                if (a.firstName && a.lastName) {
                    name = `${a.firstName} ${a.lastName}`;
                }
                aMap[a.uid] = name;
            });
            setAuditorNames(Object.values(aMap));
            setAuditorMap(aMap);

            // 2. Fetch Sections (for categories) and Stores
            const [sectionsSnapshot, storesSnapshot] = await Promise.all([
                getDocs(collection(db, "sections")),
                getDocs(collection(db, "stores"))
            ]);

            const fetchedSections = sectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section));
            setSections(fetchedSections);

            // Create section ID to name map
            const secMap: Record<string, string> = {};
            fetchedSections.forEach(s => secMap[s.id] = s.name);
            setSectionMap(secMap);

            const fetchedStores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Store[];
            setStores(fetchedStores);
            const sMap: Record<string, string> = {};
            fetchedStores.forEach(s => sMap[s.id] = s.name);
            setStoreMap(sMap);

            // 3. Fetch Completed Audits
            const auditsQuery = query(collection(db, "audits"), where("status", "==", "tamamlandi"));
            const auditsSnapshot = await getDocs(auditsQuery);
            const fetchedAudits = auditsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Ensure date object is created if strictly needed here, 
                // though processAudits handles conversion
                date: (doc.data().startedAt as Timestamp)?.toDate()
            })) as ReportAudit[];

            setAllAudits(fetchedAudits);

            // Initial Process
            processAudits(fetchedAudits, aMap, sMap, secMap, fetchedAuditors, fetchedSections, fetchedStores);
            setLoading(false);

        } catch (error) {
            console.error("Error loading auditor report data:", error);
            setLoading(false);
        }
    };



    const formatDuration = (minutes: number) => {
        if (!minutes && minutes !== 0) return "-";
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    // Aylık denetmen puan ortalamalarını hesaplama fonksiyonu
    const calculateMonthlyAuditorScores = (auditorUid: string, year: number): MonthlyScore[] => {
        const monthNames = [
            "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ];

        // Her ay için boş veri yapısı oluştur
        const monthlyScores: MonthlyScore[] = monthNames.map((name, index) => ({
            month: index,
            monthName: name,
            avgScore: 0,
            auditCount: 0
        }));

        // Seçili denetmene ait ve seçili yıla ait denetimleri filtrele
        const auditorAudits = allAudits.filter(audit => {
            if (audit.auditorId !== auditorUid) return false;

            let auditDate = audit.date;
            if (!auditDate && (audit as any).startedAt) {
                auditDate = ((audit as any).startedAt as Timestamp).toDate();
            }

            return auditDate && auditDate.getFullYear() === year;
        });

        // Her denetimi ilgili aya ekle
        auditorAudits.forEach(audit => {
            let auditDate = audit.date;
            if (!auditDate && (audit as any).startedAt) {
                auditDate = ((audit as any).startedAt as Timestamp).toDate();
            }

            if (auditDate) {
                const monthIndex = auditDate.getMonth();
                const score = audit.totalScore || 0;

                monthlyScores[monthIndex].avgScore += score;
                monthlyScores[monthIndex].auditCount += 1;
            }
        });

        // Ortalamaları hesapla
        monthlyScores.forEach(month => {
            if (month.auditCount > 0) {
                month.avgScore = Math.round(month.avgScore / month.auditCount);
            }
        });

        return monthlyScores;
    };

    // Bar'a tıklandığında çağrılacak fonksiyon
    const handleBarClick = (data: any) => {
        if (!data || !data.name) return;

        // Tıklanan denetmenin adını kullanarak UID'sini bul
        const auditor = auditorStats.find(a => a.name === data.name);
        if (!auditor) return;

        // Aylık veriyi hesapla
        const monthly = calculateMonthlyAuditorScores(auditor.uid, selectedYear);
        setMonthlyData(monthly);
        setSelectedAuditorForMonthly(auditor.name);
        setMonthlyDialogOpen(true);
    };

    // Mevcut yılları hesapla (denetimlerin yapıldığı yıllar)
    const getAvailableYears = (): number[] => {
        const years = new Set<number>();
        allAudits.forEach(audit => {
            let auditDate = audit.date;
            if (!auditDate && (audit as any).startedAt) {
                auditDate = ((audit as any).startedAt as Timestamp).toDate();
            }
            if (auditDate) {
                years.add(auditDate.getFullYear());
            }
        });
        return Array.from(years).sort((a, b) => b - a); // Yeni yıldan eskiye sırala
    };

    // Yıl değiştiğinde aylık veriyi yeniden hesapla
    useEffect(() => {
        if (selectedAuditorForMonthly && monthlyDialogOpen) {
            const auditor = auditorStats.find(a => a.name === selectedAuditorForMonthly);
            if (auditor) {
                const monthly = calculateMonthlyAuditorScores(auditor.uid, selectedYear);
                setMonthlyData(monthly);
            }
        }
    }, [selectedYear, auditorStats, selectedAuditorForMonthly, monthlyDialogOpen]);

    const processAudits = (
        auditsToProcess: ReportAudit[],
        currentAuditorMap = auditorMap,
        currentStoreMap = storeMap,
        currentSectionMap = sectionMap,
        currentAuditors = auditors,
        currentSections = sections,
        currentStores = stores
    ) => {
        // Filter by Date Range
        const filteredAudits = auditsToProcess.filter(audit => {
            if (!dateRange.from) return true;

            // Handle Timestamp to Date conversion if needed
            let auditDate = audit.date;
            if (!auditDate && (audit as any).startedAt) {
                auditDate = ((audit as any).startedAt as Timestamp).toDate();
            }
            if (!auditDate) return false;

            const checkDate = new Date(auditDate.getFullYear(), auditDate.getMonth(), auditDate.getDate());
            const startDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());

            if (dateRange.to) {
                const endDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
                return checkDate >= startDate && checkDate <= endDate;
            } else {
                return checkDate >= startDate;
            }
        });

        // A. Global Average & Hawk/Dove Data
        // PRE-CALCULATE QUESTION AVERAGES
        const questionDurations: Record<string, number[]> = {};

        filteredAudits.forEach(audit => {
            audit.sections.forEach(s => {
                s.answers.forEach(a => {
                    if (a.durationSeconds && a.durationSeconds > 0) {
                        const qKey = a.questionId || a.questionText; // Prefer ID if available
                        if (!questionDurations[qKey]) questionDurations[qKey] = [];
                        questionDurations[qKey].push(a.durationSeconds);
                    }
                });
            });
        });

        const questionAverages: Record<string, number> = {};
        Object.entries(questionDurations).forEach(([key, durations]) => {
            if (durations.length > 0) {
                const sum = durations.reduce((a, b) => a + b, 0);
                questionAverages[key] = sum / durations.length;
            }
        });

        let totalScoreSum = 0;
        const auditorAggregates: Record<string, { totalScore: number; totalDuration: number; count: number; audits: DurationMetric[] }> = {};
        const storeAggregates: Record<string, { totalScore: number; totalDuration: number; count: number }> = {};

        // Initialize stats for known auditors
        currentAuditors.forEach(a => {
            auditorAggregates[a.uid] = { totalScore: 0, totalDuration: 0, count: 0, audits: [] };
        });

        // Initialize stats for known stores
        currentStores.forEach(s => {
            storeAggregates[s.id] = { totalScore: 0, totalDuration: 0, count: 0 };
        });

        const durationList: DurationMetric[] = [];

        filteredAudits.forEach(audit => {
            // Handle Timestamp to Date conversion just in case
            let auditDate = audit.date;
            if (!auditDate && (audit as any).startedAt) {
                auditDate = ((audit as any).startedAt as Timestamp).toDate();
            }

            // Determine Auditor Name
            if (!auditorAggregates[audit.auditorId]) {
                // Fallback for deleted/unknown auditors
                auditorAggregates[audit.auditorId] = { totalScore: 0, totalDuration: 0, count: 0, audits: [] };
            }

            // Determine Store Name
            const storeId = audit.storeId;
            if (!storeAggregates[storeId]) {
                storeAggregates[storeId] = { totalScore: 0, totalDuration: 0, count: 0 };
            }

            const currentTotalScore = audit.totalScore || 0;
            totalScoreSum += currentTotalScore;

            // Duration Calculation
            let durationMins = 0;
            if (audit.startedAt && audit.completedAt) {
                const start = (audit.startedAt as Timestamp).toDate();
                const end = (audit.completedAt as Timestamp).toDate();
                const diffMs = end.getTime() - start.getTime();
                durationMins = Math.floor(diffMs / 60000);
            }

            const isSuspicious = (durationMins < 15 && currentTotalScore > 90) || (durationMins < 10);

            // Calculate Suspicious Answers Count
            let suspiciousAnswerCount = 0;
            let validAnswersCount = 0;

            audit.sections.forEach(s => {
                s.answers.forEach(a => {
                    validAnswersCount++;
                    const qKey = a.questionId || a.questionText;
                    const avgDuration = questionAverages[qKey] || 0;
                    // If answer duration is less than average, count as suspicious
                    if (avgDuration > 0 && (a.durationSeconds || 0) < avgDuration) {
                        suspiciousAnswerCount++;
                    }
                });
            });

            const metric: DurationMetric = {
                duration: durationMins,
                score: currentTotalScore,
                auditor: currentAuditorMap[audit.auditorId] || audit.auditorName || "Bilinmeyen",
                status: isSuspicious ? "Şüpheli" : "Normal",
                auditId: audit.id,
                storeName: currentStoreMap[storeId] || audit.storeName || "Bilinmeyen Mağaza",
                date: auditDate || new Date(),
                startDate: audit.startedAt ? (audit.startedAt as Timestamp).toDate() : undefined,
                endDate: audit.completedAt ? (audit.completedAt as Timestamp).toDate() : undefined,
                auditType: audit.auditTypeName || "Standart",
                auditTypeName: audit.auditTypeName,
                suspiciousAnswerCount,
                validAnswersCount,
                sections: audit.sections.map(s => ({
                    name: currentSectionMap[s.sectionId] || s.name || 'Bilinmeyen Bölüm',
                    answers: s.answers.map(a => ({
                        text: a.questionText,
                        duration: a.durationSeconds || 0,
                        score: a.earnedPoints || 0
                    }))
                }))
            };

            durationList.push(metric);

            // Update Auditor Aggregates
            auditorAggregates[audit.auditorId].totalScore += currentTotalScore;
            auditorAggregates[audit.auditorId].totalDuration += durationMins;
            auditorAggregates[audit.auditorId].count += 1;
            auditorAggregates[audit.auditorId].audits.push(metric);

            // Update Store Aggregates
            storeAggregates[storeId].totalScore += currentTotalScore;
            storeAggregates[storeId].totalDuration += durationMins;
            storeAggregates[storeId].count += 1;
        });

        // Hawk/Dove Finalization
        const calculatedGlobalAvg = filteredAudits.length > 0 ? totalScoreSum / filteredAudits.length : 0;
        setGlobalAverage(Math.round(calculatedGlobalAvg));

        const hawkDoveProcessed: HawkDoveMetric[] = Object.entries(auditorAggregates).map(([uid, stats]) => {
            const avg = stats.count > 0 ? stats.totalScore / stats.count : 0;
            let role: "Yumuşak" | "Normal" | "Sert" = "Normal";
            if (avg > calculatedGlobalAvg + 10) role = "Yumuşak";
            else if (avg < calculatedGlobalAvg - 10) role = "Sert";

            return {
                name: currentAuditorMap[uid] || "Bilinmeyen",
                score: Math.round(avg),
                auditCount: stats.count,
                role
            };
        }).filter(d => d.auditCount > 0);
        setHawkDoveData(hawkDoveProcessed);
        setDurationData(durationList);

        // Finalize Auditor Stats for Table
        const finalAuditorStats: AuditorStat[] = Object.entries(auditorAggregates).map(([uid, stats]) => {
            const auditorProfile = currentAuditors.find(a => a.uid === uid);
            return {
                uid,
                name: currentAuditorMap[uid] || "Bilinmeyen",
                email: auditorProfile?.email,
                photoURL: auditorProfile?.photoURL,
                totalAudits: stats.count,
                avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
                avgScore: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
                audits: stats.audits.sort((a, b) => b.date.getTime() - a.date.getTime())
            };
        }).filter(s => s.totalAudits > 0);
        setAuditorStats(finalAuditorStats);

        // Finalize Store Stats for Table
        const finalStoreStats: StoreStat[] = Object.entries(storeAggregates).map(([storeId, stats]) => ({
            id: storeId,
            name: currentStoreMap[storeId] || "Bilinmeyen",
            totalAudits: stats.count,
            avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
            avgScore: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
        })).filter(s => s.totalAudits > 0);
        setStoreStats(finalStoreStats);

        // C. Deviation (Category based) - UNCHANGED LOGIC
        const deviationStats: Record<string, Record<string, { totalPercent: 0, count: 0 }>> = {};

        currentSections.forEach(s => {
            deviationStats[s.id] = {};
            currentAuditors.forEach(a => {
                deviationStats[s.id][a.uid] = { totalPercent: 0, count: 0 };
            });
        });

        filteredAudits.forEach(audit => {
            const auditorId = audit.auditorId;
            if (!currentAuditors.find(a => a.uid === auditorId)) return;

            audit.sections.forEach(sectionRes => {
                if (!deviationStats[sectionRes.sectionId]) return;

                if (!deviationStats[sectionRes.sectionId]) return;

                if (!deviationStats[sectionRes.sectionId][auditorId]) return;

                const sectionScore = sectionRes.answers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0);
                deviationStats[sectionRes.sectionId][auditorId].totalPercent += sectionScore;
                deviationStats[sectionRes.sectionId][auditorId].count += 1;
            });
        });

        const deviationProcessed: DeviationMetric[] = currentSections.map(sec => {
            const row: DeviationMetric = { category: sec.name };
            currentAuditors.forEach(a => {
                const stats = deviationStats[sec.id] ? deviationStats[sec.id][a.uid] : undefined;
                if (stats && stats.count > 0) {
                    const avg = stats.totalPercent / stats.count;
                    row[currentAuditorMap[a.uid]] = isNaN(avg) ? "-" : Math.round(avg);
                } else {
                    row[currentAuditorMap[a.uid]] = "-";
                }
            });
            return row;
        });
        setDeviationData(deviationProcessed);
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Denetçi Performans Sistemleri</h1>
                    <p className="text-muted-foreground mt-2">
                        Denetçi performansını ölçmek ve analiz etmek için geliştirilmiş ekran.
                    </p>
                </div>
                <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                />
            </div>

            <Tabs defaultValue="auditors" className="w-full">

                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="auditors">Denetmen Analizi</TabsTrigger>
                    <TabsTrigger value="stores">Mağaza Süre Analizi</TabsTrigger>
                </TabsList>

                <TabsContent value="auditors" className="space-y-4">
                    {/* Grid Layout for Summary and Chart */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Denetmen Özet Tablosu</CardTitle>
                                <CardDescription>Ortalama denetim süreleri ve puanları</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='[&>div]:rounded-sm [&>div]:border'>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className='hover:bg-transparent'>
                                                <TableHead>Denetmen</TableHead>
                                                <TableHead className="text-center">Top. Denetim</TableHead>
                                                <TableHead className="text-center">Ort. Süre (sa:dk)</TableHead>
                                                <TableHead className="text-center">Ort. Puan</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {auditorStats.map((stat) => (
                                                <TableRow key={stat.uid}>
                                                    <TableCell>
                                                        <div className='flex items-center gap-3'>
                                                            <Avatar>
                                                                <AvatarImage src={stat.photoURL || undefined} alt={stat.name} />
                                                                <AvatarFallback className='text-xs'>{stat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className='font-medium'>{stat.name}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">{stat.totalAudits}</TableCell>
                                                    <TableCell className="text-center">{formatDuration(stat.avgDuration)}</TableCell>
                                                    <TableCell className="text-center">{(stat.avgScore || 0).toFixed(0)}</TableCell>
                                                    <TableCell>
                                                        <Sheet>
                                                            <SheetTrigger asChild>
                                                                <Button variant="ghost" size="sm">Detay</Button>
                                                            </SheetTrigger>
                                                            <SheetContent side="right" className="w-full sm:max-w-3xl overflow-hidden flex flex-col gap-4 p-6">
                                                                <SheetHeader className="flex-shrink-0">
                                                                    <SheetTitle>{stat.name} - Denetim Geçmişi</SheetTitle>
                                                                </SheetHeader>
                                                                <div className="flex-1 overflow-auto min-h-0">
                                                                    <DataTable
                                                                        columns={auditHistoryColumns}
                                                                        data={stat.audits}
                                                                        searchKey="storeName"
                                                                        searchPlaceholder="Mağaza ara..."
                                                                    />
                                                                </div>
                                                            </SheetContent>
                                                        </Sheet>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Hawk/Dove Chart */}
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Mağazaya verilen puan ortalaması</CardTitle>
                                <CardDescription>Ortalama puan dağılımı</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full">
                                    {hawkDoveData.length > 0 ? (
                                        <ChartContainer config={{
                                            score: { label: "Ortalama Puan", color: "hsl(var(--chart-1))" },
                                            label: { color: "hsl(var(--background))" }
                                        }} className="min-h-[300px] w-full">
                                            <BarChart
                                                accessibilityLayer
                                                data={hawkDoveData}
                                                layout="vertical"
                                                margin={{ right: 16 }}
                                            >
                                                <CartesianGrid horizontal={false} />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    tickLine={false}
                                                    tickMargin={10}
                                                    axisLine={false}
                                                    hide
                                                />
                                                <XAxis dataKey="score" type="number" hide domain={[0, 100]} />
                                                <ChartTooltip
                                                    cursor={false}
                                                    content={<ChartTooltipContent indicator="line" />}
                                                />
                                                <ReferenceLine x={globalAverage} stroke="hsl(var(--destructive))" label={{ value: "Ort.", fill: "hsl(var(--destructive))", fontSize: 12 }} strokeDasharray="3 3" />
                                                <Bar
                                                    dataKey="score"
                                                    fill="#3b82f6"
                                                    radius={4}
                                                    onClick={handleBarClick}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <LabelList
                                                        dataKey="name"
                                                        position="insideLeft"
                                                        offset={8}
                                                        className="fill-white font-bold drop-shadow-md"
                                                        fontSize={12}
                                                    />
                                                    <LabelList
                                                        dataKey="score"
                                                        position="right"
                                                        offset={8}
                                                        className="fill-foreground font-bold"
                                                        fontSize={12}
                                                    />
                                                </Bar>
                                            </BarChart>
                                        </ChartContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">Veri yok</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Section/Category Analysis */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Bölüm Bazlı Puan Ortalamaları</CardTitle>
                            <CardDescription>Denetmenlerin bölümlere verdiği ortalama puanlar ve genel sapmalar</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Bölüm/Kategori</TableHead>
                                        {auditorNames.map((name, idx) => (
                                            <TableHead key={idx} className="text-right">{name}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deviationData.map((row, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">{row.category}</TableCell>
                                            {auditorNames.map((name, aIdx) => (
                                                <TableCell key={aIdx} className="text-right">
                                                    {(Number.isNaN(row[name]) || row[name] === undefined) ? "-" : row[name]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                </TabsContent>

                <TabsContent value="stores" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mağaza Süre İstatistikleri</CardTitle>
                            <CardDescription>Mağazalara göre ortalama denetim süreleri</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mağaza</TableHead>
                                        <TableHead className="text-right">Top. Denetim</TableHead>
                                        <TableHead className="text-right">Ort. Süre (dk)</TableHead>
                                        <TableHead className="text-right">Ort. Puan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {storeStats.map((stat) => (
                                        <TableRow key={stat.id}>
                                            <TableCell className="font-medium">{stat.name}</TableCell>
                                            <TableCell className="text-right">{stat.totalAudits}</TableCell>
                                            <TableCell className="text-right">{(stat.avgDuration || 0).toFixed(1)}</TableCell>
                                            <TableCell className="text-right">{(stat.avgScore || 0).toFixed(1)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Aylık Puan Ortalaması Dialog */}
            <Dialog open={monthlyDialogOpen} onOpenChange={setMonthlyDialogOpen}>
                <DialogContent className="!w-[50vw] !max-w-none max-h-[65vh] overflow-y-auto p-3">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                            {selectedAuditorForMonthly} - Aylık Mağaza Puan Ortalaması
                        </DialogTitle>
                        <DialogDescription>
                            Denetmenin aylık bazda mağazalara verdiği puan ortalamaları
                        </DialogDescription>
                    </DialogHeader>

                    {/* Yıl Seçici */}
                    <div className="flex items-center gap-4 mb-4">
                        <label className="font-medium">Yıl:</label>
                        <Select
                            value={selectedYear.toString()}
                            onValueChange={(value) => setSelectedYear(parseInt(value))}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {getAvailableYears().map(year => (
                                    <SelectItem key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Aylık Grafik */}
                    <div className="w-full">
                        <ChartContainer
                            config={{
                                avgScore: { label: "Ortalama Puan", color: "hsl(var(--chart-1))" }
                            }}
                            className="min-h-[350px] w-full"
                        >
                            <BarChart
                                accessibilityLayer
                                data={monthlyData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                            >
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="monthName"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 12 }}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload as MonthlyScore;
                                            return (
                                                <div className="rounded-lg border bg-background p-3 shadow-sm">
                                                    <div className="font-semibold text-base mb-1">{data.monthName}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Ort. Puan: <span className="font-bold text-foreground">{data.avgScore}</span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Denetim Sayısı: <span className="font-bold text-foreground">{data.auditCount}</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="avgScore"
                                    fill="#3b82f6"
                                    radius={8}
                                >
                                    <LabelList
                                        dataKey="avgScore"
                                        position="top"
                                        content={(props: any) => {
                                            const { x, y, width, value, index } = props;
                                            const monthData = monthlyData[index];
                                            if (!monthData || monthData.auditCount === 0) return null;
                                            return (
                                                <text
                                                    x={x + width / 2}
                                                    y={y - 5}
                                                    fill="currentColor"
                                                    textAnchor="middle"
                                                    className="fill-foreground font-bold"
                                                    fontSize={13}
                                                >
                                                    {value}
                                                </text>
                                            );
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>

                    {/* Detaylı Tablo */}
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3">Detaylı Aylık İstatistikler</h3>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ay</TableHead>
                                        <TableHead className="text-center">Denetim Sayısı</TableHead>
                                        <TableHead className="text-right">Ortalama Puan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlyData.map((month) => (
                                        <TableRow key={month.month}>
                                            <TableCell className="font-medium">{month.monthName}</TableCell>
                                            <TableCell className="text-center">
                                                {month.auditCount > 0 ? (
                                                    <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                                                        {month.auditCount}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {month.auditCount > 0 ? (
                                                    <span className="font-mono font-semibold">{month.avgScore}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
