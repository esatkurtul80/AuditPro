"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function QuestionHistoryButton({
    storeId,
    auditTypeId,
    questionId,
    currentAuditId,
}: QuestionHistoryButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<QuestionHistory | null>(null);
    const [shouldShow, setShouldShow] = useState(false);
    const [checking, setChecking] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Check if button should be shown (only if previous audit has "hayir")
    useEffect(() => {
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
    }, [storeId, auditTypeId, questionId, currentAuditId]);

    const loadHistory = async () => {
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

                                {/* Audit Entries */}
                                <Accordion type="single" collapsible className="space-y-3">
                                    {history.entries.map((entry, index) => (
                                        <AccordionItem
                                            key={entry.auditId}
                                            value={`audit-${index}`}
                                            className="border rounded-lg px-4"
                                        >
                                            <AccordionTrigger className="hover:no-underline py-4">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-semibold">
                                                                {(() => {
                                                                    const daysAgo = differenceInDays(new Date(), entry.completedAt.toDate());
                                                                    return `${entry.auditorName.toLocaleUpperCase('tr-TR')} - ${daysAgo} GÜN ÖNCE YAPILAN DENETİM`;
                                                                })()}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {format(entry.completedAt.toDate(), "dd MMMM yyyy HH:mm", { locale: tr })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="bg-red-500 dark:bg-red-900 text-white border-red-500 dark:border-red-900">
                                                        {(() => {
                                                            if (entry.questionType === 'yes_no' || !entry.questionType) {
                                                                return 'Hayır';
                                                            }
                                                            // For other question types, show points
                                                            return `${entry.earnedPoints}/${entry.maxPoints} Puan`;
                                                        })()}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-4">
                                                <div className="space-y-4 pt-2">
                                                    {/* Info Grid */}
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <User className="h-4 w-4" />
                                                            <span>{entry.auditorName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Calendar className="h-4 w-4" />
                                                            <span>
                                                                {format(entry.completedAt.toDate(), "HH:mm", { locale: tr })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Question Type Details */}
                                                    {(() => {
                                                        // Rating Questions: Show stars
                                                        if (entry.questionType === 'rating' && entry.ratingMax) {
                                                            const rating = parseInt(entry.answer) || 0;
                                                            return (
                                                                <>
                                                                    <Separator />
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-medium text-foreground">Verilen Puan</h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="text-2xl">
                                                                                {Array.from({ length: entry.ratingMax }, (_, i) => (
                                                                                    <span key={i} className={i < rating ? "text-yellow-500" : "text-gray-300"}>
                                                                                        ★
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-sm font-medium text-muted-foreground">
                                                                                {rating}/{entry.ratingMax}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        }

                                                        // Checkbox Questions: Show unchecked options
                                                        if (entry.questionType === 'checkbox' && entry.options) {
                                                            const selectedIds = entry.selectedOptions || [];
                                                            const uncheckedOptions = entry.options.filter(opt => !selectedIds.includes(opt.id));

                                                            if (uncheckedOptions.length > 0) {
                                                                return (
                                                                    <>
                                                                        <Separator />
                                                                        <div className="space-y-2">
                                                                            <h4 className="font-medium text-foreground">İşaretlenmemiş Seçenekler</h4>
                                                                            <div className="space-y-1">
                                                                                {uncheckedOptions.map((option, idx) => (
                                                                                    <div key={idx} className="text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-2 rounded-md flex items-center gap-2">
                                                                                        <span className="text-lg">✗</span>
                                                                                        <span>{option.text}</span>
                                                                                        <span className="ml-auto text-xs opacity-70">({option.points} puan)</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                );
                                                            }
                                                        }

                                                        // Multiple Choice (Radio): Show selected option
                                                        if (entry.questionType === 'multiple_choice' && entry.options) {
                                                            const selectedOption = entry.options.find(opt => opt.id === entry.answer);

                                                            if (selectedOption) {
                                                                return (
                                                                    <>
                                                                        <Separator />
                                                                        <div className="space-y-2">
                                                                            <h4 className="font-medium text-foreground">Seçilen Şık</h4>
                                                                            <div className="text-sm bg-muted p-3 rounded-md">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span>{selectedOption.text}</span>
                                                                                    <Badge variant="outline">{selectedOption.points} puan</Badge>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                );
                                                            }
                                                        }

                                                        return null;
                                                    })()}

                                                    {/* Notes Section */}
                                                    {entry.notes && entry.notes.length > 0 && entry.notes.some(n => n.trim()) && (
                                                        <>
                                                            <Separator />
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-foreground">Notlar</h4>
                                                                <div className="space-y-2">
                                                                    {entry.notes.filter(n => n.trim()).map((note, noteIndex) => (
                                                                        <div
                                                                            key={noteIndex}
                                                                            className="text-sm bg-muted p-3 rounded-md"
                                                                        >
                                                                            {note}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Photos Section */}
                                                    {entry.photos && entry.photos.length > 0 && (
                                                        <>
                                                            <Separator />
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-foreground">
                                                                    Fotoğraflar <span className="text-muted-foreground">({entry.photos.length})</span>
                                                                </h4>
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    {entry.photos.map((photo, photoIndex) => (
                                                                        <div
                                                                            key={photoIndex}
                                                                            className="relative aspect-square rounded-md overflow-hidden border bg-muted cursor-pointer group"
                                                                            onClick={() => setSelectedImage(photo)}
                                                                        >
                                                                            <img
                                                                                src={photo}
                                                                                alt={`Fotoğraf ${photoIndex + 1}`}
                                                                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </AccordionContent>
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
                        src={selectedImage}
                        alt="Fotoğraf Önizleme"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
