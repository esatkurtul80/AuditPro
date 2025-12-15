"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Store as StoreIcon,
    ClipboardList,
    AlertCircle,
    CheckCircle2,
    PlayCircle,
    MapPin,
    ArrowRight
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function RegionalManagerDashboard() {
    return <RegionalManagerContent />;
}

function RegionalManagerContent() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [myStores, setMyStores] = useState<Store[]>([]);
    const [recentAudits, setRecentAudits] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalStores: 0,
        totalAudits: 0,
        pendingActions: 0,
        averageScore: 0
    });

    useEffect(() => {
        if (!authLoading) {
            if (userProfile?.role !== "bolge-muduru") {
                router.push("/");
                return;
            }
            loadDashboardData();
        }
    }, [authLoading, userProfile, router]);

    const loadDashboardData = async () => {
        if (!userProfile?.uid) return;

        try {
            // 1. Get my assigned stores
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

            const storeIds = storesData.map(s => s.id);

            // 2. Get recent audits for these stores
            // Note: Firestore 'in' query is limited to 10 items. 
            // For production with many stores, we might need a different approach or multiple queries.
            // For now, we'll fetch all audits and filter client-side if store count is small, 
            // or use the 'in' query if store count <= 10.

            let auditsData: any[] = [];

            if (storeIds.length <= 10) {
                const auditsQuery = query(
                    collection(db, "audits"),
                    where("storeId", "in", storeIds),
                    orderBy("createdAt", "desc"),
                    limit(10)
                );
                const auditsSnapshot = await getDocs(auditsQuery);
                auditsData = auditsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                // Fallback for > 10 stores (simplified for this context)
                // In a real app, we might denormalize data or use a better backend query
                const auditsSnapshot = await getDocs(query(collection(db, "audits"), orderBy("createdAt", "desc"), limit(50)));
                auditsData = auditsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter(audit => storeIds.includes(audit.storeId))
                    .slice(0, 10);
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

            // 3. Calculate simple stats
            // For total audits count, we'd ideally run a count query. 
            // Here we'll just use the length of what we fetched or placeholders.
            // In a real app, use aggregation queries.

            setStats({
                totalStores: storesData.length,
                totalAudits: auditsData.length, // This is just recent ones, ideally count all
                pendingActions: 0, // Placeholder - would need another query for actions
                averageScore: 0 // Placeholder
            });

        } catch (error) {
            console.error("Error loading dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid gap-4 md:grid-cols-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bölge Müdürü Paneli</h1>
                <p className="text-muted-foreground mt-2">
                    Hoş geldiniz, {userProfile?.firstName} {userProfile?.lastName}
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Mağazalarım
                        </CardTitle>
                        <StoreIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalStores}</div>
                        <p className="text-xs text-muted-foreground">
                            Sorumlu olduğunuz mağazalar
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Son Denetimler
                        </CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{recentAudits.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Son 30 gündeki denetimler
                        </p>
                    </CardContent>
                </Card>
                {/* Add more stats cards as needed */}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Audits */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Son Denetimler</CardTitle>
                        <CardDescription>
                            Mağazalarınızda yapılan son denetimler
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentAudits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">Henüz denetim kaydı bulunmuyor.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mağaza</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead>Puan</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentAudits.map((audit) => (
                                        <TableRow key={audit.id}>
                                            <TableCell className="font-medium">
                                                {audit.storeName}
                                            </TableCell>
                                            <TableCell>
                                                {audit.status === "devam_ediyor" ? (
                                                    <Badge className="bg-yellow-500">
                                                        <PlayCircle className="mr-1 h-3 w-3" />
                                                        Sürüyor
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-green-500">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Tamamlandı
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {audit.maxScore > 0
                                                    ? `%${Math.round((audit.totalScore / audit.maxScore) * 100)}`
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {audit.createdAt?.seconds ? format(new Date(audit.createdAt.seconds * 1000), "d MMM yyyy", { locale: tr }) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/audits/view?id=${audit.id}`}>
                                                    <Button variant="ghost" size="sm">
                                                        İncele
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* My Stores List */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Mağazalarım</CardTitle>
                        <CardDescription>
                            Sorumlu olduğunuz mağaza listesi
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {myStores.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <StoreIcon className="h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">Size atanmış mağaza bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myStores.map((store) => (
                                    <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="font-medium leading-none">{store.name}</p>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <MapPin className="mr-1 h-3 w-3" />
                                                {store.location || "Konum belirtilmemiş"}
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {store.manager || "Müdür Yok"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
