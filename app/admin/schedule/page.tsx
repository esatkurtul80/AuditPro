"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CalendarDays, Save, Send, ChevronLeft, ChevronRight, Search, Plus, X, Sparkles, ChevronDown, CalendarIcon
} from "lucide-react";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
    format, addDays, startOfWeek, endOfWeek, isSameDay, subWeeks, addWeeks, startOfDay,
    addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, isSameMonth
} from "date-fns";
import { tr } from "date-fns/locale";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, Store } from "@/lib/types";
import { toast } from "sonner";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent, pointerWithin } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Interface for a schedule item
interface ScheduleItem {
    id: string; // unique id
    auditorId: string;
    storeId: string;
    storeName: string;
    date: Date;
    status: 'draft' | 'published';
}

type SuggestionItem = Store & { suggestionType: 'target' | 'repeat' | 'new'; lastScore?: number };

// Draggable Store Row Component (Excel-like)
function DraggableStoreRow({
    store,
    auditInfo,
    index
}: {
    store: SuggestionItem;
    auditInfo: { lastDates: Date[], lastAuditorName: string, daysSince: number };
    index: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `store-${store.id}`,
        data: { storeId: store.id, storeName: store.name }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
    };

    // Determine row background based on type
    let bgClass = index % 2 === 0 ? "bg-white" : "bg-slate-50";
    // Overlay type color subtly
    if (store.suggestionType === 'target') bgClass = cn(bgClass, "hover:bg-orange-50");
    if (store.suggestionType === 'repeat') bgClass = cn(bgClass, "bg-red-50/50 hover:bg-red-100/50");
    if (store.suggestionType === 'new') bgClass = cn(bgClass, "bg-blue-50/50 hover:bg-blue-100/50");

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "grid grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr_1.2fr_0.8fr] gap-0 text-xs items-center border-b border-slate-200 cursor-grab active:cursor-grabbing transition-colors min-h-[40px]",
                bgClass,
                "hover:bg-slate-100"
            )}
            title={`${store.name}`}
        >
            <div className="px-2 py-1 font-semibold truncate border-r border-slate-100 h-full flex items-center">{store.name}</div>
            <div className="px-2 py-1 text-center border-r border-slate-100 h-full flex items-center justify-center">{store.shipmentDay || "-"}</div>
            <div className="px-2 py-1 text-center border-r border-slate-100 h-full flex items-center justify-center">{store.shipmentTime || "-"}</div>

            {/* Last Audit Dates */}
            <div className="px-2 py-1 border-r border-slate-100 h-full flex flex-col justify-center items-center leading-tight">
                {auditInfo.lastDates.length > 0 ? (
                    <span className="block whitespace-nowrap font-medium">{format(auditInfo.lastDates[0], 'dd.MM.yyyy')}</span>
                ) : (
                    <span className="text-slate-400">-</span>
                )}
            </div>

            {/* Last Auditor */}
            <div className={`px-2 py-1 border-r border-slate-100 h-full flex items-center justify-center text-center leading-tight font-medium ${auditInfo.lastAuditorName !== '-' ? 'bg-yellow-100/50 text-yellow-900' : ''
                }`}>
                {auditInfo.lastAuditorName}
            </div>

            {/* Days Since */}
            <div className="px-2 py-1 flex items-center justify-center font-bold">
                {auditInfo.daysSince >= 0 ? auditInfo.daysSince : <span className="text-blue-600">YENİ</span>}
            </div>
        </div>
    );
}

// Table Header Component
function StoresTableHeader() {
    return (
        <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr_1.2fr_0.8fr] gap-0 text-[10px] font-bold text-slate-500 bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shadow-sm leading-tight">
            <div className="px-2 py-2 border-r border-slate-200">ŞUBE ADI</div>
            <div className="px-1 py-2 text-center border-r border-slate-200">SEVKİYAT GÜNÜ</div>
            <div className="px-1 py-2 text-center border-r border-slate-200">SEVKİYAT SAATİ</div>
            <div className="px-1 py-2 text-center border-r border-slate-200">EN SON DENETİM TARİHİ</div>
            <div className="px-1 py-2 text-center border-r border-slate-200">SON GİDEN DENETMEN</div>
            <div className="px-1 py-2 text-center">GEÇEN GÜN</div>
        </div>
    );
}

