"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function RegionalScores() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [storeScores, setStoreScores] = useState<any[]>([]);

    useEffect(() => {
        if (userProfile?.uid) {
            loadScoresData();
        }
    }, [userProfile, selectedYear]);

    const loadScoresData = async () => {
        if (!userProfile?.uid) return;

        setLoading(true);
        try {
            // Get stores
            const storesQuery = query(
                collection(db, "stores"),
                where("regionalManagerId", "==", userProfile.uid)
            );
            const storesSnapshot = await getDocs(storesQuery);
            const storesData = storesSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || "Bilinmeyen Mağaza"
            }));

            // Get audits for the selected year
            const yearStart = new Date(parseInt(selectedYear), 0, 1);
            const yearEnd = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59);

            const auditsQuery = query(
                collection(db, "audits"),
                where("status", "==", "tamamlandi"),
                orderBy("createdAt", "desc")
            );
            const auditsSnapshot = await getDocs(auditsQuery);

            // Filter and group by store and month
            const storeMonthScores: any = {};

            auditsSnapshot.docs.forEach(doc => {
                const audit = doc.data();
                const auditDate = audit.createdAt?.toDate();

                if (!auditDate || auditDate < yearStart || auditDate > yearEnd) return;
                if (!storesData.find(s => s.id === audit.storeId)) return;

                const month = auditDate.getMonth(); // 0-11
                // Calculate score using section-based method (same as dashboard)
                const sectionScores: number[] = [];
                if (audit.sections && Array.isArray(audit.sections)) {
                    audit.sections.forEach((section: any) => {
                        let sectionEarned = 0;
                        let sectionMax = 0;
                        if (section.answers && Array.isArray(section.answers)) {
                            section.answers.forEach((answer: any) => {
                                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                    sectionEarned += answer.earnedPoints || 0;
                                    sectionMax += answer.maxPoints || 0;
                                }
                            });
                        }
                        if (sectionMax > 0) {
                            sectionScores.push((sectionEarned / sectionMax) * 100);
                        }
                    });
                }
                const score = sectionScores.length > 0
                    ? Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length)
                    : 0;

                const key = `${audit.storeId}_${month}`;
                if (!storeMonthScores[key]) {
                    storeMonthScores[key] = { scores: [], storeId: audit.storeId, month };
                }
                storeMonthScores[key].scores.push(score);
            });

            // Calculate averages
            const scoresArray = Object.values(storeMonthScores).map((item: any) => {
                const avgScore = Math.round(
                    item.scores.reduce((a: number, b: number) => a + b, 0) / item.scores.length
                );
                const store = storesData.find(s => s.id === item.storeId);
                return {
                    storeId: item.storeId,
                    storeName: store?.name || "Bilinmeyen",
                    month: item.month,
                    score: avgScore,
                    count: item.scores.length
                };
            });

            // Group by store
            const groupedByStore: any = {};
            scoresArray.forEach(item => {
                if (!groupedByStore[item.storeId]) {
                    groupedByStore[item.storeId] = {
                        storeName: item.storeName,
                        months: Array(12).fill(null)
                    };
                }
                groupedByStore[item.storeId].months[item.month] = item.score;
            });

            setStoreScores(Object.values(groupedByStore));
        } catch (error) {
            console.error("Error loading scores:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        const data = storeScores.map(store => {
            const row: any = { "Mağaza": store.storeName };
            months.forEach((month, idx) => {
                row[month] = store.months[idx] !== null ? store.months[idx] : "-";
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Puanlar");
        XLSX.writeFile(workbook, `Bolge_Puanlari_${selectedYear}.xlsx`);
    };

    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    const years = Array.from({ length: 11 }, (_, i) => 2026 + i);

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-4 px-4 space-y-6 pb-24">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Mağaza Puanları</CardTitle>
                            <CardDescription>Aylık ortalama denetim puanları</CardDescription>
                        </div>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => (
                                    <SelectItem key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 ml-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {storeScores.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <TrendingUp className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">Bu yıl için puan kaydı bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-semibold sticky left-0 bg-background">Mağaza</th>
                                        {months.map((month, idx) => (
                                            <th key={idx} className="text-center p-2 font-semibold min-w-[60px]">{month}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {storeScores.map((store, idx) => (
                                        <tr key={idx} className="border-b hover:bg-accent/50">
                                            <td className="p-2 font-medium sticky left-0 bg-background">{store.storeName}</td>
                                            {store.months.map((score: number | null, monthIdx: number) => (
                                                <td key={monthIdx} className="text-center p-2">
                                                    {score !== null ? (
                                                        <span className={`font-semibold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {score}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
