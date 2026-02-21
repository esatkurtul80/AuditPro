"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trash2, AlertTriangle, Database, HardDrive, Server, ShieldAlert,
  Bed, ClipboardType, CalendarDays, Key, FileText, HelpCircle, LayoutTemplate,
  Users, UserCog, Activity, AlertOctagon, Loader2, Bell, Megaphone,
  Store
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { collection, getCountFromServer, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DataManagementPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const targetCollections = [
    { id: "accommodation_types", name: "Konaklama Tipleri", desc: "Sistemde tanımlı tüm konaklama tipi tanımlarını siler.", icon: Bed },
    { id: "announcements", name: "Duyurular / Bilg.", desc: "Sistemdeki tüm genel duyuruları ve bilgilendirmeleri siler.", icon: Megaphone },
    { id: "auditTypes", name: "Denetim Türleri", desc: "Tüm denetim türü (Kategori) tanımlarını kalıcı olarak siler.", icon: ClipboardType },
    { id: "audit_schedules", name: "Denetim Takvimleri", desc: "Tüm haftalık / aylık planlanmış denetmen programlarını siler.", icon: CalendarDays },
    { id: "audits", name: "Denetim Raporları", desc: "Tüm tamamlanmış ve taslak halinde olan denetim raporlarını tamamen siler.", icon: FileText },
    { id: "leave_types", name: "İzin Tipleri", desc: "Personel izin tipi tanımlarını siler.", icon: Key },
    { id: "notifications", name: "Sistem Bildirimleri", desc: "Kullanıcılara giden tüm panel anlık bildirimlerini siler.", icon: Bell },
    { id: "personnel_evaluations", name: "Personel Değerlendirmeleri", desc: "Yapılan tüm personel değerlendirmelerini ve puanlarını siler.", icon: UserCog },
    { id: "questions", name: "Sorular", desc: "Denetim soru formlarındaki tüm soruları ve puan ağırlıklarını temizler.", icon: HelpCircle },
    { id: "sections", name: "Bölümler", desc: "Denetim formlarındaki tüm alt bölümleri ve kategori başlıklarını siler.", icon: LayoutTemplate },
    { id: "settings", name: "Sistem Ayarları", desc: "Sistem konfigürasyonlarını siler. DİKKAT: Sistemin çalışmasını bozabilir.", icon: Activity, danger: true },
    { id: "store_personnel", name: "Mağaza Personelleri", desc: "Sisteme kayıtlı mağazalarda çalışan tüm personel listelerini siler.", icon: Users },
    { id: "stores", name: "Mağazalar", desc: "Sisteme kayıtlı tüm şube/mağazaları ve detaylarını siler.", icon: Store },
    { id: "system_logs", name: "Sistem Kayıtları", desc: "Sistemdeki tüm işlem hareketlerini (logları) temizler.", icon: Database },
    { id: "users", name: "Kullanıcılar", desc: "Tüm yöneticileri ve hesapları siler. Sizi sistemden atar.", icon: AlertOctagon, danger: true }
  ];

  useEffect(() => {
    const fetchCounts = async () => {
      const newCounts: Record<string, number> = {};
      await Promise.allSettled(
        targetCollections.map(async (col) => {
          try {
            const snap = await getCountFromServer(collection(db, col.id));
            newCounts[col.id] = snap.data().count;
          } catch (e) {
             console.error(`Count fetch failed for ${col.id}`, e);
             newCounts[col.id] = 0;
          }
        })
      );
      setCounts(newCounts);
    };
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleConfirm = (colId: string, val: boolean) => {
     setConfirmations(prev => ({ ...prev, [colId]: val }));
  };

  const handleWipe = async (collectionName: string) => {
      setLoadingIds(prev => ({ ...prev, [collectionName]: true }));
      try {
          const q = collection(db, collectionName);
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
              toast.info(`${collectionName} koleksiyonunda veri bulunamadı.`);
              setLoadingIds(prev => ({ ...prev, [collectionName]: false }));
              toggleConfirm(collectionName, false);
              return;
          }

          const batchSize = 400;
          const chunks = [];
          for (let i = 0; i < snapshot.docs.length; i += batchSize) {
              chunks.push(snapshot.docs.slice(i, i + batchSize));
          }

          let deleted = 0;
          for (const chunk of chunks) {
              const batch = writeBatch(db);
              chunk.forEach((docSnap) => batch.delete(docSnap.ref));
              await batch.commit();
              deleted += chunk.length;
          }

          toast.success(`${collectionName} koleksiyonundan ${deleted} kayıt silindi.`);
          setCounts(prev => ({ ...prev, [collectionName]: 0 }));
          toggleConfirm(collectionName, false);

          if (collectionName === 'users') {
              router.push("/login"); // Force logout if users deleted
          }

      } catch (error: any) {
          console.error("Wipe error:", error);
          toast.error(`Silme işlemi başarısız: ${error.message}`);
      } finally {
          setLoadingIds(prev => ({ ...prev, [collectionName]: false }));
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative font-sans bg-slate-50">
      
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/settings" className="text-slate-500 hover:text-blue-600 transition-colors">Ayarlar</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium text-red-600">Veri Yönetimi</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          
          {/* Warning Banner */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-full shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-red-700 text-xl font-bold mb-2">Sistem Veri Silme Alanı</h1>
              <p className="text-red-600/80 text-sm leading-relaxed max-w-3xl">
                Uyarı: Bu bölümde yapılan işlemler geri alınamaz. Veri silindiğinde veritabanından kalıcı olarak kaldırılır ve normal arayüzden kurtarılamaz. Lütfen devam etmeden önce gerekli yedeklemeleri yaptığınızdan emin olun.
              </p>
            </div>
          </div>

          {/* Storage & Database Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                 <Database className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Toplam Denetim</p>
                 <p className="text-2xl font-black text-slate-900">{counts.audits !== undefined ? counts.audits : "..."}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                 <HardDrive className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Toplam Mağaza</p>
                 <p className="text-2xl font-black text-slate-900">{counts.stores !== undefined ? counts.stores : "..."}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                 <Server className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Sistem Durumu</p>
                 <p className="text-2xl font-black text-emerald-600">Sağlıklı</p>
               </div>
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mt-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Tehlikeli Bölge - Veritabanı Koleksiyonları
          </h2>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {targetCollections.map((col) => {
                const Icon = col.icon;
                const isConfirmed = confirmations[col.id] || false;
                const isLoading = loadingIds[col.id] || false;
                const count = counts[col.id] !== undefined ? counts[col.id] : "...";

                return (
                    <div key={col.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-red-200 hover:shadow-red-50/50 flex flex-col">
                        <div className="p-5 flex-1">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg shrink-0 ${col.danger ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        {col.name}
                                        {col.danger && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-wider">Kritik</span>}
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1 mb-3 leading-snug">{col.desc}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">DB: {col.id}</span>
                                        <span className="text-xs font-bold text-slate-400">•</span>
                                        <span className="text-xs text-slate-500 font-medium">~{count} kayıt</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between gap-4 mt-auto">
                            <div className="flex items-center gap-2 pl-2">
                                <Switch 
                                    checked={isConfirmed} 
                                    onCheckedChange={(checked) => toggleConfirm(col.id, checked)}
                                    className="data-[state=checked]:bg-red-600"
                                />
                                <span className={`text-xs font-bold uppercase ${isConfirmed ? 'text-red-600' : 'text-slate-400'}`}>
                                    Onayla
                                </span>
                            </div>
                            
                            <Button 
                                variant="destructive" 
                                disabled={!isConfirmed || isLoading}
                                onClick={() => handleWipe(col.id)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Temizle
                            </Button>
                        </div>
                        
                        {isConfirmed && col.danger && (
                            <div className="bg-red-600 px-5 py-2 flex items-center gap-2 text-xs text-white animate-in fade-in">
                                <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
                                <strong>DİKKAT!</strong> Bu işlemi geri alamazsınız.
                            </div>
                        )}
                    </div>
                );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}