// Droppable Cell Component
function DroppableCell({
    dropId,
    isToday,
    items,
    getViolation,
    setViolationAlert,
    setOpenPopoverId,
    openPopoverId,
    handleRemoveStore,
    handleAddStore,
    stores
}: {
    dropId: string;
    isToday: boolean;
    items: ScheduleItem[];
    getViolation: (item: ScheduleItem) => string | null;
    setViolationAlert: (msg: string | null) => void;
    setOpenPopoverId: (id: string | null) => void;
    openPopoverId: string | null;
    handleRemoveStore: (id: string) => Promise<void>;
    handleAddStore: (auditorId: string, date: Date, storeId: string, storeName: string) => Promise<void>;
    stores: Store[];
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: dropId
    });

    return (
        <td
            ref={setNodeRef}
            className={cn(
                "p-1 border-r border-slate-100 align-top h-16 relative transition-colors",
                isToday ? "bg-blue-50/10" : "hover:bg-slate-50",
                isOver && "bg-blue-100/50 ring-2 ring-blue-400 ring-inset"
            )}
        >
            <div className="flex flex-col gap-1 h-full overflow-visible">
                {items.map((item) => {
                    const violation = getViolation(item);
                    return (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (violation) setViolationAlert(violation);
                            }}
                            title={item.storeName}
                            className={cn(
                                "group/item text-xs px-1.5 py-0.5 rounded border shadow-sm select-none transition-all relative flex items-center justify-between flex-1 min-h-0 cursor-pointer",
                                violation
                                    ? "bg-red-50 border-red-200 text-red-700 font-medium"
                                    : item.status === 'published'
                                        ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                                        : "bg-orange-50 border-orange-200 text-orange-700 font-medium"
                            )}
                        >
                            <span className="truncate w-full block">{item.storeName}</span>

                            {/* Violation Indicator */}
                            {violation && (
                                <span className="flex h-1.5 w-1.5 shrink-0 ml-1">
                                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                            )}

                            {/* Delete Action */}
                            {item.status === 'draft' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveStore(item.id);
                                    }}
                                    className="absolute -right-2 -top-2 p-0.5 rounded-full bg-red-600 text-white border border-red-700 opacity-0 group-hover/item:opacity-100 shadow-sm z-50 transition-all hover:bg-red-700 scale-110 cursor-pointer"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Empty State / Add Trigger - Only show if < 2 items */}
                {items.length < 2 && (
                    <Popover
                        open={openPopoverId === dropId}
                        onOpenChange={(isOpen) => {
                            if (isOpen) setOpenPopoverId(dropId);
                            else setOpenPopoverId(null);
                        }}
                    >
                        <PopoverTrigger asChild>
                            <button className="flex-1 w-full min-h-[1.5rem] rounded border border-dashed border-transparent hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-all">
                                <Plus className="h-4 w-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[300px]" align="start">
                            <Command>
                                <CommandInput placeholder="Mağaza ara..." autoFocus />
                                <CommandList>
                                    <CommandEmpty>Uygun mağaza bulunamadı.</CommandEmpty>
                                    <CommandGroup heading="Mağazalar">
                                        {stores.map((store) => (
                                            <CommandItem
                                                key={store.id}
                                                onSelect={() => {
                                                    const lastSeparator = dropId.lastIndexOf('___');
                                                    const auditorId = dropId.substring(0, lastSeparator);
                                                    const dateStr = dropId.substring(lastSeparator + 3);
                                                    handleAddStore(auditorId, new Date(dateStr), store.id, store.name);
                                                    setOpenPopoverId(null);
                                                }}
                                            >
                                                {store.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </td>
    );
}

export default function SchedulePage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [auditors, setAuditors] = useState<UserProfile[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [audits, setAudits] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<{
        monthlyMissing: (Store & { lastScore?: number })[],
        newReady: Store[],
        reAuditCandidates: (Store & { lastScore?: number })[]
    }>({ monthlyMissing: [], newReady: [], reAuditCandidates: [] });
    const [violationAlert, setViolationAlert] = useState<string | null>(null);

    // Calculate week start (Monday)
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    // Calculate days to show based on view mode
    const intervalStart = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
    const intervalEnd = viewMode === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);
    const weekDays = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

    const handlePrev = () => {
        if (viewMode === 'week') {
            setCurrentDate(prev => subWeeks(prev, 1));
        } else {
            setCurrentDate(prev => subMonths(prev, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'week') {
            setCurrentDate(prev => addWeeks(prev, 1));
        } else {
            setCurrentDate(prev => addMonths(prev, 1));
        }
    };

    useEffect(() => {
        fetchStaticData();
    }, []);

    useEffect(() => {
        fetchDynamicData();
    }, [currentDate]);

    const fetchStaticData = async () => {
        try {
            // 1. Fetch Auditors
            const auditorsQuery = query(collection(db, "users"), where("role", "==", "denetmen"));
            const auditorsSnap = await getDocs(auditorsQuery);
            const auditorsData = auditorsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
            setAuditors(auditorsData);

            // 2. Fetch Stores
            const storesSnap = await getDocs(collection(db, "stores"));
            const storesData = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
            setStores(storesData);
        } catch (error) {
            console.error("Error fetching static data:", error);
        }
    };

    const fetchDynamicData = async () => {
        setLoading(true);
        try {
            // 3. Fetch Schedule (Optimization: Could limit by date range, but currently need all for suggestions logic)
            // Ideally: Fetch logic should be smarter, but moving static data out is the first big step.
            const scheduleSnap = await getDocs(collection(db, "audit_schedules"));
            const scheduleData = scheduleSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    date: (data.date as Timestamp).toDate()
                } as ScheduleItem;
            });
            setSchedule(scheduleData);

            // 4. Fetch Audits (Last 60 Days for suggestions context)
            const sixtyDaysAgo = addDays(new Date(), -60);
            const auditsQuery = query(collection(db, "audits"), where("createdAt", ">=", Timestamp.fromDate(sixtyDaysAgo)));

            const auditsSnap = await getDocs(auditsQuery);
            const auditsData = auditsSnap.docs.map(doc => {
                const d = doc.data();
                return {
                    ...d,
                    createdAt: (d.createdAt as Timestamp)?.toDate() || new Date()
                };
            });
            setAudits(auditsData);

        } catch (error) {
            console.error("Error fetching dynamic data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Helper: Get Last Interaction Date for a Store ---
    const getLastInteractionDate = (storeId: string, excludeScheduleId?: string): Date | null => {
        let lastDate: Date | null = null;

        // Check Audits
        const storeAudits = audits.filter(a => a.storeId === storeId);
        storeAudits.forEach(a => {
            if (!lastDate || a.createdAt > lastDate) lastDate = a.createdAt;
        });

        // Check Schedule (excluding current if needed)
        const storeSchedule = schedule.filter(s => s.storeId === storeId && s.id !== excludeScheduleId);
        storeSchedule.forEach(s => {
            if (!lastDate || s.date > lastDate) lastDate = s.date;
        });

        return lastDate;
    };

    // --- Helper: Get Last Audit Score ---
    const getLastAuditScore = (storeId: string): number | undefined => {
        const storeAudits = audits.filter(a => a.storeId === storeId);
        if (storeAudits.length === 0) return undefined;
        // Sort by date desc
        storeAudits.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        // Return score (assuming score is in 'totalScore' or 'score' field)
        return storeAudits[0].totalScore ?? storeAudits[0].score;
    };

    // --- Helper: Get Store Audit Info (For Excel View) ---
    const getStoreAuditInfo = (storeId: string): { lastDates: Date[], lastAuditorName: string, daysSince: number } => {
        const storeAudits = audits.filter(a => a.storeId === storeId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const lastDates = storeAudits.slice(0, 3).map(a => a.createdAt);
        const lastAudit = storeAudits[0];

        let lastAuditorName = '-';
        if (lastAudit) {
            const auditor = auditors.find(u => u.uid === lastAudit.auditorId);
            lastAuditorName = auditor ? `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim() : (lastAudit.auditorName || 'Bilinmiyor');
        }

        let daysSince = -1;
        if (lastAudit) {
            daysSince = differenceInDays(new Date(), lastAudit.createdAt);
        }

        return { lastDates, lastAuditorName, daysSince };
    };

    // Calculate Suggestions
    useEffect(() => {
        if (loading || stores.length === 0) return;

        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        // 1. Monthly Missing
        // Definition: Stores that have NOT been visited/scheduled in the current calendar month.
        // User Request B: "If visited in Week 1, remove from suggestions in Week 2".
        const monthlyMissing = stores.filter(store => {
            // Check past audits in current month
            const hasAuditThisMonth = audits.some(a =>
                a.storeId === store.id &&
                a.createdAt >= currentMonthStart
            );

            // Check scheduled items in current month
            const isScheduledThisMonth = schedule.some(s =>
                s.storeId === store.id &&
                s.date >= currentMonthStart
            );

            return !hasAuditThisMonth && !isScheduledThisMonth;
        }).map(store => ({ ...store, lastScore: getLastAuditScore(store.id) }));

        // 2. New Ready Stores
        const twentyDaysAgo = addDays(new Date(), -20);
        const newReady = stores.filter(store => {
            if (!store.openingDate) return false;
            const openDate = new Date(store.openingDate);
            const isOldEnough = openDate <= twentyDaysAgo;
            const hasEverBeenAudited = audits.some(a => a.storeId === store.id);
            // Also check if scheduled? Usually "New Ready" implies "Plan First Audit".
            // If scheduled, it's not "Ready", it's "Planned".
            const isScheduled = schedule.some(s => s.storeId === store.id);

            return isOldEnough && !hasEverBeenAudited && !isScheduled;
        });

        // 3. Re-Audit Candidates (Low Score & 12 Day Rule)
        // Def: Audited this month BUT passed 12 days since last audit/schedule.
        // Priority: Low score first.
        const reAuditCandidates = stores.filter(store => {
            // Must have been audited this month to be considered for "2nd round" usually
            // Or just any store that fits the criteria? User implication: "After finishing 1st audits..."
            // So we primarily look for stores that HAVE 1 audit this month.
            const thisMonthAudits = audits.filter(a =>
                a.storeId === store.id &&
                a.createdAt >= currentMonthStart
            );

            // If 0 audits this month, it's in "Monthly Missing" list (Priority 1).
            if (thisMonthAudits.length === 0) return false;

            // Check if already scheduled for a 2nd time this month
            // We count total scheduled/audited events this month.
            const thisMonthSchedule = schedule.filter(s =>
                s.storeId === store.id &&
                s.date >= currentMonthStart
            );

            // If total visits (audits + planned) >= 2, maybe skip?
            // The prompt says "second audits", so if we already have 2, maybe stop.
            // Let's assume we limit to 2 for now to avoid spam.
            if (thisMonthAudits.length + thisMonthSchedule.length >= 2) return false;

            // Check 12-day rule
            const lastInteraction = getLastInteractionDate(store.id);
            if (!lastInteraction) return true; // Should ideally be covered by 'thisMonthAudits' check

            // Check based on CURRENT planning date?
            // Since we suggest for "Planning This Week", let's check against Today or Week Start.
            // If last interaction was > 12 days ago from NOW, they are eligible.
            const diffTime = Math.abs(currentDate.getTime() - lastInteraction.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays >= 12;
        }).map(store => ({ ...store, lastScore: getLastAuditScore(store.id) }))
            .sort((a, b) => (a.lastScore || 100) - (b.lastScore || 100)); // Sort lowest score first

        setSuggestions({
            monthlyMissing,
            newReady,
            reAuditCandidates
        });

    }, [stores, audits, schedule, currentDate, loading]);

    const handlePreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const handleAddStore = async (auditorId: string, date: Date, storeId: string, storeName: string) => {
        // Validation: Max 2 items per cell
        const existingItemsInCell = schedule.filter(s =>
            s.auditorId === auditorId &&
            isSameDay(s.date, date)
        );

        if (existingItemsInCell.length >= 2) {
            // Cannot add 3rd item
            // Since toasts are off, we can maybe add a shake animation or just do nothing
            // For now, strict blocking.
            return;
        }

        const id = crypto.randomUUID();
        const newItem: ScheduleItem = {
            id,
            auditorId,
            storeId: storeId,
            storeName: storeName,
            date: startOfDay(date),
            status: 'draft'
        };

        // Optimistic UI update
        setSchedule(prev => [...prev, newItem]);

        // Auto-save to Firestore
        try {
            await setDoc(doc(db, "audit_schedules", id), {
                auditorId,
                storeId,
                storeName,
                date: Timestamp.fromDate(newItem.date),
                status: 'draft'
            });
            // toast.success("Eklendi");
        } catch (error) {
            console.error("Auto-save error:", error);
            // toast.error("Kaydedilemedi!");
            setSchedule(prev => prev.filter(i => i.id !== id)); // Revert on fail
        }
    };

    const handleRemoveStore = async (itemId: string) => {
        // Optimistic UI update
        const itemToRemove = schedule.find(i => i.id === itemId);
        if (!itemToRemove) return;

        setSchedule(prev => prev.filter(item => item.id !== itemId));

        try {
            await deleteDoc(doc(db, "audit_schedules", itemId));
            // toast.success("Silindi");
        } catch (error) {
            console.error("Delete error:", error);
            // toast.error("Silinemedi!");
            setSchedule(prev => [...prev, itemToRemove]); // Revert
        }
    };

    // --- Violation Check Helper ---
    const getViolation = (item: ScheduleItem) => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

        // 1. Same Week Duplicate Check
        // Are there other items for this store in this week?
        const hasDuplicate = schedule.some(s =>
            s.id !== item.id &&
            s.storeId === item.storeId &&
            s.date >= weekStart &&
            s.date <= weekEnd
        );

        if (hasDuplicate) return "Haftalık Limit Hatası: Bu mağaza bu hafta birden fazla kez planlanmış.";

        // 2. 12-Day Rule Check
        // We check against PAST audits found in 'audits' collection
        // We do *not* check against other future schedule items for this rule typically, just history.
        const lastInteraction = getLastInteractionDate(item.storeId);
        if (lastInteraction) {
            const diffTime = Math.abs(item.date.getTime() - lastInteraction.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 12) {
                return `12 Gün Kuralı Hatası: Mağaza en son ${diffDays} gün önce işlem görmüş.`;
            }
        }

        return null;
    };

    // Calculate current view's status
    const currentWeekItems = schedule.filter(item => {
        const itemDate = item.date;
        const weekStart = weekDays[0];
        const weekEnd = weekDays[weekDays.length - 1];
        return itemDate >= startOfDay(weekStart) && itemDate <= startOfDay(weekEnd);
    });

    const isWeekPublished = currentWeekItems.length > 0 && currentWeekItems.every(i => i.status === 'published');
    const hasItems = currentWeekItems.length > 0;

    const handleTogglePublish = async () => {
        if (!hasItems) {
            // toast.info("Bu hafta için planlanmış denetim yok.");
            return;
        }

        setSaving(true);
        const newStatus = isWeekPublished ? 'draft' : 'published';
        const actionName = isWeekPublished ? 'Taslağa Çekme' : 'Yayınlama';

        try {
            const batchPromises = currentWeekItems.map(async (item) => {
                const docRef = doc(db, "audit_schedules", item.id);
                await setDoc(docRef, { status: newStatus }, { merge: true });
            });

            await Promise.all(batchPromises);

            setSchedule(prev => prev.map(item =>
                (currentWeekItems.find(w => w.id === item.id))
                    ? { ...item, status: newStatus }
                    : item
            ));

            // toast.success(`Program başarıyla ${isWeekPublished ? 'geri çekildi' : 'yayınlandı'}.`);

        } catch (error) {
            console.error("Publish error:", error);
            // toast.error(`${actionName} işlemi başarısız.`);
        } finally {
            setSaving(false);
        }
    };

    const getItemsForCell = (auditorId: string, date: Date) => {
        return schedule.filter(item =>
            item.auditorId === auditorId && isSameDay(item.date, date)
        );
    };

    // Helper to color code score
    const getScoreColor = (score?: number) => {
        if (score === undefined) return "text-slate-500 bg-slate-100";
        if (score >= 90) return "text-green-700 bg-green-100";
        if (score >= 70) return "text-amber-700 bg-amber-100";
        return "text-red-700 bg-red-100";
    };

    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        // Parse dragged store data
        const storeData = active.data.current as { storeId: string; storeName: string };
        // Parse drop target data (auditorId___date format with triple underscore)
        const dropIdStr = over.id as string;
        const lastSeparator = dropIdStr.lastIndexOf('___');

        if (lastSeparator === -1 || !storeData) return;

        const auditorId = dropIdStr.substring(0, lastSeparator);
        const dateStr = dropIdStr.substring(lastSeparator + 3);

        const dropDate = new Date(dateStr);
        const store = stores.find(s => s.id === storeData.storeId);

        if (!store) return;

        // Add store to schedule
        try {
            const scheduleItem: ScheduleItem = {
                id: `${store.id}-${dateStr}-${auditorId}`,
                storeId: store.id,
                storeName: store.name,
                auditorId,
                date: dropDate,
                status: "draft"
            };

            // Save to Firestore
            await setDoc(doc(db, "schedules", scheduleItem.id), {
                ...scheduleItem,
                date: Timestamp.fromDate(dropDate)
            });

            // Update local state
            setSchedule(prev => [...prev, scheduleItem]);
        } catch (error) {
            console.error("Error adding store:", error);
            toast.error("Mağaza eklenirken hata oluştu.");
        } finally {
            setActiveId(null);
        }
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
            <div className="flex-1 p-4 md:p-8 pt-6 h-screen flex flex-col lg:flex-row gap-4 overflow-hidden relative">
                <div className="flex flex-col flex-1 overflow-hidden gap-4 min-h-0">
                    <div className="flex-1 border rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        {/* Header Toolbar */}
                        <div className="flex items-center justify-between p-4 border-b bg-white shrink-0">
                            <NavigationMenu>
                                <NavigationMenuList className="flex items-center gap-4">
                                    {/* Navigation Controls */}
                                    <NavigationMenuItem>
                                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:text-slate-900 text-slate-500 rounded-md" onClick={handlePrev}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="h-4 w-px bg-slate-300 mx-1" />
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:text-slate-900 text-slate-500 rounded-md" onClick={handleNext}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </NavigationMenuItem>

                                    {/* Date Picker */}
                                    <NavigationMenuItem>
                                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="h-9 min-w-[240px] justify-start text-left font-normal border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex gap-2">
                                                    <CalendarIcon className="h-4 w-4 text-slate-500" />
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-700">
                                                            {format(currentDate, "MMMM yyyy", { locale: tr })}
                                                        </span>
                                                        {viewMode === 'week' && (
                                                            <>
                                                                <span className="text-slate-300">|</span>
                                                                <span className="text-slate-500 text-xs">
                                                                    {format(weekDays[0], "d MMM", { locale: tr })} - {format(weekDays[weekDays.length - 1], "d MMM", { locale: tr })}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                {viewMode === 'week' ? (
                                                    <Calendar
                                                        mode="range"
                                                        selected={{
                                                            from: startOfWeek(currentDate, { weekStartsOn: 1 }),
                                                            to: endOfWeek(currentDate, { weekStartsOn: 1 })
                                                        }}
                                                        onSelect={(_, date) => {
                                                            if (date) {
                                                                setCurrentDate(date);
                                                                setDatePickerOpen(false);
                                                            }
                                                        }}
                                                        initialFocus
                                                        locale={tr}
                                                        classNames={{
                                                            day_range_middle: "bg-slate-100 text-slate-900",
                                                            day_selected: "bg-slate-900 text-white hover:bg-slate-900 hover:text-white focus:bg-slate-900 focus:text-white",
                                                            day_today: "bg-slate-100 text-slate-900"
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="p-3 w-64">
                                                        {/* Month Picker Header: Year Navigation */}
                                                        <div className="flex items-center justify-between mb-4">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => setCurrentDate(prev => subMonths(prev, 12))}
                                                            >
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </Button>
                                                            <div className="font-semibold text-sm">
                                                                {currentDate.getFullYear()}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => setCurrentDate(prev => addMonths(prev, 12))}
                                                            >
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>

                                                        {/* Months Grid */}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {Array.from({ length: 12 }).map((_, i) => {
                                                                const monthDate = new Date(currentDate.getFullYear(), i, 1);
                                                                const isSelected = monthDate.getMonth() === currentDate.getMonth();
                                                                const isCurrentMonth = i === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

                                                                return (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => {
                                                                            setCurrentDate(monthDate);
                                                                            setDatePickerOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "h-9 text-xs rounded-md transition-colors border border-transparent",
                                                                            isSelected
                                                                                ? "bg-slate-900 text-white shadow-sm"
                                                                                : isCurrentMonth
                                                                                    ? "bg-blue-50 text-blue-700 font-semibold border-blue-200"
                                                                                    : "hover:bg-slate-100 text-slate-700"
                                                                        )}
                                                                    >
                                                                        {format(monthDate, "MMM", { locale: tr })}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </PopoverContent>
                                        </Popover>
                                    </NavigationMenuItem>

                                    {/* View Mode Toggle */}
                                    <NavigationMenuItem>
                                        <div className="flex p-1 bg-slate-100/50 rounded-lg border border-slate-200 gap-1">
                                            <button
                                                onClick={() => setViewMode('week')}
                                                className={cn(
                                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                                    viewMode === 'week'
                                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                                                        : "text-slate-500 hover:bg-slate-200/50"
                                                )}
                                            >
                                                Haftalık
                                            </button>
                                            <button
                                                onClick={() => setViewMode('month')}
                                                className={cn(
                                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                                    viewMode === 'month'
                                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                                                        : "text-slate-500 hover:bg-slate-200/50"
                                                )}
                                            >
                                                Aylık
                                            </button>
                                        </div>
                                    </NavigationMenuItem>
                                </NavigationMenuList>
                            </NavigationMenu>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mr-2 border-r pr-4 hidden sm:flex">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                        Taslak
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Yayınlandı
                                    </span>
                                </div>

                                <Button
                                    onClick={handleTogglePublish}
                                    disabled={saving || !hasItems}
                                    size="sm"
                                    variant={isWeekPublished ? "outline" : "default"}
                                    className={cn(
                                        "h-9 transition-all",
                                        isWeekPublished
                                            ? "border-red-200 text-red-600 hover:bg-red-50"
                                            : "bg-slate-900 hover:bg-slate-800 text-white"
                                    )}
                                >
                                    {isWeekPublished ? "Yayından Kaldır" : "Yayınla"}
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto relative scrollbar-thin">
                            <table className={cn("w-full h-full border-collapse text-sm text-left", viewMode === 'week' ? "table-fixed" : "table-auto min-w-max")}>
                                <thead className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 shadow-sm">
                                    <tr>
                                        <th className="p-4 border-b border-r border-slate-100 w-60 sticky left-0 bg-white/95 backdrop-blur z-30 text-center align-middle">
                                            <span className="text-lg font-extrabold text-slate-800 uppercase tracking-tight">Denetmen</span>
                                        </th>
                                        {weekDays.map((date, i) => {
                                            const isToday = isSameDay(date, new Date());
                                            return (
                                                <th key={i} className={cn(
                                                    "p-3 text-center border-b border-r border-slate-100 last:border-r-0 transition-colors",
                                                    viewMode === 'month' ? "min-w-[100px]" : "w-auto",
                                                    isToday ? "bg-blue-50/30" : "hover:bg-slate-50/50"
                                                )}>
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <span className={cn(
                                                            "text-xs font-medium uppercase tracking-widest",
                                                            isToday ? "text-blue-600" : "text-slate-500"
                                                        )}>
                                                            {format(date, "EEEE", { locale: tr })}
                                                        </span>

                                                        {isToday ? (
                                                            <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-medium shadow-md shadow-blue-200">
                                                                {format(date, "d")}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xl font-light text-slate-700 h-8 flex items-center justify-center">
                                                                {format(date, "d")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className={cn("divide-y divide-slate-200 bg-white transition-opacity duration-200", loading && auditors.length > 0 ? "opacity-50 pointer-events-none" : "opacity-100")}>
                                    {loading && auditors.length === 0 ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}>
                                                <td className="p-4 sticky left-0 bg-white border-r"><div className="h-5 w-24 bg-slate-100 rounded animate-pulse" /></td>
                                                {weekDays.map((_, j) => (
                                                    <td key={j} className="p-4 border-r"><div className="h-10 bg-slate-50 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        auditors.map((auditor) => (
                                            <tr key={auditor.uid} className="group hover:bg-slate-50/30">
                                                <td className="p-3 border-r sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                                                            {auditor.displayName?.substring(0, 2).toUpperCase() || "DE"}
                                                        </div>
                                                        <div className="font-medium text-slate-900 leading-tight">
                                                            {auditor.firstName} {auditor.lastName}
                                                        </div>
                                                    </div>
                                                </td>
                                                {weekDays.map((date, i) => {
                                                    const items = getItemsForCell(auditor.uid, date);
                                                    const isToday = isSameDay(date, new Date());
                                                    const dropId = `${auditor.uid}___${date.toISOString()}`;

                                                    return (
                                                        <DroppableCell
                                                            key={i}
                                                            dropId={dropId}
                                                            isToday={isToday}
                                                            items={items}
                                                            getViolation={getViolation}
                                                            setViolationAlert={setViolationAlert}
                                                            setOpenPopoverId={setOpenPopoverId}
                                                            openPopoverId={openPopoverId}
                                                            handleRemoveStore={handleRemoveStore}
                                                            handleAddStore={handleAddStore}
                                                            stores={stores}
                                                        />
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Suggestions Sidebar (Fixed width on desktop) */}
                <Card className="w-full lg:w-[650px] min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900 border overflow-hidden shrink-0 lg:border-l shadow-2xl z-10">
                    {/* Suggestions Sidebar - Redesigned with Tabs */}
                    <div className="flex flex-col h-full w-full bg-white">

                        <Tabs defaultValue="akilli" className="flex flex-col h-full">
                            {/* Custom Header - Fixed Height 69px (Matches Left Toolbar: p-4 + h-9 + border) */}
                            {/* Content aligned to top (pt-1) to satisfy 'move buttons up' request */}
                            {/* Removed bg-white to satisfy 'remove white area' request */}
                            <div className="h-[69px] flex items-start justify-center pt-1.5 px-4 border-b bg-slate-50/50 shrink-0">
                                <TabsList className="flex items-center gap-1 p-1 bg-slate-200/50 rounded-lg w-full max-w-[400px] h-12">
                                    <TabsTrigger
                                        value="akilli"
                                        className="flex-1 h-full px-4 text-sm font-semibold rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-200/50"
                                    >
                                        Akıllı Öneri
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="standart"
                                        className="flex-1 h-full px-4 text-sm font-semibold rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-200/50"
                                    >
                                        Standart Öneri
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Tab 1: Akıllı Öneri */}
                            <TabsContent value="akilli" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                                <StoresTableHeader />
                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                        // Combine all suggestions for Smart tab
                                        const allSuggestions: SuggestionItem[] = [
                                            ...suggestions.monthlyMissing.map(s => ({ ...s, suggestionType: 'target' as const })),
                                            ...suggestions.reAuditCandidates.map(s => ({ ...s, suggestionType: 'repeat' as const })),
                                            ...suggestions.newReady.map(s => ({ ...s, suggestionType: 'new' as const }))
                                        ];

                                        // Sort by name for consistent list view
                                        const sorted = allSuggestions.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

                                        if (sorted.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center text-muted-foreground py-8 h-full">
                                                    <div className="text-4xl mb-2">🎉</div>
                                                    <p className="text-center text-xs px-4">Harika! Tüm akıllı öneriler tamamlandı.</p>
                                                </div>
                                            );
                                        }

                                        return sorted.map((store, index) => (
                                            <DraggableStoreRow
                                                key={`${store.suggestionType}-${store.id}`}
                                                store={store}
                                                auditInfo={getStoreAuditInfo(store.id)}
                                                index={index}
                                            />
                                        ));
                                    })()}
                                </div>
                            </TabsContent>

                            {/* Tab 2: Standart Öneri */}
                            <TabsContent value="standart" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                                <StoresTableHeader />
                                <div className="flex-1 overflow-y-auto">
                                    {stores
                                        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                                        .map((store, index) => {
                                            const suggestionItem = { ...store, suggestionType: 'target' as const };
                                            return (
                                                <DraggableStoreRow
                                                    key={`std-${store.id}`}
                                                    store={suggestionItem}
                                                    auditInfo={getStoreAuditInfo(store.id)}
                                                    index={index}
                                                />
                                            );
                                        })}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div></Card>

                {/* Violation Alert Dialog */}
                < AlertDialog open={!!violationAlert
                } onOpenChange={(open) => !open && setViolationAlert(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                                <span className="flex h-3 w-3 rounded-full bg-red-600" />
                                Planlama Kuralı İhlali
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-700 dark:text-slate-300 font-medium mt-2">
                                {violationAlert}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction onClick={() => setViolationAlert(null)} className="bg-red-600 hover:bg-red-700 text-white">
                                Anlaşıldı
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog >
            </div >

            {/* Drag Overlay - Shows dragged item above everything */}
            < DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]} >
                {activeId ? (() => {
                    // Find the store being dragged
                    const storeId = activeId.replace('store-', '');
                    const store = stores.find(s => s.id === storeId);

                    if (!store) return null;

                    // Determine suggestion type for styling match (optional, but good for consistency)
                    let suggestionType: 'target' | 'repeat' | 'new' = 'target';
                    if (suggestions.reAuditCandidates.some(s => s.id === storeId)) suggestionType = 'repeat';
                    if (suggestions.newReady.some(s => s.id === storeId)) suggestionType = 'new';

                    const draggedStore = { ...store, suggestionType } as SuggestionItem;

                    // Render preview - Match Calendar Item Style Exactly
                    // Calendar item classes: "text-xs px-1.5 py-0.5 rounded border shadow-sm select-none transition-all relative flex items-center justify-between flex-1 min-h-0 cursor-pointer"
                    let bgClass = "bg-orange-50 border-orange-200 text-orange-700 font-medium";
                    if (draggedStore.suggestionType === 'repeat') bgClass = "bg-red-50 border-red-200 text-red-700 font-medium";
                    if (draggedStore.suggestionType === 'new') bgClass = "bg-blue-50 border-blue-200 text-blue-700 font-medium";

                    return (
                        <div className={cn(
                            "text-xs px-1.5 py-0.5 rounded border shadow-sm select-none flex items-center justify-center text-center cursor-grabbing w-[110px] h-[30px]",
                            bgClass
                        )}>
                            <span className="truncate w-full block font-medium leading-tight">{draggedStore.name}</span>
                        </div>
                    );
                })() : null}
            </DragOverlay >
        </DndContext >
    );
}
