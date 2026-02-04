"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Store as StoreIcon, Activity, ArrowRight } from "lucide-react";
import { format, isSameDay, startOfWeek, endOfWeek, isToday } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StoreAnalysisDialog } from "./store-analysis-dialog";

interface ScheduleItem {
    id: string;
    auditorId: string;
    storeId?: string;
    storeName: string;
    date: Date;
    status: 'draft' | 'published';
    type?: 'audit' | 'leave' | 'blocked';
    note?: string;
}

export function WeeklyScheduleList() {
    const { userProfile } = useAuth();
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStoreAnalysis, setSelectedStoreAnalysis] = useState<{id: string, name: string} | null>(null);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!userProfile?.uid) return;
            setLoading(true);
            try {
                // 1. Get current week range
                const today = new Date();
                const start = startOfWeek(today, { weekStartsOn: 1 });
                const end = endOfWeek(today, { weekStartsOn: 1 });

                // 2. Fetch all published schedules for this auditor
                // Ideally we would filter by date range in query, but for now we filter in client 
                // as per existing pattern to avoid complex index requirements immediately
                const q = query(
                    collection(db, "audit_schedules"),
                    where("auditorId", "==", userProfile.uid),
                    where("status", "==", "published")
                );

                const querySnapshot = await getDocs(q);
                const items: ScheduleItem[] = [];
                
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const date = (data.date as Timestamp).toDate();
                    
                    // Filter for current week (and ignore past days optionally? No, show full week)
                    if (date >= start && date <= end && data.type !== 'leave' && data.type !== 'blocked') {
                        items.push({
                            id: doc.id,
                            ...data,
                            date: date,
                        } as ScheduleItem);
                    }
                });

                // Sort by date
                items.sort((a, b) => a.date.getTime() - b.date.getTime());
                setSchedule(items);

                // 3. Fetch necessary stores
                if (items.length > 0) {
                    const storeIds = Array.from(new Set(items.map(i => i.storeId).filter(Boolean))) as string[];
                    // Allow up to 10 stores to be fetched with 'in' query, or just fetch all stores (safer if list is huge)
                    // For safety given existing patterns, let's fetch all stores once or batch. 
                    // Existing pattern fetches all stores. Let's optimize slightly by fetching all stores 
                    // only if we really need details. We just need details for the cards.
                    // Given the small number of stores usually, fetching all is acceptable as per previous code.
                    const storesQuery = query(collection(db, "stores"));
                    const storesSnap = await getDocs(storesQuery);
                    const storesData = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
                    setStores(storesData);
                }

            } catch (error) {
                console.error("Error fetching weekly schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [userProfile?.uid]);

    if (loading) {
        return <div className="h-40 flex items-center justify-center text-slate-400">Yükleniyor...</div>;
    }

    if (schedule.length === 0) {
        return (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Bu hafta için planlanmış denetim bulunmuyor.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Bu Haftanın Programı</h2>
                    <Badge variant="outline" className="font-normal text-slate-500 bg-white">
                        {schedule.length} Mağaza
                    </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {schedule.map(item => {
                        const store = stores.find(s => s.id === item.storeId);
                        const isTaskToday = isToday(item.date);

                        return (
                            <Card key={item.id} className={cn(
                                "group relative overflow-hidden transition-all hover:shadow-md border-l-4",
                                isTaskToday ? "border-l-blue-600 shadow-blue-100" : "border-l-slate-300"
                            )}>
                                <div className="p-4 flex flex-col h-full justify-between gap-4">
                                    <div>
                                        {/* Date Badge */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={cn(
                                                "text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1.5",
                                                isTaskToday ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                                            )}>
                                                <Calendar className="h-3 w-3" />
                                                {format(item.date, "d MMMM EEEE", { locale: tr })}
                                            </div>
                                            {store?.shipmentTime && (
                                                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {store.shipmentTime}
                                                </div>
                                            )}
                                        </div>

                                        {/* Store Info */}
                                        <h3 className="font-bold text-slate-900 leading-tight mb-2 flex items-start gap-2">
                                            <StoreIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                            {item.storeName}
                                        </h3>
                                        
                                        {store?.city && (
                                            <p className="text-xs text-slate-500 ml-6 flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {store.city}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <div className="mt-auto">
                                        <Button 
                                            size="sm" 
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-none transition-all Group"
                                            onClick={() => item.storeId && setSelectedStoreAnalysis({
                                                id: item.storeId, 
                                                name: item.storeName
                                            })}
                                        >
                                            <Activity className="h-4 w-4 mr-2 text-indigo-300" />
                                            Analiz Yap
                                            <ArrowRight className="h-3 w-3 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {selectedStoreAnalysis && (
                <StoreAnalysisDialog 
                    isOpen={!!selectedStoreAnalysis}
                    storeId={selectedStoreAnalysis.id}
                    storeName={selectedStoreAnalysis.name}
                    onClose={() => setSelectedStoreAnalysis(null)}
                />
            )}
        </>
    );
}
