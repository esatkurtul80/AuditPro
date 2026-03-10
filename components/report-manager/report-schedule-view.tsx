"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay,
    addWeeks, subWeeks, startOfMonth, endOfMonth,
    addMonths, subMonths, getISOWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/lib/types";

interface ScheduleItem {
    id: string;
    auditorId: string;
    storeId?: string;
    storeName: string;
    date: Date;
    status: "draft" | "published";
    type?: "audit" | "leave" | "blocked";
    leaveTypeId?: string;
    leaveColor?: string;
    note?: string;
}

type ViewMode = "haftalik" | "aylik";

/** "HAFTALIK TATİL" → "H.T." — for mobile only */
function abbreviate(name: string): string {
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).join(".") + ".";
}

export function ReportScheduleView({ defaultView = "haftalik" }: { defaultView?: ViewMode }) {
    const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [auditors, setAuditors] = useState<UserProfile[]>([]);
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekNum = getISOWeek(currentDate);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    useEffect(() => {
        getDocs(query(collection(db, "users"), where("role", "==", "denetmen"))).then(snap =>
            setAuditors(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)))
        );
    }, []);

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                const startDate = viewMode === "haftalik" ? weekStart : monthStart;
                const endDate = viewMode === "haftalik" ? weekEnd : monthEnd;
                const snap = await getDocs(query(
                    collection(db, "audit_schedules"),
                    where("status", "==", "published"),
                    where("date", ">=", Timestamp.fromDate(startDate)),
                    where("date", "<=", Timestamp.fromDate(endDate))
                ));
                setSchedule(snap.docs.map(d => {
                    const data = d.data();
                    return { id: d.id, ...data, date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date) } as ScheduleItem;
                }));
            } finally { setLoading(false); }
        };
        fetchSchedule();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate, viewMode]);

    const getCellItems = (auditorId: string, date: Date) =>
        schedule.filter(i => i.auditorId === auditorId && isSameDay(i.date, date) && i.type !== "blocked");

    const handlePrev = () => viewMode === "haftalik" ? setCurrentDate(d => subWeeks(d, 1)) : setCurrentDate(d => subMonths(d, 1));
    const handleNext = () => viewMode === "haftalik" ? setCurrentDate(d => addWeeks(d, 1)) : setCurrentDate(d => addMonths(d, 1));

    // ─── SHARED: sticky auditor-name cell style ────────────────────────────────
    // Important: bg must be a solid color (not transparent/inherit) for sticky to work on scroll
    const stickyBg = (even: boolean) => even ? "#ffffff" : "#f8fafc";

    // ─── WEEKLY VIEW ──────────────────────────────────────────────────────────
    const WeeklyView = () => (
        <>
            {/* Desktop: table-fixed fills entire viewport — no horizontal scroll */}
            <div className="hidden md:flex flex-col flex-1 overflow-y-auto">
                <table className="w-full h-full border-separate border-spacing-0 table-fixed">
                    <colgroup>
                        <col style={{ width: "180px" }} />
                        {weekDays.map((_, i) => <col key={i} />)}
                    </colgroup>
                    <thead className="sticky top-0 z-30">
                        <tr>
                            <th className="bg-white p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-r border-slate-100">
                                Denetmen
                            </th>
                            {weekDays.map((day, i) => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <th key={i} className={cn("p-0 border-b border-slate-100 text-center", isWeekend ? "bg-slate-50" : "bg-white", isToday && "bg-indigo-50")}>
                                        <div className="flex flex-col items-center py-3 gap-1">
                                            <span className={cn("text-[10px] font-semibold uppercase tracking-widest", isToday ? "text-indigo-500" : "text-slate-400")}>
                                                {format(day, "EEE", { locale: tr })}
                                            </span>
                                            <span className={cn("text-xl font-bold flex items-center justify-center leading-none", isToday ? "h-9 w-9 rounded-full bg-indigo-600 text-white text-base shadow-md shadow-indigo-200" : isWeekend ? "text-slate-400" : "text-slate-700")}>
                                                {format(day, "d")}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {auditors.map((auditor, ai) => {
                            const even = ai % 2 === 0;
                            return (
                                <tr key={auditor.uid}>
                                    {/* Always solid bg for proper sticky overlap */}
                                    <td style={{ backgroundColor: stickyBg(even) }} className="sticky left-0 z-10 border-b border-r border-slate-100 p-3">
                                        <div className="flex items-center gap-2">
                                            <AvatarBubble auditor={auditor} />
                                            {/* Full name — no truncate on desktop */}
                                            <span className="text-xs font-bold text-slate-800 break-words leading-tight">
                                                {auditor.firstName} {auditor.lastName}
                                            </span>
                                        </div>
                                    </td>
                                    {weekDays.map((day, di) => {
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        const audits = getCellItems(auditor.uid, day).filter(i => i.type !== "leave");
                                        const leaves = getCellItems(auditor.uid, day).filter(i => i.type === "leave");
                                        return (
                                            <td
                                                key={di}
                                                style={{ backgroundColor: even ? (isWeekend ? "#f8fafc" : "#ffffff") : (isWeekend ? "#f1f5f9" : "#f8fafc") }}
                                                className="border-b border-slate-100 p-1.5 align-middle"
                                            >
                                                <div className="flex flex-col gap-1">
                                                    {/* PC: full leave name */}
                                                    {leaves.map(l => (
                                                        <div key={l.id} className="text-xs font-semibold px-2 py-1 rounded-md text-center" style={{ backgroundColor: `${l.leaveColor}20`, color: l.leaveColor || "#64748b", border: `1px solid ${l.leaveColor}30` }}>
                                                            {l.storeName}
                                                        </div>
                                                    ))}
                                                    {/* 1 store: full-width block */}
                                                    {audits.length === 1 && (
                                                        <div className="rounded-lg bg-indigo-600 text-white font-bold text-sm text-center px-2 py-3 w-full leading-tight">
                                                            {audits[0].storeName}
                                                        </div>
                                                    )}
                                                    {/* 2 stores: stacked (each takes full width, half height) */}
                                                    {audits.length >= 2 && audits.slice(0, 2).map(item => (
                                                        <div key={item.id} className="rounded-lg bg-indigo-600 text-white font-bold text-xs text-center px-2 py-2 w-full leading-tight">
                                                            {item.storeName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile: day-by-day cards */}
            <div className="md:hidden flex-1 overflow-y-auto px-3 py-2 space-y-3">
                {weekDays.map(day => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, new Date());
                    const dayItems = schedule.filter(i => isSameDay(i.date, day) && i.type !== "blocked");
                    const grouped: Record<string, ScheduleItem[]> = {};
                    dayItems.forEach(item => {
                        if (!grouped[item.auditorId]) grouped[item.auditorId] = [];
                        grouped[item.auditorId].push(item);
                    });
                    const auditorIds = Object.keys(grouped);
                    return (
                        <div key={day.toISOString()} className={cn("rounded-xl border overflow-hidden", isToday ? "border-indigo-300 shadow-lg shadow-indigo-100" : "border-slate-100 shadow-sm", isWeekend && "opacity-60")}>
                            <div className={cn("flex items-center gap-3 px-4 py-3", isToday ? "bg-indigo-600" : "bg-slate-50 border-b border-slate-100")}>
                                <span className={cn("text-2xl font-extrabold leading-none", isToday ? "text-white" : "text-slate-700")}>{format(day, "d")}</span>
                                <div>
                                    <div className={cn("text-sm font-bold uppercase tracking-wide", isToday ? "text-indigo-100" : "text-slate-700")}>{format(day, "EEEE", { locale: tr })}</div>
                                    <div className={cn("text-[11px]", isToday ? "text-indigo-200" : "text-slate-400")}>{format(day, "d MMMM yyyy", { locale: tr })}</div>
                                </div>
                                {auditorIds.length > 0 && (
                                    <span className={cn("ml-auto text-xs font-semibold px-2 py-0.5 rounded-full", isToday ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600")}>
                                        {auditorIds.length} denetmen
                                    </span>
                                )}
                            </div>
                            {auditorIds.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-slate-400 italic bg-white">Program girilmemiş</div>
                            ) : (
                                <div className="divide-y divide-slate-50 bg-white">
                                    {auditorIds.map(aid => {
                                        const auditor = auditors.find(a => a.uid === aid);
                                        const items = grouped[aid];
                                        const audits = items.filter(i => i.type !== "leave");
                                        const leaves = items.filter(i => i.type === "leave");
                                        return (
                                            <div key={aid} className="flex items-center gap-3 px-4 py-3">
                                                <AvatarBubble auditor={auditor} />
                                                <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                                                    {auditor ? `${auditor.firstName} ${auditor.lastName}` : aid}
                                                </span>
                                                <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                                                    {/* Mobile: abbreviated leave names */}
                                                    {leaves.map(l => (
                                                        <span key={l.id} className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${l.leaveColor}20`, color: l.leaveColor || "#64748b", border: `1px solid ${l.leaveColor}40` }}>
                                                            {abbreviate(l.storeName)}
                                                        </span>
                                                    ))}
                                                    {audits.map(a => (
                                                        <span key={a.id} className="text-sm font-bold px-3 py-1 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                                                            {a.storeName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );

    // ─── MONTHLY TABLE VIEW ───────────────────────────────────────────────────
    // PC: table-fixed full page, full names, large text — like weekly
    // Mobile: same table but horizontally scrollable, abbreviated leaves
    const MonthlyView = () => (
        <>
            {/* Desktop: fills full page height + horizontal scroll — same as weekly */}
            <div className="hidden md:flex flex-col flex-1 overflow-x-auto">
                <table className="h-full border-separate border-spacing-0" style={{ minWidth: `${200 + monthDays.length * 120}px` }}>
                    <thead className="sticky top-0 z-30">
                        <tr>
                            <th className="sticky left-0 z-40 bg-white w-[200px] min-w-[200px] p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-r border-slate-100">
                                Denetmen
                            </th>
                            {monthDays.map((day, i) => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <th key={i} className={cn("w-[120px] min-w-[120px] p-0 border-b border-slate-100 text-center", isWeekend ? "bg-slate-50" : "bg-white", isToday && "bg-indigo-50")}>
                                        <div className="flex flex-col items-center py-3 gap-1">
                                            <span className={cn("text-[10px] font-semibold uppercase tracking-widest", isToday ? "text-indigo-500" : "text-slate-400")}>
                                                {format(day, "EEE", { locale: tr })}
                                            </span>
                                            <span className={cn("text-xl font-bold flex items-center justify-center leading-none", isToday ? "h-9 w-9 rounded-full bg-indigo-600 text-white text-base shadow-md shadow-indigo-200" : isWeekend ? "text-slate-400" : "text-slate-700")}>
                                                {format(day, "d")}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="h-full">
                        {auditors.map((auditor, ai) => {
                            const even = ai % 2 === 0;
                            const rowH = `${(100 / auditors.length).toFixed(2)}%`;
                            return (
                                <tr key={auditor.uid} style={{ height: rowH }}>
                                    <td style={{ backgroundColor: stickyBg(even) }} className="sticky left-0 z-10 border-b border-r border-slate-100 p-3">
                                        <div className="flex items-center gap-2">
                                            <AvatarBubble auditor={auditor} />
                                            <span className="text-xs font-bold text-slate-800 break-words leading-tight">
                                                {auditor.firstName} {auditor.lastName}
                                            </span>
                                        </div>
                                    </td>
                                    {monthDays.map((day, di) => {
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        const isToday = isSameDay(day, new Date());
                                        const audits = getCellItems(auditor.uid, day).filter(i => i.type !== "leave");
                                        const leaves = getCellItems(auditor.uid, day).filter(i => i.type === "leave");
                                        return (
                                            <td
                                                key={di}
                                                style={{ backgroundColor: even ? (isWeekend ? "#f8fafc" : "#ffffff") : (isWeekend ? "#f1f5f9" : "#f8fafc") }}
                                                className="border-b border-slate-100 p-1.5 align-middle"
                                            >
                                                <div className="flex flex-col gap-1">
                                                    {leaves.map(l => (
                                                        <div key={l.id} className="text-xs font-semibold px-2 py-1 rounded-md text-center" style={{ backgroundColor: `${l.leaveColor}20`, color: l.leaveColor || "#64748b", border: `1px solid ${l.leaveColor}30` }} title={l.storeName}>
                                                            {l.storeName}
                                                        </div>
                                                    ))}
                                                    {audits.length === 1 && (
                                                        <div className="rounded-lg bg-indigo-600 text-white font-bold text-sm text-center px-2 py-3 w-full leading-tight" title={audits[0].storeName}>
                                                            {audits[0].storeName}
                                                        </div>
                                                    )}
                                                    {audits.length >= 2 && audits.slice(0, 2).map(item => (
                                                        <div key={item.id} className="rounded-lg bg-indigo-600 text-white font-bold text-xs text-center px-2 py-2 w-full leading-tight" title={item.storeName}>
                                                            {item.storeName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile: horizontal scroll — auditor column sticky, days scroll right */}
            <div className="md:hidden flex-1 overflow-auto">
                <table className="border-separate border-spacing-0" style={{ minWidth: `${150 + monthDays.length * 48}px` }}>
                    <thead className="sticky top-0 z-30">
                        <tr>
                            <th className="sticky left-0 z-40 bg-slate-50 w-[150px] min-w-[150px] p-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200">
                                Denetmen
                            </th>
                            {monthDays.map((day, i) => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <th key={i} className={cn("w-[48px] min-w-[48px] p-0 border-b border-slate-200 text-center", isWeekend ? "bg-slate-100" : "bg-slate-50", isToday && "bg-indigo-50")}>
                                        <div className="flex flex-col items-center py-2 gap-0.5">
                                            <span className={cn("text-[10px] font-semibold uppercase leading-none", isToday ? "text-indigo-500" : "text-slate-400")}>
                                                {format(day, "EE", { locale: tr })}
                                            </span>
                                            <span className={cn("text-sm font-bold flex items-center justify-center w-6 h-6 rounded-full leading-none", isToday ? "bg-indigo-600 text-white shadow" : isWeekend ? "text-slate-400" : "text-slate-700")}>
                                                {format(day, "d")}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {auditors.map((auditor, ai) => {
                            const even = ai % 2 === 0;
                            return (
                                <tr key={auditor.uid}>
                                    <td style={{ backgroundColor: stickyBg(even) }} className="sticky left-0 z-20 border-b border-r border-slate-200 p-2.5 h-14">
                                        <div className="flex items-center gap-2">
                                            <AvatarBubble auditor={auditor} size="sm" />
                                            <span className="text-sm font-semibold text-slate-800 leading-tight">{auditor.firstName} {auditor.lastName}</span>
                                        </div>
                                    </td>
                                    {monthDays.map((day, di) => {
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        const audits = getCellItems(auditor.uid, day).filter(i => i.type !== "leave");
                                        const leaves = getCellItems(auditor.uid, day).filter(i => i.type === "leave");
                                        return (
                                            <td
                                                key={di}
                                                style={{ backgroundColor: even ? (isWeekend ? "#f8fafc" : "#ffffff") : (isWeekend ? "#f1f5f9" : "#f8fafc") }}
                                                className="border-b border-slate-100 p-0.5 text-center align-middle h-14"
                                            >
                                                <div className="flex flex-col gap-0.5 items-stretch">
                                                    {audits.map(a => (
                                                        <div key={a.id} className="rounded bg-indigo-600 text-white text-xs font-bold text-center px-0.5 py-1 leading-tight truncate" title={a.storeName}>
                                                            {a.storeName}
                                                        </div>
                                                    ))}
                                                    {leaves.map(l => (
                                                        <div key={l.id} className="rounded text-xs font-bold text-center px-0.5 py-1 leading-tight" style={{ backgroundColor: `${l.leaveColor}25`, color: l.leaveColor || "#94a3b8", border: `1px solid ${l.leaveColor}40` }} title={l.storeName}>
                                                            {abbreviate(l.storeName)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 border-b bg-white shrink-0 flex-wrap">
                <div className="flex flex-1 items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button onClick={handlePrev} className="h-9 w-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 transition-all">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="flex-1 text-center text-xs md:text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {viewMode === "haftalik"
                            ? `${weekNum}. Hafta — ${format(currentDate, "MMM yyyy", { locale: tr })}`
                            : format(currentDate, "MMMM yyyy", { locale: tr })}
                    </span>
                    <button onClick={handleNext} className="h-9 w-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 transition-all">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="flex-1 md:flex-none h-9 px-3 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                    Bugün
                </button>
                <div className="hidden md:block flex-1" />
                {!loading && (
                    <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-indigo-400" />{auditors.length} denetmen</span>
                        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-purple-400" />{schedule.filter(i => i.type !== "leave" && i.type !== "blocked").length} denetim</span>
                    </div>
                )}
                <div className="flex w-full md:w-auto bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                    <button onClick={() => setViewMode("haftalik")} className={cn("flex flex-1 items-center justify-center gap-1.5 h-9 min-w-[90px] px-3 text-xs font-bold rounded-md transition-all", viewMode === "haftalik" ? "bg-white text-indigo-700 shadow-sm border border-indigo-100" : "text-slate-500 hover:bg-slate-200/60")}>
                        <CalendarDays className="h-4 w-4" /><span>Haftalık</span>
                    </button>
                    <button onClick={() => setViewMode("aylik")} className={cn("flex flex-1 items-center justify-center gap-1.5 h-9 min-w-[90px] px-3 text-xs font-bold rounded-md transition-all", viewMode === "aylik" ? "bg-white text-indigo-700 shadow-sm border border-indigo-100" : "text-slate-500 hover:bg-slate-200/60")}>
                        <Calendar className="h-4 w-4" /><span>Aylık</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-500">Program yükleniyor...</p>
                    </div>
                </div>
            ) : (
                viewMode === "haftalik" ? <WeeklyView /> : <MonthlyView />
            )}
        </div>
    );
}

function AvatarBubble({ auditor, size = "md" }: { auditor?: UserProfile; size?: "sm" | "md" }) {
    const initials = auditor ? `${auditor.firstName?.[0] ?? ""}${auditor.lastName?.[0] ?? ""}` : "?";
    return (
        <div className={cn("rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0", size === "sm" ? "h-6 w-6" : "h-8 w-8")}>
            <span className={cn("font-bold text-white", size === "sm" ? "text-[9px]" : "text-[11px]")}>{initials}</span>
        </div>
    );
}
