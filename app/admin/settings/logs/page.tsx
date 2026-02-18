"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { 
    RefreshCw, Download, Search, Activity, AlertTriangle, 
    Users, Clock, Eye, ChevronDown 
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────
interface LogRecord {
    id: string;
    level: string;
    category: string;
    message: string;
    userId?: string;
    userRole?: string;
    metadata?: Record<string, any>;
    timestamp: Timestamp;
    userAgent?: string;
    path?: string;
    env?: string;
}

type TabKey = "all" | "auth" | "action" | "error";

// ─── Helpers ─────────────────────────────────────────────────────
const categoryLabel: Record<string, string> = {
    auth: "Giriş/Çıkış",
    audit: "Denetim",
    action: "Aksiyon",
    admin: "Admin",
    system: "Sistem",
};

const categoryColor: Record<string, string> = {
    auth: "bg-emerald-100 text-emerald-700",
    audit: "bg-blue-100 text-blue-700",
    action: "bg-violet-100 text-violet-700",
    admin: "bg-orange-100 text-orange-700",
    system: "bg-slate-100 text-slate-700",
};

const levelColor: Record<string, string> = {
    info: "bg-blue-50 text-blue-600 border border-blue-200",
    warn: "bg-amber-50 text-amber-600 border border-amber-200",
    error: "bg-red-50 text-red-600 border border-red-200",
};

const levelLabel: Record<string, string> = {
    info: "INFO",
    warn: "WARNING",
    error: "ERROR",
};

const messageTranslation: Record<string, string> = {
    "User logged in": "Kullanıcı giriş yaptı",
    "User logged out": "Kullanıcı çıkış yaptı",
    "Audit completed": "Denetim tamamlandı",
    "Audit created": "Denetim oluşturuldu",
    "Audit updated (manual save)": "Denetim güncellendi (manuel kayıt)",
    "Action approved": "Aksiyon onaylandı",
    "Action rejected": "Aksiyon reddedildi",
    "Action submitted": "Aksiyon gönderildi",
    "Admin action": "Admin işlemi",
    "System error": "Sistem hatası",
    "Password changed": "Şifre değiştirildi",
    "Profile updated": "Profil güncellendi",
    "Notification sent": "Bildirim gönderildi",
    "Store created": "Mağaza oluşturuldu",
    "Store updated": "Mağaza güncellendi",
    "User role updated": "Kullanıcı rolü güncellendi",
};

