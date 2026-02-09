"use client";

import { cn } from "@/lib/utils";
import { 
  GitBranch, 
  GitCommit, 
  Activity, 
  Smartphone, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { UserProfile } from "@/lib/types";

export default function VersionPage() {
  const [versionStats, setVersionStats] = useState<{name: string, value: number, color: string}[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeInstalls, setActiveInstalls] = useState(0);
  
  const currentSystemVersion = process.env.NEXT_PUBLIC_APP_VERSION || "v2.2.0";

  // Simulate changelog for now (or fetch from a 'changelogs' collection if created)
  const changelog = [
    {
      version: "v2.2.19",
      date: "06 Şub 2026",
      status: "current",
      changes: [
        "Admin Ayarları Yenilenmesi (Kokpit, Veri Silme, Kullanıcı Yönetimi)",
        "Bildirim Token hataları düzeltildi",
        "Kenar çubuğu performans iyileştirmeleri"
      ]
    },
    {
      version: "v2.1.5",
      date: "12 Oca 2026",
      status: "released",
      changes: [
        "Takvim modülü refaktörü",
        "Denetim Raporu dışa aktarma eklendi"
      ]
    },
    {
       version: "v2.0.0",
       date: "20 Ara 2025",
       status: "released",
       changes: [
         "Büyük Arayüz Güncellemesi",
         "Karanlık Mod desteği eklendi"
       ]
    }
  ];

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(d => d.data() as UserProfile);
        setTotalUsers(users.length);
        
        // Count versions
        const dist: Record<string, number> = {};
        let activeCount = 0;

        users.forEach(u => {
            const v = u.appVersion || "Bilinmiyor";
            dist[v] = (dist[v] || 0) + 1;
            
            // Assume active if role is not pending
            if (u.role !== 'pending') activeCount++;
        });
        setActiveInstalls(activeCount);

        // Convert to chart data
        const chartData = Object.entries(dist).map(([name, value], index) => ({
            name,
            value,
            color: `hsl(${220 + (index * 40)}, 70%, 50%)`
        })).sort((a,b) => b.value - a.value);

        setVersionStats(chartData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative font-sans bg-slate-50">
       {/* Header */}
       <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/settings" className="text-slate-500 hover:text-slate-800 transition-colors">Ayarlar</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">Sürüm Kontrolü</span>
        </div>
        <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sistem Sorunsuz
            </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Hero Card */}
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <GitBranch className="h-32 w-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Mevcut Sistem Sürümü</h2>
                        <div className="flex items-baseline gap-4">
                            <h1 className="text-5xl font-black text-slate-900 tracking-tight">{currentSystemVersion}</h1>
                            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30">SON STABİL</span>
                        </div>
                        <p className="mt-4 text-slate-600 max-w-md">
                            Prodüksiyon ortamında çalışıyor. Tüm sistem bütünlük kontrolleri geçti. Bir sonraki otomatik güncelleme kontrolü: <span className="font-mono font-bold text-slate-800">23s 15d</span>.
                        </p>
                        <div className="flex gap-4 mt-8">
                            <Button className="bg-slate-900 text-white hover:bg-slate-800">
                                <Download className="h-4 w-4 mr-2" />
                                APK İndir
                            </Button>
                            <Button variant="outline" className="border-slate-300">
                                <Activity className="h-4 w-4 mr-2" />
                                Derleme Logları
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Changelog */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            Son Değişiklikler
                        </h3>
                        <Button variant="ghost" size="sm" className="text-xs h-8">Tüm Geçmişi Gör</Button>
                    </div>
                    <div className="p-6">
                        <div className="relative border-l-2 border-slate-100 pl-8 ml-3 space-y-10">
                            {changelog.map((log, i) => (
                                <div key={i} className="relative">
                                    <div className={cn(
                                        "absolute -left-[41px] top-1 h-6 w-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                                        log.status === 'current' ? "bg-blue-600 ring-4 ring-blue-50" : "bg-slate-300"
                                    )}>
                                        {log.status === 'current' && <div className="h-2 w-2 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-black text-lg text-slate-900">{log.version}</span>
                                            <span className="text-xs font-medium text-slate-400">{log.date}</span>
                                            {log.status === 'current' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] uppercase font-bold rounded">Güncel</span>}
                                        </div>
                                        <ul className="space-y-2">
                                            {log.changes.map((change, idx) => (
                                                <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                                                    <span className="text-blue-400 mt-1.5">•</span>
                                                    {change}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
                 {/* Distribution Chart */}
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-purple-500" />
                        Sürüm Dağılımı
                    </h3>
                    <div className="h-[250px] w-full relative">
                        {/* <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={versionStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {versionStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 'bold', fontSize: '13px' }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    formatter={(value, entry: any) => <span className="text-slate-600 text-xs font-medium ml-1">{value} ({entry.payload.value})</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer> */}
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">Grafik Yükleniyor...</div>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                             <span className="text-3xl font-black text-slate-900">{totalUsers}</span>
                             <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Kullanıcı</span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase">Aktif Kurulum</p>
                            <p className="text-2xl font-black text-slate-900">{activeInstalls}</p>
                        </div>
                        <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <Activity className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase">Eski Sürüm</p>
                            <p className="text-2xl font-black text-slate-900">{totalUsers - (versionStats.find(v => v.name === currentSystemVersion)?.value || 0)}</p>
                        </div>
                        <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase">Güncelleme Oranı</p>
                            <p className="text-2xl font-black text-green-600">
                                {totalUsers > 0 ? Math.round(((versionStats.find(v => v.name === currentSystemVersion)?.value || 0) / totalUsers) * 100) : 0}%
                            </p>
                        </div>
                        <div className="h-10 w-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                            <ArrowUpCircle className="h-5 w-5" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
