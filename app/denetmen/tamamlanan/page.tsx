"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/components/auth-provider";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditType, Store, Audit, Section, Question } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Loader2,
    ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { auditColumns } from "../columns";

export default function DenetmenPage() {
    const router = useRouter();
    const { userProfile } = useAuth();

    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [myAudits, setMyAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        if (userProfile) {
            loadData();
        }
    }, [userProfile]);

    const loadData = async () => {
        try {
            const storesSnapshot = await getDocs(collection(db, "stores"));
            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];
            setStores(storesData);

            const auditTypesSnapshot = await getDocs(collection(db, "auditTypes"));
            const auditTypesData = auditTypesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AuditType[];
            setAuditTypes(auditTypesData);

            const auditsQuery = query(
                collection(db, "audits"),
                where("auditorId", "==", userProfile!.uid),
                where("status", "==", "tamamlandi")
            );
            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Audit[];
            setMyAudits(auditsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };




    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["denetmen"]}>
                <DashboardLayout>
                    <div className="flex min-h-screen items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["denetmen"]}>
            <DashboardLayout>
                <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-inter font-bold tracking-tight">Tamamlanan Denetimlerim</h1>
                            <p className="text-muted-foreground mt-2 font-inter">
                                Tamamladığınız denetimleri görüntüleyin
                            </p>
                        </div>

                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Tüm Denetimler</CardTitle>
                            <CardDescription>
                                Başlattığınız tüm denetimlerin listesi
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 md:px-6">
                            {myAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Henüz denetim yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Başlamak için yeni bir denetim başlatın
                                    </p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={auditColumns}
                                    data={myAudits}
                                    searchKey="storeName"
                                    searchPlaceholder="Mağaza ara..."
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
