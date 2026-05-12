"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CalendarDays, Save, Send, ChevronLeft, ChevronRight, Search, Sparkles, ChevronDown, Ban, Loader2, Download, Map as MapIcon, Brain
} from "lucide-react";
import Script from "next/script";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, addDays, startOfMonth, endOfMonth, startOfDay, subWeeks, addWeeks, subMonths, addMonths, differenceInDays, isBefore, subDays, getISOWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { Timestamp, collection, doc, getDocs, query, setDoc, where, deleteDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Adjust path as needed
import { UserProfile, Store, Audit } from "@/lib/types";
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
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { StoreAuditHistoryDialog } from "@/components/admin/schedule/store-audit-history-dialog";
import { StoreSelectorDialog } from "@/components/admin/schedule/add-store-dialog";
import { ScheduleMapModal } from "@/components/admin/schedule/schedule-map-modal";
import { AiScheduleDialog } from "@/components/admin/schedule/ai-schedule-dialog";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Info, Calendar as CalendarIcon, ClipboardList, StickyNote, Hotel,
    Plus, Pencil, Trash2, X, Check, RefreshCw
} from "lucide-react";
import { LeaveType, AccommodationType } from "@/lib/types";
import { ACCOMMODATION_ICONS } from "@/lib/constants";
import { useAuth } from "@/components/auth-provider";

// Robust UUID Generator (Polyfill)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments where crypto.randomUUID is not available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Interface for a schedule item
interface ScheduleItem {
    id: string; // unique id
    auditorId: string;
    storeId?: string; // Optional for leaves
    storeName: string; // Display Name
    date: Date;
    status: 'draft' | 'published';
    type?: 'audit' | 'leave' | 'blocked';
    leaveTypeId?: string;
    leaveColor?: string;
    note?: string;
    accommodationTypeId?: string | null;
}

type SuggestionItem = Store & { suggestionType: 'target' | 'repeat' | 'new'; lastScore?: number };

