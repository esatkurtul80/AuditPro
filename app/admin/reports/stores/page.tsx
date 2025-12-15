"use client";

import { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
    Timestamp,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

export default function StoresReportPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        // Varsayılan olarak son 30 gün
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);

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
            const auditsData = auditsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Audit[];
            setAudits(auditsData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const getFilteredAudits = () => {
        if (!startDate || !endDate) return audits;

        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        return audits.filter((audit) => {
            const auditTime = audit.completedAt?.toMillis() || 0;
            return auditTime >= start && auditTime <= end;
        });
    };

    const getStoreStats = () => {
        const filteredAudits = getFilteredAudits();

        return stores.map((store) => {
            const storeAudits = filteredAudits.filter((a) => a.storeId === store.id);

            if (storeAudits.length === 0) {
                return {
                    name: store.name,
                    avgScore: 0,
                    auditCount: 0,
                    successRate: 0,
                };
            }

            const totalScore = storeAudits.reduce((sum, audit) => sum + audit.totalScore, 0);
            const maxPossible = storeAudits.reduce((sum, audit) => sum + audit.maxScore, 0);
            const avgScore = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
            const successAudits = storeAudits.filter((a) => (a.totalScore / a.maxScore) >= 0.8).length;
            const successRate = (successAudits / storeAudits.length) * 100;

            return {
                name: store.name,
                avgScore: parseFloat(avgScore.toFixed(1)),
                auditCount: storeAudits.length,
                successRate: parseFloat(successRate.toFixed(1)),
            };
        });
    };

    const getTrendData = () => {
        const filteredAudits = getFilteredAudits();

        // Son 6 ay için aylık ortalamalar
        const monthlyData: { [key: string]: { total: number; count: number } } = {};

        filteredAudits.forEach((audit) => {
            const date = audit.completedAt?.toDate();
            if (!date) return;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const scorePercent = (audit.totalScore / audit.maxScore) * 100;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { total: 0, count: 0 };
            }

            monthlyData[monthKey].total += scorePercent;
            monthlyData[monthKey].count += 1;
        });

        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                avgScore: parseFloat((data.total / data.count).toFixed(1)),
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-6);
    };


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const storeStats = getStoreStats();
    const trendData = getTrendData();

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold flex items-center gap-3">
                    <BarChart3 className="h-10 w-10" />
                    Mağaza Karşılaştırma Raporu
                </h1>
                <p className="text-muted-foreground mt-2">
                    Mağazaların denetim performanslarını karşılaştırın
                </p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Tarih Aralığı</CardTitle>
                    <CardDescription>Rapor için tarih aralığını seçin</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label>Başlangıç Tarihi</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Bitiş Tarihi</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Mağaza Puan Karşılaştırması</CardTitle>
                        <CardDescription>Ortalama başarı puanları (%)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={storeStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Bar dataKey="avgScore" fill="#8b5cf6" name="Ortalama Puan (%)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Başarı Oranları</CardTitle>
                        <CardDescription>%80 ve üzeri puan alan denetim oranı</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={storeStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Bar dataKey="successRate" fill="#10b981" name="Başarı Oranı (%)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Denetim Sayıları</CardTitle>
                        <CardDescription>Toplam yapılan denetim sayıları</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={storeStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="auditCount" fill="#3b82f6" name="Denetim Sayısı" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Zaman Serisi</CardTitle>
                        <CardDescription>Aylık ortalama puan trendi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="avgScore"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    name="Ortalama Puan (%)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Radar Grafiği</CardTitle>
                    <CardDescription>Mağazaların genel performans karşılaştırması</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                        <RadarChart data={storeStats}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="name" />
                            <PolarRadiusAxis domain={[0, 100]} />
                            <Radar
                                name="Ortalama Puan"
                                dataKey="avgScore"
                                stroke="#8b5cf6"
                                fill="#8b5cf6"
                                fillOpacity={0.6}
                            />
                            <Tooltip />
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
