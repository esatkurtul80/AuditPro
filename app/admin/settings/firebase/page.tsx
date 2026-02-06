"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
    ArrowLeft, 
    RefreshCcw, 
    Database, 
    BarChart3, 
    HardDrive, 
    Activity,
    AlertCircle,
    Trash2
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FirebaseMetric {
    timeSeries?: {
        metric: { labels: Record<string, string>; type: string };
        resource: { type: string; labels: Record<string, string> };
        metricKind: string;
        valueType: string;
        points: {
            interval: { startTime: string; endTime: string };
            value: { int64Value?: string; doubleValue?: number };
        }[];
    }[];
    // In case of error from previous step, we might get error object
    error?: string;
}

interface FirebaseStatsResponse {
    projectId: string;
    data: {
        reads: FirebaseMetric;
        writes: FirebaseMetric;
        deletes: FirebaseMetric;
        storage: FirebaseMetric;
        functionsInvocations?: FirebaseMetric;
        functionsExecutionTime?: FirebaseMetric;
        hostingBandwidth?: FirebaseMetric;
        hostingStorage?: FirebaseMetric;
        billing?: { cost: number; service: string }[] | null;
    };
    error?: string;
    details?: string;
}



export default function FirebaseStatsPage() {

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<FirebaseStatsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/firebase-stats-v2');
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.details || json.error || "Veri çekilemedi");
            }

            setData(json);
            setLastUpdated(new Date());
            toast.success("Veriler güncellendi");
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            toast.error("Veri çekme hatası: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchData();
    }, []);

    // Spark Plan Limits (approximate for display)
    const LIMITS = {
        reads: 50000,
        writes: 20000,
        deletes: 20000,
        bandwidth: 360 * 1024 * 1024, // 360 MB in bytes
        functions: 2000000 // 2M invocations/month
    };

    // Generic helper to sum usage since a specific timestamp
    const calculateUsageSince = (metric: FirebaseMetric | undefined, sinceTimestamp: number) => {
        if (!metric || !metric.timeSeries || metric.timeSeries.length === 0) return 0;

        let total = 0;
        metric.timeSeries.forEach(series => {
            if (!series.points) return;
            series.points.forEach(point => {
                // Check end time of the interval to decide if it belongs to the period
                const pointTime = new Date(point.interval.endTime || point.interval.startTime).getTime();
                if (pointTime >= sinceTimestamp) {
                    const val = point.value.int64Value ? parseInt(point.value.int64Value) : (point.value.doubleValue || 0);
                    total += val;
                }
            });
        });
        return total;
    };

    // Helper for Storage (usually Gauge, so we take the latest point)
    const getStorageSize = (metric: FirebaseMetric | undefined) => {
        if (!metric || !metric.timeSeries || metric.timeSeries.length === 0) return "0";
        
        // Ensure we check the first series and its points
        const points = metric.timeSeries[0].points;
        if (!points || points.length === 0) return "0";

        // Latest point is usually first in desc order from API
        const point = points[0]; 
        const bytes = point.value.int64Value ? parseInt(point.value.int64Value) : (point.value.doubleValue || 0);
        return (bytes / (1024 * 1024)).toFixed(2); // MB
    };


    // Memoized Totals (Current Month Only)
    const totals = useMemo(() => {
        if (!data) return { reads: 0, writes: 0, deletes: 0, storage: '0', avgReads: 0, avgWrites: 0, avgDeletes: 0, cost: 0, details: {}, isExact: false };

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const reads = calculateUsageSince(data.data.reads, startOfMonth);
        const writes = calculateUsageSince(data.data.writes, startOfMonth);
        const deletes = calculateUsageSince(data.data.deletes, startOfMonth);
        const storageBytes = data.data.hostingStorage ? parseFloat(getStorageSize(data.data.hostingStorage) as string) * 1024 * 1024 : 0; // Back to bytes
        const storageVal = getStorageSize(data.data.storage); // Firestore storage in MB string
        
        // Calculate days passed in current month for average
        const daysPassed = Math.max(1, now.getDate());

        // --- COST CALCULATION LOGIC ---
        // 1. Try BigQuery Real Data First
        if (data.data.billing && data.data.billing.length > 0) {
            let realTotal = 0;
            const details = { functions: 0, firestore: 0, hosting: 0 };
            
            data.data.billing.forEach(item => {
                realTotal += item.cost;
                // Map Google Service Descriptions
                if (item.service.includes("Cloud Functions")) details.functions += item.cost;
                else if (item.service.includes("Cloud Firestore")) details.firestore += item.cost;
                else if (item.service.includes("Firebase Hosting")) details.hosting += item.cost;
                else {
                    // Spread others responsibly or ignore small bits
                    // Maybe add "Other" category if needed, but for now specific buckets
                }
            });

            // Conversion if Google returns USD? Usually it matches the billing account currency.
            // Assuming billingData is in the currency of the Billing Account. 
            // If the user sees TL in console, BG returns TL.
            
            return {
                reads,
                writes,
                deletes,
                storage: storageVal,
                avgReads: Math.round(reads / daysPassed),
                avgWrites: Math.round(writes / daysPassed),
                avgDeletes: Math.round(deletes / daysPassed),
                cost: realTotal,
                details,
                isExact: true // Mark as EXACT
            };
        }

        // 2. Fallback to Estimated Calculation (Existing Logic)
        const functionsInvocations = calculateUsageSince(data.data.functionsInvocations, startOfMonth);
        // Execution Time comes in nanoseconds from API. 
        const functionsExecutionNanos = calculateUsageSince(data.data.functionsExecutionTime, startOfMonth);
        const functionsExecutionSeconds = functionsExecutionNanos / 1e9;
        
        const hostingBandwidthBytes = calculateUsageSince(data.data.hostingBandwidth, startOfMonth);

        // --- COST CALCULATION (APPROXIMATE) ---
        // Exchange Rate: 1 USD = ~36 TRY (Estimated)
        const RATE = 36;
        
        // 1. Cloud Functions (Blaze)
        // Free: 2M invocations, 400,000 GB-seconds, 200,000 GHz-seconds
        // Pricing: $0.40/M invocations
        // CPU Pricing: Tier 1 (e.g. 256MB) ~ $0.0000025/GB-second (Simplified to pure CPU seconds for estimation: $0.000010/sec)
        
        const freeInvocations = 2000000;
        const billableInvocations = Math.max(0, functionsInvocations - freeInvocations);
        const costInvocations = (billableInvocations / 1000000) * 0.40;

        // Simplified CPU Cost (assuming 256MB default avg)
        // 400,000 GB-seconds free. 
        const freeCpuSeconds = 2000000; // Rough estimate for free tier seconds (depends on memory)
        const billableCpuSeconds = Math.max(0, functionsExecutionSeconds - freeCpuSeconds);
        const costCpu = billableCpuSeconds * 0.000010; 

        const functionsCost = (costInvocations + costCpu) * RATE;


        // 2. Firestore
        // Free: 50K reads, 20K writes, 20K deletes per day. 
        // Monthly Free (Approx): 1.5M reads, 600K writes, 600K deletes
        // Pricing: $0.06/100k reads, $0.18/100k writes, $0.02/100k deletes
        
        const freeReads = 50000 * 30;
        const freeWrites = 20000 * 30;
        const freeDeletes = 20000 * 30;

        const billableReads = Math.max(0, reads - freeReads);
        const billableWrites = Math.max(0, writes - freeWrites);
        const billableDeletes = Math.max(0, deletes - freeDeletes);

        const costReads = (billableReads / 100000) * 0.06;
        const costWrites = (billableWrites / 100000) * 0.18;
        const costDeletes = (billableDeletes / 100000) * 0.02;

        // Storage: $0.18/GB
        const firestoreStorageGB = parseFloat(storageVal) / 1024;
        const freeFirestoreStorage = 1; // 1 GB free
        const billableFirestoreStorage = Math.max(0, firestoreStorageGB - freeFirestoreStorage);
        const costFirestoreStorage = billableFirestoreStorage * 0.18;

        const firestoreCost = (costReads + costWrites + costDeletes + costFirestoreStorage) * RATE;


        // 3. Hosting
        // Paid: $0.026/GB storage, $0.15/GB transfer
        // Free: 10 GB storage, 360 MB transfer/day (~10GB/month)
        const freeHostingStorageGB = 10;
        const hostingStorageGB = storageBytes / (1024 * 1024 * 1024);
        const billableHostingStorage = Math.max(0, hostingStorageGB - freeHostingStorageGB);
        const costHostingStorage = billableHostingStorage * 0.026;

        const freeHostingTransferGB = 10; 
        const hostingTransferGB = hostingBandwidthBytes / (1024 * 1024 * 1024);
        const billableHostingTransfer = Math.max(0, hostingTransferGB - freeHostingTransferGB);
        const costHostingTransfer = billableHostingTransfer * 0.15;

        const hostingCost = (costHostingStorage + costHostingTransfer) * RATE;

        const totalCost = functionsCost + firestoreCost + hostingCost;

        return {
            reads,
            writes,
            deletes,
            storage: storageVal,
            avgReads: Math.round(reads / daysPassed),
            avgWrites: Math.round(writes / daysPassed),
            avgDeletes: Math.round(deletes / daysPassed),
            cost: totalCost,
            details: {
                functions: functionsCost,
                firestore: firestoreCost,
                hosting: hostingCost
            },
            isExact: false
        };
    }, [data]);

    // Helper to process timeseries data into chart-friendly format
    // usage of useMemo is critical here to prevent recalculations on every render which might trigger library bugs
    const chartData = useMemo(() => {
        if (!data) return [];
        
        const dailyMap = new Map<string, { date: string; reads: number; writes: number; deletes: number }>();

        const fillMap = (metric: FirebaseMetric, key: 'reads' | 'writes' | 'deletes') => {
            if (!metric || !metric.timeSeries) return;
            
            metric.timeSeries.forEach(series => {
                if (!series.points) return;
                
                series.points.forEach(point => {
                    // Use ISO string YYYY-MM-DD as key to ensure correct sorting and filtering
                    // We can format it for display later in the UI
                    const isoDate = new Date(point.interval.startTime).toISOString().split('T')[0];
                    const val = point.value.int64Value ? parseInt(point.value.int64Value) : (point.value.doubleValue || 0);
                    
                    if (!dailyMap.has(isoDate)) {
                        dailyMap.set(isoDate, { date: isoDate, reads: 0, writes: 0, deletes: 0 });
                    }
                    const entry = dailyMap.get(isoDate)!;
                    entry[key] += val;
                });
            });
        };

        fillMap(data.data.reads, 'reads');
        fillMap(data.data.writes, 'writes');
        fillMap(data.data.deletes, 'deletes');

        // Filter for current month only
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        return Array.from(dailyMap.values())
            .filter(day => {
                // Now day.date is YYYY-MM-DD which parses correctly
                return new Date(day.date).getTime() >= currentMonthStart.getTime();
            })
            // Convert dates to display format after filtering and before returning
            .map(day => ({
                ...day,
                displayDate: format(new Date(day.date), "d MMM", { locale: tr })
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    const getDailyUsage = (metric: FirebaseMetric | undefined) => {
        // Daily quotas usually reset at midnight Pacific Time, but for UI simplicity we often use local midnight
        // or rely on Google's bucketing. To be safe/explicit matching the user request:
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return calculateUsageSince(metric, startOfDay);
    };

    const getMonthlyFunctionsUsage = (metric: FirebaseMetric | undefined) => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return calculateUsageSince(metric, startOfMonth);
    };

    // Helper for peak finding (7 days)
    const getPeak7DayUsage = (metric: FirebaseMetric | undefined) => {
        if (!metric || !metric.timeSeries) return 0;
        // Scan all points, take max of usage
        let maxUsage = 0;
        metric.timeSeries.forEach(series => {
            if (!series.points) return;
            // We fetch 30 days. Let's just look at the first 7 points (assuming 1 point per day alignment)
            const last7Points = series.points.slice(0, 7);
            last7Points.forEach(point => {
                const val = point.value.int64Value ? parseInt(point.value.int64Value) : (point.value.doubleValue || 0);
                if (val > maxUsage) maxUsage = val;
            });
        });
        return maxUsage;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">

           {/* ... Header ... */}
            <header className="px-6 py-5 border-b border-slate-200 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/settings" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <Database className="h-6 w-6 text-amber-600" />
                                Firebase Aylık Kullanım Analizi ve Fatura
                            </h1>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">
                                Google Cloud Monitoring API ("On-Demand")
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                         {lastUpdated && (
                            <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                                Son güncelleme: {format(lastUpdated, "HH:mm:ss")}
                            </span>
                        )}
                        <Button 
                            onClick={fetchData} 
                            disabled={loading}
                            variant="outline"
                            className={cn("gap-2 min-w-[120px] bg-white hover:bg-slate-50 transition-all", loading && "opacity-80")}
                        >
                            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                            {loading ? "Yükleniyor..." : "Yenile"}
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* ... Error Block ... */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <h3 className="text-red-900 font-bold text-sm">Veri Çekme Hatası</h3>
                                <p className="text-red-700 text-sm mt-1">
                                    {error.includes("Missing Project ID") 
                                        ? "Proje ID'si bulunamadı. .env dosyasını kontrol edin." 
                                        : "Google Cloud Monitoring API yanıt vermedi. Lütfen 'Monitoring Viewer' yetkisini ve API'nin aktif olduğunu kontrol edin."}
                                </p>
                                <p className="text-red-800/60 text-xs font-mono mt-2 bg-red-100/50 p-2 rounded">
                                    Kod: {error}
                                </p>
                            </div>
                        </div>
                    )}


                    

                    {/* Estimated Cost Card */}
                    {data && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                             <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                <Activity className="h-32 w-32 text-indigo-600" />
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg">
                                        <Database className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {(totals as any).isExact ? "Bu Ayın Net Maliyeti" : "Tahmini Bu Ay Maliyeti"}
                                        </h3>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {(totals as any).isExact ? "Google Billing (BigQuery) Verisi" : 'Blaze Plan "Pay as you go"'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col md:flex-row gap-8">
                                    <div className="shrink-0">
                                         <span className="text-sm text-slate-500 font-semibold uppercase tracking-wider">TOPLAM TUTAR</span>
                                         <div className="text-5xl font-black text-slate-900 mt-1 tracking-tight">
                                            ₺{(totals as any).cost.toFixed(2)}
                                         </div>
                                         <p className="text-xs text-slate-400 mt-2 max-w-[200px] leading-relaxed">
                                            {(totals as any).isExact 
                                                ? "Bu tutar Google Cloud Billing servisinden çekilen kesin veridir. Son 24 saat eksik olabilir." 
                                                : "Bu tutar, anlık API kullanımlarına göre tahmini olarak hesaplanmıştır. Kesin fatura farklılık gösterebilir."}
                                         </p>
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                            <span className="text-xs font-semibold text-slate-500">Cloud Functions</span>
                                            <div className="text-xl font-bold text-indigo-600 mt-1">
                                                ₺{(totals as any).details.functions.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                İşlemci ve Çağrı
                                            </div>
                                        </div>
                                         <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                            <span className="text-xs font-semibold text-slate-500">Cloud Firestore</span>
                                            <div className="text-xl font-bold text-amber-600 mt-1">
                                                ₺{(totals as any).details.firestore.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                Okuma, Yazma, Depolama
                                            </div>
                                        </div>
                                         <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                            <span className="text-xs font-semibold text-slate-500">Hosting</span>
                                            <div className="text-xl font-bold text-pink-600 mt-1">
                                                ₺{(totals as any).details.hosting.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                Bandwidth, Depolama
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {data && (
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-lg font-bold text-slate-800">Ürün Kullanımı & Kotalar (Spark Plan)</CardTitle>
                                <CardDescription>
                                    Günlük ve aylık ücretsiz kullanım limitlerine göre durumunuz.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    
                                    {/* Cloud Functions */}
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                <Activity className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">Cloud Functions</h4>
                                                <p className="text-xs text-slate-500">Aylık Çağrı (Invocations)</p>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span className="text-slate-700">
                                                    {(getMonthlyFunctionsUsage(data.data.functionsInvocations) / LIMITS.functions * 100).toFixed(1)}% kullanıldı
                                                </span>
                                                <span className="text-slate-500">
                                                    {getMonthlyFunctionsUsage(data.data.functionsInvocations).toLocaleString('tr-TR')} / 2M
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min((getMonthlyFunctionsUsage(data.data.functionsInvocations) / LIMITS.functions * 100), 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hosting */}
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="h-8 w-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                                                <HardDrive className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">Hosting</h4>
                                                <p className="text-xs text-slate-500">Kullanım & Depolama</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Bandwidth (Downloads) */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-700">Downloads (Bandwidth)</span>
                                                    <span className="text-slate-500">
                                                        {(getDailyUsage(data.data.hostingBandwidth) / (1024 * 1024)).toFixed(1)} MB / 360 MB
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500 mb-1">
                                                    {((getDailyUsage(data.data.hostingBandwidth) / LIMITS.bandwidth) * 100).toFixed(1)}% kullanıldı
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-pink-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((getDailyUsage(data.data.hostingBandwidth) / LIMITS.bandwidth * 100), 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Hosting Storage */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-700">Storage (Total Bytes)</span>
                                                    <span className="text-slate-500">
                                                        {data.data.hostingStorage ? getStorageSize(data.data.hostingStorage) : "0.00"} MB / 10 GB
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500 mb-1">
                                                     {data.data.hostingStorage ? (parseFloat(getStorageSize(data.data.hostingStorage) as string) / 10240 * 100).toFixed(1) : "0.0"}% kullanıldı
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-violet-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${data.data.hostingStorage ? Math.min((parseFloat(getStorageSize(data.data.hostingStorage) as string) / 10240 * 100), 100) : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Firestore */}
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                                                <Database className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">Cloud Firestore</h4>
                                                <p className="text-xs text-slate-500">Günlük İşlem Limitleri</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Reads */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-medium text-slate-700">Okuma (Reads)</span>
                                                    <span className="text-slate-500">
                                                        {getDailyUsage(data.data.reads).toLocaleString('tr-TR')} / 50K
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500 mb-1">
                                                    {((getDailyUsage(data.data.reads) / LIMITS.reads) * 100).toFixed(1)}% kullanıldı
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((getDailyUsage(data.data.reads) / LIMITS.reads * 100), 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Writes */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-medium text-slate-700">Yazma (Writes)</span>
                                                    <span className="text-slate-500">
                                                        {getDailyUsage(data.data.writes).toLocaleString('tr-TR')} / 20K
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500 mb-1">
                                                    {((getDailyUsage(data.data.writes) / LIMITS.writes) * 100).toFixed(1)}% kullanıldı
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((getDailyUsage(data.data.writes) / LIMITS.writes * 100), 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Deletes */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-medium text-slate-700">Silme (Deletes)</span>
                                                    <span className="text-slate-500">
                                                        {getDailyUsage(data.data.deletes).toLocaleString('tr-TR')} / 20K
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500 mb-1">
                                                    {((getDailyUsage(data.data.deletes) / LIMITS.deletes) * 100).toFixed(1)}% kullanıldı
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((getDailyUsage(data.data.deletes) / LIMITS.deletes * 100), 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Reads Card */}
                        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
                           {/* ... Content ... */}
                           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Activity className="h-24 w-24 text-blue-600" />
                           </div>
                           <CardHeader className="pb-2">
                               <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Toplam Okuma (Bu Ay)
                            </CardTitle>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900 tracking-tight">
                                {totals.reads.toLocaleString('tr-TR')}
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                Ort. {totals.avgReads.toLocaleString('tr-TR')} / gün
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <BarChart3 className="h-16 w-16 text-amber-500" />
                        </div>
                         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Toplam Yazma (Bu Ay)
                            </CardTitle>
                        </CardHeader>
                           <CardContent>
                               <div className="text-4xl font-black text-slate-900 tracking-tight">
                                   {totals.writes.toLocaleString('tr-TR')}
                               </div>
                               <p className="text-xs text-slate-400 mt-1 font-medium font-mono text-amber-600">
                                   Ort. {totals.avgWrites.toLocaleString('tr-TR')} / gün
                               </p>
                           </CardContent>
                        </Card>

                        {/* Deletes Card */}
                         <Card className="border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                           <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Trash2 className="h-16 w-16 text-red-500" />
                           </div>
                           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                               <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                   Toplam Silme (Bu Ay)
                               </CardTitle>
                           </CardHeader>
                           <CardContent>
                               <div className="text-4xl font-black text-slate-900 tracking-tight">
                                   {totals.deletes.toLocaleString('tr-TR')}
                               </div>
                               <p className="text-xs text-slate-400 mt-1 font-medium font-mono text-red-600">
                                   Ort. {(totals as any).avgDeletes.toLocaleString('tr-TR')} / gün
                               </p>
                           </CardContent>
                        </Card>
                    </div>

                    {/* Charts Section - Temporarily Disabled due to React 19 / Recharts Incompatibility */}
                    {/* {chartData.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-slate-200 shadow-sm lg:col-span-2">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Operasyon Grafiği (Son 30 Gün)</CardTitle>
                                            <CardDescription>
                                                Okuma, yazma ve silme işlemlerinin günlük dağılımı.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="w-full pt-4 overflow-x-auto">
                                    <div style={{ minWidth: '600px', height: '350px' }}>
                                        <AreaChart width={800} height={350} data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorReads" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorWrites" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#94a3b8" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis 
                                                stroke="#94a3b8" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            {/* <Tooltip 
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                                            />
                                            <Legend iconType="circle" /> */}
                                            {/* <Area 
                                                type="monotone" 
                                                dataKey="reads" 
                                                name="Okuma" 
                                                stroke="#2563eb" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorReads)" 
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="writes" 
                                                name="Yazma" 
                                                stroke="#d97706" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorWrites)" 
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="deletes" 
                                                name="Silme" 
                                                stroke="#ef4444" 
                                                strokeWidth={2}
                                                fill="none" 
                                            />
                                        </AreaChart>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )} */}

                    {/* Detailed Data Table */}
                    {data && (
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle>Günlük Döküm</CardTitle>
                                <CardDescription>
                                    Son 30 günün işlem detayları tablosu.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                     <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Tarih</th>
                                                <th className="px-6 py-4 font-semibold text-blue-700 text-right">Okuma</th>
                                                <th className="px-6 py-4 font-semibold text-amber-700 text-right">Yazma</th>
                                                <th className="px-6 py-4 font-semibold text-red-700 text-right">Silme</th>
                                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Toplam İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {/* We want to show newest first in table, so we reverse the chart data (which is old->new) */}
                                            {[...chartData].reverse().map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-600">{(row as any).displayDate || row.date}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-slate-600">{row.reads.toLocaleString('tr-TR')}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-slate-600">{row.writes.toLocaleString('tr-TR')}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-slate-600">{row.deletes.toLocaleString('tr-TR')}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-slate-900">
                                                        {(row.reads + row.writes + row.deletes).toLocaleString('tr-TR')}
                                                    </td>
                                                </tr>
                                            ))}
                                            {chartData.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                                        Görüntülenecek veri bulunamadı.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                     </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