// ─── Component ───────────────────────────────────────────────────
export default function LogsPage() {
    const [logs, setLogs] = useState<LogRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLogType, setFilterLogType] = useState("all");
    const [filterUserType, setFilterUserType] = useState("all");
    const [activeTab, setActiveTab] = useState<TabKey>("all");

    // Detail modal
    const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);

    // ─── Fetch ───────────────────────────────────────────────────
    const fetchLogs = async () => {
        try {
            setRefreshing(true);
            const q = query(
                collection(db, "system_logs"),
                orderBy("timestamp", "desc"),
                limit(300)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LogRecord[];
            setLogs(data);
        } catch (error) {
            console.error("Log fetch error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    // Fetch user display names
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const snapshot = await getDocs(collection(db, "users"));
                const map: Record<string, string> = {};
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const name = data.firstName 
                        ? `${data.firstName} ${data.lastName || ""}`.trim() 
                        : null;
                    if (name) map[doc.id] = name;
                });
                setUserMap(map);
            } catch (e) {
                console.error("User map fetch error:", e);
            }
        };
        fetchUsers();
    }, []);

    // ─── Derived Data ────────────────────────────────────────────
    const todayStart = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime() / 1000;
    }, []);

    const todayLogs = useMemo(() => 
        logs.filter(l => l.timestamp?.seconds >= todayStart), 
    [logs, todayStart]);

    const stats = useMemo(() => {
        const errors = todayLogs.filter(l => l.level === "error" || l.level === "warn").length;
        const uniqueUsers = new Set(todayLogs.map(l => l.userId).filter(Boolean)).size;
        const durations = todayLogs
            .map(l => l.metadata?.duration)
            .filter((d): d is number => typeof d === "number");
        const avgDuration = durations.length > 0 
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) 
            : 0;
        return {
            total: todayLogs.length,
            errors,
            activeUsers: uniqueUsers,
            avgDuration,
        };
    }, [todayLogs]);

    // Tab counts
    const tabCounts = useMemo(() => ({
        all: logs.length,
        auth: logs.filter(l => l.category === "auth").length,
        action: logs.filter(l => l.category === "action" || l.category === "admin").length,
        error: logs.filter(l => l.level === "error" || l.level === "warn").length,
    }), [logs]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        let result = [...logs];

        // Tab filter
        if (activeTab === "auth") result = result.filter(l => l.category === "auth");
        if (activeTab === "action") result = result.filter(l => l.category === "action" || l.category === "admin");
        if (activeTab === "error") result = result.filter(l => l.level === "error" || l.level === "warn");

        // Dropdown filters
        if (filterLogType !== "all") result = result.filter(l => l.category === filterLogType);
        if (filterUserType !== "all") result = result.filter(l => l.userRole === filterUserType);

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(l =>
                l.message?.toLowerCase().includes(term) ||
                l.userId?.toLowerCase().includes(term) ||
                JSON.stringify(l.metadata || {}).toLowerCase().includes(term)
            );
        }

        return result;
    }, [logs, activeTab, filterLogType, filterUserType, searchTerm]);

    // ─── Export ───────────────────────────────────────────────────
    const handleExport = () => {
        const csv = [
            ["Zaman", "Tip", "Seviye", "Kullanıcı", "Rol", "Mesaj", "Süre (ms)", "Metadata"].join(","),
            ...filteredLogs.map(l => [
                l.timestamp?.seconds ? format(new Date(l.timestamp.seconds * 1000), "dd.MM.yyyy HH:mm:ss") : "",
                l.category,
                l.level,
                l.userId || "",
                l.userRole || "",
                `"${l.message?.replace(/"/g, '""') || ""}"`,
                l.metadata?.duration || "",
                `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`,
            ].join(","))
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `system_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Render ──────────────────────────────────────────────────
    const tabs: { key: TabKey; label: string }[] = [
        { key: "all", label: "Tümü" },
        { key: "auth", label: "Giriş/Çıkış" },
        { key: "action", label: "Aksiyonlar" },
        { key: "error", label: "Hatalar" },
    ];

    return (
        <>
            <div className="flex-1 flex flex-col h-full bg-slate-50 font-sans">

                {/* ── Header ─────────────────────────────────── */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10 sticky top-0">
                    <div className="flex items-center gap-2 text-sm">
                        <Link href="/admin/settings" className="text-slate-500 hover:text-blue-600 transition-colors">Ayarlar</Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900 font-medium">Log Kayıtları</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLogs}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                            Yenile
                        </button>
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Dışa Aktar
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-[1400px] mx-auto space-y-6">

                        {/* ── Stats Cards ───────────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Bugünkü Toplam Log"
                                value={stats.total.toString()}
                                subtitle="Son 24 saatteki toplam işlem"
                                icon={<Activity className="h-5 w-5 text-blue-600" />}
                                iconBg="bg-blue-50"
                            />
                            <StatCard
                                title="Sistem Hataları"
                                value={stats.errors.toString()}
                                subtitle="Bugün tespit edilen hatalar"
                                icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
                                iconBg="bg-amber-50"
                                valueColor={stats.errors > 0 ? "text-red-600" : undefined}
                            />
                            <StatCard
                                title="Aktif Kullanıcılar"
                                value={stats.activeUsers.toString()}
                                subtitle="Bugün sisteme giriş yapan"
                                icon={<Users className="h-5 w-5 text-emerald-600" />}
                                iconBg="bg-emerald-50"
                            />
                            <StatCard
                                title="Ort. Yanıt Süresi"
                                value={stats.avgDuration > 0 ? `${stats.avgDuration}ms` : "—"}
                                subtitle="Sistemin ortalama performansı"
                                icon={<Clock className="h-5 w-5 text-violet-600" />}
                                iconBg="bg-violet-50"
                            />
                        </div>

                        {/* ── Filters Card ──────────────────────── */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900 mb-4">Filtreler</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                {/* Search */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">Arama</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Log ara..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Log Type */}
                                <FilterSelect
                                    label="Log Tipi"
                                    value={filterLogType}
                                    onChange={setFilterLogType}
                                    options={[
                                        { value: "all", label: "Tümü" },
                                        { value: "auth", label: "Giriş/Çıkış" },
                                        { value: "audit", label: "Denetim" },
                                        { value: "action", label: "Aksiyon" },
                                        { value: "admin", label: "Admin" },
                                        { value: "system", label: "Sistem" },
                                    ]}
                                />

                                {/* User Type */}
                                <FilterSelect
                                    label="Kullanıcı Tipi"
                                    value={filterUserType}
                                    onChange={setFilterUserType}
                                    options={[
                                        { value: "all", label: "Tümü" },
                                        { value: "admin", label: "Admin" },
                                        { value: "denetmen", label: "Denetmen" },
                                        { value: "magaza", label: "Mağaza" },
                                        { value: "bolge_muduru", label: "Bölge Müdürü" },
                                    ]}
                                />

                                {/* Mağaza */}
                                <FilterSelect
                                    label="Mağaza"
                                    value="all"
                                    onChange={() => {}}
                                    options={[{ value: "all", label: "Tümü" }]}
                                />

                                {/* Date Range */}
                                <FilterSelect
                                    label="Tarih Aralığı"
                                    value="all"
                                    onChange={() => {}}
                                    options={[{ value: "all", label: "Tümü" }]}
                                />
                            </div>
                        </div>

                        {/* ── Tabs + Table ────────────────────────── */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="border-b border-slate-200 px-1">
                                <div className="flex gap-0">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`px-5 py-3 text-sm font-semibold transition-colors relative
                                                ${activeTab === tab.key
                                                    ? "text-slate-900"
                                                    : "text-slate-400 hover:text-slate-600"
                                                }`}
                                        >
                                            {tab.label}
                                            <span className={`ml-1.5 text-xs tabular-nums ${activeTab === tab.key ? "text-slate-500" : "text-slate-300"}`}>
                                                ({tabCounts[tab.key]})
                                            </span>
                                            {activeTab === tab.key && (
                                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Table ──────────────────────────── */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-[170px]">Zaman</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-[120px]">Tip</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-[100px]">Seviye</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Kullanıcı</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Aksiyon</th>
                                            <th className="text-right py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-[120px]">Süre (ms)</th>
                                            <th className="text-center py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-[60px]">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={7} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                                                        <span className="text-sm text-slate-400">Loglar yükleniyor...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-20 text-center text-slate-400">
                                                    Kayıt bulunamadı.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                                    {/* Zaman */}
                                                    <td className="py-3 px-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                        {log.timestamp?.seconds
                                                            ? format(new Date(log.timestamp.seconds * 1000), "dd.MM.yyyy HH:mm:ss", { locale: tr })
                                                            : "—"}
                                                    </td>

                                                    {/* Tip */}
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${categoryColor[log.category] || "bg-slate-100 text-slate-600"}`}>
                                                            {categoryLabel[log.category] || log.category}
                                                        </span>
                                                    </td>

                                                    {/* Seviye */}
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${levelColor[log.level] || "bg-slate-100 text-slate-600"}`}>
                                                            {levelLabel[log.level] || log.level?.toUpperCase()}
                                                        </span>
                                                    </td>

                                                    {/* Kullanıcı */}
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-800 truncate max-w-[180px]">
                                                                {log.userId ? (userMap[log.userId] || log.userId.substring(0, 8) + "...") : "System"}
                                                            </span>
                                                            {log.userRole && (
                                                                <span className="text-[11px] text-slate-400 capitalize">
                                                                    {log.userRole === "admin" ? "Admin" :
                                                                     log.userRole === "denetmen" ? "Denetmen" :
                                                                     log.userRole === "magaza" ? "Mağaza Yön." :
                                                                     log.userRole === "bolge_muduru" ? "Bölge Müdürü" :
                                                                     log.userRole}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Aksiyon */}
                                                    <td className="py-3 px-4">
                                                        <span className="text-sm text-slate-700 truncate max-w-[300px] block">
                                                            {messageTranslation[log.message] || log.message}
                                                        </span>
                                                    </td>

                                                    {/* Süre */}
                                                    <td className="py-3 px-4 text-right">
                                                        {log.metadata?.duration ? (
                                                            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                                                                log.metadata.duration > 3000 
                                                                    ? "bg-red-50 text-red-600" 
                                                                    : log.metadata.duration > 1000 
                                                                        ? "bg-amber-50 text-amber-600" 
                                                                        : "bg-emerald-50 text-emerald-600"
                                                            }`}>
                                                                {log.metadata.duration}ms
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-300">—</span>
                                                        )}
                                                    </td>

                                                    {/* İşlem */}
                                                    <td className="py-3 px-4 text-center">
                                                        <button
                                                            onClick={() => setSelectedLog(log)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            {!loading && filteredLogs.length > 0 && (
                                <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
                                    <span>Toplam {filteredLogs.length} kayıt gösteriliyor</span>
                                    <span>Son güncelleme: {format(new Date(), "HH:mm:ss", { locale: tr })}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* ── Detail Modal ────────────────────────────── */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Log Detayı</DialogTitle>
                        <DialogDescription>Seçilen log kaydının tüm bilgileri</DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4 mt-2">
                            <DetailRow label="Zaman" value={
                                selectedLog.timestamp?.seconds
                                    ? format(new Date(selectedLog.timestamp.seconds * 1000), "dd MMMM yyyy HH:mm:ss", { locale: tr })
                                    : "—"
                            } />
                            <DetailRow label="Kategori" value={categoryLabel[selectedLog.category] || selectedLog.category} />
                            <DetailRow label="Seviye" value={levelLabel[selectedLog.level] || selectedLog.level} />
                            <DetailRow label="Mesaj" value={selectedLog.message} />
                            <DetailRow label="Kullanıcı ID" value={selectedLog.userId || "—"} />
                            <DetailRow label="Kullanıcı Rolü" value={selectedLog.userRole || "—"} />
                            <DetailRow label="Sayfa" value={selectedLog.path || "—"} />
                            <DetailRow label="User Agent" value={selectedLog.userAgent || "—"} mono />
                            {selectedLog.metadata?.duration && (
                                <DetailRow label="İşlem Süresi" value={`${selectedLog.metadata.duration}ms`} />
                            )}
                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div>
                                    <span className="text-xs font-medium text-slate-500 block mb-1.5">Metadata</span>
                                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono text-slate-700 max-h-48 overflow-y-auto">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Sub-Components ──────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon, iconBg, valueColor }: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    valueColor?: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">{title}</span>
                <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                    {icon}
                </div>
            </div>
            <div className={`text-3xl font-black tracking-tight ${valueColor || "text-slate-900"}`}>
                {value}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="text-xs font-medium text-slate-500 sm:w-28 shrink-0">{label}</span>
            <span className={`text-sm text-slate-800 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        </div>
    );
}
