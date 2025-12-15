"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import imageCompression from "browser-image-compression";
import { Skeleton } from "@/components/ui/skeleton";

function AuditActionsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const auditId = searchParams.get("id");

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

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
                router.push("/admin/actions");
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

        updatedAudit.updatedAt = Timestamp.now();

        try {
            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedAudit.sections,
                updatedAt: updatedAudit.updatedAt,
            });
            setAudit(updatedAudit);
            toast.success("Güncellendi");
        } catch (error) {
            console.error("Error updating answer:", error);
            toast.error("Güncellenirken hata oluştu");
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

    // Filter for actions (answers with "hayir")
    interface AuditActionViewItem extends AuditAnswer {
        sectionIndex: number;
        answerIndex: number;
        sectionName: string;
    }

    const actions: AuditActionViewItem[] = [];
    audit.sections.forEach((section, sIndex) => {
        section.answers.forEach((answer, aIndex) => {
            if (answer.answer === "hayir") {
                actions.push({
                    sectionIndex: sIndex,
                    answerIndex: aIndex,
                    sectionName: section.sectionName,
                    ...answer,
                });
            }
        });
    });

    return (
        <div className="container mx-auto py-8">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/admin/actions">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Geri
                    </Button>
                </Link>
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-bold">Aksiyon Detayları</h1>
                <p className="text-muted-foreground mt-1">
                    {audit.storeName} - {audit.auditTypeName}
                </p>
            </div>

            <div className="space-y-6">
                {actions.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">Aksiyon bulunamadı</p>
                        </CardContent>
                    </Card>
                ) : (
                    actions.map((action, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <Badge variant="outline" className="mb-2">
                                            {action.sectionName}
                                        </Badge>
                                        <CardTitle className="text-lg">
                                            {action.questionText}
                                        </CardTitle>
                                    </div>
                                    <Badge variant="destructive">Aksiyon Gerekiyor</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Notlar</Label>
                                    <Input
                                        value={(action.notes || []).join(", ")}
                                        onChange={(e) =>
                                            updateAnswer(
                                                action.sectionIndex,
                                                action.answerIndex,
                                                { notes: e.target.value ? [e.target.value] : [] }
                                            )
                                        }
                                        placeholder="Aksiyon notları..."
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Fotoğraflar</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {action.photos?.map((photo: string, photoIndex: number) => (
                                            <div
                                                key={photoIndex}
                                                className="relative group"
                                            >
                                                <img
                                                    src={photo}
                                                    alt={`Photo ${photoIndex + 1}`}
                                                    className="h-24 w-24 object-cover rounded-lg border"
                                                />
                                                <button
                                                    onClick={() =>
                                                        removePhoto(
                                                            action.sectionIndex,
                                                            action.answerIndex,
                                                            photoIndex
                                                        )
                                                    }
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
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
                                                            action.sectionIndex,
                                                            action.answerIndex
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
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}

export default function AuditActionsPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={
                <div className="container mx-auto py-8">
                    <div className="mb-6">
                        <Skeleton className="h-9 w-24" />
                    </div>
                    <div className="mb-6">
                        <Skeleton className="h-9 w-56 mb-2" />
                        <Skeleton className="h-5 w-64" />
                    </div>
                    <div className="space-y-6">
                        <div className="rounded-lg border bg-card">
                            <div className="p-6 border-b">
                                <Skeleton className="h-6 w-48 mb-2" />
                                <Skeleton className="h-7 w-96" />
                            </div>
                            <div className="p-6 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        </div>
                        <div className="rounded-lg border bg-card">
                            <div className="p-6 border-b">
                                <Skeleton className="h-6 w-48 mb-2" />
                                <Skeleton className="h-7 w-96" />
                            </div>
                            <div className="p-6 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            }>
                <AuditActionsContent />
            </Suspense>
        </DashboardLayout>
    );
}
