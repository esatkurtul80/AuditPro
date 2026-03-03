"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit } from "@/lib/types";
import { SpecialReportGenerator } from "@/components/admin/special-report-generator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { LogoLoader } from "@/components/logo-loader";
import { toast } from "sonner";
import { RegionalManagerHeader } from "@/components/regional-manager/regional-header";

export default function AuditReportPage() {
    const params = useParams();
    const router = useRouter();
    const { userProfile, loading: authLoading } = useAuth();
    const auditId = params.id as string;

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!userProfile) {
            router.push("/");
            return;
        }

        const fetchAudit = async () => {
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
    }, [auditId, userProfile, authLoading, router]);

    if (loading || authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <LogoLoader />
            </div>
        );
    }

    if (!audit) return null;

    // Block magaza role from viewing the special report
    const allowedRoles = ["admin", "denetmen", "bolge-muduru", "rapor-yoneticisi"];
    if (userProfile && !allowedRoles.includes(userProfile.role)) {
        router.replace("/magaza");
        return null;
    }

    const isRegionalManager = userProfile?.role === "bolge-muduru";

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            {isRegionalManager && <RegionalManagerHeader />}

            {/* Content */}
            <div className={`container mx-auto py-0 px-2 md:px-4 ${isRegionalManager ? 'animate-in fade-in duration-300' : ''}`}>
                <SpecialReportGenerator
                    audit={audit}
                    mode="preview"
                    onClose={() => {
                        if (isRegionalManager) {
                            router.push("/bolge-muduru");
                        } else {
                            router.back();
                        }
                    }}
                    onComplete={() => toast.success("Rapor başarıyla oluşturuldu")}
                    onError={() => toast.error("Rapor oluşturulurken hata oluştu")}
                    headerOffset={isRegionalManager ? 57 : 0}
                />
            </div>
        </div>
    );
}
