"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Bell, 
  Send, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Filter, 
  Search, 
  BarChart3, 
  Activity,
  RefreshCcw,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification, NotificationType } from "@/lib/types";
import { toast } from "sonner";

export default function NotificationSettingsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({
      sent: 0,
      read: 0,
      unread: 0,
      openRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch last 100 notifications for logs and stats
    // We limit to 100 to avoid reading too many documents for stats
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs: Notification[] = [];
        let readCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data() as Notification;
            notifs.push({ ...data, id: doc.id });
            if (data.read) readCount++;
        });

        setNotifications(notifs);
        setStats({
            sent: notifs.length,
            read: readCount,
            unread: notifs.length - readCount,
            openRate: notifs.length > 0 ? Math.round((readCount / notifs.length) * 100) : 0
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getTypeColor = (type: NotificationType) => {
      switch (type) {
          case 'action_approved': return 'bg-green-100 text-green-700 border-green-200';
          case 'action_rejected': return 'bg-red-100 text-red-700 border-red-200';
          case 'new_audit': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'audit_completed': return 'bg-purple-100 text-purple-700 border-purple-200';
          default: return 'bg-slate-100 text-slate-700 border-slate-200';
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative font-sans bg-slate-50">
      
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/settings" className="text-slate-500 hover:text-blue-600 transition-colors">Ayarlar</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">Bildirimler</span>
        </div>
        <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" onClick={() => toast.info("Test bildirim özelliği yakında eklenecek.")}>
                <Send className="h-4 w-4 mr-2" />
                Test Gönder
             </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
            
            {/* Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                         <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Toplam Gönderim</p>
                         <Send className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{stats.sent}</h3>
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Son 100</span>
                    </div>
                </div>

                 <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                         <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Okunma Oranı</p>
                         <Activity className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{stats.openRate}%</h3>
                        <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">+2.4%</span>
                    </div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.openRate}%` }} />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                         <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">FCM Sağlığı</p>
                         <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative h-12 w-12 flex items-center justify-center">
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                <path className="text-green-500" strokeDasharray="98, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            </svg>
                            <span className="absolute text-[10px] font-bold text-slate-900">98%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">Çalışıyor</span>
                            <span className="text-xs text-slate-500">Google FCM</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                         <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Hatalar</p>
                         <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">0</h3>
                        <span className="text-xs text-slate-400 font-medium">İletim Hatası</span>
                    </div>
                </div>
            </div>

            {/* Notification Log */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                 <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            Son Loglar
                            <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">{notifications.length}</Badge>
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input 
                                className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="Loglarda ara..." 
                            />
                        </div>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                            <Filter className="h-4 w-4" />
                            Filtrele
                        </Button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                <th className="px-6 py-4 font-semibold w-24">Tür</th>
                                <th className="px-6 py-4 font-semibold">Başlık / Mesaj</th>
                                <th className="px-6 py-4 font-semibold">Alıcı</th>
                                <th className="px-6 py-4 font-semibold">Durum</th>
                                <th className="px-6 py-4 font-semibold text-right">Zaman</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {notifications.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        Log kaydı bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                notifications.map((notif) => (
                                    <tr key={notif.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                                                <Bell className="h-4 w-4" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-sm">
                                            <p className="text-sm font-bold text-slate-900 truncate">{notif.title}</p>
                                            <p className="text-xs text-slate-500 truncate">{notif.message}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                                    {notif.userId.substring(0, 8)}...
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {notif.read ? (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 pr-2.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                    Okundu
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 gap-1 pr-2.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                    İletildi
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xs text-slate-400 font-medium font-mono">
                                                {format(notif.createdAt.toDate(), "HH:mm:ss")}
                                            </span>
                                            <p className="text-[10px] text-slate-300 mt-0.5">
                                                {format(notif.createdAt.toDate(), "d MMM", { locale: tr })}
                                            </p>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
