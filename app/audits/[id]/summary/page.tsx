"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Audit } from "@/lib/types";
import { AuditSummary } from "@/components/audit-summary";
import { DashboardLayout } from "@/components/dashboard-layout";
import { LogoLoader } from "@/components/logo-loader";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReportManagerHeader } from "@/components/report-manager/report-header";

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
                    let auditData = { id: docSnap.id, ...docSnap.data() } as Audit;

                    // Eğer admin, denetmen veya bölge müdürü ise personnel evaluations'ı da çek
                    if (userProfile && (userProfile.role === "admin" || userProfile.role === "denetmen" || userProfile.role === "bolge-muduru")) {
                        try {
                            const pQuery = query(collection(db, "personnel_evaluations"), where("auditId", "==", auditId));
                            const pSnap = await getDocs(pQuery);

                            if (!pSnap.empty) {
                                const pEvals = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                                auditData.personnelEvaluations = pEvals;
                            }
                        } catch (e) {
                            console.error("Failed to load personnel evaluations:", e);
                        }
                    }

                    setAudit(auditData);
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

        if (userProfile) { // Ensure userProfile is loaded before fetching to accurately attach restricted data
            fetchAudit();
        }
    }, [auditId, router, userProfile]);

    // Permission check
    if (!loading && audit && userProfile) {
        const isStore = userProfile.role === "magaza";
        const hasPermission =
            userProfile.role === "admin" ||
            userProfile.role === "denetmen" ||
            userProfile.role === "bolge-muduru" ||
            userProfile.role === "rapor-yoneticisi" ||
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
                        <Button variant="outline" onClick={() => router.push("/")}>
                            Ana Sayfaya Dön
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

    const isReportManager = userProfile?.role === "rapor-yoneticisi";

    const content = (
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
            <AuditSummary
                audit={audit}
                showRestrictedFeedback={userProfile?.role === "admin" || userProfile?.role === "denetmen" || userProfile?.role === "bolge-muduru"}
            />
        </div>
    );

    if (isReportManager) {
        return (
            <div className="flex h-screen overflow-hidden bg-background">
                {/* Main area - Full Width for Report Manager unless sidebar is needed, but typically headers are enough */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <ReportManagerHeader
                        activeTab="panel"
                        onTabChange={(tab) => {
                            router.push(`/rapor-yoneticisi?tab=${tab}`);
                        }}
                    />
                    <main className="flex-1 overflow-y-auto overscroll-contain pb-8">
                        {content}
                    </main>
                </div>
            </div>
        );
    }

    return <DashboardLayout>{content}</DashboardLayout>;
}
