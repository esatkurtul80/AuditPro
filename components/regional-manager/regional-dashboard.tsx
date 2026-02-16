"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, Audit } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Store as StoreIcon,
    ClipboardList,
    CheckCircle2,
    PlayCircle,
    ChevronRight,
    TrendingUp,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { SpecialReportGenerator } from "@/components/admin/special-report-generator";
import { useRouter } from "next/navigation";
import { Eye, FileText, Zap } from "lucide-react";
import { toast } from "sonner";

export function RegionalDashboard() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [myStores, setMyStores] = useState<Store[]>([]);
    const [recentAudits, setRecentAudits] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedStore, setSelectedStore] = useState<string>("all");
    const [reportAudit, setReportAudit] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        if (userProfile?.uid) {
            loadDashboardData();
        }
    }, [userProfile, selectedMonth, selectedYear, selectedStore]);

    const loadDashboardData = async () => {
        if (!userProfile?.uid) return;

        try {
            // Get my assigned stores
            const storesQuery = query(
                collection(db, "stores"),
                where("regionalManagerId", "==", userProfile.uid)
            );
            const storesSnapshot = await getDocs(storesQuery);
            const storesData = storesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Store[];

            setMyStores(storesData);

            if (storesData.length === 0) {
                setLoading(false);
                return;
            }

            const allStoreIds = storesData.map(s => s.id);
            const targetStoreIds = selectedStore === "all" ? allStoreIds : [selectedStore];

            // Get recent audits for these stores
            let auditsData: any[] = [];

            if (targetStoreIds.length <= 10) {
                let auditsQuery = query(
                    collection(db, "audits"),
                    where("storeId", "in", targetStoreIds)
                );

                // Date filtering
                if (selectedYear !== "all") {
                    const year = parseInt(selectedYear);
                    let start, end;
                    
                    if (selectedMonth !== "all") {
                        const month = parseInt(selectedMonth);
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0, 23, 59, 59);
                    } else {
                        start = new Date(year, 0, 1);
                        end = new Date(year, 11, 31, 23, 59, 59);
                    }
                    
                    auditsQuery = query(auditsQuery, where("createdAt", ">=", start), where("createdAt", "<=", end));
                    auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"));
                } else {
                    // Default view (no filter): Show last 20
                    auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"), limit(20));
                }

                const auditsSnapshot = await getDocs(auditsQuery);
                auditsData = auditsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                // For many stores, fetch latest generally and filter in client if needed
                // Note: Complex filtering with >10 stores "in" query is not supported well in Firestore without multiple queries
                // Fallback: fetch general latest
                 let auditsQuery = query(collection(db, "audits"));

                if (selectedYear !== "all") {
                     const year = parseInt(selectedYear);
                    let start, end;
                    
                    if (selectedMonth !== "all") {
                        const month = parseInt(selectedMonth);
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0, 23, 59, 59);
                    } else {
                        start = new Date(year, 0, 1);
                        end = new Date(year, 11, 31, 23, 59, 59);
                    }
                     auditsQuery = query(auditsQuery, where("createdAt", ">=", start), where("createdAt", "<=", end), orderBy("createdAt", "desc"), limit(100)); // Limit to prevent fetching too many
                } else {
                     auditsQuery = query(auditsQuery, orderBy("createdAt", "desc"), limit(50));
                }

                const auditsSnapshot = await getDocs(auditsQuery);
                auditsData = auditsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter(audit => targetStoreIds.includes(audit.storeId));
            }

            // Enrich audit data with store names
            const enrichedAudits = auditsData.map(audit => {
                const store = storesData.find(s => s.id === audit.storeId);
                return {
                    ...audit,
                    storeName: store?.name || "Bilinmeyen Mağaza"
                };
            });

            setRecentAudits(enrichedAudits);
        } catch (error) {
            console.error("Error loading dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    // Filter audits for current month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const currentMonthAudits = recentAudits.filter(audit => {
        if (!audit.createdAt?.seconds) return false;
        const auditDate = new Date(audit.createdAt.seconds * 1000);
        return auditDate >= currentMonthStart && auditDate <= currentMonthEnd;
    });

    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const years = Array.from({ length: 11 }, (_, i) => 2026 + i);

    // Calculate current month average score using section-based scoring
    const currentMonthAverage = currentMonthAudits.length > 0
        ? Math.round(
            currentMonthAudits.reduce((acc, audit) => {
                // Calculate score the same way as audit page (section-based)
                const sectionScores: number[] = [];

                if (audit.sections && Array.isArray(audit.sections)) {
                    audit.sections.forEach((section: any) => {
                        let sectionEarned = 0;
                        let sectionMax = 0;

                        if (section.answers && Array.isArray(section.answers)) {
                            section.answers.forEach((answer: any) => {
                                // Only count answered questions (excluding "muaf")
                                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                    sectionEarned += answer.earnedPoints || 0;
                                    sectionMax += answer.maxPoints || 0;
                                }
                            });
                        }

                        if (sectionMax > 0) {
                            const sectionScore = (sectionEarned / sectionMax) * 100;
                            sectionScores.push(sectionScore);
                        }
                    });
                }

                // Average of all section scores for this audit
                const auditScore = sectionScores.length > 0
                    ? sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length
                    : 0;

                return acc + auditScore;
            }, 0) / currentMonthAudits.length
        )
        : 0;

    // Get current month name in Turkish
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const currentMonthName = monthNames[now.getMonth()];

    return (
        <div className="container mx-auto py-1 px-4 space-y-6 pb-24">
            {/* Stats Cards - Compact Horizontal Layout */}
            <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                {/* Mağazalarım */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                    <StoreIcon className="h-5 w-5" />
                                </div>
                                <h4 className="text-sm text-muted-foreground font-medium">Mağazalarım</h4>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">{myStores.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Son Denetimler - Current Month */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm text-muted-foreground font-medium">Denetimler</h4>
                                    <span className="text-[10px] text-muted-foreground/70">{currentMonthName}</span>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">{currentMonthAudits.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Ortalama Puan - Current Month Average */}
                <Card className="border-gray-200 hover:shadow-md transition-shadow py-0.5">
                    <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm text-muted-foreground font-medium">Aylık Mağaza Puan Ortalaması</h4>
                                    <span className="text-[10px] text-muted-foreground/70">{currentMonthName}</span>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-foreground shrink-0">
                                {currentMonthAudits.length > 0 ? currentMonthAverage : "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* Recent Audits */}
            <Card className="py-0.5 gap-1">
                <CardHeader className="pb-0 pt-2 px-3">
                    <div className="flex flex-col gap-2">
                        <div>
                            <CardTitle className="text-base">Son Denetimler</CardTitle>
                            <CardDescription className="text-xs">
                                Mağazalarınızda yapılan en son denetimler
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Mağaza" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Mağazalar</SelectItem>
                                    {myStores.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="flex-1 sm:w-[110px] h-8 text-xs">
                                        <SelectValue placeholder="Ay" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Aylar</SelectItem>
                                        {months.map((m, i) => (
                                            <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="flex-1 sm:w-[110px] h-8 text-xs">
                                        <SelectValue placeholder="Yıl" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Yıllar</SelectItem>
                                        {years.map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-3 pb-2 pt-0">
                    {recentAudits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <ClipboardList className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Henüz denetim kaydı bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentAudits.map((audit) => {
                                // Calculate score the same way as audit page
                                const sectionScores: number[] = [];

                                if (audit.sections && Array.isArray(audit.sections)) {
                                    audit.sections.forEach((section: any) => {
                                        let sectionEarned = 0;
                                        let sectionMax = 0;

                                        if (section.answers && Array.isArray(section.answers)) {
                                            section.answers.forEach((answer: any) => {
                                                // Only count answered questions (excluding "muaf")
                                                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                                    sectionEarned += answer.earnedPoints || 0;
                                                    sectionMax += answer.maxPoints || 0;
                                                }
                                            });
                                        }

                                        if (sectionMax > 0) {
                                            const sectionScore = (sectionEarned / sectionMax) * 100;
                                            sectionScores.push(sectionScore);
                                        }
                                    });
                                }

                                // Average of all section scores
                                const scorePercent = sectionScores.length > 0
                                    ? Math.round(sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length)
                                    : 0;

                                return (
                                    <div key={audit.id} className="block mb-2 last:mb-0">
                                        <div className="flex flex-col p-3 border rounded-lg hover:bg-accent/50 transition-colors group gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                    <p className="text-sm font-medium truncate">{audit.storeName}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{audit.auditorName || "Denetmen"}</p>
                                                    <div className="flex items-center gap-2">
                                                        {audit.status === "devam_ediyor" ? (
                                                            <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-[10px] px-1.5 py-0">
                                                                <PlayCircle className="mr-1 h-2.5 w-2.5" />
                                                                Devam Ediyor
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5 py-0">
                                                                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                                                                Tamamlandı
                                                            </Badge>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {audit.createdAt?.seconds ? format(new Date(audit.createdAt.seconds * 1000), "d MMM yyyy", { locale: tr }) : "-"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-3">
                                                    <div className="text-right">
                                                        <div className="text-base font-bold">{scorePercent}</div>
                                                        <div className="text-[10px] text-muted-foreground">Puan</div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-xs"
                                                    onClick={() => router.push(`/admin/actions?storeId=${audit.storeId}`)}
                                                >
                                                    <Zap className="mr-1.5 h-3 w-3" />
                                                    Mağaza Aksiyonu
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-xs"
                                                    onClick={() => router.push(`/audits/${audit.id}`)}
                                                >
                                                    <Eye className="mr-1.5 h-3 w-3" />
                                                    İncele
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-xs"
                                                    onClick={() => setReportAudit(audit)}
                                                >
                                                    <FileText className="mr-1.5 h-3 w-3" />
                                                    Özel Rapor
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {reportAudit && (
                <Dialog open={!!reportAudit} onOpenChange={(open) => { if (!open) setReportAudit(null); }}>
                    <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[90vh] overflow-y-auto p-0">
                        <DialogTitle className="sr-only">Özel Rapor Önizleme</DialogTitle>
                        <SpecialReportGenerator 
                            audit={reportAudit}
                            mode="preview"
                            onClose={() => setReportAudit(null)}
                            onComplete={() => {
                                toast.success("Rapor başarıyla oluşturuldu");
                            }}
                            onError={() => {
                                toast.error("Rapor oluşturulurken hata oluştu");
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {/* Quick Actions - Placeholder for Reports and Persistent Failures */}
            <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-auto py-4" disabled>
                    <div className="flex flex-col items-start gap-1 w-full">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-semibold">Raporlar</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Çok yakında...</span>
                    </div>
                </Button>

                <Button variant="outline" className="h-auto py-4" disabled>
                    <div className="flex flex-col items-start gap-1 w-full">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-semibold">Sürekli Hayırlar</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Çok yakında...</span>
                    </div>
                </Button>
            </div>
        </div>
    );
}
