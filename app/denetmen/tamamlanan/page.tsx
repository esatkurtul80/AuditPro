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
import { AuditType, Store, Audit, Section, Question, DateRangeFilter } from "@/lib/types";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Loader2,
    ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { auditColumns } from "../columns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function DenetmenPage() {
    const router = useRouter();
    const { userProfile } = useAuth();

    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [myAudits, setMyAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<DateRangeFilter>({
        from: undefined,
        to: undefined,
    });


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
            const auditsData = auditsSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    auditorName: userProfile?.firstName && userProfile?.lastName
                        ? `${userProfile.firstName} ${userProfile.lastName}`
                        : data.auditorName
                };
            }) as Audit[];
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

                        <CardContent className="px-4 md:px-6">
                            {myAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Henüz denetim yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Tamamlanan denetimleriniz burada listelenir
                                    </p>
                                </div>
                            ) : (
                                <DataTable
                                    toolbar={
                                        <>
                                            <div className="relative flex-1 md:max-w-sm">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Mağaza ara..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <DateRangePicker value={dateRange} onChange={setDateRange} />
                                        </>
                                    }
                                    columns={auditColumns}
                                    mobileHiddenColumns={["startTime", "endTime"]}
                                    initialColumnVisibility={{
                                        auditTypeName: false,
                                        status: false
                                    }}
                                    data={myAudits.filter((audit) => {
                                        // Date Filter
                                        if (dateRange.from || dateRange.to) {
                                            const auditDate = audit.createdAt.toDate();
                                            const checkDate = new Date(auditDate);
                                            checkDate.setHours(0, 0, 0, 0);

                                            if (dateRange.from) {
                                                const fromDate = new Date(dateRange.from);
                                                fromDate.setHours(0, 0, 0, 0);
                                                if (checkDate < fromDate) return false;
                                            }

                                            if (dateRange.to) {
                                                const effectiveTo = new Date(dateRange.to);
                                                effectiveTo.setHours(23, 59, 59, 999);
                                                if (auditDate > effectiveTo) return false;
                                            }
                                        }

                                        // Search Filter
                                        if (searchTerm) {
                                            const term = searchTerm.toLowerCase();
                                            return (
                                                audit.storeName?.toLowerCase().includes(term) ||
                                                false
                                            );
                                        }

                                        return true;
                                    })}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
