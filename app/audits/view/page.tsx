"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Audit, AuditAnswer } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X, CheckCircle2, ArrowLeft, Download, Circle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import imageCompression from "browser-image-compression";
import { generateAuditPDF } from "@/lib/pdf-generator";

function AuditContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { userProfile } = useAuth();
    const auditId = searchParams.get("id");

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        if (auditId) {
            loadAudit();
        } else {
            setLoading(false);
        }
    }, [auditId]);

    const loadAudit = async () => {
        if (!auditId) return;
        try {
            const auditDoc = await getDoc(doc(db, "audits", auditId));
            if (!auditDoc.exists()) {
                toast.error("Denetim bulunamadı");
                router.push("/denetmen");
                return;
            }
            setAudit({ id: auditDoc.id, ...auditDoc.data() } as Audit);
        } catch (error) {
            console.error("Error loading audit:", error);
            toast.error("Denetim yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const updateAnswer = async (
        sectionIndex: number,
        answerIndex: number,
        updates: Partial<AuditAnswer>
    ) => {
        if (!audit || !auditId) return;

        const updatedAudit = { ...audit };
        updatedAudit.sections[sectionIndex].answers[answerIndex] = {
            ...updatedAudit.sections[sectionIndex].answers[answerIndex],
            ...updates,
        };

        // Puanı güncelle
        if (updates.answer) {
            const answer = updatedAudit.sections[sectionIndex].answers[answerIndex];
            if (updates.answer === "evet") {
                answer.earnedPoints = answer.maxPoints;
            } else if (updates.answer === "hayir") {
                answer.earnedPoints = 0;
            } else if (updates.answer === "muaf") {
                answer.earnedPoints = answer.maxPoints;
            }
        }

        // Bölüm ortalaması hesapla - sadece cevaplanmış bölümleri dahil et
        const sectionScores: number[] = [];

        updatedAudit.sections.forEach(section => {
            let sectionEarned = 0;
            let sectionMax = 0;

            section.answers.forEach(answer => {
                // Sadece cevaplanmış soruları hesaba kat
                // MUAF soruları hesaplamaya dahil etme
                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                    sectionEarned += answer.earnedPoints;
                    sectionMax += answer.maxPoints;
                }
            });

            // Eğer bölümde en az bir cevap varsa
            if (sectionMax > 0) {
                const sectionScore = (sectionEarned / sectionMax) * 100;
                sectionScores.push(sectionScore);
            }
        });

        // Tüm bölüm skorlarının ortalamasını al
        const finalScore = sectionScores.length > 0
            ? sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length
            : 0;

        updatedAudit.totalScore = Math.round(finalScore);
        updatedAudit.updatedAt = Timestamp.now();

        try {
            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedAudit.sections,
                totalScore: updatedAudit.totalScore,
                updatedAt: updatedAudit.updatedAt,
            });
            setAudit(updatedAudit);
        } catch (error) {
            console.error("Error updating answer:", error);
            toast.error("Cevap kaydedilirken hata oluştu");
        }
    };

    const uploadPhoto = async (
        file: File,
        sectionIndex: number,
        answerIndex: number
    ) => {
        if (!audit || !auditId) return;

        setUploading(true);

        try {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);

            const filename = `audits/${auditId}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(storageRef);

            const currentAnswer =
                audit.sections[sectionIndex].answers[answerIndex];
            const updatedPhotos = [...(currentAnswer.photos || []), downloadURL];

            await updateAnswer(sectionIndex, answerIndex, { photos: updatedPhotos });
            toast.success("Fotoğraf yüklendi");
        } catch (error) {
            console.error("Error uploading photo:", error);
            toast.error("Fotoğraf yüklenirken hata oluştu");
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = async (
        sectionIndex: number,
        answerIndex: number,
        photoIndex: number
    ) => {
        if (!audit) return;

        const currentAnswer = audit.sections[sectionIndex].answers[answerIndex];
        const updatedPhotos = currentAnswer.photos?.filter(
            (_, i) => i !== photoIndex
        );

        await updateAnswer(sectionIndex, answerIndex, { photos: updatedPhotos });
        toast.success("Fotoğraf kaldırıldı");
    };

    const completeAudit = async () => {
        if (!audit || !auditId) return;

        // Bölüm tutarlılığı kontrolü
        const incompleteSections: string[] = [];

        audit.sections.forEach(section => {
            const answeredQuestions = section.answers.filter(
                answer => answer.answer && answer.answer.trim() !== ""
            );
            const totalQuestions = section.answers.length;

            // Eğer bölümde en az 1 cevap varsa, tüm sorular cevaplanmalı
            if (answeredQuestions.length > 0 && answeredQuestions.length < totalQuestions) {
                incompleteSections.push(section.sectionName);
            }
        });

        if (incompleteSections.length > 0) {
            toast.error(
                `Lütfen şu bölümlerdeki tüm soruları cevaplayın: ${incompleteSections.join(", ")}`,
                { duration: 5000 }
            );
            return;
        }

        setCompleting(true);

        try {
            await updateDoc(doc(db, "audits", auditId), {
                status: "tamamlandi",
                completedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            toast.success("Denetim tamamlandı!");
            router.push("/denetmen");
        } catch (error) {
            console.error("Error completing audit:", error);
            toast.error("Denetim tamamlanırken hata oluştu");
        } finally {
            setCompleting(false);
        }
    };

    const getAnswerButtonClass = (selected: boolean) => {
        return selected
            ? "bg-black text-white hover:bg-black hover:text-white"
            : "hover:bg-transparent hover:text-foreground hover:border-input";
    };


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!audit) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Denetim bulunamadı.</p>
            </div>
        );
    }

    const isCompleted = audit.status === "tamamlandi";

    return (
        <div className="container mx-auto py-8">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/denetmen">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Geri
                    </Button>
                </Link>
                <div className="flex gap-2">
                    {isCompleted && (
                        <Button
                            onClick={() => audit && generateAuditPDF(audit)}
                            variant="outline"
                            size="lg"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            PDF İndir
                        </Button>
                    )}
                    {!isCompleted && (
                        <Button
                            onClick={completeAudit}
                            disabled={completing}
                            size="lg"
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {completing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Tamamlanıyor...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                    Denetimi Tamamla
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-3xl">
                                {audit.auditTypeName}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                {audit.storeName} - {audit.auditorName}
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground">Puan</div>
                            <div className="text-3xl font-bold">
                                {audit.totalScore || 0}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isCompleted && (
                        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
                            <div className="flex items-center gap-2 text-green-700 font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                Bu denetim tamamlanmıştır
                            </div>
                        </div>
                    )}

                    <Accordion type="single" collapsible className="w-full">
                        {audit.sections.map((section, sectionIndex) => (
                            <AccordionItem
                                key={sectionIndex}
                                value={`section-${sectionIndex}`}
                                className="border rounded-lg mb-3 px-4 bg-slate-50 data-[state=closed]:border-b"
                            >
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3">
                                        {/* Completion indicator */}
                                        {(() => {
                                            const totalQuestions = section.answers.length;
                                            const answeredQuestions = section.answers.filter(
                                                (a) => a.answer && a.answer.trim() !== ""
                                            ).length;
                                            const isComplete = answeredQuestions === totalQuestions;
                                            const hasAny = answeredQuestions > 0;

                                            return (
                                                <Circle
                                                    className={`h-3 w-3 ${isComplete ? 'fill-green-500 text-green-500' : hasAny ? 'fill-red-500 text-red-500' : 'text-gray-300'}`}
                                                />
                                            );
                                        })()}
                                        <span className="font-semibold text-lg">
                                            {section.sectionName}
                                        </span>
                                        <Badge>{section.answers.length} Soru</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-6 pt-4">
                                        {section.answers.map((answer, answerIndex) => (
                                            <Card key={answerIndex} className="p-4">
                                                <div className="space-y-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-base">
                                                                {answer.questionText}
                                                            </h4>
                                                            <div className="flex gap-2 mt-2">
                                                                <Badge variant="outline">
                                                                    {answer.maxPoints} Puan
                                                                </Badge>
                                                                {answer.photoRequired && (
                                                                    <Badge className="bg-blue-500">
                                                                        Fotoğraf Zorunlu
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className={getAnswerButtonClass(
                                                                answer.answer === "evet"
                                                            )}
                                                            onClick={() =>
                                                                !isCompleted &&
                                                                updateAnswer(sectionIndex, answerIndex, {
                                                                    answer: "evet",
                                                                })
                                                            }
                                                            disabled={isCompleted}
                                                        >
                                                            Evet
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className={getAnswerButtonClass(
                                                                answer.answer === "hayir"
                                                            )}
                                                            onClick={() =>
                                                                !isCompleted &&
                                                                updateAnswer(sectionIndex, answerIndex, {
                                                                    answer: "hayir",
                                                                })
                                                            }
                                                            disabled={isCompleted}
                                                        >
                                                            Hayır
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className={getAnswerButtonClass(
                                                                answer.answer === "muaf"
                                                            )}
                                                            onClick={() =>
                                                                !isCompleted &&
                                                                updateAnswer(sectionIndex, answerIndex, {
                                                                    answer: "muaf",
                                                                })
                                                            }
                                                            disabled={isCompleted}
                                                        >
                                                            Muaf
                                                        </Button>
                                                    </div>

                                                    {answer.answer === "hayir" && (
                                                        <div className="space-y-3 border-t pt-4">
                                                            <div>
                                                                <Label>Not</Label>
                                                                <Input
                                                                    value={(answer.notes || []).join(", ")}
                                                                    onChange={(e) =>
                                                                        !isCompleted &&
                                                                        updateAnswer(sectionIndex, answerIndex, {
                                                                            notes: e.target.value ? [e.target.value] : [],
                                                                        })
                                                                    }
                                                                    placeholder="Açıklama girin..."
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>

                                                            <div>
                                                                <Label>Fotoğraflar</Label>
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    {answer.photos?.map((photo, photoIndex) => (
                                                                        <div
                                                                            key={photoIndex}
                                                                            className="relative group"
                                                                        >
                                                                            <img
                                                                                src={photo}
                                                                                alt={`Photo ${photoIndex + 1}`}
                                                                                className="h-24 w-24 object-cover rounded-lg border"
                                                                            />
                                                                            {!isCompleted && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        removePhoto(
                                                                                            sectionIndex,
                                                                                            answerIndex,
                                                                                            photoIndex
                                                                                        )
                                                                                    }
                                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                >
                                                                                    <X className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {!isCompleted && (
                                                                        <label className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-accent">
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                className="hidden"
                                                                                onChange={(e) => {
                                                                                    const file = e.target.files?.[0];
                                                                                    if (file) {
                                                                                        uploadPhoto(
                                                                                            file,
                                                                                            sectionIndex,
                                                                                            answerIndex
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                disabled={uploading}
                                                                            />
                                                                            {uploading ? (
                                                                                <Loader2 className="h-6 w-6 animate-spin" />
                                                                            ) : (
                                                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                                            )}
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AuditPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={
                <div className="container mx-auto py-8">
                    <div className="mb-6 flex items-center justify-between">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-11 w-48" />
                    </div>
                    <div className="rounded-lg border bg-card">
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <Skeleton className="h-9 w-64 mb-2" />
                                    <Skeleton className="h-5 w-48" />
                                </div>
                                <Skeleton className="h-12 w-16" />
                            </div>
                        </div>
                        <div className="p-6 space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </div>
            }>
                <AuditContent />
            </Suspense>
        </DashboardLayout>
    );
}
