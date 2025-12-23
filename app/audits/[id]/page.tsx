"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    collection,
    addDoc,
    query,
    where,
    getDocs,
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, CheckCircle2, ArrowLeft, Circle, Plus, Save, WifiOff, Clock, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ImageGallery from "@/components/image-gallery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuditSync } from "@/hooks/useAuditSync";
import { QuestionHistoryButton } from "@/components/question-history-button";
import { AuditSummary } from "@/components/audit-summary";
import { Checkbox } from "@/components/ui/checkbox";

export default function AuditPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userProfile } = useAuth();
    const auditId = params.id as string;
    const mode = searchParams.get("mode"); // "edit" or "view" or null

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [currentSectionIndex, setCurrentSectionIndex] = useState<number | null>(null);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [showBackDialog, setShowBackDialog] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [originalScore, setOriginalScore] = useState<number>(0);
    const [originalAudit, setOriginalAudit] = useState<Audit | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Offline sync
    const isOnline = useOnlineStatus();
    const { syncing, syncProgress, hasPending, syncingImageUrls, uploadedImageUrls } = useAuditSync(auditId);
    const reloadedAfterSync = useRef(false);

    // Reload audit when sync completes (only once)
    useEffect(() => {
        if (!syncing && !hasPending && uploadedImageUrls.length > 0 && !reloadedAfterSync.current) {
            // Sync just completed, reload audit to get Firebase URLs
            reloadedAfterSync.current = true;
            loadAudit();
            // Reset after 5 seconds so next sync can reload
            setTimeout(() => {
                reloadedAfterSync.current = false;
            }, 5000);
        }
    }, [syncing, hasPending, uploadedImageUrls.length]);

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
            const auditData = { id: auditDoc.id, ...auditDoc.data() } as Audit;

            // Denetmen ismini güncel veritabanından çek
            if (auditData.auditorId) {
                try {
                    const userDoc = await getDoc(doc(db, "users", auditData.auditorId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as any;
                        if (userData.firstName && userData.lastName) {
                            auditData.auditorName = `${userData.firstName} ${userData.lastName}`;
                        } else if (userData.displayName) {
                            auditData.auditorName = userData.displayName;
                        }
                    }
                } catch (e) {
                    console.error("Error fetching auditor name:", e);
                }
            }

            // Ensure each answer has at least one empty note
            auditData.sections.forEach(section => {
                section.answers.forEach(answer => {
                    if (!answer.notes || answer.notes.length === 0) {
                        answer.notes = [""];
                    }
                });
            });

            setAudit(auditData);
            // Store original score and full audit when entering edit mode
            if (mode === "edit") {
                setOriginalScore(auditData.totalScore || 0);
                setOriginalAudit(JSON.parse(JSON.stringify(auditData)));
            }
        } catch (error) {
            console.error("Error loading audit:", error);
            toast.error("Denetim yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (currentSectionIndex !== null) {
            // Return to section list from section detail
            setCurrentSectionIndex(null);
        } else {
            // Determine back destination based on user role
            const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard' : '/denetmen/tamamlanan';

            // If in view mode (just viewing completed audit), go directly back without dialog
            if (isViewMode) {
                router.push(backDestination);
                return;
            }

            // If in edit mode and no changes, go directly back
            if (isEditMode && !isDirty) {
                router.push(backDestination);
                return;
            }
            // Show exit confirmation dialog
            setShowBackDialog(true);
        }
    };

    const updateAnswer = async (
        sectionIndex: number,
        answerIndex: number,
        updates: Partial<AuditAnswer>
    ) => {
        if (!audit || !auditId) return;

        // Mark as dirty when editing in edit mode
        if (isEditMode && !isDirty) {
            setIsDirty(true);
        }

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
                console.log(`${section.sectionName}: ${sectionEarned}/${sectionMax} = ${Math.round(sectionScore)}%`);
            }
        });

        // Tüm bölüm skorlarının ortalamasını al
        const finalScore = sectionScores.length > 0
            ? sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length
            : 0;

        console.log(`BÖLÜM ORTALAMASI: ${Math.round(finalScore)}% (${sectionScores.length} bölüm)`);

        updatedAudit.totalScore = Math.round(finalScore);
        updatedAudit.updatedAt = Timestamp.now();

        // OPTIMISTIC UPDATE: Set state immediately
        setAudit(updatedAudit);

        // If in edit mode, DON'T save to Firebase (only save when clicking "Kaydet")
        // Check mode directly from searchParams to be safe
        const currentMode = new URLSearchParams(window.location.search).get('mode');
        const isInEditMode = currentMode === 'edit' && audit.status === 'tamamlandi';

        console.log('🔍 updateAnswer - mode:', currentMode, 'status:', audit.status, 'isInEditMode:', isInEditMode);

        if (isInEditMode) {
            console.log('✋ Edit modunda - Firebase\'e kaydedilmiyor (sadece local state güncellendi)');
            return;
        }

        console.log('💾 Firebase\'e kaydediliyor...');
        // Then save to Firebase in background (only for non-edit mode)
        try {
            // Filter out local:// URLs before saving to Firestore
            const sectionsToSave = updatedAudit.sections.map(section => ({
                ...section,
                answers: section.answers.map(answer => ({
                    ...answer,
                    photos: (answer.photos || []).filter(url => !url.startsWith('local://'))
                }))
            }));

            await updateDoc(doc(db, "audits", auditId), {
                sections: sectionsToSave,
                totalScore: updatedAudit.totalScore,
                updatedAt: updatedAudit.updatedAt,
            });
            console.log('✅ Firebase\'e kaydedildi');
        } catch (error) {
            console.error("Error updating answer:", error);
            toast.error("Cevap kaydedilirken hata oluştu");
            // Revert on error
            setAudit(audit);
        }
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
            const now = Timestamp.now();
            await updateDoc(doc(db, "audits", auditId), {
                status: "tamamlandi",
                completedAt: now,
                updatedAt: now,
            });

            // Local state'i güncelle ki UI hemen güncellensin ve özet görünsün
            setAudit({
                ...audit,
                status: "tamamlandi",
                completedAt: now,
                updatedAt: now,
            });

            toast.success("Denetim tamamlandı!");
            // Yönlendirme yerine sayfayı view moduna al (özet ve rapor indirme için)
            router.replace(`/audits/${auditId}?mode=view`);
        } catch (error) {
            console.error("Error completing audit:", error);
            toast.error("Denetim tamamlanırken hata oluştu");
        } finally {
            setCompleting(false);
        }
    };

    const saveAndNotify = async () => {
        if (!audit || !auditId || !userProfile) return;

        setSaving(true);

        try {
            const newScore = audit.totalScore || 0;
            const scoreChanged = newScore !== originalScore;

            // Update audit
            await updateDoc(doc(db, "audits", auditId), {
                sections: audit.sections,
                totalScore: audit.totalScore,
                updatedAt: Timestamp.now(),
            });

            // Create notification for all admins if score changed or answers changed

            // Calculate detailed changes
            const changes: Array<{
                sectionName: string;
                questionId: string;
                questionText: string;
                oldAnswer: string;
                newAnswer: string;
                oldScore: number;
                newScore: number;
            }> = [];

            if (originalAudit) {
                audit.sections.forEach((section, sIndex) => {
                    section.answers.forEach((answer, aIndex) => {
                        const originalSection = originalAudit.sections.find(s => s.sectionId === section.sectionId || s.sectionName === section.sectionName);
                        if (!originalSection) return;

                        const originalAnswer = originalSection.answers.find(a => a.questionId === answer.questionId || a.questionText === answer.questionText);
                        if (!originalAnswer) return;

                        const ansChanged = (answer.answer || "") !== (originalAnswer.answer || "");
                        const scoreChanged = answer.earnedPoints !== originalAnswer.earnedPoints;

                        if (ansChanged || scoreChanged) {
                            changes.push({
                                sectionName: section.sectionName,
                                questionId: answer.questionId,
                                questionText: answer.questionText,
                                oldAnswer: originalAnswer.answer || "boş",
                                newAnswer: answer.answer || "boş",
                                oldScore: originalAnswer.earnedPoints,
                                newScore: answer.earnedPoints
                            });
                        }
                    });
                });
            }

            if (scoreChanged || changes.length > 0) {
                const adminsQuery = query(
                    collection(db, "users"),
                    where("role", "==", "admin")
                );
                const adminsSnapshot = await getDocs(adminsQuery);

                const scoreDirection = newScore > originalScore ? "arttı" : "azaldı";
                let notificationMessage = `${userProfile.displayName || userProfile.email} ${audit.storeName} mağazasının denetimini düzeltti.`;

                if (scoreChanged) {
                    notificationMessage += ` Puan ${originalScore} iken ${newScore} oldu (${scoreDirection}).`;
                }

                if (changes.length > 0) {
                    notificationMessage += ` Toplam ${changes.length} soru değiştirildi.`;
                }

                // Create notifications for all admins
                const notificationPromises = adminsSnapshot.docs.map((adminDoc) =>
                    addDoc(collection(db, "notifications"), {
                        userId: adminDoc.id,
                        type: "audit_edited",
                        title: "Denetim Düzenlendi",
                        message: notificationMessage,
                        read: false,
                        relatedId: auditId,
                        changes: changes,
                        createdAt: Timestamp.now(),
                    })
                );

                await Promise.all(notificationPromises);
            }

            toast.success("Düzenleme kaydedildi");
            // Redirect based on user role
            const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard' : '/denetmen/tamamlanan';
            router.push(backDestination);
        } catch (error) {
            console.error("Error saving audit:", error);
            toast.error("Denetim kaydedilirken hata oluştu");
        } finally {
            setSaving(false);
        }
    };

    const getAnswerButtonClass = (selected: boolean) => {
        return selected
            ? "bg-black dark:bg-red-900 text-white hover:bg-black dark:hover:bg-red-900 hover:text-white"
            : "hover:bg-transparent hover:text-foreground hover:border-input";
    };


    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex min-h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (!audit) {
        return (
            <DashboardLayout>
                <div className="flex min-h-screen items-center justify-center">
                    <p>Denetim bulunamadı.</p>
                </div>
            </DashboardLayout>
        );
    }

    const isCompleted = audit.status === "tamamlandi";
    const isEditMode = mode === "edit" && isCompleted;
    const isViewMode = mode === "view" || (!isEditMode && isCompleted);
    const canEdit = !isViewMode;

    return (
        <DashboardLayout>
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="mb-6 flex items-center justify-between">
                    {currentSectionIndex !== null ? (
                        <Button
                            variant="outline"
                            size="lg"
                            className="bg-background hover:bg-muted shadow-sm"
                            onClick={handleBack}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Geri
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="lg"
                            className="bg-background hover:bg-muted shadow-sm"
                            onClick={() => {
                                const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard' : '/denetmen/tamamlanan';
                                if (isViewMode) {
                                    // View mode: navigate directly without dialog
                                    window.location.href = backDestination;
                                } else if (isEditMode) {
                                    // Edit mode: show confirmation dialog
                                    setShowBackDialog(true);
                                } else {
                                    // Pending audit: show confirmation dialog
                                    setShowBackDialog(true);
                                }
                            }}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Geri
                        </Button>
                    )}
                    <div className="flex gap-2">
                        {isEditMode && (
                            <Button
                                onClick={saveAndNotify}
                                disabled={saving}
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-5 w-5" />
                                        Kaydet
                                    </>
                                )}
                            </Button>
                        )}
                        {!isCompleted && currentSectionIndex === null && (
                            <Button
                                onClick={completeAudit}
                                disabled={completing || hasPending || !isOnline}
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                                title={
                                    !isOnline
                                        ? "Denetimi tamamlamak için internet bağlantısı gerekli"
                                        : hasPending
                                            ? "Lütfen tüm verilerin senkronize olmasını bekleyin"
                                            : ""
                                }
                            >
                                {completing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Tamamlanıyor...
                                    </>
                                ) : !isOnline ? (
                                    <>
                                        <WifiOff className="mr-2 h-5 w-5" />
                                        Offline - Tamamlanamaz
                                    </>
                                ) : hasPending ? (
                                    <>
                                        <Clock className="mr-2 h-5 w-5" />
                                        Senkronizasyon Bekleniyor...
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

                <Card className="shadow-lg overflow-hidden border bg-card">
                    {currentSectionIndex === null && (
                        <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-3xl font-bold mb-2 text-foreground">
                                        {audit.auditTypeName}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-lg">
                                        {audit.storeName} • {audit.auditorName}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center justify-center w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-lg border-4 border-slate-100 dark:border-slate-700">
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                            {audit.totalScore || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                    )}
                    <CardContent className={`pb-8 px-6 bg-background ${currentSectionIndex === null ? 'pt-6' : 'pt-0'}`}>
                        {isViewMode && (
                            <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
                                <div className="flex items-center gap-2 text-green-700 font-medium">
                                    <CheckCircle2 className="h-5 w-5" />
                                    Bu denetim tamamlanmıştır
                                </div>
                            </div>
                        )}
                        {isEditMode && (
                            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                                <div className="flex items-center gap-2 text-blue-700 font-medium">
                                    <Save className="h-5 w-5" />
                                    Düzenleme Modu - Değişiklikleri kaydetmeyi unutmayın
                                </div>
                            </div>
                        )}



                        {currentSectionIndex === null ? (
                            // Section list view - hide in view mode, show only in edit mode or pending audits
                            !isViewMode ? (
                                <>
                                    <div className="grid gap-2 md:gap-4 bg-background p-2 md:p-6 rounded-lg transition-all duration-500 ease-out animate-in fade-in zoom-in-95">
                                        {audit.sections.map((section, sectionIndex) => {
                                            const totalQuestions = section.answers.length;
                                            const answeredQuestions = section.answers.filter(
                                                (a) => a.answer && a.answer.trim() !== ""
                                            ).length;
                                            const isComplete = answeredQuestions === totalQuestions;
                                            const hasAny = answeredQuestions > 0;

                                            // Calculate section score
                                            let sectionEarned = 0;
                                            let sectionMax = 0;
                                            section.answers.forEach(answer => {
                                                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                                    sectionEarned += answer.earnedPoints;
                                                    sectionMax += answer.maxPoints;
                                                }
                                            });
                                            const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                                            return (
                                                <Card
                                                    key={sectionIndex}
                                                    className="cursor-pointer hover:shadow-lg transition-all border shadow-sm bg-card hover:bg-accent/50 group rounded-xl h-20 md:h-auto py-0 md:py-6 gap-0 md:gap-6 flex items-center justify-center"
                                                    onClick={() => setCurrentSectionIndex(sectionIndex)}
                                                >
                                                    <CardHeader className="p-0 px-3 md:p-6 w-full">
                                                        <div className="grid grid-cols-[1fr_auto] items-center gap-3 w-full">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <Circle
                                                                    className={`h-5 w-5 ${isComplete ? 'fill-green-500 text-green-500' : hasAny ? 'fill-red-500 text-red-500' : 'text-gray-300'}`}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-bold text-base md:text-2xl mb-1 md:mb-2 truncate text-foreground group-hover:text-blue-700 transition-colors">{section.sectionName}</h3>
                                                                    <p className="text-sm text-muted-foreground mt-1 truncate">
                                                                        {answeredQuestions} / {totalQuestions} soru cevaplanmış
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-muted rounded-full shadow-inner">
                                                                    <div className="text-base md:text-xl font-bold text-primary">
                                                                        {sectionScore}
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : null
                        ) : (
                            // SECTION DETAIL VIEW
                            <div className="space-y-6 transition-all duration-500 ease-out animate-in fade-in slide-in-from-bottom-8">
                                {/* Section Header with Score */}
                                {audit.sections[currentSectionIndex] && (() => {
                                    const section = audit.sections[currentSectionIndex];
                                    let sectionEarned = 0;
                                    let sectionMax = 0;
                                    section.answers.forEach(answer => {
                                        if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                            sectionEarned += answer.earnedPoints;
                                            sectionMax += answer.maxPoints;
                                        }
                                    });
                                    const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                                    return (
                                        <div className="flex items-center justify-between mb-6 p-4 bg-muted/50 rounded-lg border">
                                            <h2 className="text-2xl font-bold text-foreground">{section.sectionName}</h2>
                                            <div className="flex items-center justify-center w-14 h-14 bg-white dark:bg-slate-800 rounded-full shadow-md border">
                                                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                    {sectionScore}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                {audit.sections[currentSectionIndex].answers.map((answer, answerIndex) => (
                                    <Card key={answerIndex} className="p-4 border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-base">
                                                        {answer.questionText}
                                                    </h4>
                                                    {answer.photoRequired && (
                                                        <Badge className="bg-blue-500 mt-2">
                                                            Fotoğraf Zorunlu
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2 items-end shrink-0">
                                                    {answer.answer === "muaf" ? (
                                                        <Badge className="bg-orange-500 hover:bg-orange-600">
                                                            Muaf
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">
                                                            {answer.maxPoints} Puan
                                                        </Badge>
                                                    )}
                                                    <QuestionHistoryButton
                                                        storeId={audit.storeId}
                                                        auditTypeId={audit.auditTypeId}
                                                        questionId={answer.questionId}
                                                        currentAuditId={auditId}
                                                    />
                                                </div>
                                            </div>

                                            {/* Cevap Alanı - Soru Tipine Göre Dinamik */}
                                            {answer.questionType === 'checkbox' && answer.options && answer.options.length > 0 ? (
                                                // CHECKBOX: Çoklu seçim
                                                <div className="space-y-2">
                                                    {answer.options.map((option) => {
                                                        const selectedOptions = answer.selectedOptions || [];
                                                        const isChecked = selectedOptions.includes(option.id);

                                                        return (
                                                            <div key={option.id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent transition-colors">
                                                                <Checkbox
                                                                    id={`${answer.questionId}-${option.id}`}
                                                                    checked={isChecked}
                                                                    disabled={!canEdit}
                                                                    onCheckedChange={(checked) => {
                                                                        if (!canEdit) return;

                                                                        let newSelected: string[];
                                                                        if (checked) {
                                                                            newSelected = [...selectedOptions, option.id];
                                                                        } else {
                                                                            newSelected = selectedOptions.filter(id => id !== option.id);
                                                                        }

                                                                        // Toplam puan hesapla
                                                                        const totalPoints = answer.options
                                                                            ?.filter(opt => newSelected.includes(opt.id))
                                                                            .reduce((sum, opt) => sum + opt.points, 0) || 0;

                                                                        // Muaf'tan çıkıyorsa maxPoints'i geri yükle
                                                                        const originalMax = answer.originalMaxPoints || answer.maxPoints;

                                                                        updateAnswer(currentSectionIndex, answerIndex, {
                                                                            answer: newSelected.length > 0 ? newSelected.join(',') : '',
                                                                            selectedOptions: newSelected,
                                                                            earnedPoints: totalPoints,
                                                                            maxPoints: originalMax, // Muaf'tan geri yükle
                                                                        });
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`${answer.questionId}-${option.id}`}
                                                                    className="flex-1 cursor-pointer"
                                                                >
                                                                    {option.text}
                                                                    <span className="ml-2 text-sm text-muted-foreground">
                                                                        ({option.points} puan)
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="text-sm text-muted-foreground mt-2">
                                                        Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                    </div>
                                                    {/* Muaf butonu */}
                                                    <Button
                                                        variant={answer.answer === "muaf" ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                selectedOptions: [],
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            });
                                                        }}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>
                                            ) : answer.questionType === 'multiple_choice' && answer.options && answer.options.length > 0 ? (
                                                // MULTIPLE CHOICE: Tek seçim
                                                <div className="space-y-2">
                                                    {answer.options.map((option) => {
                                                        const isSelected = answer.answer === option.id;

                                                        return (
                                                            <Button
                                                                key={option.id}
                                                                variant={isSelected ? "default" : "outline"}
                                                                className="w-full justify-start"
                                                                disabled={!canEdit}
                                                                onClick={() => {
                                                                    if (!canEdit) return;
                                                                    updateAnswer(currentSectionIndex, answerIndex, {
                                                                        answer: option.id,
                                                                        earnedPoints: option.points,
                                                                        // maxPoints admin'de tanımlanan değer olarak kalır
                                                                    });
                                                                }}
                                                            >
                                                                {option.text}
                                                                <span className="ml-2 text-sm opacity-70">
                                                                    ({option.points} puan)
                                                                </span>
                                                            </Button>
                                                        );
                                                    })}
                                                    <div className="text-sm text-muted-foreground mt-2">
                                                        Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                    </div>
                                                    {/* Muaf butonu */}
                                                    <Button
                                                        variant={answer.answer === "muaf" ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            });
                                                        }}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>
                                            ) : answer.questionType === 'rating' && answer.ratingMax ? (
                                                // RATING: Derece (1-5 veya 1-10)
                                                <div className="space-y-3">
                                                    <div className="flex gap-1 sm:gap-2 w-full">
                                                        {Array.from({ length: answer.ratingMax }, (_, i) => i + 1).map((rating) => {
                                                            const isSelected = answer.answer === rating.toString();

                                                            return (
                                                                <button
                                                                    key={rating}
                                                                    type="button"
                                                                    disabled={!canEdit}
                                                                    onClick={() => {
                                                                        if (!canEdit) return;
                                                                        // Restore originalMaxPoints if coming from muaf
                                                                        const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                                        // Calculate proportional points based on rating
                                                                        const ratingMax = answer.ratingMax || 5;
                                                                        const earnedPoints = Math.round((rating / ratingMax) * originalMax);
                                                                        updateAnswer(currentSectionIndex, answerIndex, {
                                                                            answer: rating.toString(),
                                                                            earnedPoints: earnedPoints,
                                                                            maxPoints: originalMax, // Restore maxPoints
                                                                        });
                                                                    }}
                                                                    className={`flex-1 flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg border-2 transition-all ${isSelected
                                                                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                                        : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600'
                                                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                >
                                                                    <Star
                                                                        className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected
                                                                            ? 'fill-yellow-500 text-yellow-500'
                                                                            : 'text-gray-400 dark:text-gray-500'
                                                                            }`}
                                                                    />
                                                                    <span className={`text-xs sm:text-sm font-medium ${isSelected
                                                                        ? 'text-yellow-700 dark:text-yellow-400'
                                                                        : 'text-gray-600 dark:text-gray-400'
                                                                        }`}>
                                                                        {rating}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                    </div>
                                                    {/* Muaf butonu */}
                                                    <Button
                                                        variant={answer.answer === "muaf" ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            });
                                                        }}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>
                                            ) : (
                                                // YES_NO (varsayılan): Evet/Hayır/Muaf
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={getAnswerButtonClass(
                                                            answer.answer === "evet"
                                                        )}
                                                        onClick={() => {
                                                            const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                            canEdit &&
                                                                updateAnswer(currentSectionIndex, answerIndex, {
                                                                    answer: "evet",
                                                                    earnedPoints: originalMax, // Orijinal max puan
                                                                    maxPoints: originalMax, // Muaf'tan geri yükle
                                                                });
                                                        }}
                                                        disabled={!canEdit}
                                                    >
                                                        Evet
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={getAnswerButtonClass(
                                                            answer.answer === "hayir"
                                                        )}
                                                        onClick={() => {
                                                            const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                            canEdit &&
                                                                updateAnswer(currentSectionIndex, answerIndex, {
                                                                    answer: "hayir",
                                                                    earnedPoints: 0, // Hayır = 0 puan
                                                                    maxPoints: originalMax, // Muaf'tan geri yükle
                                                                });
                                                        }}
                                                        disabled={!canEdit}
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
                                                            canEdit &&
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            })
                                                        }
                                                        disabled={!canEdit}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Notes and Photos - Always visible */}
                                            <div className="space-y-3 border-t pt-4">
                                                <div>
                                                    <Label>Notlar</Label>
                                                    <div className="space-y-2 mt-2">
                                                        {(answer.notes && answer.notes.length > 0 ? answer.notes : [""]).map((note, noteIndex) => (
                                                            <div key={noteIndex} className="flex gap-2">
                                                                <Textarea
                                                                    value={note}
                                                                    onChange={(e) => {
                                                                        if (!canEdit) return;
                                                                        const currentNotes = answer.notes || [""];
                                                                        const newNotes = [...currentNotes];
                                                                        newNotes[noteIndex] = e.target.value;
                                                                        updateAnswer(currentSectionIndex, answerIndex, {
                                                                            notes: newNotes,
                                                                        });
                                                                    }}
                                                                    onInput={(e) => {
                                                                        const target = e.target as HTMLTextAreaElement;
                                                                        target.style.height = 'auto';
                                                                        target.style.height = target.scrollHeight + 'px';
                                                                    }}
                                                                    placeholder="Not girin..."
                                                                    disabled={!canEdit}
                                                                    className="flex-1 min-h-[60px] resize-none overflow-hidden"
                                                                    rows={2}
                                                                />
                                                                {canEdit && noteIndex > 0 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const newNotes = (answer.notes || []).filter((_, i) => i !== noteIndex);
                                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                                notes: newNotes.length > 0 ? newNotes : [""],
                                                                            });
                                                                        }}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {canEdit && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const newNotes = [...(answer.notes || [""]), ""];
                                                                    updateAnswer(currentSectionIndex, answerIndex, {
                                                                        notes: newNotes,
                                                                    });
                                                                }}
                                                                className="w-full"
                                                            >
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Not Ekle
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label>Fotoğraflar</Label>
                                                    <div className="mt-2">
                                                        <ImageGallery
                                                            images={answer.photos || []}
                                                            onImagesChange={(newImages) => {
                                                                updateAnswer(currentSectionIndex, answerIndex, {
                                                                    photos: newImages,
                                                                });
                                                            }}
                                                            auditId={auditId}
                                                            sectionIndex={currentSectionIndex}
                                                            answerIndex={answerIndex}
                                                            questionText={answer.questionText}
                                                            disabled={!canEdit}
                                                            onUploadStart={() => setUploading(true)}
                                                            onUploadEnd={() => setUploading(false)}
                                                            syncingImages={syncingImageUrls}
                                                            uploadedImages={uploadedImageUrls}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Audit Summary - Show only in view mode, not in edit mode */}
                        {isCompleted && currentSectionIndex === null && isViewMode && (
                            <AuditSummary audit={audit} />
                        )}

                        {/* Exit Confirmation Dialog */}
                        <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Denetimden Çıkılsın mı?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Denetimden çıkmak istediğinize emin misiniz? Denetim bekleyen denetimler listesinde kalacaktır.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => router.push('/denetmen/bekleyen')}>
                                        Çıkış Yap
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {/* Back Confirmation Dialog */}
                        <AlertDialog open={showBackDialog} onOpenChange={setShowBackDialog}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{isEditMode ? "Düzenlemeler İptal Edilsin mi?" : "Denetimden Çıkılsın mı?"}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {isEditMode
                                            ? "Düzenlemeler iptal edilecektir. Yine de geri dönmek istiyor musunuz?"
                                            : isViewMode
                                                ? "Görüntülemeden çıkmak istediğinize emin misiniz?"
                                                : "Denetimden çıkmak istediğinize emin misiniz? Denetim bekleyen denetimler listesinde kalacaktır."
                                        }
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => {
                                        const isAdmin = userProfile?.role === 'admin';
                                        if (isEditMode || isViewMode) {
                                            // For completed audits (edit or view mode)
                                            window.location.href = isAdmin ? '/admin/dashboard' : '/denetmen/tamamlanan';
                                        } else {
                                            // For pending audits
                                            const backDestination = isAdmin ? '/admin/dashboard' : '/denetmen/bekleyen';
                                            router.push(backDestination);
                                        }
                                    }}>
                                        {isEditMode ? "Evet, Geri Dön" : "Çıkış Yap"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout >
    );
}
