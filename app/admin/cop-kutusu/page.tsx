"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    RefreshCw,
    Trash2,
    CheckCircle2,
    PlayCircle,
} from "lucide-react";
import {
    collection,
    getDocs,
    query,
    where,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit } from "@/lib/types";
import { restoreAudit, permanentlyDeleteAudit } from "@/lib/firebase-utils";
import { toast } from "sonner";

export default function TrashPage() {
    const [loading, setLoading] = useState(true);
    const [deletedAudits, setDeletedAudits] = useState<Audit[]>([]);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [auditToRestore, setAuditToRestore] = useState<string | null>(null);
    const [auditToDelete, setAuditToDelete] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadDeletedAudits();
    }, []);

    const loadDeletedAudits = async () => {
        try {
            setLoading(true);
            const auditsQuery = query(
                collection(db, "audits"),
                where("isDeleted", "==", true)
            );
            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Audit[];

            // Sort by deletion date (most recent first)
            setDeletedAudits(
                auditsData.sort((a, b) => {
                    if (!a.deletedAt || !b.deletedAt) return 0;
                    return b.deletedAt.toMillis() - a.deletedAt.toMillis();
                })
            );
        } catch (error) {
            console.error("Error loading deleted audits:", error);
            toast.error("Silinmiş denetimler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!auditToRestore) return;

        try {
            setProcessing(true);
            await restoreAudit(auditToRestore);
            toast.success("Denetim geri yüklendi");
            setRestoreDialogOpen(false);
            setAuditToRestore(null);
            await loadDeletedAudits();
        } catch (error) {
            console.error("Error restoring audit:", error);
            toast.error("Geri yükleme işlemi başarısız oldu");
        } finally {
            setProcessing(false);
        }
    };

    const handlePermanentDelete = async () => {
        if (!auditToDelete) return;

        try {
            setProcessing(true);
            await permanentlyDeleteAudit(auditToDelete);
            toast.success("Denetim kalıcı olarak silindi");
            setDeleteDialogOpen(false);
            setAuditToDelete(null);
            await loadDeletedAudits();
        } catch (error) {
            console.error("Error permanently deleting audit:", error);
            toast.error("Silme işlemi başarısız oldu");
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return "Tarih bilinmiyor";
        return timestamp.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">
                <div className="flex items-center justify-end">
                    <Button onClick={loadDeletedAudits} variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Yenile
                    </Button>
                </div>

                {/* Deleted Audits Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Silinmiş Denetimler</CardTitle>
                        <CardDescription>
                            {deletedAudits.length} silinmiş denetim bulundu
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {deletedAudits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Trash2 className="h-16 w-16 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold">
                                    Çöp kutusu boş
                                </h3>
                                <p className="text-muted-foreground mt-2">
                                    Silinmiş denetim bulunmuyor
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Denetim Türü</TableHead>
                                        <TableHead>Mağaza</TableHead>
                                        <TableHead>Denetmen</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead>Silinme Tarihi</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedAudits.map((audit) => (
                                        <TableRow key={audit.id}>
                                            <TableCell className="font-medium">
                                                {audit.auditTypeName}
                                            </TableCell>
                                            <TableCell>{audit.storeName}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {audit.auditorName}
                                            </TableCell>
                                            <TableCell>
                                                {audit.status === "devam_ediyor" ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-yellow-100 text-yellow-800"
                                                    >
                                                        <PlayCircle className="mr-1 h-3 w-3" />
                                                        Devam Ediyordu
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-green-100 text-green-800"
                                                    >
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Tamamlanmıştı
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatDate(audit.deletedAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2"
                                                        onClick={() => {
                                                            setAuditToRestore(audit.id);
                                                            setRestoreDialogOpen(true);
                                                        }}
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                        Geri Yükle
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => {
                                                            setAuditToDelete(audit.id);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Kalıcı Sil
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Restore Confirmation Dialog */}
            <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Denetimi geri yükle?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu denetim ana listeye geri yüklenecek ve tekrar görünür olacak.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRestore}
                            disabled={processing}
                        >
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Geri Yükle
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Permanent Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kalıcı olarak sil?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz! Denetim ve ilişkili tüm veriler (fotoğraflar,
                            aksiyonlar) kalıcı olarak silinecek.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handlePermanentDelete}
                            disabled={processing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kalıcı Olarak Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
