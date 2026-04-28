"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X, Calendar, User, Store, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { getQuestionHistory, QuestionHistory } from "@/lib/question-history";
import { format, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";

interface QuestionHistoryButtonProps {
    storeId: string;
    auditTypeId: string;
    questionId: string;
    currentAuditId: string;
    historyData?: QuestionHistory; // Pre-fetched data
}

export function QuestionHistoryButton({
    storeId,
    auditTypeId,
    questionId,
    currentAuditId,
    historyData
}: QuestionHistoryButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<QuestionHistory | null>(historyData || null);
    const [shouldShow, setShouldShow] = useState(false);
    const [checking, setChecking] = useState(!historyData);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [refreshedUrls, setRefreshedUrls] = useState<Map<string, string>>(new Map());
    const refreshingRef = useRef<Set<string>>(new Set());

    const getImgSrc = (url: string) => refreshedUrls.get(url) ?? url;

    const handleImgError = async (originalUrl: string) => {
        if (!originalUrl || !originalUrl.includes('firebasestorage')) return;
        if (refreshingRef.current.has(originalUrl) || refreshedUrls.has(originalUrl)) return;
        refreshingRef.current.add(originalUrl);
        try {
            const url = new URL(originalUrl);
            const pathMatch = url.pathname.match(/\/o\/(.+)/);
            if (!pathMatch) return;
            const path = decodeURIComponent(pathMatch[1]);
            const freshUrl = await getDownloadURL(storageRef(storage, path));
            setRefreshedUrls(prev => new Map(prev).set(originalUrl, freshUrl));
        } catch {
            setRefreshedUrls(prev => new Map(prev).set(originalUrl, originalUrl));
        } finally {
            refreshingRef.current.delete(originalUrl);
        }
    };

    // Initial check
    useEffect(() => {
        if (historyData) {
            setHistory(historyData);
            setShouldShow(historyData.consecutiveFailCount > 0);
            setChecking(false);
            return;
        }

        const checkPreviousAudit = async () => {
            try {
                const result = await getQuestionHistory(
                    storeId,
                    auditTypeId,
                    questionId,
                    currentAuditId
                );
                // Show button only if there's at least one consecutive fail
                setShouldShow(result.consecutiveFailCount > 0);
            } catch (error) {
                console.error("Error checking previous audit:", error);
                setShouldShow(false);
            } finally {
                setChecking(false);
            }
        };

        checkPreviousAudit();
    }, [storeId, auditTypeId, questionId, currentAuditId, historyData]);

    const loadHistory = async () => {
        if (historyData) {
            // Already have data
            setOpen(true);
            return;
        }

        setLoading(true);
        try {
            const result = await getQuestionHistory(
                storeId,
                auditTypeId,
                questionId,
                currentAuditId
            );
            setHistory(result);
            setOpen(true);
        } catch (error) {
            console.error("Error loading question history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Don't show button if still checking or if there's no previous "hayir"
    if (checking || !shouldShow) {
        return null;
    }

    return (
        <>
            <Button
                variant="destructive"
                size="sm"
                onClick={loadHistory}
                disabled={loading}
                className="h-6 px-2 text-xs"
            >
                {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <>
                        <History className="h-3 w-3 mr-1" />
                        Geçmiş
                    </>
                )}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(newOpen) => {
                    // Only allow closing if lightbox is not open
                    if (!newOpen && selectedImage) {
                        // Close lightbox first instead of dialog
                        setSelectedImage(null);
                        return;
                    }
                    if (!newOpen) {
                        // Clear selected image when dialog is closing
                        setSelectedImage(null);
                    }
                    setOpen(newOpen);
                }}
            >
                <DialogContent className="md:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-4">
                    <DialogHeader className="px-0 pt-2">
                        <DialogTitle>Soru Geçmişi</DialogTitle>
                        <DialogDescription>
                            Bu sorunun önceki denetimlerdeki cevapları
                        </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 px-3 pb-4">
                        {history && history.consecutiveFailCount > 0 ? (
                            <>
                                {/* Summary Card */}
                                <Card>
                                    <CardContent className="py-4 text-center">
                                        <p className="text-sm font-bold">
                                            {(() => {
                                                // Check if all entries are yes/no questions (Hayır)
                                                const allYesNo = history.entries.every(
                                                    entry => entry.questionType === 'yes_no' || !entry.questionType
                                                );

                                                if (allYesNo) {
                                                    // Special message for Yes/No questions
                                                    return `Son ${history.consecutiveFailCount} denetimde hayır alınmıştır.`;
                                                } else {
                                                    // General message for other question types
                                                    return `Son ${history.consecutiveFailCount} denetimde bu soruda tam puan alınamamış.`;
                                                }
                                            })()}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Separator className="my-4" />

                                {/* Timeline of Failures */}
                                <Accordion type="single" collapsible className="w-full space-y-2 px-2">
                                    {history.entries.map((entry, index) => (
                                        <AccordionItem key={entry.auditId} value={entry.auditId} className="border-0 bg-transparent">
                                            <div className="relative pl-6 border-l-2 border-slate-200 last:border-0 pb-2">
                                                {/* Dot */}
                                                <div className="absolute -left-[9px] top-4 h-4 w-4 rounded-full bg-slate-200 border-2 border-white shadow-sm ring-1 ring-slate-100"></div>

                                                <AccordionTrigger className="hover:no-underline py-3 px-1">
                                                    {/* Header: Date & Auditor */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pr-4 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm text-slate-900">
                                                                {format(entry.completedAt.toDate(), "dd MMMM yyyy", { locale: tr })}
                                                            </span>
                                                            <span className="text-xs text-slate-400">•</span>
                                                            <span className="text-xs font-medium text-slate-500">{entry.auditorName}</span>
                                                            <span className="text-xs text-slate-400">•</span>
                                                            <span className="text-xs text-slate-500">{differenceInDays(new Date(), entry.completedAt.toDate())} gün önce</span>
                                                        </div>
                                                        <Badge variant="destructive" className="w-fit text-[10px] bg-red-100 text-red-700 border-red-200 hover:bg-red-100 shrink-0">
                                                            {(() => {
                                                                if (entry.questionType === 'yes_no' || !entry.questionType) {
                                                                    return 'Hayır';
                                                                }
                                                                return `${entry.earnedPoints}/${entry.maxPoints} Puan`;
                                                            })()}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="pt-2 pb-6 px-1">
                                                    {/* Auditor Content */}
                                                    <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
                                                        {/* Question Type Details */}
                                                        {(() => {
                                                            if (entry.questionType === 'rating' && entry.ratingMax) {
                                                                const rating = parseInt(entry.answer) || 0;
                                                                return (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="text-lg">
                                                                            {Array.from({ length: entry.ratingMax }, (_, i) => (
                                                                                <span key={i} className={i < rating ? "text-yellow-500" : "text-gray-300"}>★</span>
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-xs font-medium text-muted-foreground">{rating}/{entry.ratingMax}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            if (entry.questionType === 'checkbox' && entry.options) {
                                                                const selectedIds = entry.selectedOptions || [];
                                                                const uncheckedOptions = entry.options.filter(opt => !selectedIds.includes(opt.id));
                                                                if (uncheckedOptions.length > 0) {
                                                                    return (
                                                                        <div className="space-y-1">
                                                                            <span className="text-xs font-semibold text-slate-500">İşaretlenmemiş:</span>
                                                                            {uncheckedOptions.map((option, idx) => (
                                                                                <div key={idx} className="text-xs text-red-600 flex items-center gap-1">
                                                                                    <span>✗</span> {option.text}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                            }
                                                            if (entry.questionType === 'multiple_choice' && entry.options) {
                                                                const selectedOption = entry.options.find(opt => opt.id === entry.answer);
                                                                if (selectedOption) {
                                                                    return (
                                                                        <div className="text-xs font-medium text-slate-700">
                                                                            Seçilen: {selectedOption.text}
                                                                        </div>
                                                                    );
                                                                }
                                                            }
                                                            return null;
                                                        })()}

                                                        {/* Note */}
                                                        {entry.notes && entry.notes.length > 0 && entry.notes.some(n => n.trim()) && (
                                                            <div className="text-sm text-slate-700 italic">
                                                                {entry.notes.filter(n => n.trim()).map((note, idx) => (
                                                                    <div key={idx}>&quot;{note}&quot;</div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Photos */}
                                                        {entry.photos && entry.photos.length > 0 && (
                                                            <div className="flex gap-2 flex-wrap mt-2">
                                                                {entry.photos.map((photo, pIdx) => (
                                                                    <div key={pIdx} className="h-16 w-16 rounded border bg-white shrink-0 overflow-hidden cursor-pointer hover:opacity-90" onClick={() => setSelectedImage(photo)}>
                                                                        <img src={getImgSrc(photo)} className="h-full w-full object-cover" alt="Evidence" onError={() => handleImgError(photo)} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Store Action Content (If Exists) */}
                                                    {entry.actionData && (entry.actionData.storeNote || (entry.actionData.storeImages && entry.actionData.storeImages.length > 0)) ? (
                                                        <div className="mt-4 pt-4 border-t border-dashed relative">
                                                            {/* Connector Line/Icon */}
                                                            <div className="absolute -left-[30px] top-6 flex items-center gap-2">
                                                                <div className="h-px w-5 bg-slate-300"></div>
                                                            </div>
                                                            
                                                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs uppercase tracking-wide">
                                                                        <Store className="h-3 w-3" />
                                                                        Mağaza Aksiyon Dönüşü
                                                                    </div>
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[10px]",
                                                                        entry.actionData.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                                                        entry.actionData.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 
                                                                        'bg-amber-100 text-amber-700 border-amber-200'
                                                                    )}>
                                                                        {entry.actionData.status === 'approved' ? 'Onaylandı' : 
                                                                         entry.actionData.status === 'rejected' ? 'Reddedildi' : 
                                                                         entry.actionData.status === 'pending_admin' ? 'Onay Bekliyor' : 'Bekliyor'}
                                                                    </Badge>
                                                                </div>

                                                                {entry.actionData.storeNote && (
                                                                    <p className="text-sm text-slate-800 mb-3 leading-relaxed">
                                                                        {entry.actionData.storeNote}
                                                                    </p>
                                                                )}

                                                                {entry.actionData.storeImages && entry.actionData.storeImages.length > 0 && (
                                                                    <div className="flex gap-2 flex-wrap pb-1">
                                                                        {entry.actionData.storeImages.map((img: string, i: number) => (
                                                                            <div key={i} className="h-16 w-16 rounded border border-blue-200 bg-white shrink-0 overflow-hidden cursor-pointer hover:opacity-90" onClick={() => setSelectedImage(img)}>
                                                                                <img src={getImgSrc(img)} className="h-full w-full object-cover" alt="Action" onError={() => handleImgError(img)} />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {entry.actionData.adminNote && entry.actionData.status === 'rejected' && (
                                                                    <div className="mt-3 pt-3 border-t border-blue-200/50">
                                                                        <h5 className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                            <AlertCircle className="h-3 w-3" />
                                                                            Red Nedeni
                                                                        </h5>
                                                                        <p className="text-xs text-red-700 italic">
                                                                            &quot;{entry.actionData.adminNote}&quot;
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-4 pt-4 border-t border-dashed relative">
                                                            <div className="absolute -left-[30px] top-6 flex items-center gap-2">
                                                                <div className="h-px w-5 bg-slate-300"></div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-amber-600 italic bg-amber-50 p-2 rounded-md border border-amber-100">
                                                                <AlertCircle className="h-3 w-3" />
                                                                Mağaza henüz aksiyon dönüşü yapmamış.
                                                            </div>
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </div>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </>
                        ) : (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <History className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center">
                                        Bu soru için önceki denetimlerde<br />
                                        arka arkaya eksik puan bulunamadı.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Fullscreen Image Lightbox - Portal to body */}
            {selectedImage && createPortal(
                <div
                    className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                        }}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-md p-2 transition-colors z-10"
                        aria-label="Kapat"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={getImgSrc(selectedImage)}
                        alt="Fotoğraf Önizleme"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                        onError={() => handleImgError(selectedImage)}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
