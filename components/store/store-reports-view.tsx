"use client";

import { useState, useMemo } from "react";
import { BarChart3, AlertTriangle, FileText, Calendar, Store, AlertCircle, X, XCircle } from "lucide-react";
import { useStoreData } from "@/hooks/use-store-data";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportAuditCard } from "@/components/report-audit-card";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";

interface RecurringFailureDetail {
    date: Date;
    failType: "Hayır" | "Eksik Puan";
    actionData?: any;
    auditId: string;
    auditorNotes?: string[];
    auditorPhotos?: string[];
}

interface ExpandedRecurringIssue {
    id: string;
    question: string;
    count: number;
    lastDate: string;
    failures: RecurringFailureDetail[];
}

export function StoreReportsView() {
    const [selectedYear, setSelectedYear] = useState("2026");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { audits, loading } = useStoreData();
    const router = useRouter();

    // Years to display (2026 to 2036)
    const years = Array.from({ length: 11 }, (_, i) => (2026 + i).toString());

    // 1. Filter audits by year (Real Logic)
    const filteredAudits = useMemo(() => {
        if (!audits) return [];
        return audits.filter(audit => {
            const auditDate = audit.completedAt instanceof Date 
                ? audit.completedAt 
                : (audit.completedAt?.toDate ? audit.completedAt.toDate() : new Date(audit.completedAt));
            
            return auditDate.getFullYear().toString() === selectedYear;
        });
    }, [audits, selectedYear]);

    // 2. Calculate "Sürekli Hayırlar" (Persistent Failures) with details
    const persistentFailures = useMemo(() => {
        const failureMap = new Map<string, ExpandedRecurringIssue>();

        filteredAudits.forEach(audit => {
            if (!audit.sections) return;
            const auditDate = audit.completedAt instanceof Date 
                ? audit.completedAt 
                : (audit.completedAt?.toDate ? audit.completedAt.toDate() : new Date(audit.completedAt));

            audit.sections.forEach((section: any) => {
                section.answers?.forEach((answer: any) => {
                    const isFailure = answer.answer === "hayir" || (answer.questionType === "checkbox" && answer.earnedPoints < (answer.maxPoints || 0));
                    
                    if (isFailure) {
                        const existing = failureMap.get(answer.questionId);
                        const detail: RecurringFailureDetail = {
                            date: auditDate,
                            failType: answer.answer === "hayir" ? "Hayır" : "Eksik Puan",
                            actionData: answer.actionData,
                            auditId: audit.id,
                            auditorNotes: answer.notes,
                            auditorPhotos: answer.photos
                        };

                        if (existing) {
                            existing.count++;
                            existing.failures.push(detail);
                        } else {
                            failureMap.set(answer.questionId, {
                                id: answer.questionId,
                                question: answer.questionText,
                                count: 1,
                                lastDate: format(auditDate, "dd.MM.yyyy"),
                                failures: [detail]
                            });
                        }
                    }
                });
            });
        });

        return Array.from(failureMap.values())
            .filter(issue => issue.count >= 2) // Only show truly recurring failures (2+ times)
            .map(issue => {
                issue.failures.sort((a, b) => b.date.getTime() - a.date.getTime());
                issue.lastDate = format(issue.failures[0].date, "dd.MM.yyyy");
                return issue;
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 50);
    }, [filteredAudits]);

    // 3. Calculate "Puan Özeti" (Score Summary) - Monthly Avgs
    const scoreData = useMemo(() => {
        const months = [
            'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
        ];
        
        const monthlyStats = new Map<number, { total: number, count: number }>();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear().toString();

        filteredAudits.forEach(audit => {
             const auditDate = audit.completedAt instanceof Date 
                ? audit.completedAt 
                : (audit.completedAt?.toDate ? audit.completedAt.toDate() : new Date(audit.completedAt));
            
            const monthIdx = auditDate.getMonth();
            const current = monthlyStats.get(monthIdx) || { total: 0, count: 0 };
            
            monthlyStats.set(monthIdx, {
                total: current.total + audit.score,
                count: current.count + 1
            });
        });

        return months.map((name, index) => {
            const hasData = monthlyStats.has(index);
            const isFutureMonthInCurrentYear = selectedYear === currentYear && index > currentMonth;
            const isFutureYear = parseInt(selectedYear) > parseInt(currentYear);

            if (!hasData && (isFutureMonthInCurrentYear || isFutureYear)) {
                return null;
            }

            const stats = monthlyStats.get(index);
            const avg = stats && stats.count > 0 ? Math.round(stats.total / stats.count) : 0;

            return {
                name,
                puan: avg,
                hasData: !!stats
            };
        }).filter(Boolean) as { name: string, puan: number, hasData: boolean }[];

    }, [filteredAudits, selectedYear]);

    // Calculate YTD Average for the selected year
    const yearlyAverage = useMemo(() => {
        if (filteredAudits.length === 0) return "0";
        const total = filteredAudits.reduce((acc, curr) => acc + curr.score, 0);
        return (total / filteredAudits.length).toFixed(1);
    }, [filteredAudits]);


    const handleAuditClick = (auditId: string) => {
        router.push(`/audits/${auditId}/summary`);
    };

    if (loading) {
        return <div className="h-40 flex items-center justify-center text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="container mx-auto py-6 px-4 md:px-6 space-y-6 mb-20 relative">
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
                                    <ReportAuditCard
                                        key={audit.id}
                                        auditId={audit.id}
                                        storeName={audit.storeName}
                                        auditorName={audit.auditorName || "Sistem"}
                                        auditType={audit.auditType || "Genel Denetim"}
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

                {/* Tab: Sürekli Hayırlar (Detailed Persistent Failures) */}
                <TabsContent value="failures" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Tekrarlanan Başarısızlıklar
                            </CardTitle>
                            <CardDescription>
                                {selectedYear} yılında yapılan denetimlerde en sık "Hayır" alınan veya eksik puan alınan maddeler ve detayları.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {persistentFailures.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">Kayıt bulunamadı.</p>
                                ) : (
                                    persistentFailures.map((item, index) => (
                                        <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                     <h4 className="font-semibold text-base leading-tight">{item.question}</h4>
                                                     <div className="mt-1 flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                            {item.count} Kez Tekrarlandı
                                                        </span>
                                                     </div>
                                                </div>
                                            </div>

                                            {/* Failure History Details */}
                                            <div className="space-y-3">
                                                {item.failures.map((fail, fIdx) => (
                                                    <div key={`${fail.auditId}-${fIdx}`} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm border border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                                    {format(fail.date, "d MMMM yyyy", { locale: tr })}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                                                {fail.failType}
                                                            </span>
                                                        </div>

                                                        {/* Auditor Findings (Notes & Photos) */}
                                                        {((fail.auditorNotes && fail.auditorNotes.length > 0) || (fail.auditorPhotos && fail.auditorPhotos.length > 0)) && (
                                                            <div className="mb-3 pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Denetmen Tespiti</div>
                                                                
                                                                {fail.auditorNotes && fail.auditorNotes.length > 0 && (
                                                                    <div className="space-y-1">
                                                                        {fail.auditorNotes.map((note, noteIdx) => (
                                                                            <div key={noteIdx} className="flex gap-2">
                                                                                <FileText className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                                                                <p className="text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap flex-1 min-w-0">{note}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                
                                                                {fail.auditorPhotos && fail.auditorPhotos.length > 0 && (
                                                                    <div className="flex gap-2 flex-wrap mt-1">
                                                                        {fail.auditorPhotos.map((img: string, i: number) => (
                                                                            <img 
                                                                                key={i} 
                                                                                src={img} 
                                                                                alt="Denetmen Fotoğrafı" 
                                                                                className="h-20 w-20 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity" 
                                                                                onClick={() => setSelectedImage(img)}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Store Action Data Display */}
                                                        <div className="flex flex-col gap-2">
                                                             <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mağaza Aksiyonu</div>
                                                            {fail.actionData && (fail.actionData.storeNote || (fail.actionData.storeImages && fail.actionData.storeImages.length > 0)) ? (
                                                                <div className="flex flex-col gap-2">
                                                                    {fail.actionData.storeNote && (
                                                                        <div className="flex gap-2">
                                                                            <Store className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                                            <p className="text-slate-600 dark:text-slate-400 italic break-all whitespace-pre-wrap flex-1 min-w-0">"{fail.actionData.storeNote}"</p>
                                                                        </div>
                                                                    )}
                                                                    {fail.actionData.storeImages && fail.actionData.storeImages.length > 0 && (
                                                                        <div className="flex gap-2 flex-wrap mt-1">
                                                                            {fail.actionData.storeImages.map((img: string, i: number) => (
                                                                                <img 
                                                                                    key={i} 
                                                                                    src={img} 
                                                                                    alt="Aksiyon" 
                                                                                    className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                                                                                    onClick={() => setSelectedImage(img)}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    Mağaza henüz aksiyon almadı veya not girmedi.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
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
                                {selectedYear} yılı aylık ortalama denetim puanları.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50 hover:bg-muted/50">
                                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-1/2">Ay</th>
                                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-1/2">Ortalama Puan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scoreData.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} className="p-4 text-center text-muted-foreground">Veri bulunamadı.</td>
                                            </tr>
                                        ) : (
                                            scoreData.map((item, index) => (
                                                <tr key={index} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                    <td className="p-4 align-middle font-medium">{item.name}</td>
                                                    <td className="p-4 align-middle text-right">
                                                        {item.hasData ? (
                                                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold
                                                                ${item.puan >= 85 ? 'bg-green-100 text-green-700' : 
                                                                  item.puan >= 70 ? 'bg-yellow-100 text-yellow-700' : 
                                                                  'bg-red-100 text-red-700'}`}>
                                                                {item.puan}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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
                                            filteredAudits
                                                .sort((a, b) => {
                                                    const dateA = a.completedAt instanceof Date ? a.completedAt : (a.completedAt?.toDate ? a.completedAt.toDate() : new Date());
                                                    const dateB = b.completedAt instanceof Date ? b.completedAt : (b.completedAt?.toDate ? b.completedAt.toDate() : new Date());
                                                    return dateB.getTime() - dateA.getTime();
                                                })
                                                .map((audit) => (
                                                <tr key={audit.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleAuditClick(audit.id)}>
                                                    <td className="p-4 align-middle font-medium">
                                                        {audit.completedAt instanceof Date 
                                                            ? audit.completedAt.toLocaleDateString('tr-TR') 
                                                            : (audit.completedAt?.toDate ? audit.completedAt.toDate().toLocaleDateString('tr-TR') : "-")}
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
                                <CardTitle className={cn(
                                    "text-3xl font-bold",
                                    parseFloat(yearlyAverage) >= 90 ? "text-emerald-600" :
                                    parseFloat(yearlyAverage) >= 75 ? "text-blue-600" :
                                    parseFloat(yearlyAverage) >= 60 ? "text-orange-600" : "text-red-600"
                                )}>{yearlyAverage}</CardTitle>
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

            {/* Lightbox Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                        aria-label="Kapat"
                    >
                        <XCircle className="h-8 w-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selectedImage}
                        alt="Tam boyut fotoğraf"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
