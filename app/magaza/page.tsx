"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit } from "@/lib/types";
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
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MagazaPage() {
    const { userProfile } = useAuth();
    const [auditsWithActions, setAuditsWithActions] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.storeId) {
            loadAudits();
        }
    }, [userProfile]);

    const loadAudits = async () => {
        if (!userProfile?.storeId) return;

        try {
            const auditsQuery = query(
                collection(db, "audits"),
                where("storeId", "==", userProfile.storeId),
                where("status", "==", "tamamlandi")
            );

            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as Audit))
                .filter((audit) => {
                    // Sadece "hayır" cevabı olan denetimleri al
                    return audit.sections.some((section) =>
                        section.answers.some((answer) => answer.answer === "hayir")
                    );
                })
                .sort((a, b) => b.completedAt!.toMillis() - a.completedAt!.toMillis());

            setAuditsWithActions(auditsData);
        } catch (error) {
            console.error("Error loading audits:", error);
            toast.error("Denetimler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        return timestamp?.toDate().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const getDeadlineStatus = (audit: Audit) => {
        if (audit.allActionsResolved) return { text: "Tamamlandı", color: "bg-green-100 text-green-800 border-green-200" };
        if (!audit.actionDeadline) return null;

        const now = new Date().getTime();
        const deadline = audit.actionDeadline.toMillis();
        const diff = deadline - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) return { text: `${Math.abs(days)} gün gecikti`, color: "bg-red-100 text-red-800 border-red-200 animate-pulse" };
        if (days === 0) return { text: "Bugün son gün", color: "bg-orange-100 text-orange-800 border-orange-200" };
        return { text: `${days} gün kaldı`, color: "bg-blue-100 text-blue-800 border-blue-200" };
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["magaza"]}>
                <DashboardLayout>
                    <div className="flex min-h-screen items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["magaza"]}>
            <DashboardLayout>
                <div className="container mx-auto py-8 px-4 md:px-6">
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold">Düzeltici Aksiyonlar</h1>
                        <p className="text-muted-foreground mt-2">
                            Mağazanız için aksiyon gerektiren denetimler
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Aksiyon Gerektiren Denetimler</CardTitle>
                            <CardDescription>
                                Bu denetimlerde "Hayır" cevabı verilmiş maddeler var
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {auditsWithActions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Aksiyon gerektiren denetim yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Harika! Tüm denetimler başarılı.
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Denetim Türü</TableHead>
                                            <TableHead>Denetmen</TableHead>
                                            <TableHead>Tarih</TableHead>
                                            <TableHead>Son Tarih</TableHead>
                                            <TableHead>Puan</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {auditsWithActions.map((audit) => {
                                            const deadline = getDeadlineStatus(audit);
                                            return (
                                                <TableRow key={audit.id}>
                                                    <TableCell className="font-medium">
                                                        {audit.auditTypeName}
                                                    </TableCell>
                                                    <TableCell>{audit.auditorName}</TableCell>
                                                    <TableCell>{formatDate(audit.completedAt)}</TableCell>
                                                    <TableCell>
                                                        {deadline && (
                                                            <Badge variant="outline" className={deadline.color}>
                                                                {deadline.text}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                audit.totalScore / audit.maxScore >= 0.8
                                                                    ? "default"
                                                                    : "destructive"
                                                            }
                                                        >
                                                            {audit.totalScore} / {audit.maxScore}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/audits/${audit.id}/actions`}>
                                                            <Button variant="ghost" size="sm">
                                                                Aksiyonları Görüntüle
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
