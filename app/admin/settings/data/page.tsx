"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trash2, 
  AlertTriangle, 
  Database, 
  HardDrive, 
  Server, 
  ShieldAlert, 
  CheckCircle,
  XCircle,
  AlertOctagon,
  Loader2
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { collection, getCountFromServer, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DataManagementPage() {
  const [confirmAuditDelete, setConfirmAuditDelete] = useState(false);
  const [confirmStoreDelete, setConfirmStoreDelete] = useState(false);
  const [confirmProgramDelete, setConfirmProgramDelete] = useState(false);
  const [confirmUserDelete, setConfirmUserDelete] = useState(false);
  
  const [counts, setCounts] = useState({
    audits: 0,
    stores: 0,
    programs: 0,
    users: 0
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchCounts = async () => {
        try {
            const auditSnap = await getCountFromServer(collection(db, "audits"));
            const storeSnap = await getCountFromServer(collection(db, "stores"));
            const progSnap = await getCountFromServer(collection(db, "programs")); // Assuming 'programs' or relevant schedule collection
            const userSnap = await getCountFromServer(collection(db, "users"));

            setCounts({
                audits: auditSnap.data().count,
                stores: storeSnap.data().count,
                programs: progSnap.data().count,
                users: userSnap.data().count
            });
        } catch (error) {
            console.error("Error fetching counts:", error);
        }
    };
    fetchCounts();
  }, []);

  const handleWipe = async (collectionName: string) => {
      setLoading(true);
      try {
          // Implement batch delete logic
          // Firestore has a 500 limit for batches, so we need to loop
          const q = collection(db, collectionName);
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
              toast.info(`${collectionName} koleksiyonunda veri bulunamadı.`);
              setLoading(false);
              return;
          }

          const total = snapshot.size;
          let deleted = 0;
          const batchSize = 400;
          const chunks = [];

          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += batchSize) {
              chunks.push(docs.slice(i, i + batchSize));
          }

          for (const chunk of chunks) {
              const batch = writeBatch(db);
              chunk.forEach((doc) => {
                  batch.delete(doc.ref);
              });
              await batch.commit();
              deleted += chunk.length;
          }

          toast.success(`${collectionName} koleksiyonundan ${deleted} kayıt silindi.`);
          
          // Refresh counts
          setCounts(prev => ({ ...prev, [collectionName]: 0 }));
          
          // Reset switch
          if (collectionName === 'audits') setConfirmAuditDelete(false);
          if (collectionName === 'stores') setConfirmStoreDelete(false);
          if (collectionName === 'programs') setConfirmProgramDelete(false);
          if (collectionName === 'users') {
              setConfirmUserDelete(false);
              router.push("/login"); // Force logout if users deleted
          }

      } catch (error: any) {
          console.error("Wipe error:", error);
          toast.error(`Silme işlemi başarısız: ${error.message}`);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative font-sans bg-slate-50">
      
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10">
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
                 <p className="text-2xl font-black text-slate-900">{counts.audits}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                 <HardDrive className="h-6 w-6" />
               </div>
               <div>
                 <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Toplam Mağaza</p>
                 <p className="text-2xl font-black text-slate-900">{counts.stores}</p>
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
            Tehlikeli Bölge
          </h2>

          <div className="space-y-4">
            
            {/* Audits Wipe */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-red-200 hover:shadow-red-50/50">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clipboard-list"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Tüm Denetimleri Sil</h3>
                      <p className="text-slate-500 text-sm mt-1">Tüm denetim raporlarını, puanları ve ilişkili resimleri kalıcı olarak siler.</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Koleksiyon: audits</span>
                        <span className="text-xs font-bold text-slate-400">•</span>
                        <span className="text-xs text-slate-500">~{counts.audits} kayıt</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 pl-0 md:pl-6 md:border-l border-slate-100 min-w-48">
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-semibold text-slate-500 uppercase">Onayla</span>
                         <Switch 
                            checked={confirmAuditDelete} 
                            onCheckedChange={setConfirmAuditDelete} 
                            className="data-[state=checked]:bg-red-600"
                         />
                       </div>
                    </div>
                    <div>
                        <Button 
                            variant="destructive" 
                            disabled={!confirmAuditDelete || loading}
                            onClick={() => handleWipe('audits')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Verileri Sil
                        </Button>
                    </div>
                  </div>
                </div>
              </div>
              {confirmAuditDelete && (
                <div className="bg-red-50 px-6 py-3 border-t border-red-100 flex items-center gap-2 text-sm text-red-700 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="h-4 w-4" />
                    <strong>Dikkat:</strong> Tüm denetim kayıtlarını silmek üzeresiniz. Bu işlem geri alınamaz.
                </div>
              )}
            </div>

            {/* Stores Wipe */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-red-200 hover:shadow-red-50/50">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-store"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Tüm Mağazaları Sil</h3>
                      <p className="text-slate-500 text-sm mt-1">Tüm mağaza veritabanını ve bölgesel eşleşmeleri kaldırır.</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Koleksiyon: stores</span>
                        <span className="text-xs font-bold text-slate-400">•</span>
                        <span className="text-xs text-slate-500">~{counts.stores} kayıt</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 pl-0 md:pl-6 md:border-l border-slate-100 min-w-48">
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-semibold text-slate-500 uppercase">Onayla</span>
                         <Switch 
                            checked={confirmStoreDelete} 
                            onCheckedChange={setConfirmStoreDelete}
                            className="data-[state=checked]:bg-red-600"
                         />
                       </div>
                    </div>
                    <div>
                        <Button 
                            variant="destructive" 
                            disabled={!confirmStoreDelete || loading}
                            onClick={() => handleWipe('stores')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Verileri Sil
                        </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Programs Wipe */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-red-200 hover:shadow-red-50/50">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-days"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Tüm Programları Sil</h3>
                      <p className="text-slate-500 text-sm mt-1">Tüm denetim takvimlerini ve gelecek atamaları temizler.</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Koleksiyon: programs</span>
                        <span className="text-xs font-bold text-slate-400">•</span>
                        <span className="text-xs text-slate-500">~{counts.programs} kayıt</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 pl-0 md:pl-6 md:border-l border-slate-100 min-w-48">
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-semibold text-slate-500 uppercase">Onayla</span>
                         <Switch 
                            checked={confirmProgramDelete} 
                            onCheckedChange={setConfirmProgramDelete}
                            className="data-[state=checked]:bg-red-600"
                         />
                       </div>
                    </div>
                    <div>
                        <Button 
                            variant="destructive" 
                            disabled={!confirmProgramDelete || loading}
                            onClick={() => handleWipe('programs')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Verileri Sil
                        </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

             {/* Users Wipe */}
             <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-red-200 hover:shadow-red-50/50">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Tüm Kullanıcıları Sil</h3>
                      <p className="text-slate-500 text-sm mt-1">Tüm kullanıcı hesaplarını siler. <span className="text-red-600 font-bold">Bu işlem sizi sistemden anında atacaktır.</span></p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Koleksiyon: users</span>
                        <span className="text-xs font-bold text-slate-400">•</span>
                        <span className="text-xs text-slate-500">~{counts.users} kayıt</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 pl-0 md:pl-6 md:border-l border-slate-100 min-w-48">
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-semibold text-slate-500 uppercase">Onayla</span>
                         <Switch 
                            checked={confirmUserDelete} 
                            onCheckedChange={setConfirmUserDelete}
                            className="data-[state=checked]:bg-red-600"
                         />
                       </div>
                    </div>
                    <div>
                        <Button 
                            variant="destructive" 
                            disabled={!confirmUserDelete || loading}
                            onClick={() => handleWipe('users')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Verileri Sil
                        </Button>
                    </div>
                  </div>
                </div>
              </div>
              {confirmUserDelete && (
                <div className="bg-red-600 px-6 py-3 border-t border-red-700 flex items-center gap-2 text-sm text-white animate-in fade-in slide-in-from-top-2">
                    <AlertOctagon className="h-4 w-4 fill-white text-red-600" />
                    <strong>KRİTİK UYARI:</strong> Bu işlem kendi yönetici hesabınızı da silecektir. Sadece ne yaptığınızdan eminseniz devam edin.
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
