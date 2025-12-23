"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Audit, AuditAnswer, ActionDataStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Upload, CheckCircle2, AlertCircle, Clock, XCircle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import ImageGallery from "@/components/image-gallery";
import { cn } from "@/lib/utils";

export default function AuditActionsPage() {
    const params = useParams();
    const router = useRouter();
    const { userProfile } = useAuth();
    const auditId = params.id as string;

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null); // keeping track of which action is uploading
    const [submitting, setSubmitting] = useState(false);

    // Admin Rejection State
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<{ sectionIndex: number, answerIndex: number } | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Store Submission State
    const [submissionData, setSubmissionData] = useState<Record<string, { note: string, images: File[] }>>({});

    useEffect(() => {
        if (auditId) {
            loadAudit();
        }
    }, [auditId]);

    const loadAudit = async () => {
        try {
            const docRef = doc(db, "audits", auditId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setAudit({ id: docSnap.id, ...docSnap.data() } as Audit);
            } else {
                toast.error("Denetim bulunamadı");
                router.push("/");
            }
        } catch (error) {
            console.error("Error loading audit:", error);
            toast.error("Denetim yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (sectionIndex: number, answerIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const key = `${sectionIndex}-${answerIndex}`;
        if (e.target.files && e.target.files.length > 0) {
            setSubmissionData(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    images: [...(prev[key]?.images || []), ...Array.from(e.target.files!)]
                }
            }));
        }
    };

    const handleRemoveFile = (sectionIndex: number, answerIndex: number, fileIndex: number) => {
        const key = `${sectionIndex}-${answerIndex}`;
        setSubmissionData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                images: prev[key].images.filter((_, i) => i !== fileIndex)
            }
        }));
    };

    const handleNoteChange = (sectionIndex: number, answerIndex: number, note: string) => {
        const key = `${sectionIndex}-${answerIndex}`;
        setSubmissionData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                note
            }
        }));
    };

    const handleStoreSubmit = async (sectionIndex: number, answerIndex: number, answer: AuditAnswer) => {
        const key = `${sectionIndex}-${answerIndex}`;
        const data = submissionData[key];

        if (!data?.note || !data.note.trim()) {
            toast.error("Lütfen bir açıklama girin");
            return;
        }

        if (answer.actionPhotoRequired) {
            if (!data.images || data.images.length === 0) {
                toast.error("Bu aksiyon için fotoğraf yüklemesi zorunludur");
                return;
            }
        }

        setSubmitting(true);
        setUploading(key);

        try {
            const imageUrls: string[] = [];

            // Upload images
            if (data.images && data.images.length > 0) {
                for (const file of data.images) {
                    const storageRef = ref(storage, `actions/${auditId}/${Date.now()}_${file.name}`);
                    const uploadResult = await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(uploadResult.ref);
                    imageUrls.push(url);
                }
            }

            const updatedSections = [...audit!.sections];
            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...updatedSections[sectionIndex].answers[answerIndex].actionData!,
                status: "pending_admin" as const,
                storeNote: data.note,
                storeImages: imageUrls,
                submittedAt: Timestamp.now(), // This field is technically mostly for UI display logic if needed later
            };

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now()
            });

            // Update local state
            setAudit({ ...audit!, sections: updatedSections });

            // Clear submission data for this item
            setSubmissionData(prev => {
                const newData = { ...prev };
                delete newData[key];
                return newData;
            });

            toast.success("Aksiyon cevabı gönderildi");

        } catch (error) {
            console.error("Error submitting action:", error);
            toast.error("Gönderim sırasında hata oluştu");
        } finally {
            setSubmitting(false);
            setUploading(null);
        }
    };

    const handleAdminReject = async () => {
        if (!selectedAction || !rejectionReason.trim() || !audit) return;

        setSubmitting(true);
        try {
            const { sectionIndex, answerIndex } = selectedAction;
            const updatedSections = [...audit.sections];
            const actionData = updatedSections[sectionIndex].answers[answerIndex].actionData!;

            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...actionData,
                status: "rejected" as const,
                adminNote: rejectionReason,
                rejectedAt: Timestamp.now(),
                // Keep store note/images so they can see what they sent, or maybe clear them? 
                // Usually better to keep history, but for simplicity we keep them as 'previous submission'
                // But the requirement says "Re-submit".
                // We keep them in the object but the UI allows new submission.
            };

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now()
            });

            // Send Notification to Store (TODO)
            // We'll skip notification implementation for now as it's not strictly blocked but good to have.
            // Assuming notification system listens to changes or we trigger it explicitly.

            setAudit({ ...audit, sections: updatedSections });
            toast.success("Aksiyon reddedildi");
            setRejectDialogOpen(false);
            setRejectionReason("");
            setSelectedAction(null);

        } catch (error) {
            console.error("Error rejecting action:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdminApprove = async (sectionIndex: number, answerIndex: number) => {
        if (!audit) return;

        // Confirm
        if (!confirm("Bu aksiyonu onaylamak istediğinize emin misiniz?")) return;

        setSubmitting(true);
        try {
            const updatedSections = [...audit.sections];
            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...updatedSections[sectionIndex].answers[answerIndex].actionData!,
                status: "approved" as const,
                approvedAt: Timestamp.now(),
                resolvedAt: Timestamp.now(),
            };

            // Check if all actions are resolved
            let allResolved = true;
            updatedSections.forEach(section => {
                section.answers.forEach(a => {
                    if (a.answer === "hayir") {
                        if (a.actionData?.status !== "approved") {
                            allResolved = false;
                        }
                    }
                });
            });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now(),
                ...(allResolved ? { allActionsResolved: true } : {})
            });

            setAudit({
                ...audit,
                sections: updatedSections,
                ...(allResolved ? { allActionsResolved: true } : {})
            });
            toast.success("Aksiyon onaylandı");

        } catch (error) {
            console.error("Error approving action:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: ActionDataStatus) => {
        switch (status) {
            case "pending_store":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Mağaza Cevabı Bekleniyor</Badge>;
            case "pending_admin":
                return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Yönetici Onayı Bekleniyor</Badge>;
            case "approved":
                return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Onaylandı</Badge>;
            case "rejected":
                return <Badge variant="destructive">Reddedildi - Tekrar Gönderim Gerekli</Badge>;
            default:
                return null;
        }
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

    if (!audit) return null;

    const isAdmin = userProfile?.role === "admin";
    const isStore = userProfile?.role === "magaza";

    // Flatten actions for easy rendering
    const actions = audit.sections.flatMap((section, sIndex) =>
        section.answers
            .map((answer, aIndex) => ({ answer, section, sIndex, aIndex }))
            .filter(item => item.answer.answer === "hayir")
    );

    return (
        <ProtectedRoute allowedRoles={["admin", "magaza", "bolge-muduru"]}>
            <DashboardLayout>
                <div className="container mx-auto py-8 px-4 md:px-6">
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Geri Dön
                        </Button>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Aksiyon Planı</h1>
                                <p className="text-muted-foreground mt-1">
                                    {audit.storeName} - {audit.auditTypeName}
                                </p>
                            </div>
                            {/* Deadline Info */}
                            {audit.actionDeadline && (
                                <div className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg border",
                                    (audit.allActionsResolved || Timestamp.now().toMillis() < audit.actionDeadline.toMillis())
                                        ? "bg-blue-50 border-blue-100 text-blue-700"
                                        : "bg-red-50 border-red-100 text-red-700"
                                )}>
                                    <Clock className="h-5 w-5" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold uppercase opacity-70">Son İşlem Tarihi</span>
                                        <span className="font-medium">
                                            {audit.actionDeadline.toDate().toLocaleDateString("tr-TR", {
                                                day: 'numeric', month: 'long', weekday: 'long'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {actions.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold">Aksiyon Gerektiren Durum Yok</h3>
                                    <p className="text-muted-foreground mt-2">Bu denetimde düzeltici faaliyet gerektiren bir madde bulunmamaktadır.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            actions.map(({ answer, section, sIndex, aIndex }) => {
                                const actionData = answer.actionData;
                                const status = actionData?.status || "pending_store";
                                const isPendingStore = status === "pending_store" || status === "rejected";
                                const isPendingAdmin = status === "pending_admin";
                                const isApproved = status === "approved";

                                const submissionKey = `${sIndex}-${aIndex}`;
                                const currentSubmission = submissionData[submissionKey];

                                return (
                                    <Card key={submissionKey} className={cn(
                                        "border-l-4",
                                        isApproved ? "border-l-green-500" :
                                            status === "rejected" ? "border-l-red-500" :
                                                "border-l-yellow-500"
                                    )}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="outline">{section.sectionName}</Badge>
                                                        {getStatusBadge(status)}
                                                    </div>
                                                    <CardTitle className="text-lg leading-snug">
                                                        {answer.questionText}
                                                    </CardTitle>
                                                </div>
                                                {answer.maxPoints > 0 && (
                                                    <Badge variant="secondary">{answer.maxPoints} Puan</Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Original Issue */}
                                            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                                                <h4 className="flex items-center gap-2 font-medium text-sm text-foreground/80">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Tespit Edilen Uygunsuzluk
                                                </h4>
                                                {answer.notes && answer.notes.length > 0 && answer.notes[0] && (
                                                    <p className="text-sm italic">"{answer.notes[0]}"</p>
                                                )}
                                                {answer.photos && answer.photos.length > 0 && (
                                                    <div className="flex gap-2 mt-2">
                                                        <ImageGallery
                                                            images={answer.photos}
                                                            auditId={auditId}
                                                            sectionIndex={sIndex}
                                                            answerIndex={aIndex}
                                                            questionText={answer.questionText}
                                                            onImagesChange={() => { }}
                                                            disabled={true}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Admin Rejection Note */}
                                            {status === "rejected" && actionData?.adminNote && (
                                                <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                                                    <h4 className="flex items-center gap-2 font-medium text-red-800 text-sm mb-1">
                                                        <XCircle className="h-4 w-4" />
                                                        Red Nedeni
                                                    </h4>
                                                    <p className="text-sm text-red-700">{actionData.adminNote}</p>
                                                </div>
                                            )}

                                            {/* Store Submission Form */}
                                            {isStore && isPendingStore && (
                                                <div className="space-y-4 border-t pt-4">
                                                    <h4 className="font-medium">Düzeltici Aksiyon Gönder</h4>

                                                    <div className="space-y-2">
                                                        <Label>Açıklama</Label>
                                                        <Textarea
                                                            placeholder="Yapılan düzeltmeleri detaylıca açıklayınız..."
                                                            value={currentSubmission?.note || ""}
                                                            onChange={(e) => handleNoteChange(sIndex, aIndex, e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Fotoğraf Kanıtı {answer.actionPhotoRequired && <span className="text-red-500">*</span>}</Label>
                                                        <div className="flex items-center gap-4">
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                className="w-full"
                                                                onChange={(e) => handleFileSelect(sIndex, aIndex, e)}
                                                            />
                                                        </div>
                                                        {currentSubmission?.images?.map((file, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                                                                <ImageIcon className="h-4 w-4" />
                                                                <span className="flex-1 truncate">{file.name}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => handleRemoveFile(sIndex, aIndex, i)}
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <Button
                                                        onClick={() => handleStoreSubmit(sIndex, aIndex, answer)}
                                                        disabled={submitting}
                                                    >
                                                        {submitting && uploading === submissionKey ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Gönderiliyor
                                                            </>
                                                        ) : "Gönder"}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Submitted Content (View for Admin or Store waiting) */}
                                            {(!isPendingStore || (status === "rejected" && actionData?.storeNote)) && actionData?.storeNote && (
                                                <div className="space-y-4 border-t pt-4">
                                                    <h4 className="font-medium flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                                        Mağaza Cevabı
                                                    </h4>
                                                    <div className="bg-card border p-4 rounded-lg">
                                                        <p className="text-sm whitespace-pre-wrap">{actionData.storeNote}</p>
                                                        {actionData.storeImages && actionData.storeImages.length > 0 && (
                                                            <div className="mt-4">
                                                                <Label className="text-xs text-muted-foreground mb-2 block">Kanıt Fotoğrafları</Label>
                                                                <ImageGallery
                                                                    images={actionData.storeImages}
                                                                    auditId={auditId}
                                                                    sectionIndex={sIndex}
                                                                    answerIndex={aIndex}
                                                                    questionText={answer.questionText}
                                                                    onImagesChange={() => { }}
                                                                    disabled={true}
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="mt-2 text-xs text-muted-foreground text-right">
                                                            Gönderim: {actionData.submittedAt ? actionData.submittedAt.toDate().toLocaleString("tr-TR") : "-"}
                                                        </div>
                                                    </div>

                                                    {/* Admin Actions */}
                                                    {isAdmin && isPendingAdmin && (
                                                        <div className="flex gap-3 justify-end pt-2">
                                                            <Button
                                                                variant="outline"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => {
                                                                    setSelectedAction({ sectionIndex: sIndex, answerIndex: aIndex });
                                                                    setRejectDialogOpen(true);
                                                                }}
                                                                disabled={submitting}
                                                            >
                                                                Reddet
                                                            </Button>
                                                            <Button
                                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                                onClick={() => handleAdminApprove(sIndex, aIndex)}
                                                                disabled={submitting}
                                                            >
                                                                Onayla
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Rejection Dialog */}
                <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Aksiyonu Reddet</DialogTitle>
                            <DialogDescription>
                                Lütfen ret nedenini belirtiniz. Bu not mağazaya iletilecektir.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <Label>Ret Nedeni</Label>
                            <Textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Örn: Fotoğraflar net değil, onarım tam görünmüyor..."
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>İptal</Button>
                            <Button
                                variant="destructive"
                                onClick={handleAdminReject}
                                disabled={!rejectionReason.trim() || submitting}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reddet ve Gönder"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
