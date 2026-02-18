"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { 
    ShieldCheck, 
    LayoutDashboard, 
    Store, 
    Users, 
    Info,
    CheckCircle2,
    ArrowDown,
    Zap,
    Cpu,
    Target,
    PenTool,
    Settings,
    FileText,
    Database,
    CalendarRange,
    Bell,
    BarChart3,
    Camera,
    Smartphone,
    Activity,
    FileBarChart,
    MessageSquare,
    ImagePlus,
    WifiOff,
    Search,
    ListChecks,
    Table,
    FileImage
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRef } from "react";

// Slide Data Interface
interface SectionData {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    highlights: string[];
    color: string;
    icon: any;
    imagePosition?: "left" | "right";
    visualType?: "icon" | "process" | "tech";
}

// 17 POINTS MAPPING:
// 1. Tanıtım -> S1
// 2. Mağazalar sayfası (eklerken neler var) -> S2
// 4. Haftalık denetim programı -> S2
// 7. Denetim yönetimi (formlar sorular bölümler) -> S3
// 8. Soru puan sistemi detaylı -> S3
// 10. Online offline fotoğraf -> S4
// 11. Çoklu fotoğraf ekleme -> S4
// 12. Bölümlerle ilgili görüş ve öneriler -> S4
// 13. Denetmen panelinde mağaza analizi -> S5
// 14. Denetmen panelinde mağaza bilgileri -> S5
// 15. Tekrarlayan hayırlar -> S5
// 3. Bildirim ve bilgilendirme -> S6
// 5. Mağaza aksiyon sistemi -> S6
// 17. Mağaza panelinde neler var -> S6
// 16. Bölge müdürü modülü -> S7
// 6. Raporlama sayfası (tüm raporlar) -> S8
// 9. Özel rapor sistemi -> S8

