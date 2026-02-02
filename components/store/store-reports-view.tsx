"use client";

import { useState, useMemo } from "react";
import { BarChart3, AlertTriangle, FileText, Calendar } from "lucide-react";
import { useStoreData } from "@/hooks/use-store-data";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuditCard } from "@/components/audit-card";
import { useRouter } from "next/navigation";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from "recharts";

export function StoreReportsView() {
    const [selectedYear, setSelectedYear] = useState("2026");
    const { audits, loading } = useStoreData();
    const router = useRouter();

    // Years to display
    const years = ["2026", "2027", "2028"];

    // Filter audits by year (Mocking year filtering for now as most data is recent/test)
    // In production, parse audit.createdAt or completedAt dates
    const filteredAudits = useMemo(() => {
        // Since we don't have real 2026 data yet, we might show all for demo
        // or filter strictly. Let's filter strictly if date strings available.
        return audits; 
    }, [audits, selectedYear]);

    // Mock Data for "Sürekli Hayırlar" (Persistent Failures)
    const persistentFailures = [
        { id: 1, question: "Mağaza temizliği ve düzeni uygun mu?", count: 3, lastDate: "12.01.2026" },
        { id: 2, question: "Personel kılık kıyafet yönetmeliğine uyuyor mu?", count: 2, lastDate: "05.01.2026" },
        { id: 3, question: "Fiyat etiketleri güncel mi?", count: 2, lastDate: "28.12.2025" },
    ];

    // Mock Data for "Puan Özeti" (Score Summary)
    const scoreData = [
        { name: 'Ocak', puan: 85 },
        { name: 'Şubat', puan: 92 },
        { name: 'Mart', puan: 78 },
        { name: 'Nisan', puan: 88 },
        { name: 'Mayıs', puan: 95 },
        { name: 'Haziran', puan: 90 },
    ];

    const handleAuditClick = (auditId: string) => {
        router.push(`/audits/${auditId}/summary`);
    };

    return (
        <div className="container mx-auto py-6 px-4 md:px-6 space-y-6 mb-20">
            {/* Header & Year Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Raporlar</h2>
                    <p className="text-muted-foreground text-sm">
                        Mağaza performans ve denetim analizleri.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Yıl Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((year) => (
                                <SelectItem key={year} value={year}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="audits" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="audits">Denetim</TabsTrigger>
                    <TabsTrigger value="failures">Sürekli Hayırlar</TabsTrigger>
                    <TabsTrigger value="scores">Puan Özeti</TabsTrigger>
                </TabsList>

                {/* Tab: Denetim (Audits List) */}
                <TabsContent value="audits" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                         <h3 className="text-lg font-medium">{selectedYear} Denetimleri</h3>
                         <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {filteredAudits.length} Kayıt
                        </span>
                    </div>
                    
                    {filteredAudits.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                            <p className="text-muted-foreground">Bu yıla ait denetim bulunamadı.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                             {filteredAudits.map((audit) => (
                                <AuditCard
                                    key={audit.id}
                                    auditId={audit.id}
                                    storeName={audit.storeName}
                                    auditorName={audit.auditorName}
                                    auditType={audit.auditType}
                                    completedAt={audit.completedAt}
                                    score={audit.score}
                                    totalScore={audit.totalScore}
                                    hasActions={audit.hasActions}
                                    actionStats={audit.actionStats}
                                    lastSubmittedAt={audit.lastSubmittedAt}
                                    onClick={() => handleAuditClick(audit.id)}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Tab: Sürekli Hayırlar (Persistent Failures) */}
                <TabsContent value="failures" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                En Çok Tekrarlanan Hayırlar
                            </CardTitle>
                            <CardDescription>
                                {selectedYear} yılında yapılan denetimlerde en sık "Hayır" yanıtı alınan maddeler.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {persistentFailures.map((item, index) => (
                                    <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <p className="font-medium text-sm leading-none">{item.question}</p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                                                <span className="flex items-center gap-1 font-semibold text-red-600">
                                                    <AlertTriangle className="h-3 w-3" /> {item.count} Tekrar
                                                </span>
                                                <span>Son Görülme: {item.lastDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Puan Özeti (Score Summary) */}
                <TabsContent value="scores" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Monthly Summary Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-blue-500" />
                                Puan Performans Tablosu
                            </CardTitle>
                            <CardDescription>
                                {selectedYear} yılı aylık denetim puanları listesi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50 hover:bg-muted/50">
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-1/2">Ay</th>
                                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-1/2">Puan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scoreData.map((item, index) => (
                                            <tr key={index} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                <td className="p-4 align-middle font-medium">{item.name}</td>
                                                <td className="p-4 align-middle text-right">
                                                    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold
                                                        ${item.puan >= 85 ? 'bg-green-100 text-green-700' : 
                                                          item.puan >= 70 ? 'bg-yellow-100 text-yellow-700' : 
                                                          'bg-red-100 text-red-700'}`}>
                                                        {item.puan}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Detailed Audit List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-purple-500" />
                                Denetim Detayları
                            </CardTitle>
                            <CardDescription>
                                {selectedYear} yılında yapılan tüm denetimlerin detaylı listesi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50 hover:bg-muted/50">
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Denetmen</th>
                                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Puan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAudits.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                                    Bu yıla ait denetim kaydı bulunamadı.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAudits.map((audit) => (
                                                <tr key={audit.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                    <td className="p-4 align-middle font-medium">
                                                        {audit.completedAt?.toDate ? 
                                                            audit.completedAt.toDate().toLocaleDateString('tr-TR') : 
                                                            new Date().toLocaleDateString('tr-TR')}
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{audit.auditorName || "Bilinmiyor"}</span>
                                                            <span className="text-xs text-muted-foreground capitalize">{audit.auditType || "Denetim"}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-middle text-right">
                                                        <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold
                                                            ${audit.score >= 85 ? 'bg-green-100 text-green-700' : 
                                                              audit.score >= 70 ? 'bg-yellow-100 text-yellow-700' : 
                                                              'bg-red-100 text-red-700'}`}>
                                                            {audit.score}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                             <CardHeader className="pb-2">
                                <CardDescription>Yıllık Ortalama</CardDescription>
                                <CardTitle className="text-3xl font-bold text-primary">88.5</CardTitle>
                             </CardHeader>
                        </Card>
                        <Card>
                             <CardHeader className="pb-2">
                                <CardDescription>Toplam Denetim</CardDescription>
                                <CardTitle className="text-3xl font-bold text-primary">{filteredAudits.length}</CardTitle>
                             </CardHeader>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
