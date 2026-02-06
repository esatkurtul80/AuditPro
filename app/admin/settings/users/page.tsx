"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  UserPlus, 
  Search, 
  MoreVertical, 
  Shield, 
  Key, 
  Database,
  Lock,
  Eye,
  Edit,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  Download,
  Plus,
  RefreshCcw,
  Wifi,
  X,
  Code,
  History,
  AlertCircle
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, Timestamp, arrayRemove, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function UserSettingsPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // State for deletion confirmation
  const [tokenToDelete, setTokenToDelete] = useState<{ userId: string, token: string, type: 'single' | 'array' } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        userList.push({ ...doc.data(), uid: doc.id } as UserProfile);
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      toast.error("Kullanıcılar yüklenirken hata oluştu.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync selected user data when users list updates
  useEffect(() => {
    if (selectedUser) {
      const updatedUser = users.find(u => u.uid === selectedUser.uid);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    }
  }, [users, selectedUser?.uid]);

  const handleRoleUpdate = async (userId: string, newRole: string) => {
      try {
          await updateDoc(doc(db, "users", userId), {
              role: newRole,
              updatedAt: Timestamp.now()
          });
          toast.success(`Kullanıcı rolü güncellendi: ${getRoleDisplayName(newRole)}`);
      } catch (error) {
          console.error("Role update error:", error);
          toast.error("Rol güncellenemedi.");
      }
  };

  const confirmDeleteToken = async () => {
      if (!tokenToDelete) return;
      
      const { userId, token, type } = tokenToDelete;
      
      try {
          const updates: any = { updatedAt: Timestamp.now() };
          if (type === 'single') {
              updates.notificationToken = deleteField();
          } else {
              updates.fcmTokens = arrayRemove(token);
          }

          await updateDoc(doc(db, "users", userId), updates);
          toast.success("Cihaz tokenı başarıyla silindi ve bağlantısı kesildi.");
      } catch (error) {
          console.error("Token delete error:", error);
          toast.error("Token silinemedi.");
      } finally {
          setTokenToDelete(null);
      }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      (user.displayName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    activeSessions: users.filter(u => u.role !== "pending").length, // Proxy logic per active
    pendingTokens: users.filter(u => (u.fcmTokens?.length || 0) > 0 || u.notificationToken).length,
  };

  // Convert Role to Turkish Display
  const getRoleDisplayName = (role: string) => {
      switch(role) {
          case 'admin': return 'Yönetici';
          case 'denetmen': return 'Denetmen';
          case 'bolge-muduru': return 'Bölge Md.';
          case 'magaza': return 'Mağaza';
          case 'pending': return 'Bekliyor';
          default: return role;
      }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-50 relative font-sans">
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-4 z-10 sticky top-0 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Link href="/admin/settings" className="hover:text-blue-600 transition-colors">Ayarlar</Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-800 font-medium">Kullanıcılar</span>
              </div>
              <h2 className="text-slate-900 text-xl font-bold leading-tight">Kullanıcı Ayarları & Sistem Verileri</h2>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm gap-2 h-10">
                <Download className="h-[18px] w-[18px] text-slate-500" />
                <span className="hidden sm:inline">Veri Dışa Aktar</span>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 gap-2 h-10">
                <Plus className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Yeni Kullanıcı Ekle</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Toplam Kullanıcı</p>
                  <h3 className="text-slate-900 text-2xl font-bold">{stats.total}</h3>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Aktif Oturumlar</p>
                  <h3 className="text-slate-900 text-2xl font-bold">{stats.activeSessions}</h3>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-green-600">
                  <Wifi className="h-6 w-6" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Cihaz Tokenları</p>
                  <h3 className="text-slate-900 text-2xl font-bold">{stats.pendingTokens}</h3>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-yellow-600">
                  <Key className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:max-w-md">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="h-5 w-5" />
                </div>
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-all" 
                  placeholder="İsim, e-posta veya ID ile ara..." 
                  type="text"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select 
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-2.5 px-4 min-w-[140px] cursor-pointer outline-none transition-all"
                >
                  <option value="all">Rol: Tümü</option>
                  <option value="admin">Yönetici</option>
                  <option value="denetmen">Denetmen</option>
                  <option value="bolge-muduru">Bölge Md.</option>
                  <option value="magaza">Mağaza</option>
                </select>
                <button 
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => setLoading(false), 500);
                  }}
                  className="p-2.5 bg-white rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors border border-slate-300" 
                  title="Verileri Yenile"
                >
                  <RefreshCcw className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                      <th className="p-4 min-w-[200px]">Kullanıcı Profili</th>
                      <th className="p-4 font-mono">Kullanıcı ID</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4">Durum</th>
                      <th className="p-4 text-right">Kayıt Tarihi</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {loading ? (
                       <tr>
                           <td colSpan={6} className="p-8 text-center text-slate-500">
                               <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                               Veriler Yükleniyor...
                           </td>
                       </tr>
                    ) : filteredUsers.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                                Kayıt bulunamadı.
                            </td>
                        </tr>
                    ) : ( 
                        filteredUsers.map((user) => (
                            <tr 
                                key={user.uid} 
                                onClick={() => setSelectedUser(user)}
                                className={cn(
                                    "group hover:bg-slate-50 transition-colors cursor-pointer",
                                    selectedUser?.uid === user.uid && "bg-blue-50/50 hover:bg-blue-50/80 border-l-2 border-l-blue-600"
                                )}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 ring-1 ring-slate-200">
                                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} className="object-cover" />
                                            <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-xs">{(user.displayName || "U").substring(0,2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-slate-900 font-medium">{user.displayName || "İsimsiz Kullanıcı"}</span>
                                            <span className="text-slate-500 text-xs">{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-slate-500 text-xs">
                                    #{user.uid?.substring(0,8)}...
                                </td>
                                <td className="p-4">
                                    <span className="text-slate-700 font-medium">{getRoleDisplayName(user.role)}</span>
                                </td>
                                <td className="p-4">
                                    {user.role === 'pending' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                            <History className="h-3.5 w-3.5" />
                                            Bekliyor
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                            Aktif
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right text-slate-500 font-mono text-xs">
                                    {user.createdAt ? format(user.createdAt.toDate(), "d MMM yyyy", { locale: tr }) : "-"}
                                </td>
                                <td className="p-4 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                                                <MoreVertical className="h-5 w-5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[200px]">
                                            <DropdownMenuLabel>Rol İşlemleri</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleRoleUpdate(user.uid as string, "admin")} className="cursor-pointer gap-2">
                                                <Shield className="h-4 w-4 text-blue-600" /> Yönetici Yap
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleRoleUpdate(user.uid as string, "denetmen")} className="cursor-pointer gap-2">
                                                <CheckCircle className="h-4 w-4 text-emerald-600" /> Denetmen Yap
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleRoleUpdate(user.uid as string, "bolge-muduru")} className="cursor-pointer gap-2">
                                                <Users className="h-4 w-4 text-purple-600" /> Bölge Md. Yap
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleRoleUpdate(user.uid as string, "magaza")} className="cursor-pointer gap-2">
                                                <Database className="h-4 w-4 text-orange-600" /> Mağaza Yap
                                            </DropdownMenuItem>
                                             <DropdownMenuSeparator />
                                            <DropdownMenuItem className="cursor-pointer gap-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                                                <Trash2 className="h-4 w-4" /> Sil / Engelle
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination (Static for now) */}
              <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between">
                <span className="text-slate-500 text-sm">Toplam {stats.total} kayıttan 1-5 arası gösteriliyor</span>
                <div className="flex items-center gap-2">
                  <button className="p-1 rounded bg-white border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm" disabled>
                    <span className="text-lg">‹</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button className="h-8 w-8 flex items-center justify-center rounded bg-blue-600 text-white text-sm font-medium shadow-sm">1</button>
                  </div>
                  <button className="p-1 rounded bg-white border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm" disabled>
                     <span className="text-lg">›</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Right Detail Panel (System Data View) */}
      {selectedUser && (
        <aside className="w-[400px] border-l border-slate-200 bg-white shadow-2xl flex-col hidden lg:flex shrink-0 z-20 animate-in slide-in-from-right-10 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h3 className="text-slate-900 text-lg font-bold">Sistem Veri Görünümü</h3>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center mb-8">
                    <Avatar className="h-20 w-20 mb-3 ring-4 ring-slate-50">
                        <AvatarImage src={selectedUser.photoURL || undefined} className="object-cover" />
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-xl font-bold">{(selectedUser.displayName || "U").substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h4 className="text-slate-900 text-xl font-bold text-center">{selectedUser.displayName}</h4>
                    <p className="text-slate-500 text-sm mb-4">{selectedUser.email}</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        <span className="px-3 py-1 bg-slate-100 rounded text-xs text-slate-600 font-mono border border-slate-200">ID: {selectedUser.uid?.substring(0,8)}</span>
                        <span className="px-3 py-1 bg-slate-100 rounded text-xs text-slate-600 font-mono border border-slate-200">Rol: {getRoleDisplayName(selectedUser.role)}</span>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Active Tokens */}
                    <div>
                        <h5 className="text-slate-800 text-sm font-semibold mb-3 flex items-center gap-2">
                            <Key className="h-4 w-4 text-blue-600" />
                            Cihaz Tokenları
                        </h5>
                        <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-3 shadow-sm">
                            
                            {/* Legacy Token */}
                            {selectedUser.notificationToken && (
                                <div className="flex justify-between items-start pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="flex-1 mr-2">
                                        <p className="text-slate-900 text-xs font-mono mb-1 break-all">
                                            {selectedUser.notificationToken.substring(0, 20)}...
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 text-[10px] bg-green-50 px-1.5 py-0.5 rounded border border-green-200 font-medium">Legacy Token</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setTokenToDelete({ userId: selectedUser.uid, token: selectedUser.notificationToken as string, type: 'single' })}
                                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                        title="Tokenı Sil"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* FCM Tokens Array */}
                            {selectedUser.fcmTokens && selectedUser.fcmTokens.map((token, index) => (
                                <div key={index} className="flex justify-between items-start pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="flex-1 mr-2">
                                        <p className="text-slate-900 text-xs font-mono mb-1 break-all">
                                            {token.substring(0, 20)}...
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-medium">FCM</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setTokenToDelete({ userId: selectedUser.uid, token: token, type: 'array' })}
                                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                        title="Tokenı Sil"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}

                            {(!selectedUser.notificationToken && (!selectedUser.fcmTokens || selectedUser.fcmTokens.length === 0)) && (
                                <div className="text-center py-2 text-slate-500 text-xs italic">
                                    Aktif cihaz tokenı bulunamadı.
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Raw Log Data */}
                    <div>
                        <h5 className="text-slate-800 text-sm font-semibold mb-3 flex items-center gap-2">
                            <Code className="h-4 w-4 text-blue-600" />
                            Ham Log Verisi
                        </h5>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 font-mono text-xs text-slate-600 overflow-x-auto shadow-inner">
<pre>{JSON.stringify(selectedUser, null, 2)}</pre>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                         <h5 className="text-slate-800 text-sm font-semibold mb-3 flex items-center gap-2">
                            <History className="h-4 w-4 text-blue-600" />
                            Son Hareketler
                        </h5>
                        <div className="relative pl-4 border-l border-slate-200 space-y-6 ml-2">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 border-2 border-white"></div>
                                <p className="text-slate-800 text-xs font-medium">Son Veri Güncelleme</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">
                                    {selectedUser.updatedAt ? format(selectedUser.updatedAt.toDate(), "d MMM yyyy HH:mm", { locale: tr }) : "Bilinmiyor"}
                                </p>
                            </div>
                             <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 border-2 border-white"></div>
                                <p className="text-slate-800 text-xs font-medium">Hesap oluşturuldu</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">{selectedUser.createdAt ? format(selectedUser.createdAt.toDate(), "d MMM yyyy", { locale: tr }) : "-"}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 mt-auto">
                <button className="w-full py-2 bg-white hover:bg-red-50 text-red-600 text-sm font-bold rounded border border-red-200 shadow-sm transition-colors">
                    Hesabı Askıya Al
                </button>
            </div>
        </aside>
      )}

      {/* Alert Dialog */}
      <AlertDialog open={!!tokenToDelete} onOpenChange={() => setTokenToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Token'ı Silmek İstediğinize Emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Bu tokenı sildiğinizde, kullanıcı bu cihazdan bildirim almayı durduracaktır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteToken} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