const sections: SectionData[] = [
// Section 1: Intro
    {
        id: 1,
        title: "AuditPro Nedir?", // Point 1
        subtitle: "BÜTÜNLEŞİK YÖNETİM PLATFORMU",
        description: "Perakende mağaza denetimlerini dijitalleştiren, operasyonel verimliliği artıran ve anlık veri akışı sağlayan kapsamlı bir sistemdir.",
        highlights: [
            "Kağıt/Excel Yerine Dijital Formlar",
            "Operasyonel Mükemmellik Hedefi",
            "Veri Odaklı Karar Alma",
            "Şeffaf Denetim Mekanizması"
        ],
        color: "from-blue-600 to-indigo-600",
        icon: ShieldCheck,
        imagePosition: "right",
        visualType: "icon"
    },
    {
        id: 2,
        title: "Mağaza & Planlama Yönetimi", // Point 2, 4
        subtitle: "VERİ GİRİŞİ VE ROTA OLUŞTURMA",
        description: "Haftalık denetim programı, sistemin akıllı öneri algoritmaları (12 Gün Kuralı, Ayda Min. 1 Ziyaret, Yeni Mağaza Kontrolü) dikkate alınarak oluşturulur.",
        highlights: [
            "🏪 Mağaza Ekleme: Konum, Tip, Bölge Detayları", // Point 2
            "📅 Akıllı Planlama: 12 Gün Kuralı & Ziyaret Sıklığı", // Point 4 Updated
            "👤 Denetmen Atama & Rota Planlama",
            "📍 Coğrafi Bölge Yapılandırması"
        ],
        color: "from-purple-600 to-pink-600",
        icon: CalendarRange,
        imagePosition: "left",
        visualType: "icon"
    },
    {
        id: 3,
        title: "Form & Puanlama Mimarisi", // Point 7, 8
        subtitle: "DİNAMİK SORULAR VE ALGORİTMA",
        description: "Formlar, bölümler ve sorular esnek bir yapıda yönetilir. Puanlama sistemi, (Kazanılan Puan / Maksimum Puan) * 100 formülüyle çalışır. 'Muaf' seçeneği, ilgili soruyu hesaplamadan çıkararak adaleti sağlar.",
        highlights: [
            "📝 Form Yönetimi: Bölüm > Soru Hiyerarşisi", // Point 7
            "🧮 Puanlama: Ağırlıklı Ortalama Algoritması", // Point 8
            "⚖️ Muafiyet (Etkisiz Soru) Desteği", // Point 8 Detail
            "⭐ Soru Tipleri: Evet/Hayır, Puan, Tarih, Çoktan Seçmeli"
        ],
        color: "from-cyan-500 to-blue-500",
        icon: Settings, // or Calculator
        imagePosition: "right",
        visualType: "tech"
    },
    {
        id: 4,
        title: "Saha Denetim Teknolojisi", // Point 10, 11, 12
        subtitle: "ONLİNE/OFFLİNE & FOTOĞRAF",
        description: "Denetmenler internet olmadan da çalışabilir; bağlantı geldiğinde veriler senkronize olur. Fotoğraflar cihazda sıkıştırılarak yüklenir. 'Hayır' cevaplarında fotoğraf ve açıklama zorunludur. Denetmen her bölüm sonunda görüş ve önerilerini ekleyebilir.",
        highlights: [
            "📶 Online & Offline Çalışma Modu (Senkronizasyon)", // Point 10
            "📸 Çoklu Fotoğraf Yükleme & Sıkıştırma", // Point 10, 11
            "💬 Bölüm Sonu Görüş ve Öneri Girişi", // Point 12
            "🔒 Güvenli Veri Gönderimi" // Replaced GPS with Security generic
        ],
        color: "from-emerald-600 to-teal-600",
        icon: Smartphone,
        imagePosition: "left",
        visualType: "icon"
    },
    {
        id: 5,
        title: "Mağaza Analizi (Denetmen)", // Point 13, 14, 15
        subtitle: "DENETİM ÖNCESİ HAZIRLIK",
        description: "Denetmen, mağazaya gitmeden önce 'Mağaza Analizi' ekranından mağazanın tüm künyesini, geçmiş puanlarını ve özellikle 'Tekrar Eden Hayır' (kronik sorunlar) listesini inceleyerek denetime hazırlıklı başlar.",
        highlights: [
            "📊 Mağaza Analiz Ekranı & Geçmiş Puanlar", // Point 13
            "ℹ️ Mağaza Bilgileri (Müdür, M2, Açılış Tarihi)", // Point 14
            "⚠️ Tekrarlayan 'Hayır' Cevapları Listesi", // Point 15
            "📉 Trend Analizi"
        ],
        color: "from-amber-500 to-orange-600",
        icon: Search,
        imagePosition: "right",
        visualType: "process"
    },
    {
        id: 6,
        title: "Aksiyon ve Bildirim Döngüsü", // Point 3, 5, 17
        subtitle: "MAĞAZA PANELİ & SÜREÇ",
        description: "Denetim bittiğinde mağaza yetkilisine anlık bildirim gider. Mağaza panelinde eksikler listelenir. 3 gün içinde eksiklik giderilmeli ve kanıt fotoğrafı yüklenmelidir. Bildirim sistemi tüm süreci (Yeni Denetim, Red, Onay) anlık olarak haber verir.",
        highlights: [
            "🔔 Gelişmiş Bildirim Sistemi (Push Notification)", // Point 3
            "🏪 Mağaza Paneli: Sonuçlar & Aksiyon Listesi", // Point 17
            "⏳ 3 Gün Kuralı & Kanıt Fotoğrafı Yükleme", // Point 5
            "✅ Yönetici Onay/Red Mekanizması" // Point 5
        ],
        color: "from-rose-500 to-pink-600",
        icon: Zap,
        imagePosition: "left",
        visualType: "icon"
    },
    {
        id: 7,
        title: "Bölge Yönetimi", // Point 16
        subtitle: "PERFORMANS TAKİBİ",
        description: "Bölge müdürü, kendisine bağlı mağazaların anlık durumunu, ortalama puanlarını, yaklaşan denetimlerini ve aksiyon performanslarını (geciken/bekleyen) tek bir dashboard üzerinden izleyebilir.",
        highlights: [
            "👔 Bölge Bazlı Performans Karnesi", // Point 16
            "📅 Denetim Takvimi Görüntüleme", // Point 16
            "🚨 Geciken/Bekleyen Aksiyon Takibi", // Point 16
            "📉 Mağaza Karşılaştırma Analizi"
        ],
        color: "from-slate-600 to-slate-800",
        icon: Users,
        imagePosition: "right",
        visualType: "icon"
    },
    {
        id: 8,
        title: "Raporlama Sistemi", // Point 6, 9
        subtitle: "ANALİTİK VE ÖZEL RAPORLAR",
        description: "Sistemdeki tüm veriler anlamlı raporlara dönüşür. Puan raporları, aksiyon süreleri ve denetmen performansları izlenir. Özel Rapor modülü ile tarih, bölge ve mağaza filtreleri kullanılarak detaylı PDF raporlar oluşturulur.",
        highlights: [
            "📄 Özel Rapor: Filtreli PDF Üretimi", // Point 9
            "📊 Puan Sıralaması & Aksiyon Performans Raporu", // Point 6
            "👨‍💼 Denetmen Performans Karnesi", // Point 6
            "📥 Excel (XLSX) Formatında Dışa Aktarım"
        ],
        color: "from-violet-600 to-purple-800",
        icon: FileBarChart,
        imagePosition: "left",
        visualType: "icon"
    }
];

