"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
    isSameDay, addMonths, subMonths, startOfMonth, endOfMonth,
    addWeeks, subWeeks, isToday
} from "date-fns";
import { tr } from "date-fns/locale";
import {
    ChevronLeft, ChevronRight, MapPin, Hotel, StickyNote, Calendar as CalendarIcon,
    Clock, Building2, Store as StoreIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, AccommodationType } from "@/lib/types";
import { ACCOMMODATION_ICONS } from "@/lib/constants";

// Types
interface ScheduleItem {
    id: string;
    auditorId: string;
    storeId?: string;
    storeName: string;
    date: Date; // Converted from Firestore Timestamp
    status: 'draft' | 'published';
    type?: 'audit' | 'leave' | 'blocked';
    note?: string;
    accommodationTypeId?: string;
    leaveTypeId?: string;
}

export default function AuditorSchedulePage() {
    const { userProfile } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            if (!userProfile?.uid) return;
            setLoading(true);
            try {
                // 1. Fetch Accommodation Types
                const accQuery = query(collection(db, "accommodation_types"));
                const accSnap = await getDocs(accQuery);
                const accTypes = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccommodationType));
                setAccommodationTypes(accTypes);

                // 2. Fetch Stores (for full details like address/city if needed, mainly names needed)
                // We might rely on storeName in schedule, but having store details is better
                const storesQuery = query(collection(db, "stores"));
                const storesSnap = await getDocs(storesQuery);
                const storesData = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
                setStores(storesData);

                // 3. Fetch Published Schedule for this Auditor
                // We fetch a wide range or all? 
                // Let's fetch all published items for simplicity in this view, 
                // or optimize by month if data gets large. For now: ALL published.
                const q = query(
                    collection(db, "audit_schedules"),
                    where("auditorId", "==", userProfile.uid),
                    where("status", "==", "published")
                );

                const querySnapshot = await getDocs(q);
                const items: ScheduleItem[] = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        date: (data.date as Timestamp).toDate(),
                    } as ScheduleItem;
                });

                setSchedule(items);
            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userProfile?.uid]);

    // Calendar Navigation
    const handlePrevious = () => {
        if (viewMode === 'month') {
            setCurrentDate(prev => subMonths(prev, 1));
        } else {
            setCurrentDate(prev => subWeeks(prev, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            setCurrentDate(prev => addMonths(prev, 1));
        } else {
            setCurrentDate(prev => addWeeks(prev, 1));
        }
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    // Get days to display based on view mode
    const getDaysToDisplay = () => {
        let start, end;
        if (viewMode === 'month') {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            start = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
            end = endOfWeek(monthEnd, { weekStartsOn: 1 });
        } else {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        }
        return eachDayOfInterval({ start, end });
    };

    const days = getDaysToDisplay();
    const weekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    // Get items for a specific date
    const getItemsForDate = (date: Date) => {
        return schedule.filter(item => isSameDay(item.date, date));
    };

    // Render Calendar Cell
    const renderCell = (day: Date) => {
        const items = getItemsForDate(day);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isSelected = isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);

        // Styling classes
        const cellClasses = cn(
            "min-h-[100px] border-b border-r p-1 transition-colors relative cursor-pointer md:min-h-[120px]",
            !isCurrentMonth && "bg-slate-50/50 text-slate-400",
            isSelected && "bg-blue-50 ring-2 ring-inset ring-blue-500",
            !isSelected && isTodayDate && "bg-amber-50",
            "hover:bg-slate-50"
        );

        return (
            <div
                key={day.toISOString()}
                className={cellClasses}
                onClick={() => setSelectedDate(day)}
            >
                {/* Date Number */}
                <span className={cn(
                    "block text-right text-xs p-1 font-medium",
                    isTodayDate ? "text-amber-600 font-bold" : "text-slate-600"
                )}>
                    {format(day, "d")}
                </span>

                {/* Event Dots / Bars */}
                <div className="flex flex-col gap-1 mt-1">
                    {items.map((item, i) => {
                        if (item.type === 'blocked') return null;

                        // Limit visible items on small month view? 
                        // For tablet/desktop we can show text.

                        let bgColor = "bg-blue-100 text-blue-700 border-blue-200";
                        if (item.type === 'leave') bgColor = "bg-purple-100 text-purple-700 border-purple-200";

                        return (
                            <div key={item.id} className={cn(
                                "text-[10px] px-1 py-0.5 rounded border truncate font-medium",
                                bgColor
                            )}>
                                {item.type === 'leave' ? (
                                    <span className="flex items-center gap-1">
                                        <Hotel className="h-3 w-3" />
                                        İzin
                                    </span>
                                ) : (
                                    <span>{item.storeName}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Get Details for Selected Date
    const selectedItems = getItemsForDate(selectedDate);




    return (
        <DashboardLayout>
            <div className="container mx-auto py-6 px-4 md:px-6 h-[calc(100vh-80px)] flex flex-col">
                {/* Header Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 shrink-0">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                        Denetim Programı
                    </h1>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrevious}
                            className="h-8 w-8 p-0 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold px-2 min-w-[100px] text-center">
                            {format(currentDate, "MMMM yyyy", { locale: tr })}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleNext}
                            className="h-8 w-8 p-0 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToday}
                            className="h-8 px-3 text-xs font-semibold hover:bg-white hover:text-slate-900 hover:shadow-sm ml-2"
                        >
                            Bugün
                        </Button>
                    </div>

                    <div className="flex p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setViewMode('month')}
                            className={cn(
                                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                                viewMode === 'month'
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            Aylık
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={cn(
                                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                                viewMode === 'week'
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            Haftalık
                        </button>
                    </div>
                </div>

                {/* Main Content Area: Calendar + Details */}
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

                    {/* Calendar Grid */}
                    <div className="flex-1 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
                        {/* Days Header */}
                        <div className="grid grid-cols-7 border-b bg-slate-50">
                            {weekDays.map(day => (
                                <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Body */}
                        <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-y-auto">
                            {days.map(day => renderCell(day))}
                        </div>
                    </div>

                    {/* Selected Day Details Panel */}
                    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
                        <Card className="p-4 border-l-4 border-l-blue-600 shadow-sm h-full overflow-y-auto">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                                <div className="bg-blue-100 text-blue-700 w-12 h-12 rounded-xl flex items-center justify-center flex-col shrink-0">
                                    <span className="text-xs font-bold uppercase">{format(selectedDate, "MMM", { locale: tr })}</span>
                                    <span className="text-xl font-bold">{format(selectedDate, "d")}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500">{format(selectedDate, "EEEE", { locale: tr })}</div>
                                    <h2 className="font-bold text-slate-900">Günlük Program</h2>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedItems.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">Bugün için planlanan bir denetim bulunmuyor.</p>
                                    </div>
                                ) : (
                                    selectedItems.map((item, index) => {
                                        // Find store details if available
                                        const store = stores.find(s => s.id === item.storeId);
                                        const accType = item.accommodationTypeId ? accommodationTypes.find(a => a.id === item.accommodationTypeId) : null;
                                        const AccIcon = accType ? (ACCOMMODATION_ICONS[accType.icon] || Hotel) : Hotel;

                                        if (item.type === 'leave') {
                                            return (
                                                <div key={item.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100 relative overflow-hidden">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                                                            <Hotel className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">İzin</h3>
                                                            {item.note && (
                                                                <p className="text-xs text-slate-500 mt-1">{item.note}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={item.id} className="relative group">
                                                {/* Connecting Line if multiple items */}
                                                {index < selectedItems.length - 1 && (
                                                    <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-slate-200 -z-10 h-full"></div>
                                                )}

                                                <div className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group-hover:border-blue-200">
                                                    {/* Store Badge/Time */}
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                                                                <StoreIcon className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                                Denetim
                                                            </span>
                                                        </div>
                                                        {store?.shipmentTime && (
                                                            <div className="flex items-center text-xs text-slate-400">
                                                                <Clock className="h-3 w-3 mr-1" />
                                                                {store.shipmentTime}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Store Name & Location */}
                                                    <h3 className="font-bold text-slate-900 mb-1">{item.storeName}</h3>
                                                    {store?.city && (
                                                        <div className="flex items-center text-xs text-slate-500 mb-3">
                                                            <MapPin className="h-3 w-3 mr-1 shrink-0" />
                                                            {store.city} {store.location ? `- ${store.location}` : ''}
                                                        </div>
                                                    )}

                                                    {/* Meta : Accommodation & Note */}
                                                    <div className="grid gap-2 border-t pt-3 mt-2">
                                                        {accType && (
                                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                                                <AccIcon className="h-4 w-4 text-amber-600 shrink-0" />
                                                                <span>Konaklama: <span className="text-amber-700">{accType.name}</span></span>
                                                            </div>
                                                        )}

                                                        {item.note && (
                                                            <div className="flex items-start gap-2 text-xs text-slate-600 bg-yellow-50/50 p-2 rounded-lg">
                                                                <StickyNote className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                                                                <span className="italic">"{item.note}"</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
