"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Terminal, 
  ArrowRight, 
  GitBranch, 
  Bell, 
  Trash2, 
  UserCog,
  LayoutDashboard,
  Database
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

// Force recompile

export default function SettingsPage() {
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const modules = [
    {
      title: "Konsol",
      description: "Sistem durumu, API sağlığı ve performans metriklerini anlık olarak izleyin.",
      icon: LayoutDashboard,
      href: "/admin/settings",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100",
      status: "Aktif",
      statusColor: "bg-green-50 text-green-700 ring-green-600/20"
    },
    {
      title: "Sürüm Kontrolü",
      description: "Uygulama güncellemelerini yönetin, dağıtım geçmişini takip edin ve geri yükleme yapın.",
      icon: GitBranch, // Source equivalent
      href: "/admin/settings/version",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100",
      footer: "v2.2.19 (Güncel)"
    },
    {
      title: "Bildirim Yönetimi",
      description: "E-posta uyarılarını yapılandırın, push bildirimlerini tetikleyin ve sistem uyarılarını yönetin.",
      icon: Bell,
      href: "/admin/settings/notifications",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100"
    },
    {
      title: "Sistem Veri Silme",
      description: "Veri temizleme, fabrika ayarlarına dönüş ve log silme için acil durum kontrolleri. Dikkatli kullanın.",
      icon: Trash2, // Dangerous equivalent
      href: "/admin/settings/data",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-100",
      hoverBorder: "hover:border-red-500",
      hoverShadow: "hover:shadow-red-100",
      titleHover: "group-hover:text-red-600",
      iconGroupHover: "group-hover:bg-red-100",
      arrowHover: "group-hover:text-red-500"
    },
    {
      title: "Kullanıcı Ayarları",
      description: "Rol tabanlı erişim kontrolü (RBAC), yönetici profilleri ve oturum güvenliği politikalarını yönetin.",
      icon: UserCog, // Admin Panel Settings equivalent
      href: "/admin/settings/users",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100",

    },
    {
      title: "Firebase Aylık Kullanım Analizi ve Fatura",
      description: "Firestore okuma/yazma sayıları, depolama kullanımı ve API kotalarını analiz edin.",
      icon: Database, 
      href: "/admin/settings/firebase",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-100",
      status: "Yeni",
      statusColor: "bg-blue-50 text-blue-700 ring-blue-600/20"
    }
  ];

  const filteredModules = modules.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">
        <header className="w-full px-6 py-5 md:px-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
          <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900">Ayarlar</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Ayarlar Merkezi</h1>
                <p className="mt-1 text-slate-500 font-medium">Sistem yapılandırmalarını ve yönetimsel kontrolleri buradan yönetin.</p>
              </div>
              <div className="w-full md:w-80">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Search className="h-5 w-5" />
                  </div>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all sm:text-sm shadow-sm outline-none font-medium" 
                    placeholder="Ayarlarda ara..." 
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredModules.map((module, index) => (
                <Link 
                  href={module.href} 
                  key={index}
                  className={`group relative flex flex-col p-6 rounded-2xl border bg-white transition-all duration-300 cursor-pointer
                    ${module.hoverBorder ? module.hoverBorder : 'hover:border-blue-600'} 
                    ${module.hoverShadow ? module.hoverShadow : 'hover:shadow-xl hover:shadow-slate-200/50'} 
                    hover:-translate-y-1 border-slate-200 shadow-sm`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${module.color} ${module.bgColor} ${module.borderColor} ${module.iconGroupHover || ''} transition-colors`}>
                      <module.icon className="h-6 w-6" />
                    </div>
                    <ArrowRight className={`h-6 w-6 text-slate-300 transition-colors ${module.arrowHover ? module.arrowHover : 'group-hover:text-blue-600'}`} />
                  </div>
                  <h3 className={`text-lg font-bold text-slate-900 mb-2 ${module.titleHover || ''} transition-colors`}>{module.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1 font-medium">
                    {module.description}
                  </p>
                  
                  <div className="mt-auto pt-4 flex items-center gap-2 border-t border-slate-50">
                    {module.status && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${module.statusColor}`}>
                        {module.status}
                      </span>
                    )}
                    {module.footer && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                        {module.footer}
                      </span>
                    )}

                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-xs font-medium text-slate-400">
              <p>© 2026 AuditGuard Inc. Tüm hakları saklıdır.</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-blue-600 transition-colors">Gizlilik</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Şartlar</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Destek</a>
              </div>
            </div>
          </div>
        </main>
    </div>
  );
}
