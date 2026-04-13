"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, Store, UserProfile, PersonnelEvaluation, DateRangeFilter } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import {
    Loader2, MapPin, TrendingUp, TrendingDown, Users, Target,
    RefreshCw, FileSpreadsheet, Star, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
    ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// Dynamic imports for recharts — SSR safe
const RadarChart = dynamic(() => import("recharts").then(m => m.RadarChart), { ssr: false });
const Radar = dynamic(() => import("recharts").then(m => m.Radar), { ssr: false });
const PolarGrid = dynamic(() => import("recharts").then(m => m.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import("recharts").then(m => m.PolarAngleAxis), { ssr: false });
const PolarRadiusAxis = dynamic(() => import("recharts").then(m => m.PolarRadiusAxis), { ssr: false });
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then(m => m.Legend), { ssr: false });
const LineChart = dynamic(() => import("recharts").then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then(m => m.Line), { ssr: false });
const PieChart = dynamic(() => import("recharts").then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then(m => m.Cell), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegionData {
    managerId: string;
    managerName: string;
    storeCount: number;
    auditCount: number;
    avgAuditScore: number;    // 0-100 — sadece tamamlanan denetimler
    avgPersonnelScore: number; // 0-100
    respondedItems: number;   // Mağazanin dönüş yaptığı aksiyon madde sayısı (pending_admin | approved | rejected)
    revisionItems: number;    // rejectedAt olan maddeler (admin reddedip mağaza tekrar gönderdi)
    revisionRate: number;     // revisionItems / respondedItems * 100
    revisionScore: number;    // 100 - revisionRate (iade puanı)
    healthScore: number;      // Denetim×0.60 + Personel×0.20 + İadePuanı×0.20
    stores: string[];
}

interface MonthlyPersonnelPoint {
    month: string;
    [managerName: string]: string | number;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

const parseDateObj = (rawDate: any, fallback: Date = new Date()): Date => {
    if (!rawDate) return fallback;
    if (typeof rawDate.toDate === "function") return rawDate.toDate();
    if (rawDate instanceof Date) return rawDate;
    if (typeof rawDate === "object" && "seconds" in rawDate) return new Date(rawDate.seconds * 1000);
    return new Date(rawDate);
};

/**
 * Bölge Sağlık Skoru Algoritması (v3)
 *
 * Denetim Skoru   × 0.60  → Sadece BİTEN denetimler, totalScore doğrudan kullanılır
 * Personel Puanı  × 0.20  → Personel değerlendirme ortalaması
 * İade Puanı      × 0.20  → 100 - (rejectedAt_olan / toplam_aksiyon_madde * 100)
 *
 * İade Hesabı:
 *   totalActionItems = aksiyon gerektiren toplam madde (tüm durumlar)
 *   revisionItems    = rejectedAt tarihi olan maddeler (reddedilip tekrar dönülen)
 *   revisionRate     = revisionItems / totalActionItems * 100
 *   revisionScore    = 100 - revisionRate
 *
 * Örnek: 25 maddede 5 red → revisionRate = %20 → revisionScore = 80
 *   90×0.60 + 80×0.20 + 80×0.20 = 54 + 16 + 16 = 86
 */
const calcHealthScore = (
    auditScore: number,    // 0-100
    personnelScore: number, // 0-100
    revisionScore: number  // 0-100 (100 - revisionRate)
): number => {
    return Math.round(
        auditScore * 0.60 +
        personnelScore * 0.20 +
        revisionScore * 0.20
    );
};

const healthBadge = (score: number) => {
    if (score >= 95) return { label: "Çok İyi Bölge", cls: "border-emerald-500 text-emerald-700 bg-emerald-50" };
    if (score >= 90) return { label: "İyi Bölge", cls: "border-sky-500 text-sky-700 bg-sky-50" };
    if (score >= 85) return { label: "Orta Bölge", cls: "border-amber-500 text-amber-700 bg-amber-50" };
    return { label: "Zayıf Bölge", cls: "border-rose-500 text-rose-700 bg-rose-50" };
};

const REGION_COLORS = [
    "#6366f1", "#22d3ee", "#f59e0b", "#10b981",
    "#f43f5e", "#a78bfa", "#38bdf8", "#fb923c",
    "#84cc16", "#ec4899",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BolgeRaporuPage() {
    const [loading, setLoading] = useState(true);
    const [regionData, setRegionData] = useState<RegionData[]>([]);
    const [monthlyPersonnel, setMonthlyPersonnel] = useState<MonthlyPersonnelPoint[]>([]);
    const [managerNamesWithData, setManagerNamesWithData] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({ from: undefined, to: undefined });
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [allAudits, setAllAudits] = useState<Audit[]>([]);
    const [allAuditScores, setAllAuditScores] = useState<{ year: number; month: number; score: number; managerName: string }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [auditsSnap, storesSnap, usersSnap, personnelSnap] = await Promise.all([
                    // Sadece TAMAMLANAN denetimler — devam eden / yükleniyor dahil edilmez
                    getDocs(query(collection(db, "audits"), where("status", "==", "tamamlandi"), orderBy("completedAt", "desc"))),
                    getDocs(collection(db, "stores")),
                    getDocs(query(collection(db, "users"), where("role", "==", "bolge-muduru"))),
                    getDocs(collection(db, "personnel_evaluations")),
                ]);

                // Maps
                const storeMap = new Map<string, Store>();
                storesSnap.docs.forEach(d => storeMap.set(d.id, { id: d.id, ...d.data() } as Store));

                const userMap = new Map<string, string>(); // uid -> displayName
                usersSnap.docs.forEach(d => {
                    const u = d.data() as UserProfile;
                    userMap.set(d.id, `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.displayName || u.email);
                });

                // Accumulator per manager
                interface ManagerAcc {
                    managerName: string;
                    storeNames: Set<string>;
                    auditScores: number[];     // Tamamlanan denetim puanları (totalScore)
                    // Aksiyon iade metrikleri
                    respondedItems: number;    // Mağazanin dönüş yaptığı maddeler (payda)
                    revisionItems: number;     // rejectedAt olan maddeler (pay)
                    // Personel
                    personnelScores: number[];
                    monthlyPersonnel: Record<string, number[]>; // "YYYY-MM" -> scores
                }
                const accMap = new Map<string, ManagerAcc>();

                const getAcc = (managerId: string, managerName: string): ManagerAcc => {
                    if (!accMap.has(managerId)) {
                        accMap.set(managerId, {
                            managerName,
                            storeNames: new Set(),
                            auditScores: [],
                            respondedItems: 0,
                            revisionItems: 0,
                            personnelScores: [],
                            monthlyPersonnel: {},
                        });
                    }
                    return accMap.get(managerId)!;
                };

                // Date filter helper
                const inRange = (date: Date): boolean => {
                    if (dateRange.from) {
                        const f = new Date(dateRange.from); f.setHours(0, 0, 0, 0);
                        if (date < f) return false;
                    }
                    if (dateRange.to) {
                        const t = new Date(dateRange.to); t.setHours(23, 59, 59, 999);
                        if (date > t) return false;
                    }
                    return true;
                };

                // Process audits
                const auditScoreEntries: { year: number; month: number; score: number; managerName: string }[] = [];
                auditsSnap.docs.forEach(doc => {
                    const audit = { id: doc.id, ...doc.data() } as Audit;
                    if (!audit.completedAt) return;

                    const store = storeMap.get(audit.storeId);
                    if (!store?.regionalManagerId) return;

                    const auditDate = parseDateObj(audit.completedAt);
                    if (!inRange(auditDate)) return;

                    const managerId = store.regionalManagerId;
                    const managerName = userMap.get(managerId) || "Bilinmeyen";
                    const acc = getAcc(managerId, managerName);
                    acc.storeNames.add(audit.storeName || store.name);

                    // ── Denetim Skoru ─────────────────────────────────────────────────────
                    // totalScore zaten 0-100 ölçeğinde saklanan ham puan.
                    // maxScore ile bölmeye GEREK YOK — maxScore formun ham puan toplamıdır,
                    // totalScore ise denetçi tarafından kazanılan ham puandır.
                    // Yüzdeyi doğru almak için: (totalScore / maxScore) * 100
                    // Ama puan-raporu'nda da totalScore doğrudan kullanılıyor (0-100 scale).
                    // Gerçek DB verisine göre: totalScore = kazanılan puan (0-100),
                    // bu yüzden doğrudan kullanıyoruz.
                    const auditScore = typeof audit.totalScore === "number" ? audit.totalScore : 0;
                    if (auditScore > 0) {
                        acc.auditScores.push(auditScore);
                        auditScoreEntries.push({
                            year: auditDate.getFullYear(),
                            month: auditDate.getMonth(),
                            score: auditScore,
                            managerName,
                        });
                    }

                    // ── Aksiyon İade Metrikleri ───────────────────────────────────────────
                    //
                    // PAYDA → respondedItems
                    //   Mağazanin AKSİYON MADDESİNE DÖNÜŞ YAPTIĞI maddeler:
                    //   status = "pending_admin" | "approved" | "rejected"
                    //   (Mağaza henüz göndermedi = "pending_store" → PAYDAYA DAHİL DEĞİL)
                    //
                    // PAY → revisionItems
                    //   Admin en az 1 kez reddetti (rejectedAt mevcut)
                    //
                    // Örnek: 25 maddeye dönüş yapıldı, 5 tanesi reddedildi
                    //   revisionRate = 5/25 * 100 = %20
                    //   revisionScore = 100 - 20 = 80
                    (audit.sections || []).forEach(section => {
                        (section.answers || []).forEach(answer => {
                            const needsAction =
                                answer.answer &&
                                answer.answer.trim() !== "" &&
                                answer.answer !== "muaf" &&
                                (answer.earnedPoints || 0) < (answer.maxPoints || 0);

                            if (!needsAction) return;

                            const status = answer.actionData?.status;

                            // PAYDA: Mağaza dönüş yaptıysa say
                            // pending_store = henüz göndermedi → hç sayılmaz
                            if (
                                status === "pending_admin" ||
                                status === "approved" ||
                                status === "rejected"
                            ) {
                                acc.respondedItems++;
                            }

                            // PAY: Admin en az 1 kez reddedip iade gönderdi
                            if (answer.actionData?.rejectedAt) {
                                acc.revisionItems++;
                            }
                        });
                    });
                });

                // Process personnel evaluations
                personnelSnap.docs.forEach(doc => {
                    const pe = { id: doc.id, ...doc.data() } as PersonnelEvaluation & { createdAt?: any };
                    const store = storeMap.get(pe.storeId);
                    if (!store?.regionalManagerId) return;

                    const managerId = store.regionalManagerId;
                    const managerName = userMap.get(managerId) || "Bilinmeyen";
                    const evalDate = parseDateObj((pe as any).createdAt);
                    if (!inRange(evalDate)) return;

                    const acc = getAcc(managerId, managerName);
                    acc.personnelScores.push(pe.score);

                    const monthKey = `${evalDate.getFullYear()}-${String(evalDate.getMonth() + 1).padStart(2, "0")}`;
                    if (!acc.monthlyPersonnel[monthKey]) acc.monthlyPersonnel[monthKey] = [];
                    acc.monthlyPersonnel[monthKey].push(pe.score);
                });

                // Build region data
                const regions: RegionData[] = [];
                const allManagerNames: string[] = [];

                accMap.forEach((acc, managerId) => {
                    const avgAuditScore = acc.auditScores.length > 0
                        ? Math.round(acc.auditScores.reduce((a, b) => a + b, 0) / acc.auditScores.length)
                        : 0;

                    const avgPersonnelScore = acc.personnelScores.length > 0
                        ? Math.round(acc.personnelScores.reduce((a, b) => a + b, 0) / acc.personnelScores.length)
                        : 0;

                    // İade metrikleri
                    // PAYDA: respondedItems (mağazanin dönüş yaptığı maddeler)
                    // PAY:   revisionItems  (admin reddettikleri)
                    const revisionRate = acc.respondedItems > 0
                        ? Math.round((acc.revisionItems / acc.respondedItems) * 100)
                        : 0; // Henüz hiç dönüş yok → %0 iade

                    // revisionScore: 100 - revisionRate
                    // 25 dönüş, 5 red → %20 hata → 80 puan
                    const revisionScore = 100 - revisionRate;

                    const healthScore = calcHealthScore(
                        avgAuditScore,
                        avgPersonnelScore,
                        revisionScore
                    );

                    regions.push({
                        managerId,
                        managerName: acc.managerName,
                        storeCount: acc.storeNames.size,
                        auditCount: acc.auditScores.length,
                        avgAuditScore,
                        avgPersonnelScore,
                        respondedItems: acc.respondedItems,
                        revisionItems: acc.revisionItems,
                        revisionRate,
                        revisionScore,
                        healthScore,
                        stores: Array.from(acc.storeNames),
                    });
                    allManagerNames.push(acc.managerName);
                });

                // Sort by health score desc
                regions.sort((a, b) => b.healthScore - a.healthScore);
                setRegionData(regions);

                // Personel trendi için sadece verisi olan müdürlerin isimleri
                setManagerNamesWithData(
                    Array.from(accMap.entries())
                        .filter(([, acc]) => acc.personnelScores.length > 0)
                        .map(([, acc]) => acc.managerName)
                );

                // Build monthly personnel trend
                const allMonths = new Set<string>();
                accMap.forEach(acc => Object.keys(acc.monthlyPersonnel).forEach(m => allMonths.add(m)));
                const sortedMonths = Array.from(allMonths).sort();

                const monthlyData: MonthlyPersonnelPoint[] = sortedMonths.map(m => {
                    const point: MonthlyPersonnelPoint = {
                        month: m.replace(/^(\d{4})-(\d{2})$/, (_, y, mo) => {
                            const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
                            return `${monthNames[parseInt(mo) - 1]} ${y}`;
                        })
                    };
                    accMap.forEach(acc => {
                        const scores = acc.monthlyPersonnel[m];
                        if (scores && scores.length > 0) {
                            point[acc.managerName] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                        }
                    });
                    return point;
                });
                setMonthlyPersonnel(monthlyData);
                setAllAudits(auditsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Audit)));
                setAllAuditScores(auditScoreEntries);

            } catch (err) {
                console.error("Bölge raporu veri hatası:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange]);

    // ── Derived chart data ──────────────────────────────────────────────────

    // Radar — İlk 5 bölge, 3 eksen (v3: Denetim, Personel, İade Puanı, Sağlık)
    const radarData = useMemo(() => {
        const top5 = regionData.slice(0, 5);
        return [
            { subject: "Denetim" },
            { subject: "Personel" },
            { subject: "İade Puanı" },
            { subject: "Sağlık" },
        ].map(d => {
            const row: Record<string, any> = { subject: d.subject };
            top5.forEach(r => {
                const key = r.managerName.split(" ")[0];
                if (d.subject === "Denetim") row[key] = r.avgAuditScore;
                else if (d.subject === "Personel") row[key] = r.avgPersonnelScore;
                else if (d.subject === "İade Puanı") row[key] = r.revisionScore;
                else if (d.subject === "Sağlık") row[key] = r.healthScore;
            });
            return row;
        });
    }, [regionData]);

    const radarNames = useMemo(
        () => regionData.slice(0, 5).map(r => r.managerName.split(" ")[0]),
        [regionData]
    );

    // Bar — Denetim ve Personel skorları yan yana (sağlık hariç — ayrı kart var)
    const barData = useMemo(() =>
        regionData.map(r => ({
            name: r.managerName.split(" ")[0],
            fullName: r.managerName,
            "Denetim": r.avgAuditScore,
            "Personel": r.avgPersonnelScore,
            "Sağlık": r.healthScore,
        })),
        [regionData]
    );

    // Stacked Bar — Mağazanın dönüş yaptığı maddeler: Temiz vs İade Edilen
    const actionStackData = useMemo(() =>
        regionData
            .filter(r => r.respondedItems > 0)
            .map(r => ({
                name: r.managerName.split(" ")[0],
                fullName: r.managerName,
                "Temiz Dönüş": r.respondedItems - r.revisionItems,
                "İade Edilen": r.revisionItems,
            })),
        [regionData]
    );

    // Donut — İade madde adedi (sadece revisionItems > 0 olanlar)
    const donutData = useMemo(() =>
        regionData
            .filter(r => r.revisionItems > 0)
            .map((r, i) => ({
                name: r.managerName.split(" ")[0],
                fullName: r.managerName,
                value: r.revisionItems,
                color: REGION_COLORS[i % REGION_COLORS.length],
            })),
        [regionData]
    );

    // Monthly Development — Aylık Gelişim (Manager-bazlı)
    const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const MONTH_SHORT  = ["Oca",  "Şub",  "Mar",  "Nis",  "May",  "Haz",  "Tem",  "Ağu",  "Eyl",  "Eki",  "Kas",  "Ara"];

    const monthlyManagerData = useMemo(() => {
        const filtered = allAuditScores.filter(a => a.year === selectedYear);
        const managers = [...new Set(filtered.map(a => a.managerName))].sort();

        // chart data — one row per month, one key per manager
        const chartData = MONTH_NAMES.map((monthName, mi) => {
            const row: Record<string, any> = { month: MONTH_SHORT[mi] };
            managers.forEach(mgr => {
                const scores = filtered.filter(a => a.month === mi && a.managerName === mgr).map(a => a.score);
                row[mgr] = scores.length > 0
                    ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length)
                    : null;
            });
            return row;
        });

        // table data — one row per manager, one column per month
        const tableData = managers.map(mgr => {
            const row: (number | null)[] = [];
            for (let mi = 0; mi < 12; mi++) {
                const scores = filtered.filter(a => a.month === mi && a.managerName === mgr).map(a => a.score);
                row.push(scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : null);
            }
            return { managerName: mgr, months: row };
        });

        return { chartData, tableData, managers };
    }, [allAuditScores, selectedYear]);

    // ── KPI Summary ─────────────────────────────────────────────────────────

    const avgHealth = regionData.length
        ? Math.round(regionData.reduce((a, r) => a + r.healthScore, 0) / regionData.length)
        : 0;
    const bestRegion = regionData[0];
    const worstRegion = regionData[regionData.length - 1];
    const avgAudit = regionData.length
        ? Math.round(regionData.filter(r => r.auditCount > 0).reduce((a, r) => a + r.avgAuditScore, 0) / Math.max(1, regionData.filter(r => r.auditCount > 0).length))
        : 0;
    const avgPersonnel = regionData.length
        ? Math.round(regionData.filter(r => r.avgPersonnelScore > 0).reduce((a, r) => a + r.avgPersonnelScore, 0) / Math.max(1, regionData.filter(r => r.avgPersonnelScore > 0).length))
        : 0;
    const totalRevisionItems = regionData.reduce((a, r) => a + r.revisionItems, 0);
    const totalRespondedItems = regionData.reduce((a, r) => a + r.respondedItems, 0);
    const overallRevisionRate = totalRespondedItems > 0 ? Math.round((totalRevisionItems / totalRespondedItems) * 100) : 0;
    const overallRevisionScore = 100 - overallRevisionRate;

    // ── Table columns ────────────────────────────────────────────────────────

    const columns: ColumnDef<RegionData>[] = [
        {
            accessorKey: "managerName",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bölge Müdürü" />,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm">{row.original.managerName}</span>
                </div>
            ),
            meta: { title: "Bölge Müdürü" } as any,
        },
        {
            accessorKey: "storeCount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Mağaza" />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.storeCount} Mağaza</Badge>,
            meta: { title: "Mağaza Sayısı" } as any,
        },
        {
            accessorKey: "auditCount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Denetim" />,
            cell: ({ row }) => <span className="text-sm font-mono">{row.original.auditCount}</span>,
            meta: { title: "Denetim Adedi" } as any,
        },
        {
            accessorKey: "avgAuditScore",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ort. Denetim" />,
            cell: ({ row }) => {
                const v = row.original.avgAuditScore;
                if (row.original.auditCount === 0) return <span className="text-muted-foreground text-xs">—</span>;
                const cls = v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-rose-600";
                return <span className={cn("font-bold text-sm", cls)}>{v}/100</span>;
            },
            meta: { title: "Ort. Denetim Skoru" } as any,
        },
        {
            accessorKey: "avgPersonnelScore",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ort. Personel" />,
            cell: ({ row }) => {
                const v = row.original.avgPersonnelScore;
                if (v === 0) return <span className="text-muted-foreground text-xs">—</span>;
                const cls = v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-rose-600";
                return <span className={cn("font-bold text-sm", cls)}>{v}/100</span>;
            },
            meta: { title: "Ort. Personel Puanı" } as any,
        },
        {
            accessorKey: "revisionRate",
            header: ({ column }) => <DataTableColumnHeader column={column} title="İade Oranı" />,
            cell: ({ row }) => {
                const r = row.original;
                if (r.respondedItems === 0) return <span className="text-muted-foreground text-xs">—</span>;
                if (r.revisionItems === 0) return (
                    <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 text-xs font-medium">İade Yok</span>
                    </div>
                );
                const v = r.revisionRate;
                const cls = v <= 10 ? "text-emerald-600" : v <= 25 ? "text-amber-600" : "text-rose-600";
                return (
                    <div className="flex flex-col">
                        <span className={cn("font-bold text-sm", cls)}>%{v}</span>
                        <span className="text-xs text-muted-foreground">{r.revisionItems}/{r.respondedItems} dönüşte iade</span>
                    </div>
                );
            },
            meta: { title: "İade Oranı" } as any,
        },
        {
            accessorKey: "revisionScore",
            header: ({ column }) => <DataTableColumnHeader column={column} title="İade Puanı" />,
            cell: ({ row }) => {
                const v = row.original.revisionScore;
                const cls = v >= 90 ? "text-emerald-600" : v >= 75 ? "text-amber-600" : "text-rose-600";
                return <span className={cn("font-bold text-sm", cls)}>{v}/100</span>;
            },
            meta: { title: "İade Puanı" } as any,
        },
        {
            accessorKey: "healthScore",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sağlık Skoru" />,
            cell: ({ row }) => {
                const { label, cls } = healthBadge(row.original.healthScore);
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{row.original.healthScore}</span>
                        <Badge variant="outline" className={cls}>{label}</Badge>
                    </div>
                );
            },
            meta: { title: "Bölge Sağlık Skoru" } as any,
        },
    ];

    // ── Excel Export ─────────────────────────────────────────────────────────

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(regionData.map(r => ({
            "Bölge Müdürü": r.managerName,
            "Mağaza Sayısı": r.storeCount,
            "Denetim Adedi": r.auditCount,
            "Ort. Denetim Skoru": r.avgAuditScore,
            "Ort. Personel Puanı": r.avgPersonnelScore,
            "Dönüş Yapılan Madde": r.respondedItems,
            "İade Edilen Madde": r.revisionItems,
            "İade Oranı (%)": r.revisionRate,
            "İade Puanı (100-İadeOranı)": r.revisionScore,
            "Bölge Sağlık Skoru": r.healthScore,
            "Değerlendirme": healthBadge(r.healthScore).label,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bölge Raporu");
        XLSX.writeFile(wb, `Bolge_Raporu_${new Date().toLocaleDateString("tr-TR")}.xlsx`);
    };

    const handleExportMonthly = () => {
        const { tableData } = monthlyManagerData;
        if (!tableData.length) return;
        const rows = tableData.map(row => {
            const obj: Record<string, any> = { "Bölge Müdürü": row.managerName };
            MONTH_NAMES.forEach((name, mi) => {
                obj[name] = row.months[mi] !== null ? row.months[mi] : "";
            });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Aylık Gelişim ${selectedYear}`);
        XLSX.writeFile(wb, `Aylik_Gelisim_${selectedYear}.xlsx`);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 space-y-6">

            {/* ── Header ── */}
            <Card className="border shadow-sm bg-white">
                <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl">
                                <MapPin className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Bölge Performans Raporu</h1>
                                <p className="text-slate-500 text-sm mt-0.5">
                                    Bölge müdürü bazında denetim, personel, aksiyon ve revize analizi
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Bölge verileri analiz ediliyor...</p>
                </div>
            ) : regionData.length === 0 ? (
                <Card>
                    <CardContent className="py-20 text-center">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Seçilen tarih aralığında bölge verisi bulunamadı.</p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="karsilastirma" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="karsilastirma">Karşılaştırma</TabsTrigger>
                        <TabsTrigger value="aylik-gelisim">Aylık Gelişim</TabsTrigger>
                    </TabsList>

                    {/* ═══ TAB 1: Karşılaştırma ═══ */}
                    <TabsContent value="karsilastirma" className="space-y-6 mt-0">

                        {/* Bölge Karşılaştırma Tablosu */}
                        <Card className="shadow-none border">
                            <CardHeader className="pb-2">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                            Bölge Karşılaştırma Tablosu
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Tüm bölge müdürlerinin karşılaştırmalı performans göstergeleri
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-1">
                                            <DateRangePicker
                                                value={dateRange}
                                                onChange={setDateRange}
                                                className="border-none shadow-none bg-transparent"
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 gap-2"
                                            onClick={handleExport}
                                        >
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <DataTable
                                    columns={columns}
                                    data={regionData}
                                    searchKey="managerName"
                                    searchPlaceholder="Bölge müdürü ara..."
                                    pageSizeOptions={[10, 20, 50, 100, 200]}
                                />
                            </CardContent>
                        </Card>

                        {/* Skor Karşılaştırması */}
                        <Card className="shadow-none border">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Skor Karşılaştırması
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Bölge müdürlerine göre denetim, personel ve sağlık skorları
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 55 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                            <Tooltip
                                                formatter={(v: any, name: string) => [`${v}/100`, name]}
                                                labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || "" as any}
                                            />
                                            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
                                            <Bar dataKey="Denetim" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Personel" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Sağlık" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Algorithm note */}
                        <Card className="shadow-none border border-dashed border-indigo-200 bg-indigo-50/40">
                            <CardContent className="p-4">
                                <div className="flex gap-3">
                                    <AlertTriangle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-indigo-700">Bölge Sağlık Skoru Algoritması (v3)</p>
                                        <p className="text-xs text-indigo-600/80 leading-relaxed">
                                            <strong>Denetim Skoru × 0.60</strong> + <strong>Personel Puanı × 0.20</strong> + <strong>İade Puanı × 0.20</strong>
                                        </p>
                                        <ul className="text-xs text-indigo-600/70 space-y-0.5 mt-1">
                                            <li>• <strong>İade Puanı</strong> = 100 − (reddedilen madde / mağazanın dönüş yaptığı madde × 100)</li>
                                            <li>• Örnek: 25 dönüşte 5 iade → %20 hata → İade Puanı = <strong>80</strong></li>
                                            <li>• 90×0.60 + 80×0.20 + 80×0.20 = 54 + 16 + 16 = <strong>86 puan</strong></li>
                                            <li>• Hiç iade yoksa İade Puanı = <strong>100</strong> (tam puan)</li>
                                        </ul>
                                        <p className="text-xs text-indigo-600/60 mt-1">Bölge Sağlığı: 100-95 Çok İyi · 94-90 İyi · 89-85 Orta · 84 ve Altı Zayıf</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </TabsContent>

                    {/* ═══ TAB 2: Aylık Gelişim ═══ */}
                    <TabsContent value="aylik-gelisim" className="space-y-4 mt-0">

                        {/* Year selector */}
                        <Card className="shadow-none border">
                            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-800 text-sm">Bölge Müdürü Bazlı Aylık Gelişim</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Her bölge müdürü için aylık ortalama denetim puanı karşılaştırması</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                                        <SelectTrigger className="w-32 shrink-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 11 }, (_, i) => 2026 + i).map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 gap-2"
                                        onClick={handleExportMonthly}
                                        disabled={monthlyManagerData.tableData.length === 0}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Excel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Multi-line chart — one line per manager */}
                        <Card className="shadow-none border">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    {selectedYear} — Bölge Müdürü Aylık Denetim Puanları
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Her çizgi bir bölge müdürünü temsil eder; boşluk = o ayda veri yok
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyManagerData.chartData} margin={{ top: 10, right: 20, left: -10, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                            <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} />
                                            <Tooltip
                                                formatter={(v: any, name: string) => [v !== null && v !== undefined ? `${v}/100` : "Veri yok", name]}
                                                labelFormatter={(label: string) => `${label} ${selectedYear}`}
                                            />
                                            <Legend verticalAlign="bottom" height={52} wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                                            {monthlyManagerData.managers.map((mgr, idx) => (
                                                <Line
                                                    key={mgr}
                                                    type="monotone"
                                                    dataKey={mgr}
                                                    name={mgr}
                                                    stroke={REGION_COLORS[idx % REGION_COLORS.length]}
                                                    strokeWidth={2}
                                                    dot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                                                    activeDot={{ r: 6 }}
                                                    connectNulls={false}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Manager × Month table */}
                        <Card className="shadow-none border">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    Aylık Puan Tablosu
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Ok işareti bir önceki aya göre değişimi gösterir
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0 pb-4 overflow-x-auto">
                                {monthlyManagerData.tableData.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8">{selectedYear} yılı için veri bulunamadı</p>
                                ) : (
                                    <table className="w-full text-xs min-w-[900px]">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-40">Bölge Müdürü</th>
                                                {MONTH_SHORT.map(m => (
                                                    <th key={m} className="text-center px-2 py-2.5 font-semibold text-slate-600 w-16">{m}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyManagerData.tableData.map((row, ri) => (
                                                <tr key={row.managerName} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                                    <td className="px-4 py-2.5 font-medium text-slate-700 border-r border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                style={{ background: REGION_COLORS[ri % REGION_COLORS.length] }}
                                                            />
                                                            {row.managerName}
                                                        </div>
                                                    </td>
                                                    {row.months.map((score, mi) => {
                                                        const prev = mi > 0 ? row.months[mi - 1] : null;
                                                        const diff = score !== null && prev !== null ? score - prev : null;
                                                        return (
                                                            <td key={mi} className="text-center px-1 py-2.5">
                                                                {score === null ? (
                                                                    <span className="text-slate-200 font-medium">—</span>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span className={cn(
                                                                            "font-bold text-sm",
                                                                            score >= 95 ? "text-emerald-600"
                                                                            : score >= 90 ? "text-sky-600"
                                                                            : score >= 85 ? "text-amber-600"
                                                                            : "text-rose-600"
                                                                        )}>{score}</span>
                                                                        {diff !== null && (
                                                                            <span className={cn(
                                                                                "text-[10px] font-semibold flex items-center",
                                                                                diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-500" : "text-slate-300"
                                                                            )}>
                                                                                {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                                                                {diff !== 0 && Math.abs(diff)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>

                    </TabsContent>

                </Tabs>
            )}
        </div>
    );
}