export default function InfoPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    return (
        <div ref={containerRef} className="bg-slate-50 dark:bg-slate-950 font-sans selection:bg-primary/20">
            
            {/* Scroll Progress Bar */}
            <motion.div 
                className="fixed top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-50 origin-left"
                style={{ scaleX: scrollYProgress }}
            />

            {/* Hero Section */}
            <section className="min-h-[90vh] flex flex-col items-center justify-center relative overflow-hidden px-4 md:px-0 bg-white dark:bg-slate-950">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] dark:opacity-[0.05]" />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="relative z-10 text-center max-w-5xl mx-auto space-y-6"
                >
                    <Badge variant="outline" className="mb-4 px-4 py-1 text-sm border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 backdrop-blur-sm">
                        v2 Stable Release
                    </Badge>

                    <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
                        Denetimde <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Dijital Dönüşüm.</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">AuditPro</span>, mağaza operasyonlarının denetim, aksiyon ve analiz süreçlerini tek platformda birleştirir.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        <Button size="lg" className="rounded-full px-8 h-14 text-lg font-bold shadow-2xl shadow-blue-500/30 bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105" asChild>
                            <Link href="/admin/dashboard">
                                Panele Başla
                            </Link>
                        </Button>
                        <Button variant="ghost" size="lg" className="rounded-full px-8 h-14 text-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
                            Özellikleri Keşfet ↓
                        </Button>
                    </div>
                </motion.div>
            </section>

            {/* Content Sections */}
            <div className="flex flex-col">
                {sections.map((section, index) => (
                    <section 
                        key={section.id} 
                        className={`min-h-screen py-24 flex items-center relative overflow-hidden ${
                            index % 2 === 0 
                                ? 'bg-slate-50 dark:bg-slate-950' 
                                : 'bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800'
                        }`}
                    >
                         <div className={`absolute -z-10 w-[800px] h-[800px] rounded-full blur-[120px] opacity-[0.03] pointer-events-none 
                            bg-gradient-to-r ${section.color}
                            ${index % 2 === 0 ? '-right-96 top-0' : '-left-96 bottom-0'}
                         `} />

                        <div className="container mx-auto px-6 md:px-12">
                            <div className={`flex flex-col lg:flex-row items-center gap-16 lg:gap-24 ${
                                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                            }`}>
                                
                                {/* Info Block */}
                                <motion.div 
                                    initial={{ opacity: 0, y: 40 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-10%" }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="flex-1 space-y-8"
                                >
                                    <div className={`inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br ${section.color} shadow-lg text-white mb-2`}>
                                        <section.icon className="w-8 h-8" />
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className={`text-sm font-bold tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r ${section.color}`}>
                                            {section.subtitle}
                                        </h3>
                                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                                            {section.title}
                                        </h2>
                                        <div className="h-1 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    </div>

                                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                                        {section.description}
                                    </p>

                                    <div className="grid grid-cols-1 gap-4 pt-4">
                                        {section.highlights.map((highlight, idx) => (
                                            <motion.div 
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 * idx, duration: 0.5 }}
                                                className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                                            >
                                                <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br ${section.color}`}> 
                                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{highlight}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Visual Block */}
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9, rotate: index % 2 === 0 ? 2 : -2 }}
                                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                                    viewport={{ once: true, margin: "-10%" }}
                                    transition={{ duration: 1, type: "spring", bounce: 0.3 }}
                                    className="flex-1 w-full relative"
                                >
                                    {/* Abstract UI Window */}
                                    <div className="relative aspect-square md:aspect-[4/3] rounded-[2.5rem] bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 shadow-2xl border border-white/40 dark:border-white/5 p-4 overflow-hidden group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] transition-shadow duration-500">
                                        
                                        {/* Browser Header Visual */}
                                        <div className="absolute top-6 left-8 right-8 h-10 bg-white/50 dark:bg-black/20 backdrop-blur rounded-full flex items-center px-4 gap-2 border border-black/5 dark:border-white/5">
                                            <div className="flex gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                            </div>
                                        </div>

                                        {/* Dynamic Content Visual based on section */}
                                        <div className="absolute inset-0 top-24 bottom-0 flex items-center justify-center">
                                            {/* Big Icon Visual */}
                                            <div className={`w-4/5 h-4/5 rounded-3xl bg-gradient-to-br ${section.color} bg-opacity-10 backdrop-blur-3xl flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-700`}>
                                                <div className="absolute inset-0 bg-white/10 dark:bg-black/10 mix-blend-overlay" />
                                                <section.icon className="w-32 h-32 text-white drop-shadow-2xl opacity-90" strokeWidth={1} />
                                                
                                                {/* Decorative Circles */}
                                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
                                                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-2xl" />
                                            </div>
                                        </div>

                                        {/* Floating Badge (Example) */}
                                        <div className="absolute bottom-8 right-8 bg-white/80 dark:bg-black/50 backdrop-blur px-6 py-3 rounded-2xl shadow-lg border border-white/20 dark:border-white/10 flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${section.color} animate-pulse`} />
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-wide">
                                               AuditPro v2
                                            </span>
                                        </div>

                                    </div>
                                </motion.div>

                            </div>
                        </div>
                    </section>
                ))}
            </div>
            
            {/* System Flow Steps */}
            <section className="py-32 bg-slate-900 text-white relative">
                 <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                 <div className="container mx-auto px-6">
                    <div className="text-center mb-20">
                        <Badge className="mb-6 bg-blue-600 hover:bg-blue-700 text-white border-none py-1 px-4 text-sm">İŞ AKIŞI</Badge>
                        <h2 className="text-4xl md:text-5xl font-bold mb-6">Sistem Özet Akışı</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-lg font-light">
                            Uçtan uca entegre ve kesintisiz denetim süreci.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { step: 1, title: "Planlama", desc: "Admin denetimi planlar ve personel atar.", icon: Settings },
                            { step: 2, title: "Saha Denetimi", desc: "Denetmen formu doldurur, fotoğraflar ve tamamlar.", icon: FileText },
                            { step: 3, title: "Hesaplama", desc: "Sistem puanı ve raporu otomatik üretir.", icon: Cpu },
                            { step: 4, title: "Aksiyon", desc: "Mağaza eksikleri görüp 3 gün içinde düzeltir.", icon: Activity },
                            { step: 5, title: "Onay", desc: "Admin çözümü inceler ve onaylar.", icon: CheckCircle2 },
                            { step: 6, title: "Analiz", desc: "Bölge müdürü ve yönetim performansı izler.", icon: LayoutDashboard },
                        ].map((item, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors relative group"
                            >
                                <div className="text-6xl font-black text-white/5 absolute top-4 right-4 group-hover:text-white/10 transition-colors">
                                    {item.step}
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-6">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                <p className="text-slate-400">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                 </div>
            </section>

             {/* Footer */}
             <footer className="py-12 bg-slate-950 text-slate-500 text-center border-t border-slate-900">
                <div className="container mx-auto px-4">
                    <p className="text-sm font-medium">&copy; {new Date().getFullYear()} AuditPro. Tüm hakları saklıdır.</p>
                </div>
             </footer>
        </div>
    );
}
