import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    MapPin, 
    Calendar, 
    Clock, 
    User, 
    History, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle,
    Building2,
    TrendingUp,
    AlertOctagon,
    ArrowRight,
    Store,
    AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getStoreAnalysis } from "@/lib/store-analysis";
import type { StoreAnalysisData } from "@/lib/store-analysis";
import { cn, getWorkingDaysPassed } from "@/lib/utils";

interface StoreAnalysisDialogProps {
    storeId: string;
    storeName: string;
    isOpen: boolean;
    onClose: () => void;
}

export function StoreAnalysisDialog({ storeId, storeName, isOpen, onClose }: StoreAnalysisDialogProps) {
    const [data, setData] = useState<StoreAnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && storeId) {
            setLoading(true);
            getStoreAnalysis(storeId)
                .then(result => {
                    setData(result);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isOpen, storeId]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-200";
        if (score >= 75) return "text-amber-600 bg-amber-50 border-amber-200";
        return "text-rose-600 bg-rose-50 border-rose-200";
    };

    const getDaysColor = (days: number | null) => {
        if (!days) return "text-slate-500 bg-slate-100";
        if (days < 30) return "text-emerald-600 bg-emerald-50";
        if (days < 60) return "text-amber-600 bg-amber-50";
        return "text-rose-600 bg-rose-50";
    };

    const formatHistoryAnswer = (item: any) => {
        if (!item.answer) return "-";

        if (item.questionType === 'yes_no') {
            if (item.answer === 'evet') return 'Evet';
            if (item.answer === 'hayir') return 'Hayır';
            if (item.answer === 'muaf') return 'Muaf';
            return item.answer;
        }

        if ((item.questionType === 'multiple_choice' || item.questionType === 'checkbox') && item.options) {
            // Try to match ID with option text
            const answerId = item.answer;
            const option = item.options.find((opt: any) => opt.id === answerId);
            if (option) return option.text;
            
            // If comma separated (checkbox)
            if (answerId.includes(',')) {
                const ids = answerId.split(',').map((id: string) => id.trim());
                const texts = ids.map((id: string) => {
                     const opt = item.options.find((o: any) => o.id === id);
                     return opt ? opt.text : id;
                });
                return texts.join(', ');
            }
        }

        return item.answer;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] max-w-7xl sm:max-w-7xl md:max-w-7xl lg:max-w-7xl h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 border-b bg-slate-50/50 shrink-0 pr-12">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Building2 className="h-6 w-6 text-blue-600" />
                                {storeName}
                            </DialogTitle>
                            {data?.store?.city && (
                                <p className="text-slate-500 flex items-center gap-1 mt-1 text-sm">
                                    <MapPin className="h-3 w-3" />
                                    {data.store.city}
                                </p>
                            )}
                        </div>

                        {/* Top Stats */}
                        {!loading && data && (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-start">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Son Puan</span>
                                    <Badge variant="outline" className={cn("text-lg px-3 py-1 font-bold", getScoreColor(data.lastScore || 0))}>
                                        {data.lastScore ? `${data.lastScore.toFixed(0)}` : '-'}
                                    </Badge>
                                </div>
                                <div className="w-px h-10 bg-slate-200 mx-1"></div>
                                <div className="flex flex-col items-start px-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Son Denetim</span>
                                    <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold border", getDaysColor(data.daysSinceLastAudit))}>
                                        <History className="h-4 w-4" />
                                        {data.daysSinceLastAudit !== null ? `${data.daysSinceLastAudit} Gün Önce` : 'Yeni'}
                                    </div>
                                </div>
                                
                                {/* Action Return Stats */}
                                {(() => {
                                    if (!data.auditHistory || data.auditHistory.length === 0) return null;
                                    const lastAudit = data.auditHistory[0];
                                    
                                    // 1. Check if ANY action was needed
                                    let hasActionItems = false;
                                    let allResponded = true;
                                    let firstSubmissionDate: Date | null = null;

                                    lastAudit.sections.forEach(section => {
                                        section.answers.forEach(answer => {
                                            const isActionNeeded = answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf" && (answer.earnedPoints || 0) < (answer.maxPoints || 0);
                                            if (isActionNeeded) {
                                                hasActionItems = true;
                                                const status = answer.actionData?.status;
                                                if (!status || status === "pending_store") {
                                                    allResponded = false;
                                                }
                                                // Track earliest submission
                                                if (answer.actionData?.submittedAt) {
                                                    const subDate = answer.actionData.submittedAt.toDate();
                                                    if (!firstSubmissionDate || subDate < firstSubmissionDate) {
                                                        firstSubmissionDate = subDate;
                                                    }
                                                }
                                            }
                                        });
                                    });

                                    if (!hasActionItems) {
                                        return (
                                            <>
                                                <div className="w-px h-10 bg-slate-200 mx-1"></div>
                                                <div className="flex flex-col items-start px-2">
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksiyon</span>
                                                    <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-200 px-3 py-1 font-bold">
                                                        Gerekmedi
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    }

                                    // 2. Logic for Response Time
                                    let content;
                                    
                                    if (!allResponded) {
                                         content = (
                                            <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 px-3 py-1 font-bold animate-pulse">
                                                Dönüş Yapılmadı
                                            </Badge>
                                        );
                                    } else if (firstSubmissionDate && lastAudit.completedAt) {
                                        // Calculate Business Days
                                        const count = getWorkingDaysPassed(lastAudit.completedAt.toDate(), firstSubmissionDate);
                                        
                                        const isLate = count > 3;
                                        content = (
                                            <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold border", 
                                                isLate ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
                                            )}>
                                                {isLate ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                                {isLate ? `Geç Döndü (${count} Gün)` : `Zamanında (${count} Gün)`}
                                            </div>
                                        );
                                    } else {
                                        // Fallback logic if dates are missing but status is approved (?) - unlikely
                                        content = <Badge variant="outline">Veri Yok</Badge>;
                                    }

                                    return (
                                        <>
                                            <div className="w-px h-10 bg-slate-200 mx-1"></div>
                                            <div className="flex flex-col items-start px-2">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksiyon Dönüşü</span>
                                                {content}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (



                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="bg-white border-b p-4 shrink-0">
                            {/* Sliding Pill Tab Container */}
                            <div className="relative bg-slate-100 rounded-lg p-1 shadow-inner flex overflow-hidden border border-slate-200">
                                {/* Sliding Background Pill */}
                                <div 
                                    className="absolute top-1 bottom-1 left-1 w-[calc(25%-3px)] bg-slate-900 rounded-md transition-all duration-300 ease-out shadow-sm z-0"
                                    style={{ 
                                        transform: `translateX(${
                                            activeTab === 'overview' ? '0%' : 
                                            activeTab === 'last_failures' ? '100%' :
                                            activeTab === 'history' ? '200%' : '300%'
                                        })` 
                                    }}
                                />

                                {/* Tab Buttons */}
                                <button
                                    onClick={() => setActiveTab("overview")}
                                    className={cn(
                                        "flex-1 relative z-10 py-3 px-1 text-xs md:text-sm font-medium text-center transition-colors duration-200 flex flex-col items-center justify-center gap-0.5 select-none leading-tight",
                                        activeTab === "overview" ? "text-white" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <span>Genel</span>
                                    <span>Bakış</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab("last_failures")}
                                    className={cn(
                                        "flex-1 relative z-10 py-3 px-1 text-xs md:text-sm font-medium text-center transition-colors duration-200 flex flex-col items-center justify-center gap-0.5 select-none leading-tight",
                                        activeTab === "last_failures" ? "text-white" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <span>Son</span>
                                    <div className="flex items-center gap-1 relative">
                                        <span>Denetim</span>
                                        <AlertOctagon className={cn("w-3 h-3 mb-0.5", activeTab === "last_failures" ? "text-white" : "text-amber-500")} />
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab("history")}
                                    className={cn(
                                        "flex-1 relative z-10 py-3 px-1 text-xs md:text-sm font-medium text-center transition-colors duration-200 flex flex-col items-center justify-center gap-0.5 select-none leading-tight",
                                        activeTab === "history" ? "text-white" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <span>Denetim</span>
                                    <div className="flex items-center gap-1 relative">
                                        <span>Geçmişi</span>
                                        {data?.auditHistory.length ? (
                                             <span className={cn("text-[10px] font-bold opacity-80", activeTab === "history" ? "text-slate-200" : "text-slate-400")}>
                                                ({data.auditHistory.length})
                                            </span>
                                        ) : null}
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab("recurring")}
                                    className={cn(
                                        "flex-1 relative z-10 py-3 px-1 text-xs md:text-sm font-medium text-center transition-colors duration-200 flex flex-col items-center justify-center gap-0.5 select-none leading-tight",
                                        activeTab === "recurring" ? "text-white" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <span>Tekrarlayan</span>
                                    <div className="flex items-center gap-1 relative">
                                        <span>Hayırlar</span>
                                        {data?.recurringIssues && data.recurringIssues.length > 0 && (
                                            <span className={cn(
                                                "min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors duration-200 shrink-0 mb-px",
                                                activeTab === "recurring" 
                                                    ? "bg-white text-slate-900" 
                                                    : "bg-rose-100 text-rose-600"
                                            )}>
                                                {data.recurringIssues.length}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
                            
                            {/* OVERVIEW TAB */}
                            <TabsContent value="overview" className="m-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="p-5 border-l-4 border-l-blue-500 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Building2 className="h-5 w-5 text-blue-500" />
                                            Mağaza Bilgileri
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
                                                <span className="text-sm text-slate-500">Bölge Müdürü</span>
                                                <span className="text-sm font-semibold text-slate-900 text-right">
                                                    {data?.regionalManagerName || "-"}
                                                </span>
                                            </div>
                                            <div className="flex items-start justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
                                                <span className="text-sm text-slate-500">İl</span>
                                                <span className="text-sm font-semibold text-slate-900">{data?.store?.city || "-"}</span>
                                            </div>
                                            {data?.store?.location && (
                                                <div className="flex items-start justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
                                                    <span className="text-sm text-slate-500">Konum</span>
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.store.location)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center justify-end gap-1 whitespace-nowrap"
                                                    >
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        Haritada Görüntüle
                                                    </a>
                                                </div>
                                            )}
                                            <div className="flex items-start justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
                                                <span className="text-sm text-slate-500">Format</span>
                                                <Badge variant="secondary">{data?.store?.type || "Standart"}</Badge>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-5 border-l-4 border-l-amber-500 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-amber-500" />
                                            Sevkiyat & Operasyon
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                                                <div className="bg-amber-100 p-2 rounded-md text-amber-700">
                                                    <Calendar className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium uppercase">Sevkiyat Günü</p>
                                                    <p className="font-bold text-slate-900">{data?.store?.shipmentDay || "Belirtilmemiş"}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                                                <div className="bg-amber-100 p-2 rounded-md text-amber-700">
                                                    <Clock className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium uppercase">Sevkiyat Saati</p>
                                                    <p className="font-bold text-slate-900">{data?.store?.shipmentTime || "Belirtilmemiş"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                                
                                {data?.lastAuditDate && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
                                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                                            <History className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-blue-900 text-sm">Son Denetim Özeti</h4>
                                            <p className="text-blue-700 text-xs mt-1">
                                                En son <strong>{format(data.lastAuditDate, 'd MMMM yyyy', {locale: tr})}</strong> tarihinde denetlendi. 
                                                Aradan geçen süre: <strong className="underline">{data.daysSinceLastAudit} gün</strong>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            {/* LAST FAILURES TAB */}
                            <TabsContent value="last_failures" className="m-0">
                                {(!data?.auditHistory?.[0] || data.auditHistory[0].totalScore === 100) ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="bg-emerald-50 p-4 rounded-full mb-4">
                                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900">Son Denetim Başarılı</h3>
                                        <p className="text-slate-500 max-w-sm mt-2">Son denetimde herhangi bir başarısız soru bulunamadı.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-800">
                                            <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />
                                            <p><strong>{data?.auditHistory[0]?.completedAt ? format(data.auditHistory[0].completedAt.toDate(), "d MMMM yyyy", {locale: tr}) : "Son denetim"}</strong> Tarihli son denetimde alınan hayırlar aşağıdadır.</p>
                                        </div>
                                        
                                        {/* Since we don't store failures separately in store analysis response but get full audit object,
                                            we can filter failures from data.auditHistory[0] on the fly */}
                                        {(() => {
                                            const lastAudit = data.auditHistory[0];
                                            const failures: any[] = [];
                                            // Helper logic inline to extract failures
                                            lastAudit.sections.forEach(section => {
                                                section.answers.forEach(answer => {
                                                    // Only consider questions that have an actual answer (skipped/empty questions are exempt)
                                                    if (answer.answer && answer.answer.trim() !== "") {
                                                        if ((answer.questionType === 'yes_no' && answer.answer === 'hayir') || 
                                                            (answer.answer !== 'muaf' && answer.earnedPoints < answer.maxPoints)) {
                                                            failures.push({ ...answer, sectionName: section.sectionName });
                                                        }
                                                    }
                                                });
                                            });

                                            return failures.map((fail, idx) => (
                                                <Card key={idx} className="p-4 border-l-4 border-l-rose-500 shadow-sm">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">
                                                                    {fail.sectionName}
                                                                </Badge>
                                                                <Badge variant="destructive" className="uppercase text-[10px]">
                                                                    {fail.answer === 'hayir' ? 'Hayır' : 'Eksik Puan'}
                                                                </Badge>
                                                            </div>
                                                            <h4 className="font-semibold text-slate-800 leading-snug">{fail.questionText}</h4>
                                                            
                                                            {/* Auditor Notes */}
                                                            {fail.notes && fail.notes.length > 0 && (
                                                                <div className="bg-slate-50 p-3 rounded-lg border text-sm mt-3">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <User className="h-3 w-3 text-slate-400" />
                                                                        <span className="text-slate-500 text-xs uppercase font-bold">Denetçi Notu:</span>
                                                                    </div>
                                                                    <p className="text-slate-700 italic">"{fail.notes[0]}"</p>
                                                                </div>
                                                            )}

                                                            {/* Photos Grid */}
                                                            {fail.photos && fail.photos.length > 0 && (
                                                                <div className="flex gap-2 mt-3 flex-wrap">
                                                                    {fail.photos.map((photo: string, pIdx: number) => (
                                                                        <div key={pIdx} className="relative h-16 w-16 rounded-md overflow-hidden border shrink-0 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setSelectedImage(photo)}>
                                                                            <img src={photo} alt="Fail" className="h-full w-full object-cover" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {/* Store Action */}
                                                            {fail.actionData && (fail.actionData.storeNote || (fail.actionData.storeImages && fail.actionData.storeImages.length > 0)) ? (
                                                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm mt-3">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Store className="h-3 w-3 text-blue-500" />
                                                                        <span className="text-blue-600 text-xs uppercase font-bold">Mağaza Aksiyonu:</span>
                                                                    </div>
                                                                    {fail.actionData.storeNote && (
                                                                        <p className="text-slate-700 italic mb-2">"{fail.actionData.storeNote}"</p>
                                                                    )}
                                                                    {fail.actionData.storeImages && fail.actionData.storeImages.length > 0 && (
                                                                        <div className="flex gap-2 flex-wrap mt-2">
                                                                            {fail.actionData.storeImages.map((img: string, i: number) => (
                                                                                <div key={i} className="relative h-12 w-12 rounded overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(img)}>
                                                                                     <img src={img} alt="Store Action" className="h-full w-full object-cover" />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 italic">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    Mağaza henüz aksiyon almadı.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </TabsContent>

                            {/* HISTORY TAB */}
                            <TabsContent value="history" className="m-0">
                                {data?.auditHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="bg-slate-100 p-4 rounded-full mb-4">
                                            <History className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900">Henüz Denetim Yapılmamış</h3>
                                        <p className="text-slate-500 max-w-sm mt-2">Bu mağaza için tamamlanmış bir denetim kaydı bulunmuyor.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data?.auditHistory.map((audit) => (
                                            <Card key={audit.id} className="p-4 hover:shadow-md transition-shadow cursor-default group">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className={cn("p-2 rounded-lg font-bold text-sm min-w-[50px] text-center", getScoreColor(audit.totalScore))}>
                                                            {audit.totalScore.toFixed(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900">
                                                                {audit.auditTypeName || "Genel Denetim"}
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {audit.completedAt 
                                                                        ? format(audit.completedAt.toDate(), "d MMM yyyy", {locale: tr}) 
                                                                        : "-"}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />
                                                                    {audit.auditorName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* RECURRING ISSUES TAB */}
                            <TabsContent value="recurring" className="m-0">
                                {data?.recurringIssues.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                                        <div className="bg-emerald-50 p-4 rounded-full mb-4 animate-in zoom-in duration-300">
                                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-emerald-900">Harika!</h3>
                                        <p className="text-emerald-700 max-w-sm mt-2">Bu mağazada tekrarlayan kronik bir sorun tespit edilmedi.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex gap-3 text-sm text-rose-800">
                                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                                            <p>Aşağıdaki sorular, son denetimlerde arka arkaya başarısız olmuştur. Her bir sorunun geçmişi ve mağaza aksiyonları aşağıda listelenmiştir.</p>
                                        </div>

                                        <div className="grid gap-6">
                                            {data?.recurringIssues.map((issue, idx) => (
                                                <Card key={`${issue.questionId}-${idx}`} className="overflow-hidden border-rose-100 shadow-sm">
                                                    {/* Issue Header */}
                                                    <div className="bg-rose-50/50 p-4 border-b border-rose-100">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div>
                                                                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-white mb-2">
                                                                    {issue.sectionName || "Bölüm Bilgisi Yok"}
                                                                </Badge>
                                                                <h4 className="font-bold text-slate-900 leading-snug">{issue.questionText}</h4>
                                                            </div>
                                                            <div className="bg-rose-100 text-rose-700 px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0">
                                                                {issue.failCount} Kez Tekrar
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Timeline of Failures */}
                                                    <div className="p-4 space-y-6">
                                                        {issue.history?.map((historyItem, hIdx) => (
                                                            <div key={hIdx} className="relative pl-6 border-l-2 border-slate-200 last:border-0 pb-6 last:pb-0">
                                                                {/* Dot */}
                                                                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-200 border-2 border-white shadow-sm ring-1 ring-slate-100"></div>
                                                                
                                                                {/* Header: Date & Auditor */}
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-medium text-sm text-slate-900">
                                                                            {historyItem.auditDate ? format(new Date(historyItem.auditDate), 'd MMMM yyyy', {locale: tr}) : '-'}
                                                                        </span>
                                                                        <span className="text-xs text-slate-400">•</span>
                                                                        <span className="text-xs text-slate-500">{historyItem.auditorName}</span>
                                                                    </div>
                                                                    <Badge variant="secondary" className="w-fit text-[10px] bg-slate-100 text-slate-500">
                                                                        Yanıt: {formatHistoryAnswer(historyItem)}
                                                                    </Badge>
                                                                </div>

                                                                {/* Auditor Content */}
                                                                <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
                                                                    {/* Note */}
                                                                    {historyItem.notes && historyItem.notes.length > 0 && (
                                                                        <div className="text-sm text-slate-700 italic">
                                                                            "{historyItem.notes[0]}"
                                                                        </div>
                                                                    )}
                                                                    {/* Photos */}
                                                                    {historyItem.photos && historyItem.photos.length > 0 && (
                                                                        <div className="flex gap-2 flex-wrap mt-2">
                                                                            {historyItem.photos.map((img, i) => (
                                                                                <div key={i} className="h-16 w-16 rounded border bg-white shrink-0 overflow-hidden cursor-pointer hover:opacity-90" onClick={() => setSelectedImage(img)}>
                                                                                    <img src={img} className="h-full w-full object-cover" alt="Evidence" />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Store Action Content (If Exists) */}
                                                                {(historyItem.storeNote || (historyItem.storeImages && historyItem.storeImages.length > 0)) ? (
                                                                    <div className="mt-4 pt-4 border-t border-dashed relative">
                                                                        {/* Connector Line/Icon */}
                                                                        <div className="absolute -left-[30px] top-6 flex items-center gap-2">
                                                                             <div className="h-px w-5 bg-slate-300"></div>
                                                                        </div>
                                                                        
                                                                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                                                                            <div className="flex items-center gap-2 mb-2 text-blue-700 font-semibold text-xs uppercase tracking-wide">
                                                                                <Building2 className="h-3 w-3" />
                                                                                Mağaza Aksiyonu
                                                                            </div>
                                                                            {historyItem.storeNote && (
                                                                                <p className="text-sm text-slate-800 mb-3 leading-relaxed">
                                                                                    {historyItem.storeNote}
                                                                                </p>
                                                                            )}
                                                                            {historyItem.storeImages && historyItem.storeImages.length > 0 && (
                                                                                <div className="flex gap-2 flex-wrap pb-1">
                                                                                    {historyItem.storeImages.map((img, i) => (
                                                                                        <div key={i} className="h-20 w-20 rounded border border-blue-200 bg-white shrink-0 overflow-hidden cursor-pointer hover:opacity-90" onClick={() => setSelectedImage(img)}>
                                                                                            <img src={img} className="h-full w-full object-cover" alt="Action" />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-3">
                                                                        <span className="text-[10px] text-rose-400 flex items-center gap-1 italic">
                                                                            <AlertTriangle className="h-3 w-3" />
                                                                            Mağaza henüz aksiyon kanıtı yüklememiş.
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>

        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] bg-transparent border-none shadow-none p-0 flex items-center justify-center [&>button]:hidden">
                <DialogTitle className="sr-only">Tam Boyut Fotoğraf</DialogTitle>
                <div className="relative w-full h-full flex items-center justify-center" onClick={() => setSelectedImage(null)}>
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute -top-2 -right-2 md:top-0 md:right-0 z-50 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all"
                        aria-label="Kapat"
                    >
                        <XCircle className="h-8 w-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selectedImage || undefined}
                        alt="Tam boyut fotoğraf"
                        className="max-w-full max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