// Draggable Store Row Component (Excel-like)
function DraggableStoreRow({
    store,
    auditInfo,
    index,
    disabled,
    scheduledDate,
    onInfoClick
}: {
    store: SuggestionItem;
    auditInfo: { lastDates: Date[], lastAuditorName: string, daysSince: number };
    index: number;
    disabled?: boolean;
    scheduledDate?: Date | null;
    onInfoClick: (storeId: string, storeName: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `store-${store.id}`,
        data: { storeId: store.id, storeName: store.name },
        disabled: disabled,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
    };

    // Determine row background based on type
    let bgClass = index % 2 === 0 ? "bg-white" : "bg-slate-50";
    // Overlay type color subtly
    if (store.suggestionType === 'target') bgClass = cn(bgClass, "hover:bg-orange-50");
    if (store.suggestionType === 'repeat') bgClass = cn(bgClass, "bg-blue-50/60 hover:bg-blue-100/60");
    if (store.suggestionType === 'new') bgClass = cn(bgClass, "bg-emerald-50/50 hover:bg-emerald-100/50");

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={setNodeRef}
                    style={style}
                    {...listeners}
                    {...attributes}
                    className={cn(
                        "grid grid-cols-[1.5fr_0.8fr_0.8fr_1.2fr_1.2fr_0.8fr] gap-0 text-xs items-center border-b border-slate-200 cursor-grab active:cursor-grabbing transition-colors min-h-[40px]",
                        bgClass,
                        disabled ? "opacity-50 pointer-events-none grayscale" : "hover:bg-slate-100"
                    )}
                    title={`${store.name}`}
                >
                    <div className={cn(
                        "px-2 py-1 font-semibold truncate border-r border-slate-100 h-full flex items-center relative uppercase",
                        store.suggestionType === 'repeat' ? "text-blue-700" : ""
                    )}>
                        {store.name}
                        {scheduledDate && (
                            <div className="absolute top-0 right-0 bottom-0 flex items-center pr-1 pointer-events-none">
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded-sm border border-blue-200 leading-tight">
                                    Plan: {format(scheduledDate, 'd MMMM', { locale: tr })}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="px-2 py-1 text-center border-r border-slate-100 h-full flex items-center justify-center">{store.shipmentDay || "-"}</div>
                    <div className="px-2 py-1 text-center border-r border-slate-100 h-full flex items-center justify-center">{store.shipmentTime || "-"}</div>

                    {/* Last Audit Dates */}
                    <div className="px-2 py-1 border-r border-slate-100 h-full flex flex-col justify-center items-center leading-tight">
                        {auditInfo.lastDates.length > 0 ? (
                            <span className={cn(
                                "block whitespace-nowrap font-medium",
                                store.suggestionType === 'repeat' ? "text-blue-600" : ""
                            )}>{format(auditInfo.lastDates[0], 'dd.MM.yyyy')}</span>
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
                    <div className={cn(
                        "px-2 py-1 flex items-center justify-center font-bold",
                        store.suggestionType === 'repeat' ? "text-blue-600" : ""
                    )}>
                        {auditInfo.daysSince >= 0 ? auditInfo.daysSince : <span className="text-blue-600">YENİ</span>}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => onInfoClick(store.id, store.name)}>
                    <Info className="mr-2 h-4 w-4" />
                    Bilgi
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
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
    rawItems,
    getViolation,
    setViolationAlert,
    setOpenPopoverId,
    openPopoverId,
    handleRemoveStore,
    handleAddStore,
    stores,
    isWeekPublished,
    leaveTypes,
    handleAddLeave,
    isSelected,
    onCellClick,
    selectedCells,
    setNoteDialog,
    accommodationTypes,
    handleUpdateScheduleItem,
    onStoreAction,
    audits,
    isReadOnly
}: {
    dropId: string;
    isToday: boolean;
    rawItems: ScheduleItem[];
    getViolation: (item: ScheduleItem) => string | null;
    setViolationAlert: (msg: string | null) => void;
    setOpenPopoverId: (id: string | null) => void;
    openPopoverId: string | null;
    handleRemoveStore: (id: string) => Promise<void>;
    handleAddStore: (auditorId: string, date: Date, storeId: string, storeName: string, accommodationTypeId?: string | null) => Promise<void>;
    stores: Store[];
    isWeekPublished: boolean;
    leaveTypes: LeaveType[];
    handleAddLeave: (auditorId: string, date: Date, leaveType: LeaveType) => Promise<void>;
    isSelected: boolean;
    onCellClick: (id: string, isMulti: boolean) => void;
    selectedCells: Set<string>;
    setNoteDialog: (v: { open: boolean, itemId: string | null, note: string }) => void;
    accommodationTypes: AccommodationType[];
    handleUpdateScheduleItem: (itemId: string, updates: Partial<ScheduleItem>) => void;
    onStoreAction: (action: 'add' | 'change' | 'replace_leave', date: Date, auditorId: string, item?: ScheduleItem) => void;
    audits: any[]; // Or proper type
    isReadOnly?: boolean;
}) {
    // Filter out blocked items for display
    const filteredItems = rawItems.filter(i => i.type !== 'blocked');
    const hasLeave = filteredItems.some(i => i.type === 'leave');
    const { setNodeRef, isOver } = useDroppable({
        id: dropId,
        disabled: hasLeave // Unlock for published week (was: isWeekPublished || hasLeave)
    });

    const handleContextMenuAddLeave = async (leaveType: LeaveType) => {
        // Decide targets: if current cell is selected, use all selected cells. Otherwise just current.
        const targets = isSelected ? Array.from(selectedCells) : [dropId];

        try {
            await Promise.all(targets.map(id => {
                const lastSeparator = id.lastIndexOf('___');
                const auditorId = id.substring(0, lastSeparator);
                const dateStr = id.substring(lastSeparator + 3);
                return handleAddLeave(auditorId, new Date(dateStr), leaveType);
            }));

            // Optional: visual feedback or toast could go here
        } catch (error) {
            console.error("Bulk add failed", error);
        }
    };

    const cell = (
        <td
            ref={setNodeRef}
            className={cn(
                "p-1 border-r border-b border-slate-100/50 align-top min-h-[4rem] relative transition-all duration-200 hover:z-[20]",
                isSelected ? "bg-blue-100/40 ring-2 ring-inset ring-blue-500 z-10" : (isToday ? "bg-blue-50/20" : "hover:bg-slate-50/40"),
                isOver && "bg-blue-50/80 ring-2 ring-blue-100 ring-inset"
            )}
            onClick={(e) => {
                const isPublishedContext = isWeekPublished || filteredItems.some(i => i.status === 'published');
                if (isPublishedContext) return;
                // Prevent triggering when clicking inside popover or existing item if needed, 
                // but usually cell click is fine.
                // Check for modifier key (Ctrl or Meta/Command)
                onCellClick(dropId, e.ctrlKey || e.metaKey);
            }}
            onContextMenu={(e) => {
                setOpenPopoverId(null);
            }}
        >
            <div className="flex flex-col gap-1 h-full overflow-visible relative">
                {filteredItems.map((item) => {
                    if (item.type === 'leave') {
                        const content = (
                            <div
                                key={item.id}
                                className={cn(
                                    "absolute inset-0 m-1 rounded-lg shadow-sm select-none transition-all flex items-center justify-center cursor-default z-10 hover:z-[100] group/item overflow-visible hover:shadow-md hover:scale-[1.02] duration-200",
                                    "text-white font-bold border border-white/10 backdrop-blur-sm"
                                )}
                                style={{ backgroundColor: item.leaveColor || '#64748B' }}
                            >
                                <div className="flex flex-col items-center justify-center w-full h-full p-1">
                                    {item.note && (
                                        <div className="absolute top-1 left-1">
                                            <StickyNote className="h-3 w-3 text-white/90 fill-white/20" />
                                        </div>
                                    )}
                                    <span className="w-full block text-center shadow-black/10 drop-shadow-md px-1 whitespace-normal leading-tight break-words text-xs">
                                        {item.storeName}
                                    </span>
                                </div>

                                {item.status === 'draft' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveStore(item.id);
                                        }}
                                        className="absolute -right-2 -top-2 p-1 rounded-full bg-red-600 text-white border border-red-700 shadow-xl z-[110] transition-all hover:bg-red-700 cursor-pointer opacity-0 group-hover/item:opacity-100"
                                    >
                                        <X className="h-2 w-2" />
                                    </button>
                                )}
                            </div>
                        );

                        if (isWeekPublished) return content;

                        return (
                            <ContextMenu key={item.id}>
                                <ContextMenuTrigger asChild>
                                    {content}
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    {item.note ? (
                                        <>
                                            <ContextMenuItem onClick={() => setNoteDialog({ open: true, itemId: item.id, note: item.note || "" })}>
                                                <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => handleUpdateScheduleItem(item.id, { note: "" })} className="text-red-600">
                                                <Trash2 className="mr-2 h-4 w-4" /> Notu Sil
                                            </ContextMenuItem>
                                        </>
                                    ) : (
                                        <ContextMenuItem onClick={() => setNoteDialog({ open: true, itemId: item.id, note: "" })}>
                                            <Plus className="mr-2 h-4 w-4" /> Not Ekle
                                        </ContextMenuItem>
                                    )}
                                </ContextMenuContent>
                            </ContextMenu>
                        );
                    }

                    const violation = getViolation(item);

                    // Check if this specific item has been completed
                    const isCompleted = audits.some(a =>
                        a.storeId === item.storeId &&
                        a.auditorId === item.auditorId &&
                        a.status === 'tamamlandi' &&
                        isSameDay(a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() || new Date(a.createdAt as unknown as string), item.date)
                    );

                    const content = (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (violation) setViolationAlert(violation);
                            }}
                            title={violation || item.storeName}
                            className={cn(
                                "group/item text-xs px-1.5 py-0.5 rounded border shadow-sm select-none transition-all relative flex items-center justify-between flex-1 min-h-0 cursor-pointer",
                                violation
                                    ? "bg-red-50 border-red-200 text-red-700 font-medium"
                                    : isCompleted
                                        ? "bg-green-50 border-green-400 text-green-700 font-medium ring-1 ring-inset ring-green-500/20"
                                        : item.status === 'published'
                                            ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                                            : "bg-white border-slate-300 text-slate-700 font-medium"
                            )}
                            onContextMenu={(e) => {
                                // Prevent default context menu to allow our custom one
                                // But Radix ContextMenu handles this via trigger.
                                // Just ensuring no native menu interferes if needed.
                            }}
                        >
                            <div className="flex items-center justify-center gap-1 min-w-0 flex-1">
                                {isCompleted && <Check className="h-3 w-3 text-green-600 shrink-0" />}
                                {item.note && <StickyNote className="h-3 w-3 text-yellow-500 fill-yellow-100 shrink-0" />}
                                <span className="truncate block text-center uppercase">{item.storeName}</span>
                            </div>

                            {violation && (
                                <span className="flex h-1.5 w-1.5 shrink-0 ml-1">
                                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                            )}

                            {item.accommodationTypeId && (() => {
                                const type = accommodationTypes.find(t => t.id === item.accommodationTypeId);
                                if (type) {
                                    const Icon = ACCOMMODATION_ICONS[type.icon] || Hotel;
                                    return (
                                        <div className="absolute -bottom-1 -right-1 p-0.5 bg-white rounded-full border shadow-sm z-10" title={type.name}>
                                            <Icon className="h-3 w-3 text-blue-600" />
                                        </div>
                                    );
                                }
                                return null;
                            })()}

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

                    if (isReadOnly) {
                        return <div key={item.id} className="relative group/item">{content}</div>;
                    }

                    if (isWeekPublished) {
                        return (
                            <ContextMenu key={item.id}>
                                <ContextMenuTrigger asChild>
                                    {content}
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 rounded-sm mb-1">
                                        Acil Durum Yönetimi
                                    </div>
                                    <ContextMenuItem onClick={() => onStoreAction('change', item.date, item.auditorId, item)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Mağazayı Değiştir
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => onStoreAction('add', item.date, item.auditorId)}>
                                        <Plus className="mr-2 h-4 w-4" /> İkinci Mağazayı Ekle
                                    </ContextMenuItem>

                                    {/* Accommodation Actions - Copied for Published Items */}
                                    <ContextMenuSub>
                                        <ContextMenuSubTrigger>
                                            <Hotel className="mr-2 h-4 w-4" /> Konaklama
                                        </ContextMenuSubTrigger>
                                        <ContextMenuSubContent className="w-48">
                                            {accommodationTypes.length === 0 ? (
                                                <ContextMenuItem disabled>Tanımlı tür yok</ContextMenuItem>
                                            ) : (
                                                accommodationTypes.map(type => {
                                                    const Icon = ACCOMMODATION_ICONS[type.icon] || Hotel;
                                                    const isSelected = item.accommodationTypeId === type.id;
                                                    return (
                                                        <ContextMenuItem
                                                            key={type.id}
                                                            onClick={() => handleUpdateScheduleItem(item.id, { accommodationTypeId: type.id })}
                                                            className="flex items-center justify-between"
                                                        >
                                                            <div className="flex items-center">
                                                                <Icon className="mr-2 h-4 w-4" /> {type.name}
                                                            </div>
                                                            {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                                                        </ContextMenuItem>
                                                    );
                                                })
                                            )}
                                            <ContextMenuSeparator />
                                            <ContextMenuItem onClick={() => handleUpdateScheduleItem(item.id, { accommodationTypeId: deleteField() as unknown as string })} className="text-red-600">
                                                <X className="mr-2 h-4 w-4" /> Konaklamayı Kaldır
                                            </ContextMenuItem>
                                        </ContextMenuSubContent>
                                    </ContextMenuSub>

                                    <ContextMenuSub>
                                        <ContextMenuSubTrigger>
                                            <Hotel className="mr-2 h-4 w-4" /> İzin ile Değiştir
                                        </ContextMenuSubTrigger>
                                        <ContextMenuSubContent className="w-48">
                                            {leaveTypes.map(type => (
                                                <ContextMenuItem
                                                    key={type.id}
                                                    onClick={() => {
                                                        const lastSeparator = dropId.lastIndexOf('___');
                                                        const auditorId = dropId.substring(0, lastSeparator);
                                                        const dateStr = dropId.substring(lastSeparator + 3);
                                                        handleAddLeave(auditorId, new Date(dateStr), type);
                                                    }}
                                                >
                                                    <div className="w-3 h-3 rounded-full mr-2 border border-slate-200" style={{ backgroundColor: type.color }} />
                                                    {type.name}
                                                </ContextMenuItem>
                                            ))}
                                        </ContextMenuSubContent>
                                    </ContextMenuSub>

                                    <ContextMenuItem onClick={() => handleRemoveStore(item.id)} className="text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" /> Havuza Gönder (İptal)
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        );
                    }

                    return (
                        <ContextMenu key={item.id}>
                            <ContextMenuTrigger asChild>
                                {content}
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                                {/* Note Actions */}
                                {item.note ? (
                                    <>
                                        <ContextMenuItem onClick={() => setNoteDialog({ open: true, itemId: item.id, note: item.note || "" })}>
                                            <Pencil className="mr-2 h-4 w-4" /> Notu Düzenle
                                        </ContextMenuItem>
                                        <ContextMenuItem onClick={() => handleUpdateScheduleItem(item.id, { note: "" })} className="text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" /> Notu Sil
                                        </ContextMenuItem>
                                    </>
                                ) : (
                                    <ContextMenuItem onClick={() => setNoteDialog({ open: true, itemId: item.id, note: "" })}>
                                        <Plus className="mr-2 h-4 w-4" /> Not Ekle
                                    </ContextMenuItem>
                                )}
                                <ContextMenuSeparator />

                                {/* Accommodation Actions */}
                                <ContextMenuSub>
                                    <ContextMenuSubTrigger>
                                        <Hotel className="mr-2 h-4 w-4" /> Konaklama
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-48">
                                        {accommodationTypes.length === 0 ? (
                                            <ContextMenuItem disabled>Tanımlı tür yok</ContextMenuItem>
                                        ) : (
                                            accommodationTypes.map(type => {
                                                const Icon = ACCOMMODATION_ICONS[type.icon] || Hotel;
                                                const isSelected = item.accommodationTypeId === type.id;
                                                return (
                                                    <ContextMenuItem
                                                        key={type.id}
                                                        onClick={() => handleUpdateScheduleItem(item.id, { accommodationTypeId: type.id })}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center">
                                                            <Icon className="mr-2 h-4 w-4" /> {type.name}
                                                        </div>
                                                        {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                                                    </ContextMenuItem>
                                                );
                                            })
                                        )}
                                        <ContextMenuSeparator />
                                        <ContextMenuItem onClick={() => handleUpdateScheduleItem(item.id, { accommodationTypeId: deleteField() as unknown as string })} className="text-red-600">
                                            <X className="mr-2 h-4 w-4" /> Konaklamayı Kaldır
                                        </ContextMenuItem>
                                    </ContextMenuSubContent>
                                </ContextMenuSub>
                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}

                {/* Empty State / Add Trigger 
                    Draft: Show if < 2 items.
                    Published: HIDE ALWAYS (Clean UI). User must right-click to Add.
                */}
                {!isReadOnly && !hasLeave && !isWeekPublished && !filteredItems.some(i => i.status === 'published') && filteredItems.length < 2 && (
                    <Popover
                        open={openPopoverId === dropId}
                        onOpenChange={(isOpen) => {
                            if (isOpen) setOpenPopoverId(dropId);
                            else setOpenPopoverId(null);
                        }}
                    >
                        <PopoverTrigger asChild>
                            <button
                                onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onCellClick(dropId, true);
                                    }
                                }}
                                className={cn(
                                    "flex-1 m-0.5 min-h-[1.5rem] rounded border border-dashed border-transparent hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-all",
                                    filteredItems.length > 0 ? "h-8 min-h-0 text-xs w-auto" : "flex-1",
                                    isSelected && "pointer-events-none"
                                )}>
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

    if (isWeekPublished) {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    {cell}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 rounded-sm mb-1">
                        Acil Durum Yönetimi
                    </div>

                    {/* Only allow deleting leave if leave exists */}
                    {hasLeave && (
                        <>
                            {filteredItems.filter(i => i.type === 'leave').map(leaveItem => (
                                <ContextMenuItem
                                    key={leaveItem.id}
                                    onClick={() => handleRemoveStore(leaveItem.id)}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> İzni Sil
                                </ContextMenuItem>
                            ))}
                            <ContextMenuItem onClick={() => {
                                // For leaves, we need to know existing item details to replace it, or just use the dropId context to add new after delete
                                const leaveItem = filteredItems.find(i => i.type === 'leave');
                                if (leaveItem) {
                                    onStoreAction('replace_leave', leaveItem.date, leaveItem.auditorId, leaveItem);
                                }
                            }}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Mağaza Ata
                            </ContextMenuItem>
                            <Separator className="my-1" />
                        </>
                    )}

                    {!hasLeave && (
                        <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                                Acil Ekleme
                            </div>
                            <ContextMenuItem onClick={() => {
                                const lastSeparator = dropId.lastIndexOf('___');
                                const auditorId = dropId.substring(0, lastSeparator);
                                const dateStr = dropId.substring(lastSeparator + 3);
                                onStoreAction('add', new Date(dateStr), auditorId);
                            }}>
                                <Plus className="mr-2 h-4 w-4" /> Mağaza Ekle
                            </ContextMenuItem>
                            <Separator className="my-1" />

                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                                İzin Ekle (Hastalık vb.)
                            </div>
                            <Separator className="my-1" />
                            {leaveTypes.length === 0 ? (
                                <div className="px-2 py-1 text-xs text-slate-400 italic">Tanımlı izin yok</div>
                            ) : (
                                leaveTypes.map(type => (
                                    <ContextMenuItem key={type.id} onClick={() => handleContextMenuAddLeave(type)}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: type.color }} />
                                            <span>{type.name}</span>
                                        </div>
                                    </ContextMenuItem>
                                ))
                            )}
                        </>
                    )}
                </ContextMenuContent>
            </ContextMenu>
        );
    }

    if (isReadOnly) {
        return <div className="h-full min-h-[100px] w-full">{cell}</div>;
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {cell}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                    İzin Ekle
                </div>
                <Separator className="my-1" />
                {leaveTypes.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-slate-400 italic">Tanımlı izin yok</div>
                ) : (
                    leaveTypes.map(type => (
                        <ContextMenuItem key={type.id} onClick={() => handleContextMenuAddLeave(type)}>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: type.color }} />
                                <span>{type.name}</span>
                            </div>
                        </ContextMenuItem>
                    ))
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}

