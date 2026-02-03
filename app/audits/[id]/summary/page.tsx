"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Audit } from "@/lib/types";
import { AuditSummary } from "@/components/audit-summary";
import { DashboardLayout } from "@/components/dashboard-layout";
import { LogoLoader } from "@/components/logo-loader";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AuditSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const { userProfile } = useAuth();
    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);

    const auditId = params.id as string;

    useEffect(() => {
        const fetchAudit = async () => {
            if (!auditId) return;

            try {
                const docRef = doc(db, "audits", auditId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setAudit({ id: docSnap.id, ...docSnap.data() } as Audit);
                } else {
                    toast.error("Denetim bulunamadı");
                    router.back();
                }
            } catch (error) {
                console.error("Error fetching audit:", error);
                toast.error("Denetim yüklenirken hata oluştu");
            } finally {
                setLoading(false);
            }
        };

        fetchAudit();
    }, [auditId, router]);

    // Permission check
    if (!loading && audit && userProfile) {
        const isStore = userProfile.role === "magaza";
        const hasPermission =
            userProfile.role === "admin" ||
            userProfile.role === "denetmen" ||
            (isStore && (
                (userProfile.storeId && audit.storeId && userProfile.storeId === audit.storeId) ||
                (userProfile.storeName && audit.storeName && userProfile.storeName === audit.storeName)
            ));

        if (!hasPermission) {
            return (
                <DashboardLayout>
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                        <h2 className="text-xl font-bold text-red-600 mb-2">Yetkisiz Erişim</h2>
                        <p className="text-gray-500 mb-6">Bu denetimi görüntüleme yetkiniz bulunmuyor.</p>
                        <Button variant="outline" onClick={() => router.push("/magaza/panel")}>
                            Panele Dön
                        </Button>
                    </div>
                </DashboardLayout>
            );
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LogoLoader />
            </div>
        );
    }

    if (!audit) return null;

    return (
        <DashboardLayout>
            <div className="container mx-auto py-6 max-w-5xl px-4 md:px-6">
                <div className="mb-6">
                    <Button
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md shadow-purple-500/20"
                        onClick={() => {
                            if (userProfile?.role === "magaza") {
                                router.push("/magaza/panel");
                            } else {
                                router.back();
                            }
                        }}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Geri Dön
                    </Button>
                </div>
                <AuditSummary audit={audit} />
            </div>
        </DashboardLayout>
    );
}