export default function SchedulePage() {
    const { userProfile } = useAuth();
    const isReadOnly = userProfile?.role !== 'admin';

    const [currentDate, setCurrentDate] = useState(new Date());
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [auditors, setAuditors] = useState<UserProfile[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>([]);
    const [mapOpen, setMapOpen] = useState(false);
    const [aiScheduleOpen, setAiScheduleOpen] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            setIsGeneratingPDF(true);

            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            // Load Roboto TTF from /public/fonts and register with jsPDF
            // This ensures proper Turkish character rendering (ş, ğ, ü, ö, ç, ı)
            const loadFont = async (path: string): Promise<string> => {
                const resp = await fetch(path);
                const buffer = await resp.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                bytes.forEach(b => { binary += String.fromCharCode(b); });
                return btoa(binary);
            };

            const [regularB64, boldB64] = await Promise.all([
                loadFont('/fonts/Roboto-Regular.ttf'),
                loadFont('/fonts/Roboto-Bold.ttf'),
            ]);

            doc.addFileToVFS('Roboto-Regular.ttf', regularB64);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.addFileToVFS('Roboto-Bold.ttf', boldB64);
            doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
            doc.setFont('Roboto', 'normal');

            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

            const weekItems = schedule.filter(item =>
                item.date >= startOfDay(weekStart) && item.date <= startOfDay(weekEnd)
            );

            const weekNum = getISOWeek(currentDate);

            // Title
            doc.setFont('Roboto', 'bold');
            doc.setFontSize(14);
            doc.text(`${weekNum}. Hafta Denetim Programı`, 14, 14);
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(
                `${format(weekStart, 'd MMM', { locale: tr })} - ${format(weekEnd, 'd MMM yyyy', { locale: tr })}`,
                14, 20
            );
            doc.setTextColor(0);

            // Build column headers: day name on first line, date (d MMM) on second line
            // Using an array per cell gives autoTable explicit two-line header cells
            const head = [
                [
                    'Denetmen',
                    ...days.map(d => ({
                        content: `${format(d, 'EEEE', { locale: tr })}\n${format(d, 'd MMM', { locale: tr })}`,
                        styles: { halign: 'center' as const }
                    }))
                ]
            ];

            const body = auditors.map(auditor => {
                const row: string[] = [`${auditor.firstName} ${auditor.lastName}`];
                const defaultLeave = leaveTypes.find(t => t.isDefault);

                days.forEach(day => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const cellItems = weekItems.filter(
                        item => item.auditorId === auditor.uid && isSameDay(item.date, day)
                    );

                    if (cellItems.length === 0) {
                        // Eğer hücre boşsa ve haftasonuysa (örn: henüz taslak aşamasındayken), varsayılan izni koy
                        if (isWeekend && defaultLeave && !schedule.some(i => i.auditorId === auditor.uid && isSameDay(i.date, day) && i.type === 'blocked')) {
                            row.push(defaultLeave.name);
                        } else {
                            row.push('');
                        }
                    } else {
                        row.push(
                            cellItems.map(item => {
                                if (item.type === 'leave') return item.storeName;
                                if (item.type === 'blocked') return '';
                                return item.storeName;
                            }).filter(Boolean).join('\n\n')
                        );
                    }
                });
                return row;
            });

            autoTable(doc, {
                head,
                body,
                startY: 25,
                margin: { left: 10, right: 10 },
                tableWidth: 277, // A4 landscape 297mm - 10mm*2 margins = 277mm
                styles: {
                    font: 'Roboto',
                    fontStyle: 'normal',
                    fontSize: 11,
                    cellPadding: 4,
                    overflow: 'linebreak',
                    valign: 'middle',
                    halign: 'center',
                    lineColor: [180, 180, 180],
                    lineWidth: 0.4,
                },
                headStyles: {
                    font: 'Roboto',
                    fontStyle: 'bold',
                    fontSize: 11,
                    fillColor: [30, 41, 59],
                    textColor: 255,
                    halign: 'center',
                    minCellHeight: 16,
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 36, halign: 'left' },
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
                didParseCell: (data: any) => {
                    const colIdx = data.column.index;
                    if (colIdx > 0) {
                        const day = days[colIdx - 1];
                        if (day && (day.getDay() === 0 || day.getDay() === 6)) {
                            if (data.row.section !== 'head') {
                                data.cell.styles.fillColor = [241, 245, 249];
                            } else {
                                data.cell.styles.fillColor = [51, 65, 85];
                            }
                        }
                    }
                },
            });

            doc.save(`${weekNum}. HAFTA DENETİM PROGRAMI ${format(currentDate, 'yyyy')}.pdf`);
            toast.success('PDF başarıyla indirildi.');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('PDF oluşturulurken bir hata oluştu.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };


    // Note Dialog State
    const [noteDialog, setNoteDialog] = useState<{ open: boolean, itemId: string | null, note: string }>({
        open: false,
        itemId: null,
        note: ""
    });

    const handleSaveNote = async () => {
        if (!noteDialog.itemId) return;

        // Optimistic Update
        setSchedule(prev => prev.map(item =>
            item.id === noteDialog.itemId
                ? { ...item, note: noteDialog.note }
                : item
        ));

        try {
            const docRef = doc(db, "audit_schedules", noteDialog.itemId);
            await setDoc(docRef, { note: noteDialog.note }, { merge: true });
            // toast.success("Not kaydedildi.");
            setNoteDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
            console.error("Error saving note:", error);
            // toast.error("Not kaydedilemedi.");
        }
    };




    // Sidebar Resize State
    const [sidebarWidth, setSidebarWidth] = useState(500);
    const [isResizing, setIsResizing] = useState(false);

    // Refs for delta calculation to ensure 1:1 movement without jumps
    const dragStartRef = useRef<{ x: number, w: number } | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !dragStartRef.current) return;

            const { x: startX, w: startWidth } = dragStartRef.current;

            // Calculate Delta: How much did the mouse move LEFT?
            // If moved Left (smaller X), Width should INCREASE.
            // Delta = StartX - CurrentX
            const delta = startX - e.clientX;

            let newWidth = startWidth + delta;

            // Constraints
            if (newWidth < 300) newWidth = 300;
            if (newWidth > 1200) newWidth = 1200;

            // Snap to default Reference Point (500px) - Increased threshold for better feel
            if (Math.abs(newWidth - 500) < 30) {
                newWidth = 500;
            }

            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            dragStartRef.current = null;
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);
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
    const [historyDialogState, setHistoryDialogState] = useState<{ open: boolean; storeId: string | null; storeName: string }>({
        open: false,
        storeId: null,
        storeName: ""
    });

    // Reassign Dialog State
    const [reassignDialogState, setReassignDialogState] = useState<{
        open: boolean;
        item: { id: string; storeName: string; currentAuditorId: string; currentDate: Date } | null;
    }>({ open: false, item: null });

    const handleReassignOpen = (item: ScheduleItem) => {
        setReassignDialogState({
            open: true,
            item: {
                id: item.id,
                storeName: item.storeName,
                currentAuditorId: item.auditorId,
                currentDate: item.date
            }
        });
    };

    const handleReassignConfirm = async (newAuditorId: string, newDate: Date) => {
        const item = reassignDialogState.item;
        if (!item) return;

        // Optimistic Update
        // Remove from old slot, Add to new slot (by changing auditorId and date)
        setSchedule(prev => prev.map(s => {
            if (s.id === item.id) {
                return {
                    ...s,
                    auditorId: newAuditorId,
                    date: startOfDay(newDate) // Update to new date
                };
            }
            return s;
        }));

        try {
            const docRef = doc(db, "audit_schedules", item.id);
            await updateDoc(docRef, {
                auditorId: newAuditorId,
                date: Timestamp.fromDate(startOfDay(newDate))
            });
            toast.success("Atama başarıyla güncellendi.");
        } catch (error) {
            console.error("Reassign error:", error);
            toast.error("Atama güncellenemedi.");
            // Revert would be complex here, assuming success for MVP or relying on refresh
        }
    };

    // Unified Store Selection State
    const [storeSelector, setStoreSelector] = useState<{
        open: boolean;
        mode: 'add' | 'change' | 'replace_leave';
        auditorId: string;
        date: Date | null;
        targetItem?: ScheduleItem;
    }>({
        open: false,
        mode: 'add',
        auditorId: "",
        date: null
    });

    const handleStoreAction = (action: 'add' | 'change' | 'replace_leave', date: Date, auditorId: string, item?: ScheduleItem) => {
        setStoreSelector({
            open: true,
            mode: action,
            date,
            auditorId,
            targetItem: item
        });
    };

    const handleStoreSelectConfirm = async (storeId: string, storeName: string) => {
        const { mode, date, auditorId, targetItem } = storeSelector;
        if (!date) return;

        try {
            if (mode === 'add') {
                // Check if existing items have accommodation
                const existingItems = schedule.filter(s =>
                    s.auditorId === auditorId &&
                    isSameDay(s.date, date) &&
                    s.accommodationTypeId
                );
                const inheritedAccommodation = existingItems.length > 0 ? existingItems[0].accommodationTypeId : undefined;

                await handleAddStore(auditorId, date, storeId, storeName, inheritedAccommodation);
            } else if (mode === 'change' && targetItem) {
                // Update local first
                setSchedule(prev => prev.map(s => s.id === targetItem.id ? { ...s, storeId, storeName } : s));
                // Update db
                await updateDoc(doc(db, "audit_schedules", targetItem.id), { storeId, storeName });
                toast.success("Mağaza değiştirildi.");
            } else if (mode === 'replace_leave' && targetItem) {
                // Delete leave first
                await deleteDoc(doc(db, "audit_schedules", targetItem.id));
                setSchedule(prev => prev.filter(s => s.id !== targetItem.id));
                // Add new store
                await handleAddStore(auditorId, date, storeId, storeName);
            }
        } catch (error) {
            console.error("Store action failed", error);
            toast.error("İşlem başarısız.");
        }
    };

    // Bulk Selection State
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

    const handleCellClick = (dropId: string, isMulti: boolean) => {
        if (!isMulti) {
            // If Ctrl is not pressed, clear selection completely.
            // Do not select the current cell either, as requested.
            setSelectedCells(new Set());
            return;
        }

        setSelectedCells(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dropId)) {
                newSet.delete(dropId);
            } else {
                newSet.add(dropId);
            }
            return newSet;
        });
    };

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

            // Deduplicate by UID just in case
            const uniqueAuditors = Array.from(new Map(auditorsData.map(item => [item.uid, item])).values());

            // Sort alphabetically with Turkish locale
            uniqueAuditors.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '', 'tr-TR'));

            setAuditors(uniqueAuditors);

            // 2. Fetch Stores
            const storesSnap = await getDocs(collection(db, "stores"));
            const storesData = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
            storesData.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr-TR'));
            setStores(storesData);

            // 3. Fetch Leave Types
            const leaveTypesSnap = await getDocs(collection(db, "leave_types"));
            const leaveTypesData = leaveTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveType));
            leaveTypesData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setLeaveTypes(leaveTypesData);

            // 4. Accommodation Types
            const accSnap = await getDocs(collection(db, "accommodation_types"));
            const accData = accSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccommodationType));
            accData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setAccommodationTypes(accData);
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
                    date: data.date ? (data.date as Timestamp).toDate() : new Date(), // Fallback to now to prevent crash
                } as ScheduleItem;
            }).filter(item => item.date); // Filter out any that might still be problematic
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

        // Calculate daysSince from the PLANNING ANCHOR (next Monday), not today.
        // This shows how many days will have passed when the plan is executed.
        let daysSince = -1;
        if (lastAudit) {
            const todayStart = startOfDay(new Date());
            const viewedMonday = startOfWeek(currentDate, { weekStartsOn: 1 });
            const nextMonday = startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
            const anchor = isBefore(viewedMonday, todayStart) ? nextMonday : viewedMonday;
            daysSince = differenceInDays(anchor, lastAudit.createdAt);
        }

        return { lastDates, lastAuditorName, daysSince };
    };

    // Helper: Check if store is already scheduled in the current view month
    const getScheduledDateInMonth = (storeId: string) => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        const found = schedule.find(s =>
            s.storeId === storeId &&
            s.date >= monthStart &&
            s.date <= monthEnd
        );
        return found ? found.date : null;
    };

    // Calculate Suggestions
    useEffect(() => {
        if (loading || stores.length === 0) return;

        // --- KEY CHANGE: Use NEXT week's Monday as the planning reference date ---
        // When planning next week, the 12-day rule must be evaluated against
        // the first day of the week being planned, not today.
        const nextWeekMonday = startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
        // If we're already viewing a future week, use that week's Monday
        const today = startOfDay(new Date());
        const viewedWeekMonday = startOfWeek(currentDate, { weekStartsOn: 1 });
        // planningAnchor = the Monday of the NEXT week relative to currentDate
        // (the week we'd be planning for)
        const planningAnchor = isBefore(viewedWeekMonday, today)
            ? nextWeekMonday  // Viewing past/current week → planning for next week
            : viewedWeekMonday; // Already viewing future → plan for that week

        const currentMonthStart = startOfMonth(planningAnchor);
        const currentMonthEnd = endOfMonth(planningAnchor);

        // --- Capacity: how many slots are available in the planned week ---
        // 8 auditors × 5 weekdays = 40. We use actual auditor count.
        const weekdaysInPlan = 5; // Mon–Fri
        const totalCapacity = auditors.length * weekdaysInPlan;

        // 2. New Ready Stores
        const twentyDaysAgo = addDays(today, -20);
        const newReady = stores.filter(store => {
            if (!store.openingDate) return false;
            const openDate = new Date(store.openingDate);
            const isOldEnough = openDate <= twentyDaysAgo;
            const hasEverBeenAudited = audits.some(a => a.storeId === store.id);
            const isScheduled = schedule.some(s => s.storeId === store.id);
            return isOldEnough && !hasEverBeenAudited && !isScheduled;
        });

        // 1. Monthly Missing (First Audits not yet done this month)
        // 12-day rule evaluated against planningAnchor (next Monday), NOT today.
        const monthlyMissing = stores.filter(store => {
            if (newReady.some(nr => nr.id === store.id)) return false;

            // Check if already audited this month
            const hasAuditThisMonth = audits.some(a =>
                a.storeId === store.id &&
                a.createdAt >= currentMonthStart &&
                a.createdAt <= currentMonthEnd
            );
            if (hasAuditThisMonth) return false;

            // Check if scheduled this month
            const isScheduledThisMonth = schedule.some(s =>
                s.storeId === store.id &&
                s.date >= currentMonthStart &&
                s.date <= currentMonthEnd
            );
            if (isScheduledThisMonth) return false;

            // 12-day rule: check last audit/schedule date against planningAnchor
            const lastAuditDate = audits
                .filter(a => a.storeId === store.id)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;
            const lastScheduleDate = schedule
                .filter(s => s.storeId === store.id)
                .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date;

            const lastInteraction = lastAuditDate && lastScheduleDate
                ? (lastAuditDate > lastScheduleDate ? lastAuditDate : lastScheduleDate)
                : (lastAuditDate || lastScheduleDate);

            if (lastInteraction) {
                const daysBetween = differenceInDays(planningAnchor, lastInteraction);
                if (daysBetween < 12) return false; // Too soon even for next week
            }

            return true;
        }).map(store => ({ ...store, lastScore: getLastAuditScore(store.id) }));

        // 3. Re-Audit Candidates (Second Visit)
        // Eligible if: 1 audit/schedule this month, not yet maxed out (< 2),
        // AND 12 days will have passed by planningAnchor.
        const reAuditCandidates = stores.filter(store => {
            const thisMonthAudits = audits.filter(a =>
                a.storeId === store.id &&
                a.createdAt >= currentMonthStart &&
                a.createdAt <= currentMonthEnd
            );
            const thisMonthSchedule = schedule.filter(s =>
                s.storeId === store.id &&
                s.date >= currentMonthStart &&
                s.date <= currentMonthEnd
            );

            const totalInteractions = thisMonthAudits.length + thisMonthSchedule.length;
            if (totalInteractions === 0) return false; // → monthlyMissing
            if (totalInteractions >= 2) return false;  // Already maxed out

            // Latest interaction date
            const allDates = [
                ...thisMonthAudits.map(a => a.createdAt),
                ...thisMonthSchedule.map(s => s.date)
            ].sort((a, b) => b.getTime() - a.getTime());

            const lastInteractionDate = allDates[0];
            if (!lastInteractionDate) return false;

            // 12-day rule measured from planningAnchor (next Monday), not today
            const daysSinceLastByPlanningDate = differenceInDays(planningAnchor, lastInteractionDate);
            return daysSinceLastByPlanningDate >= 12;

        }).map(store => {
            const lastScore = getLastAuditScore(store.id);
            // Find last interaction date for sorting by proximity
            const lastAuditDate = audits
                .filter(a => a.storeId === store.id && a.createdAt >= currentMonthStart)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;
            const lastScheduleDate = schedule
                .filter(s => s.storeId === store.id && s.date >= currentMonthStart)
                .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date;
            const lastInteraction = lastAuditDate && lastScheduleDate
                ? (lastAuditDate > lastScheduleDate ? lastAuditDate : lastScheduleDate)
                : (lastAuditDate || lastScheduleDate);
            const daysSince = lastInteraction ? differenceInDays(planningAnchor, lastInteraction) : 999;
            return { ...store, lastScore, _daysSince: daysSince };
        })
        // Sort: most days elapsed first (closest to overdue) → then lowest score
        .sort((a, b) => {
            if (b._daysSince !== a._daysSince) return b._daysSince - a._daysSince;
            return (a.lastScore || 100) - (b.lastScore || 100);
        });

        // --- Capacity-aware merge ---
        // Slots needed = totalCapacity
        // If firstAuditCount < totalCapacity → fill remaining with reAuditCandidates
        const firstAuditPool = [...monthlyMissing, ...newReady];
        const firstAuditCount = firstAuditPool.length;
        const remainingSlots = Math.max(0, totalCapacity - firstAuditCount);
        // Only take as many re-audit candidates as there are remaining slots
        const trimmedReAudit = reAuditCandidates.slice(0, remainingSlots);

        setSuggestions({
            monthlyMissing,
            newReady,
            reAuditCandidates: trimmedReAudit
        });

    }, [stores, audits, schedule, currentDate, loading, auditors]);

    const handlePreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    // Calculate current view's status (Moved up for availability in handlers)
    const currentWeekItems = schedule.filter(item => {
        const itemDate = item.date;
        const weekStart = weekDays[0];
        const weekEnd = weekDays[weekDays.length - 1];
        return itemDate >= startOfDay(weekStart) && itemDate <= startOfDay(weekEnd);
    });

    const isWeekPublished = currentWeekItems.length > 0 && currentWeekItems.every(i => i.status === 'published');



    const handleAddStore = async (auditorId: string, date: Date, storeId: string, storeName: string, accommodationTypeId?: string | null) => {
        // Validation: Max 2 real items per cell
        const existingItemsInCell = schedule.filter(s =>
            s.auditorId === auditorId &&
            isSameDay(s.date, date) &&
            s.type !== 'blocked'
        );

        if (existingItemsInCell.length >= 2) {
            toast.error("Bir güne en fazla 2 mağaza/işlem eklenebilir.");
            return;
        }

        // --- NEW: Live Publish Logic ---
        // If the *week* (or explicit context) is published, new items must be published too.
        // We use 'isWeekPublished' derived from the visual state.
        const status = isWeekPublished ? 'published' : 'draft';

        const id = generateUUID();
        const newItem: ScheduleItem = {
            id,
            auditorId,
            storeId,
            storeName,
            date: startOfDay(date),
            status: status, // Dynamic Status
            type: 'audit',
            accommodationTypeId: accommodationTypeId || null
        };

        // Optimistic UI
        setSchedule(prev => [...prev, newItem]);

        try {
            await setDoc(doc(db, "audit_schedules", id), {
                ...newItem,
                date: Timestamp.fromDate(newItem.date)
            });
            if (status === 'published') toast.success("Mağaza plana eklendi (Yayında)");
        } catch (error) {
            console.error("Error adding schedule item:", error);
            setSchedule(prev => prev.filter(i => i.id !== id));
        }
    };

    const handleAddLeave = async (auditorId: string, date: Date, leaveType: LeaveType) => {
        // ... (Existing deletion logic)
        try {
            // (Same clean logic as before)
            const existingItemsInCell = schedule.filter(s =>
                s.auditorId === auditorId &&
                isSameDay(s.date, date)
            );

            for (const item of existingItemsInCell) {
                if (item.id && !item.id.includes('virtual___')) {
                    await deleteDoc(doc(db, "audit_schedules", item.id));
                }
            }

        } catch (e) {
            console.error("Error clearing existing items:", e);
        }

        // Live Publish Check
        const status = isWeekPublished ? 'published' : 'draft';

        // 2. Add the NEW leave item
        const id = generateUUID();
        const newItem: ScheduleItem = {
            id,
            auditorId,
            // storeId: "", // Not used for leave
            storeName: leaveType.name,
            date: startOfDay(date),
            status: status, // Dynamic Status
            type: 'leave',
            leaveTypeId: leaveType.id,
            leaveColor: leaveType.color
        };

        // Optimistic UI
        setSchedule(prev => [...prev.filter(s => !(s.auditorId === auditorId && isSameDay(s.date, date))), newItem]);

        try {
            await setDoc(doc(db, "audit_schedules", id), {
                ...newItem,
                date: Timestamp.fromDate(newItem.date)
            });
            if (status === 'published') toast.success("İzin plana eklendi (Yayında)");
        } catch (error) {
            console.error("Error adding leave item:", error);
            setSchedule(prev => prev.filter(i => i.id !== id));
        }
    };


    const handleRemoveStore = async (itemId: string) => {
        // Handle Virtual Default Leave Deletion (by creating a 'blocked' item)
        if (itemId.startsWith('virtual___')) {
            const parts = itemId.split('___');
            const audId = parts[1];
            const dateStr = parts[2];
            const blockedId = generateUUID();

            const blockedItem: ScheduleItem = {
                id: blockedId,
                auditorId: audId,
                date: new Date(dateStr),
                storeName: 'BLOCKED',
                status: 'draft',
                type: 'blocked'
            };

            setSchedule(prev => [...prev, blockedItem]);

            try {
                await setDoc(doc(db, "audit_schedules", blockedId), {
                    ...blockedItem,
                    date: Timestamp.fromDate(blockedItem.date),
                    type: 'blocked'
                });
                // toast.success("Varsayılan izin bu gün için kaldırıldı.");
            } catch (error) {
                console.error("Error creating blocked item:", error);
                setSchedule(prev => prev.filter(i => i.id !== blockedId)); // Revert
            }
            return;
        }

        // Handle Real Item Deletion
        const itemToRemove = schedule.find(i => i.id === itemId);
        if (!itemToRemove) return;

        // Optimistic Delete
        setSchedule(prev => prev.filter(item => item.id !== itemId));

        try {
            await deleteDoc(doc(db, "audit_schedules", itemId));


            const dayOfWeek = itemToRemove.date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=Sun, 6=Sat

            // Check if there is already a blocked item for this cell
            const cellAlreadyHasBlocked = schedule.some(i =>
                i.auditorId === itemToRemove.auditorId &&
                isSameDay(i.date, itemToRemove.date) &&
                i.type === 'blocked' &&
                i.id !== itemId
            );

            if (isWeekend && !cellAlreadyHasBlocked) {
                // Check if any OTHER items remain for this auditor/date? 
                // Since we just optimistically filtered, we check the *new* state relative to that cell.
                // Or simpler: Just always block. If there's another item, the block is fine (invisible usually).
                // But let's be cleaner: Create block only.

                const blockedId = generateUUID();
                const blockedItem: ScheduleItem = {
                    id: blockedId,
                    auditorId: itemToRemove.auditorId,
                    date: itemToRemove.date,
                    storeName: 'BLOCKED',
                    status: 'draft',
                    type: 'blocked'
                };

                // Add block to UI
                setSchedule(prev => [...prev, blockedItem]);

                // Add block to DB
                await setDoc(doc(db, "audit_schedules", blockedId), {
                    ...blockedItem,
                    date: Timestamp.fromDate(blockedItem.date),
                    type: 'blocked'
                });
            }

        } catch (error) {
            console.error("Delete error:", error);
            setSchedule(prev => [...prev, itemToRemove]); // Revert delete
        }
    };


    const handleRemoveStoreV2 = async (itemId: string) => {
        // Handle Virtual Default Leave Deletion
        if (itemId.startsWith('virtual___')) {
            const parts = itemId.split('___');
            const audId = parts[1];
            const dateStr = parts[2];
            const blockedId = generateUUID();

            const blockedItem: ScheduleItem = {
                id: blockedId,
                auditorId: audId,
                date: new Date(dateStr),
                storeName: 'BLOCKED',
                status: 'draft',
                type: 'blocked'
            };

            setSchedule(prev => [...prev, blockedItem]);

            try {
                await setDoc(doc(db, "audit_schedules", blockedId), {
                    ...blockedItem,
                    date: Timestamp.fromDate(blockedItem.date),
                    type: 'blocked'
                });
            } catch (error) {
                console.error("Error creating blocked item:", error);
                setSchedule(prev => prev.filter(i => i.id !== blockedId));
            }
            return;
        }

        // Handle Real Item Deletion
        const itemToRemove = schedule.find(i => i.id === itemId);
        if (!itemToRemove) return;

        // Prepare Blocking Logic (Atomic)
        const dayOfWeek = itemToRemove.date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let blockedItem: ScheduleItem | undefined;
        let blockedId: string | undefined;

        // Check if there is already a blocked item for this cell
        const cellAlreadyHasBlocked = schedule.some(i =>
            i.auditorId === itemToRemove.auditorId &&
            isSameDay(i.date, itemToRemove.date) &&
            i.type === 'blocked' &&
            i.id !== itemId
        );

        if (isWeekend && !cellAlreadyHasBlocked) {
            blockedId = generateUUID();
            blockedItem = {
                id: blockedId,
                auditorId: itemToRemove.auditorId,
                date: itemToRemove.date,
                storeName: 'BLOCKED',
                status: itemToRemove.status, // Inherit status (keep published if it was published)
                type: 'blocked'
            };
        }

        // ATOMIC UI UPDATE: Swap item with block (if needed) in one go
        setSchedule(prev => {
            const filtered = prev.filter(item => item.id !== itemId);
            if (blockedItem) {
                return [...filtered, blockedItem];
            }
            return filtered;
        });

        try {
            await deleteDoc(doc(db, "audit_schedules", itemId));

            if (blockedItem && blockedId) {
                await setDoc(doc(db, "audit_schedules", blockedId), {
                    ...blockedItem,
                    date: Timestamp.fromDate(blockedItem.date),
                    type: 'blocked'
                });
            }
        } catch (error) {
            console.error("Delete error:", error);
            // Revert UI if DB fails
            setSchedule(prev => {
                let finalState = prev;
                if (blockedId) {
                    finalState = finalState.filter(i => i.id !== blockedId);
                }
                return [...finalState, itemToRemove];
            });
        }
    };

    // --- Violation Check Helper ---
    const getViolation = (item: ScheduleItem) => {
        if (item.type === 'leave' || !item.storeId) return null;
        const errors: string[] = [];
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

        // 1. Same Week Duplicate Check
        const hasDuplicate = schedule.some(s =>
            s.id !== item.id &&
            s.storeId === item.storeId &&
            s.date >= weekStart &&
            s.date <= weekEnd
        );

        if (hasDuplicate) errors.push("Bu mağaza bu hafta zaten planlanmış!");

        // 2. Frequency Limit Check (Max 2 per month)
        // Published items are already finalized — no need to flag them.
        if (item.status === 'published') return errors.length > 0 ? errors.map(e => `• ${e}`).join('\n\n') : null;
        const itemMonthStart = startOfMonth(item.date);
        const itemMonthEnd = endOfMonth(item.date);

        const monthlyAuditsList = audits.filter(a =>
            a.storeId === item.storeId &&
            a.createdAt >= itemMonthStart &&
            a.createdAt <= itemMonthEnd &&
            a.status === 'tamamlandi'
        );

        // Only count DRAFT schedule items — published ones are already reflected
        // in the audits collection as completed audits, so counting them here
        // would cause double-counting (e.g., 2 completed + 1 published plan = false 3).
        const monthlyScheduleList = schedule.filter(s =>
            s.id !== item.id &&
            s.storeId === item.storeId &&
            s.date >= itemMonthStart &&
            s.date <= itemMonthEnd &&
            s.status !== 'published' &&
            s.type === 'audit'
        );

        if ((monthlyAuditsList.length + monthlyScheduleList.length + 1) > 2) {
            let errorMsg = "Ayda en fazla 2 denetim limiti aşıldı!\n";

            // List Completed Audits
            if (monthlyAuditsList.length > 0) {
                errorMsg += "\nTamamlananlar:\n";
                monthlyAuditsList.forEach(a => {
                    // Try to find auditor name if not in audit object (though audit usually has it, fallback to lookup)
                    let auditorName = a.auditorName || "Bilinmiyor";
                    if (!a.auditorName && a.auditorId) {
                        const aud = auditors.find(u => u.uid === a.auditorId);
                        if (aud) auditorName = `${aud.firstName} ${aud.lastName}`;
                    }
                    errorMsg += `• ${format(a.createdAt, 'dd.MM.yyyy')} - ${auditorName}\n`;
                });
            }

            // List Scheduled Items
            if (monthlyScheduleList.length > 0) {
                errorMsg += "\nPlanlananlar:\n";
                monthlyScheduleList.forEach(s => {
                    const aud = auditors.find(u => u.uid === s.auditorId);
                    const auditorName = aud ? `${aud.firstName || ''} ${aud.lastName || ''}`.trim() || aud.email || "Bilinmiyor" : "Bilinmiyor";
                    errorMsg += `• ${format(s.date, 'dd.MM.yyyy')} - ${auditorName}\n`;
                });
            }

            // Total Count
            const total = monthlyAuditsList.length + monthlyScheduleList.length;
            errorMsg += `\nToplam: ${total} (Mevcut) + 1 (Yeni) = ${total + 1}`;

            errors.push(errorMsg);
        }

        // 3. 12-Day Rule Check
        const allDates = [
            ...audits.filter(a => a.storeId === item.storeId && a.status === 'tamamlandi').map(a => a.createdAt),
            ...schedule.filter(s => s.storeId === item.storeId && s.id !== item.id).map(s => s.date)
        ];

        for (const date of allDates) {
            if (isSameDay(date, item.date)) continue;

            const diffTime = Math.abs(item.date.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 12) {
                errors.push(`12 Gün Kuralı İhlali! (En yakın: ${format(date, 'dd.MM.yyyy')})`);
                break; // Only report one 12-day violation to avoid spam
            }
        }

        const normalizeDayName = (name: string) => {
            return name.toLocaleLowerCase('tr').trim()
                .replace('ı', 'i')
                .replace('ş', 's')
                .replace('ğ', 'g')
                .replace('ü', 'u')
                .replace('ö', 'o')
                .replace('ç', 'c');
        };

        // 4. Shipment Day Check
        const store = stores.find(s => s.id === item.storeId);
        if (store && store.shipmentDay && store.shipmentTime) {
            const scheduledDayName = format(item.date, 'EEEE', { locale: tr });
            const prevDayDate = subDays(item.date, 1);
            const prevDayName = format(prevDayDate, 'EEEE', { locale: tr });

            const shipmentDayName = store.shipmentDay;
            const shipmentHour = parseInt(store.shipmentTime.split(':')[0]);

            const normScheduled = normalizeDayName(scheduledDayName);
            const normPrev = normalizeDayName(prevDayName);
            const normShipment = normalizeDayName(shipmentDayName);

            // Scenario A: Late Shipment (>= 18:00)
            if (shipmentHour >= 18) {
                if (normPrev === normShipment) {
                    errors.push(`Sevkiyat Sonrası Günü İhlali! (Dün ${store.shipmentTime} sevkiyatı vardı, bugün yoğun)`);
                }
            }
            // Scenario B: Early Shipment (< 18:00)
            else {
                if (normScheduled === normShipment) {
                    errors.push(`Sevkiyat Günü İhlali! (Bugün ${store.shipmentTime} sevkiyatı var, mağaza yoğun)`);
                }
            }
        }

        return errors.length > 0 ? errors.map(e => `• ${e}`).join("\n\n") : null;
    };




    const hasItems = currentWeekItems.length > 0;

    // Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        type: 'publish' | 'unpublish';
        violations: string[];
    }>({ open: false, type: 'publish', violations: [] });

    const handleTogglePublish = async () => {
        if (!hasItems) return;

        const actionType = isWeekPublished ? 'unpublish' : 'publish';

        // 1. Validation Check (Only for Publish)
        const violations: string[] = [];
        if (actionType === 'publish') {
            // 1. Existing Violation Checks
            currentWeekItems.forEach(item => {
                const violation = getViolation(item);
                if (violation) {
                    // split newlines if multiple errors per item
                    const msgs = violation.split('\n\n').map(v => v.replace('• ', '').trim());
                    violations.push(...msgs.map(m => `${item.storeName}: ${m}`));
                }
            });

            // 2. Empty Day Check (New)
            // Iterate all auditors and all days in the view
            auditors.forEach(auditor => {
                weekDays.forEach(date => {
                    // Check if this auditor has ANY item (store, leave, or blocked) on this date
                    const hasItem = currentWeekItems.some(item =>
                        item.auditorId === auditor.uid &&
                        isSameDay(item.date, date)
                    );

                    if (!hasItem) {
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        if (!isWeekend) {
                            const dayName = format(date, "EEEE", { locale: tr });
                            const dateStr = format(date, "dd MMMM", { locale: tr });
                            violations.push(`${auditor.firstName} ${auditor.lastName}: ${dateStr} (${dayName}) için hiçbir atama yapılmamış.`);
                        }
                    }
                });
            });
        }

        // 2. Open Confirmation Dialog
        setConfirmDialog({
            open: true,
            type: actionType,
            violations: [...new Set(violations)] // Deduplicate messages
        });
    };

    const isPublishingRef = useRef(false);

    const executePublishAction = async () => {
        if (isPublishingRef.current) return;
        isPublishingRef.current = true;
        setSaving(true);

        const newStatus: 'published' | 'draft' = confirmDialog.type === 'publish' ? 'published' : 'draft';

        try {
            // 1. Update existing items
            const batchPromises = currentWeekItems.map(async (item) => {
                const docRef = doc(db, "audit_schedules", item.id);
                await setDoc(docRef, { status: newStatus }, { merge: true });
            });

            // 2. Insert missing weekend holidays (ONLY if publishing)
            const newGeneratedItems: ScheduleItem[] = [];

            if (newStatus === 'published') {
                const defaultLeave = leaveTypes.find(t => t.isDefault);

                if (defaultLeave) {
                    for (const auditor of auditors) {
                        for (const date of weekDays) {
                            // Check if weekend
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            if (!isWeekend) continue;

                            // Check collision with EXISTING items (not virtual ones)
                            // We need real items from schedule state
                            const rawItems = schedule.filter(item =>
                                item.auditorId === auditor.uid && isSameDay(item.date, date)
                            );
                            const hasBlocked = rawItems.some(i => i.type === 'blocked');

                            // If empty and weekend, create item
                            if (rawItems.length === 0 && !hasBlocked) {
                                // Deterministic ID to prevent duplication (Double-Click or Race Condition Protection)
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const id = `auto_leave_${auditor.uid}_${dateKey}`;

                                const newItem: ScheduleItem = {
                                    id,
                                    auditorId: auditor.uid,
                                    date: startOfDay(date),
                                    storeName: defaultLeave.name,
                                    status: 'published',
                                    type: 'leave',
                                    leaveTypeId: defaultLeave.id,
                                    leaveColor: defaultLeave.color
                                };

                                newGeneratedItems.push(newItem);
                                batchPromises.push(
                                    setDoc(doc(db, "audit_schedules", id), {
                                        ...newItem,
                                        date: Timestamp.fromDate(newItem.date)
                                    })
                                );
                            }
                        }
                    }
                }
            }

            await Promise.all(batchPromises);

            setSchedule(prev => {
                const updatedExisting = prev.map(item =>
                    (currentWeekItems.find(w => w.id === item.id))
                        ? { ...item, status: newStatus }
                        : item
                );

                // Filter out any duplicates from newGeneratedItems just in case they already exist in prev
                // (Though deterministic ID + setDoc handles DB, we need to handle UI properly)
                const uniqueNewItems = newGeneratedItems.filter(newItem =>
                    !updatedExisting.some(existing => existing.id === newItem.id)
                );

                return [...updatedExisting, ...uniqueNewItems];
            });
        } catch (error) {
            console.error("Publish error:", error);
        } finally {
            setSaving(false);
            isPublishingRef.current = false;
            setConfirmDialog(prev => ({ ...prev, open: false }));
        }
    };

    const getItemsForCell = (auditorId: string, date: Date) => {
        return schedule.filter(item =>
            item.auditorId === auditorId && isSameDay(item.date, date)
        );
    };

    const handleUpdateScheduleItem = async (itemId: string, updates: Partial<ScheduleItem>) => {
        // If updating accommodation, we need to sync it with ALL items on the same day for this auditor
        if ('accommodationTypeId' in updates) {
            const currentItem = schedule.find(i => i.id === itemId);
            if (currentItem) {
                // Find all sibling items (same auditor, same day)
                const siblingItems = schedule.filter(i =>
                    i.auditorId === currentItem.auditorId &&
                    isSameDay(i.date, currentItem.date)
                );

                // Optimistic Update for ALL siblings
                setSchedule(prev => prev.map(item =>
                    (item.auditorId === currentItem.auditorId && isSameDay(item.date, currentItem.date))
                        ? { ...item, ...updates }
                        : item
                ));

                // DB Update for ALL siblings
                try {
                    const batchPromises = siblingItems.map(item => {
                        // Only update if it's a real document (audit or unspecified/legacy)
                        // Ignore 'leave' or 'blocked' virtual types unless explicitly handled
                        if (item.type === 'audit' || !item.type) {
                            const docRef = doc(db, "audit_schedules", item.id);
                            // Use setDoc with merge: true instead of updateDoc for better reliability
                            // This handles 'undefined' better (ignores it) whereas updateDoc throws
                            return setDoc(docRef, updates, { merge: true });
                        }
                        return Promise.resolve();
                    });
                    await Promise.all(batchPromises);
                } catch (error) {
                    console.error("Error syncing accommodation type:", error);
                    toast.error("Konaklama türü güncellenirken hata oluştu.");
                    // Revert (approximated)
                    setSchedule(prev => prev.map(item =>
                        (item.auditorId === currentItem.auditorId && isSameDay(item.date, currentItem.date))
                            ? { ...item, accommodationTypeId: currentItem.accommodationTypeId } // Revert to old value
                            : item
                    ));
                }
                return; // Exit early since we handled everything
            }
        }

        // Standard update for other fields (like note) or if item not found
        setSchedule(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
        try {
            const docRef = doc(db, "audit_schedules", itemId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating schedule item:", error);
        }
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
            await setDoc(doc(db, "audit_schedules", scheduleItem.id), {
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
        <>
        <DndContext onDragStart={isReadOnly ? undefined : handleDragStart} onDragEnd={isReadOnly ? undefined : handleDragEnd} collisionDetection={pointerWithin}>
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
                                                <Button variant="outline" className="px-5 py-2 min-w-[340px] justify-start text-left text-sm font-semibold border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex gap-2">
                                                    <CalendarIcon className="h-4 w-4 text-slate-500" />
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-700 uppercase">
                                                            {format(currentDate, "MMMM yyyy", { locale: tr })}
                                                        </span>
                                                        {viewMode === 'week' && (
                                                            <>
                                                                <span className="text-slate-300">|</span>
                                                                <span className="font-semibold text-slate-700 uppercase">
                                                                    {getISOWeek(currentDate)}. HAFTA
                                                                </span>
                                                                <span className="text-slate-500 text-xs">
                                                                    ({format(weekDays[0], "d MMM", { locale: tr })} - {format(weekDays[weekDays.length - 1], "d MMM", { locale: tr })})
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
                                                    "px-8 py-2 text-sm font-semibold rounded-md transition-all",
                                                    viewMode === 'week'
                                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                                                        : "text-slate-500 hover:bg-slate-200/50"
                                                )}
                                            >
                                                HAFTALIK
                                            </button>
                                            <button
                                                onClick={() => setViewMode('month')}
                                                className={cn(
                                                    "px-8 py-2 text-sm font-semibold rounded-md transition-all",
                                                    viewMode === 'month'
                                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                                                        : "text-slate-500 hover:bg-slate-200/50"
                                                )}
                                            >
                                                AYLIK
                                            </button>
                                        </div>
                                    </NavigationMenuItem>

                                    {/* Map Button */}
                                    <NavigationMenuItem>
                                        <button
                                            onClick={() => setMapOpen(true)}
                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-slate-100/50 border border-slate-200 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-all"
                                        >
                                            <MapIcon className="h-4 w-4" />
                                            HARİTA
                                        </button>
                                    </NavigationMenuItem>


                                </NavigationMenuList>
                            </NavigationMenu>

                            <div className="flex items-center gap-3">

                                {viewMode === 'week' && (
                                    <Button
                                        onClick={handleDownloadPDF}
                                        disabled={isGeneratingPDF || !hasItems}
                                        size="sm"
                                        variant="outline"
                                        className="h-9 transition-all bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                    >
                                        {isGeneratingPDF ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="mr-2 h-4 w-4" />
                                        )}
                                        PDF İndir
                                    </Button>
                                )}

                                {!isReadOnly && (
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
                                        {isWeekPublished ? (
                                            <>
                                                <Ban className="mr-2 h-4 w-4" />
                                                Yayından Kaldır
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" />
                                                Yayınla
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto rounded-xl border shadow-sm bg-white/50 backdrop-blur-sm relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            <table id="schedule-export-content" className={cn("w-full h-full border-separate border-spacing-0 text-sm text-left bg-white", viewMode === 'week' ? "table-fixed" : "table-auto min-w-max")}>
                                <thead className="bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40 border-b border-slate-200/60 shadow-sm">
                                    <tr>
                                        <th className="w-[200px] min-w-[200px] p-4 text-left font-bold text-slate-700 tracking-tight text-sm uppercase bg-slate-50/90 backdrop-blur border-b border-slate-200/60 sticky left-0 z-50 align-middle">
                                            <span className="text-slate-900">Denetmen</span>
                                        </th>
                                        {weekDays.map((date, i) => {
                                            const isToday = isSameDay(date, new Date());
                                            return (
                                                <th key={i} className={cn(
                                                    "min-w-[140px] p-0 font-medium text-slate-500 border-b border-slate-200/60 transition-colors uppercase tracking-wider text-xs",
                                                    !isSameDay(date, new Date()) && "hover:bg-slate-50/50",
                                                    isSameDay(date, new Date()) ? "bg-blue-50/40" : ""
                                                )}>
                                                    <div className="flex flex-col items-center justify-center py-4">
                                                        <span className={cn(
                                                            "font-outfit text-sm font-medium mb-1 uppercase tracking-[0.2em]",
                                                            isToday ? "text-blue-600" : "text-slate-400"
                                                        )}>
                                                            {format(date, "EEEE", { locale: tr })}
                                                        </span>

                                                        <span className={cn(
                                                            "font-outfit text-3xl font-bold tracking-tight flex items-center justify-center transition-all duration-300",
                                                            isToday
                                                                ? "w-11 h-11 rounded-full bg-blue-600 text-white shadow-md shadow-blue-200 text-xl"
                                                                : "text-slate-700"
                                                        )}>
                                                            {format(date, "d")}
                                                        </span>
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
                                                <td className="p-3 border-r sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-50 border-slate-100">
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
                                                    const isMonthView = viewMode === 'month';
                                                    const rawItems = getItemsForCell(auditor.uid, date);

                                                    // Default Leave Injection (Virtual)
                                                    let cellItems = rawItems;
                                                    const defaultLeave = leaveTypes.find(t => t.isDefault);
                                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                                    const hasBlocked = rawItems.some(i => i.type === 'blocked');

                                                    // Inject ONLY if: No Real items, No Blocked items, Weekend, Default exists
                                                    if (defaultLeave && isWeekend && rawItems.length === 0 && !hasBlocked && viewMode === 'week') {
                                                        const virtualId = `virtual___${auditor.uid}___${date.toISOString()}`;
                                                        cellItems = [{
                                                            id: virtualId,
                                                            auditorId: auditor.uid,
                                                            date: date,
                                                            storeName: defaultLeave.name,
                                                            status: 'draft',
                                                            type: 'leave',
                                                            leaveTypeId: defaultLeave.id,
                                                            leaveColor: defaultLeave.color
                                                        } as ScheduleItem];
                                                    }

                                                    // Monthly View Rule: Only show PUBLISHED items
                                                    const items = isMonthView
                                                        ? cellItems.filter(i => i.status === 'published')
                                                        : cellItems;

                                                    const isToday = isSameDay(date, new Date());
                                                    const dropId = `${auditor.uid}___${date.toISOString()}`;

                                                    return (
                                                        <DroppableCell
                                                            key={i}
                                                            dropId={dropId}
                                                            isToday={isToday}
                                                            rawItems={items}
                                                            getViolation={getViolation}
                                                            setViolationAlert={setViolationAlert}
                                                            setOpenPopoverId={setOpenPopoverId}
                                                            openPopoverId={openPopoverId}
                                                            handleRemoveStore={handleRemoveStoreV2}
                                                            handleAddStore={handleAddStore}
                                                            stores={stores}
                                                            isWeekPublished={isWeekPublished || isMonthView} // Lock cell in month view
                                                            leaveTypes={leaveTypes}
                                                            handleAddLeave={handleAddLeave}
                                                            isSelected={selectedCells.has(dropId)}
                                                            onCellClick={handleCellClick}
                                                            selectedCells={selectedCells}
                                                            setNoteDialog={setNoteDialog}
                                                            accommodationTypes={accommodationTypes}

                                                            handleUpdateScheduleItem={handleUpdateScheduleItem}
                                                            onStoreAction={handleStoreAction}
                                                            audits={audits}
                                                            isReadOnly={isReadOnly}
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

                {/* Resizer Handle */}
                <div
                    className={cn(
                        "w-4 bg-transparent hover:bg-blue-500/10 cursor-col-resize z-50 flex items-center justify-center transition-colors group/resizer -ml-2 -mr-2 relative rounded-full",
                        isResizing && "bg-blue-500/20"
                    )}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        // Store initial values
                        dragStartRef.current = {
                            x: e.clientX,
                            w: sidebarWidth
                        };
                    }}
                >
                    <div className={cn(
                        "w-1 h-8 rounded-full transition-all duration-200",
                        sidebarWidth === 500
                            ? "bg-emerald-500 h-16 w-2 shadow-[0_0_15px_rgba(16,185,129,0.6)]" // Thicker green bar for better rounding visibility
                            : isResizing
                                ? "bg-blue-600 w-1.5 h-12"
                                : "bg-slate-300 group-hover/resizer:bg-blue-400"
                    )} />
                </div>

                {/* Right: Suggestions Sidebar (Resizable) */}
                <Card
                    className="min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900 border overflow-hidden shrink-0 lg:border-l shadow-2xl z-10 transition-[width] duration-0 will-change-[width]"
                    style={{ width: sidebarWidth }}
                >
                    {/* Suggestions Sidebar - Redesigned with Tabs */}
                    <div className="flex flex-col h-full w-full bg-white">

                        <Tabs defaultValue="akilli" className="flex flex-col h-full">
                            {/* AI Schedule Button */}
                            <div className="px-3 pt-2 pb-0 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 bg-indigo-50/50"
                                    onClick={() => setAiScheduleOpen(true)}
                                >
                                    <Brain className="h-3.5 w-3.5" />
                                    Rota Bazlı Haftalık Program
                                </Button>
                            </div>
                            {/* Custom Header */}
                            <div className="h-[55px] flex items-start justify-center pt-1.5 px-4 border-b bg-slate-50/50 shrink-0">
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
                                    <TabsTrigger
                                        value="waiting_visits"
                                        className="flex-1 h-full px-4 text-sm font-semibold rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-200/50"
                                    >
                                        Ziyaret Bekleyenler
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Tab 1: Akıllı Öneri */}
                            <TabsContent value="akilli" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                                <StoresTableHeader />
                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                        // Combine all suggestions for Smart tab
                                        // Improved logic: Concatenate pre-sorted lists relative to priority
                                        // Priority 1: Monthly Missing (Alphabetical)
                                        const targets = suggestions.monthlyMissing
                                            .map(s => ({ ...s, suggestionType: 'target' as const }))
                                            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

                                        // Priority 2: New Ready (Alphabetical)
                                        const newStores = suggestions.newReady
                                            .map(s => ({ ...s, suggestionType: 'new' as const }))
                                            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

                                        // Priority 3: Re-Audit Candidates (Score Ascending - Already sorted in effect, but ensuring here)
                                        const repeats = suggestions.reAuditCandidates
                                            .map(s => ({ ...s, suggestionType: 'repeat' as const }))
                                            .sort((a, b) => (a.lastScore || 100) - (b.lastScore || 100));

                                        // Combine: If Targets exist, show them. Repeats are secondary.
                                        const sorted = [...targets, ...newStores, ...repeats];

                                        if (sorted.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center text-muted-foreground py-8 h-full">
                                                    <div className="text-4xl mb-2">🎉</div>
                                                    <p className="text-center text-xs px-4">Harika! Tüm akıllı öneriler tamamlandı.</p>
                                                </div>
                                            );
                                        }

                                        // Group by City
                                        const grouped = sorted.reduce((acc, store) => {
                                            const city = store.city || "Diğer";
                                            if (!acc[city]) acc[city] = [];
                                            acc[city].push(store);
                                            return acc;
                                        }, {} as Record<string, typeof sorted>);

                                        // Sort Cities
                                        const cities = Object.keys(grouped).sort((a, b) => {
                                            if (a === "Diğer") return 1;
                                            if (b === "Diğer") return -1;
                                            return a.localeCompare(b, 'tr');
                                        });

                                        return cities.map(city => (
                                            <div key={city}>
                                                <div className="bg-slate-800/95 backdrop-blur-sm px-3 py-2 text-xs font-bold text-white border-b border-slate-700/50 sticky top-0 z-20 uppercase tracking-widest flex justify-center items-center shadow-md gap-2">
                                                    <span>{city}</span>
                                                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full min-w-[20px] text-center">{grouped[city].length}</span>
                                                </div>
                                                {grouped[city].map((store, index) => (
                                                    <DraggableStoreRow
                                                        key={`${store.suggestionType}-${store.id}-${index}`}
                                                        store={store}
                                                        auditInfo={getStoreAuditInfo(store.id)}
                                                        index={index}
                                                        disabled={isWeekPublished}
                                                        onInfoClick={(id, name) => setHistoryDialogState({ open: true, storeId: id, storeName: name })}
                                                    />
                                                ))}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </TabsContent>

                            {/* Tab 2: Standart Öneri */}
                            <TabsContent value="standart" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                                <StoresTableHeader />
                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                        // 1. Group by City
                                        const grouped = stores.reduce((acc, store) => {
                                            const city = store.city || "Diğer";
                                            if (!acc[city]) acc[city] = [];
                                            acc[city].push(store);
                                            return acc;
                                        }, {} as Record<string, typeof stores>);

                                        // 2. Sort Cities
                                        const cities = Object.keys(grouped).sort((a, b) => {
                                            if (a === "Diğer") return 1;
                                            if (b === "Diğer") return -1;
                                            return a.localeCompare(b, 'tr');
                                        });

                                        // 3. Render Groups
                                        return cities.map(city => (
                                            <div key={city}>
                                                <div className="bg-slate-800/95 backdrop-blur-sm px-3 py-2 text-xs font-bold text-white border-b border-slate-700/50 sticky top-0 z-20 uppercase tracking-widest flex justify-center items-center shadow-md gap-2">
                                                    <span>{city}</span>
                                                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full min-w-[20px] text-center">{grouped[city].length}</span>
                                                </div>
                                                {grouped[city].map((store, index) => {
                                                    const suggestionItem = { ...store, suggestionType: 'target' as const };
                                                    return (
                                                        <DraggableStoreRow
                                                            key={`std-${store.id}-${index}`}
                                                            store={suggestionItem}
                                                            auditInfo={getStoreAuditInfo(store.id)}
                                                            index={index}
                                                            disabled={isWeekPublished}
                                                            scheduledDate={getScheduledDateInMonth(store.id)}
                                                            onInfoClick={(id, name) => setHistoryDialogState({ open: true, storeId: id, storeName: name })}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </TabsContent>

                            {/* Tab 3: Ziyaret Bekleyenler */}
                            <TabsContent value="waiting_visits" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                                <StoresTableHeader />
                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                        // Combine Monthly Missing + New Ready
                                        const missing = [...suggestions.monthlyMissing, ...suggestions.newReady]
                                            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

                                        if (missing.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center text-muted-foreground py-8 h-full">
                                                    <div className="text-4xl mb-2">🎉</div>
                                                    <p className="text-center text-xs px-4">Bu ay için tüm ilk ziyaretler tamamlandı veya planlandı.</p>
                                                </div>
                                            );
                                        }

                                        // 1. Group by City
                                        const grouped = missing.reduce((acc, store) => {
                                            const city = store.city || "Diğer";
                                            if (!acc[city]) acc[city] = [];
                                            acc[city].push(store);
                                            return acc;
                                        }, {} as Record<string, typeof missing>);

                                        // 2. Sort Cities
                                        const cities = Object.keys(grouped).sort((a, b) => {
                                            if (a === "Diğer") return 1;
                                            if (b === "Diğer") return -1;
                                            return a.localeCompare(b, 'tr');
                                        });

                                        // 3. Render Groups
                                        return cities.map(city => (
                                            <div key={city}>
                                                <div className="bg-slate-800/95 backdrop-blur-sm px-3 py-2 text-xs font-bold text-white border-b border-slate-700/50 sticky top-0 z-20 uppercase tracking-widest flex justify-center items-center shadow-md gap-2">
                                                    <span>{city}</span>
                                                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full min-w-[20px] text-center">{grouped[city].length}</span>
                                                </div>
                                                {grouped[city].map((store, index) => {
                                                    // Map to 'target' type for visuals since they are priority
                                                    const suggestionItem = { ...store, suggestionType: 'target' as const };
                                                    return (
                                                        <DraggableStoreRow
                                                            key={`wait-${store.id}-${index}`}
                                                            store={suggestionItem}
                                                            auditInfo={getStoreAuditInfo(store.id)}
                                                            index={index}
                                                            disabled={isWeekPublished}
                                                            scheduledDate={getScheduledDateInMonth(store.id)}
                                                            onInfoClick={(id, name) => setHistoryDialogState({ open: true, storeId: id, storeName: name })}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()}
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
                            <AlertDialogDescription className="text-slate-700 dark:text-slate-300 font-medium mt-2 whitespace-pre-wrap">
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

                {/* Confirm Publish/Unpublish Dialog */}
                <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
                    <AlertDialogContent className="max-w-[500px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className={cn("text-xl flex items-center gap-2", confirmDialog.type === 'publish' ? "text-slate-900" : "text-red-600")}>
                                {confirmDialog.type === 'publish' ? (
                                    <>
                                        <div className="p-2 bg-blue-100 rounded-full"><Sparkles className="h-5 w-5 text-blue-600" /></div>
                                        {getISOWeek(currentDate)}. Hafta Programını Yayınla
                                    </>
                                ) : (
                                    <>
                                        <div className="p-2 bg-red-100 rounded-full"><CalendarIcon className="h-5 w-5 text-red-600" /></div>
                                        Yayından Kaldır
                                    </>
                                )}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-600 mt-2" asChild>
                                <div>
                                    {confirmDialog.violations.length > 0 ? (
                                        <div className="bg-red-50 border border-red-100 rounded-md p-3 mb-4">
                                            <div className="font-bold text-red-800 mb-2 flex items-center gap-2">
                                                <span className="flex h-2 w-2 rounded-full bg-red-600" />
                                                Tespit Edilen Kural Hataları:
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-red-200">
                                                {confirmDialog.violations.map((err, idx) => (
                                                    <div key={idx} className="text-xs text-red-700 bg-white/50 p-1.5 rounded border border-red-100/50">
                                                        • {err}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-xs text-red-600 mt-3 font-medium">
                                                Hatalara rağmen yayınlamak istiyor musunuz?
                                            </p>
                                        </div>
                                    ) : (
                                        <p>
                                            {confirmDialog.type === 'publish' ? (
                                                `Bu haftanın (${getISOWeek(currentDate)}. Hafta) programını tüm denetmenler için yayınlamak üzeresiniz. Onayladıktan sonra program herkes tarafından görünür olacaktır.`
                                            ) : (
                                                "DİKKAT! Yayınlanmış bir programı taslağa çekmek üzeresiniz. Erişim kısıtlanacak ve denetmenler programı göremeyecektir."
                                            )}
                                        </p>
                                    )}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-4 sm:space-x-4">
                            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                                İptal
                            </Button>
                            <Button
                                onClick={executePublishAction}
                                className={cn(
                                    confirmDialog.type === 'publish' ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700",
                                    "text-white"
                                )}
                            >
                                {confirmDialog.type === 'publish' ? "Evet, Yayınla" : "Evet, Kaldır"}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Note Dialog */}
                <Dialog open={noteDialog.open} onOpenChange={(open) => setNoteDialog(prev => ({ ...prev, open }))}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <StickyNote className="h-5 w-5 text-blue-600" />
                                Not Ekle / Düzenle
                            </DialogTitle>
                            <DialogDescription>
                                Bu planlama için bir not ekleyin. (Örn: Araç ile gidilecek)
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Textarea
                                id="note"
                                placeholder="Notunuzu buraya yazın..."
                                value={noteDialog.note}
                                onChange={(e) => setNoteDialog(prev => ({ ...prev, note: e.target.value }))}
                                className="col-span-3 min-h-[100px]"
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSaveNote} className="bg-blue-600 hover:bg-blue-700 text-white">Kaydet</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>



                {/* Audit History Dialog */}
                <StoreAuditHistoryDialog
                    open={historyDialogState.open}
                    onOpenChange={(open) => setHistoryDialogState(prev => ({ ...prev, open }))}
                    storeId={historyDialogState.storeId}
                    storeName={historyDialogState.storeName}
                    auditors={auditors}
                />
            </div >

            <StoreSelectorDialog
                open={storeSelector.open}
                onOpenChange={(open) => setStoreSelector(prev => ({ ...prev, open }))}
                title={storeSelector.mode === 'add' ? "Mağaza Ekle" : (storeSelector.mode === 'change' ? "Mağazayı Değiştir" : "Mağaza Ata")}
                stores={stores}
                onConfirm={handleStoreSelectConfirm}
            />

            {/* Drag Overlay - Shows dragged item above everything */}
            < DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]} >
                {activeId ? (() => {
                    // Find the store being dragged
                    const storeId = activeId!.replace('store-', '');
                    const store = stores.find(s => s.id === storeId);

                    if (!store) return null;

                    // Determine suggestion type for styling match (optional, but good for consistency)
                    let suggestionType: 'target' | 'repeat' | 'new' = 'target';
                    if (suggestions.reAuditCandidates.some(s => s.id === storeId)) suggestionType = 'repeat';
                    if (suggestions.newReady.some(s => s.id === storeId)) suggestionType = 'new';

                    const draggedStore = { ...store, suggestionType } as SuggestionItem;

                    // Render preview - Match Calendar Item Style Exactly
                    // Calendar item classes: "text-xs px-1.5 py-0.5 rounded border shadow-sm select-none transition-all relative flex items-center justify-between flex-1 min-h-0 cursor-pointer"
                    let bgClass = "bg-white border-slate-300 text-slate-700 font-medium";
                    // Removed dynamic coloring for drag preview to match "Draft" state consistency
                    // if (draggedStore.suggestionType === 'repeat') bgClass = "bg-red-50 border-red-200 text-red-700 font-medium";
                    // if (draggedStore.suggestionType === 'new') bgClass = "bg-blue-50 border-blue-200 text-blue-700 font-medium";

                    return (
                        <div className={cn(
                            "text-xs px-1.5 py-0.5 rounded border shadow-sm select-none flex items-center justify-center text-center cursor-grabbing w-[110px] h-[30px]",
                            bgClass
                        )}>
                            <span className="truncate w-full block font-medium leading-tight uppercase">{draggedStore.name}</span>
                        </div>
                    );
                })() : null}
            </DragOverlay >
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
                strategy="lazyOnload"
            />
        </DndContext >

        <ScheduleMapModal
            open={mapOpen}
            onClose={() => setMapOpen(false)}
            stores={stores}
            auditors={auditors}
            schedule={schedule}
            audits={audits}
            currentDate={currentDate}
            accommodationTypes={accommodationTypes}
        />

        <AiScheduleDialog
            open={aiScheduleOpen}
            onOpenChange={setAiScheduleOpen}
            auditors={auditors}
            stores={stores}
            audits={audits}
            schedule={schedule}
            currentDate={currentDate}
        />
    </>
    );
}
