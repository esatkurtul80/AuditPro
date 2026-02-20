"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import { 
    ShieldCheck, 
    Smartphone, 
    Store, 
    Users, 
    Database,
    Zap,
    FileText,
    TrendingUp
} from "lucide-react";

const modules = [
    {
        id: "01",
        title: "Merkezi İstasyon",
        name: "Yönetim (Admin)",
        icon: ShieldCheck,
        color: "from-blue-500 to-indigo-500",
        desc: "Sistemin analitik ve operasyonel kalbi. Planlamaların, form yapı taşlarının ve büyük verinin orkestre edildiği tam yetkili kontrol noktası.",
        features: [
            { icon: Database, text: "Akıllı Algoritma: 12 Gün Kuralı ve Rota Çizimi" },
            { icon: FileText, text: "Detaylı Puanlama: Muaf sistemiyle çalışan ağırlıklı modüller" },
            { icon: Zap, text: "Aksiyon ve Ret Mekanizması: Kapanış Kanıtlarının Onayı" },
            { icon: TrendingUp, text: "Raporlar: Puan Sıralaması, Aksiyon Performans, Personel Raporu, Özel PDF Raporlar" }
        ]
    },
    {
        id: "02",
        title: "Saha Operasyonu",
        name: "Denetmen Uygulaması",
        icon: Smartphone,
        color: "from-emerald-500 to-teal-500",
        desc: "Sahadaki personelin, internetin olmadığı kör noktalarda dahi denetim verilerini güvenle toplayabilmesi için izole edilmiş mobil uyumlu terminal.",
        features: [
            { icon: Store, text: "Mağaza Analizi: Müdür bilgisi, Eski Puanlar, Kronik (Tekrar Eden) Hatalar" },
            { icon: Database, text: "Offline-First: Kesintisiz Senkronizasyon" },
            { icon: FileText, text: "Görüşler: Başarısızlıklarda Zorunlu Fotoğraf ve Ek Ziyaret Notları" }
        ]
    },
    {
        id: "03",
        title: "Reaksiyon Terminali",
        name: "Mağaza Portalı",
        icon: Store,
        color: "from-rose-500 to-pink-500",
        desc: "Odak noktası sadece aksiyon almak olan daraltılmış arayüz. Mağaza müdürlerinin eksikliklerini raporlamak için kullandığı geri dönüşüm kanalı.",
        features: [
            { icon: Zap, text: "SLA Döngüsü: 72 Saat İçinde 'Kanıtlı Kapatma' Süresi" },
            { icon: Users, text: "Anında Canlı Bildirim: Denetim Bittiğinde Mağazaya Push Uyarı" },
            { icon: TrendingUp, text: "Tarihsel Karneler: Reddedilen Aksiyonların İncelemesi" }
        ]
    },
    {
        id: "04",
        title: "Makro Gözetim",
        name: "Bölge Yöneticisi Paneli",
        icon: Users,
        color: "from-amber-500 to-orange-500",
        desc: "Operasyonel işleme doğrudan temas etmeyen, yalnızca altındaki mağaza kümesinin performans nabzını tutan analitik izleme kulesi.",
        features: [
            { icon: TrendingUp, text: "Gözlem Hattı: Alt Mağazaların Metrik Kıyaslaması ve Standart Kontrolü" },
            { icon: Zap, text: "Kritik Alarm Listesi: Geciken Aksiyonlara Sahip Lokasyonlar" },
            { icon: ShieldCheck, text: "Push İletişimi: Denetim Başladığında ve Bittiğinde Bölge Müdürüne Bildirim" }
        ]
    }
];

const HeroSection = () => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });
    
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

    return (
        <motion.div 
            ref={ref}
            className="h-screen flex flex-col items-center justify-center relative overflow-hidden"
            style={{ opacity }}
        >
            <motion.div style={{ y }} className="flex flex-col items-center text-center z-10 space-y-8 px-6">
                <div className="relative w-48 h-48 md:w-64 md:h-64 drop-shadow-2xl mb-4">
                    <Image 
                        src="/logo.png" 
                        alt="AuditPro Logo" 
                        fill 
                        className="object-contain"
                        priority
                    />
                </div>
                
                <h1 className="text-5xl md:text-8xl font-medium tracking-tighter leading-tight">
                    Sistem Mimarisi.
                </h1>
                
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl font-light">
                    Avant-Garde yaklaşımla tasarlanmış, mağaza standartlarını dijitalleştiren dört terminalli operasyon platformu.
                </p>

                <div className="animate-bounce pt-12 text-muted-foreground">
                    <span className="text-xs uppercase tracking-[0.3em]">Aşağı Kaydır</span>
                </div>
            </motion.div>

            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-primary/5 rounded-full blur-[120px] -z-10" />
        </motion.div>
    );
};

const PresentationSlide = ({ mod, index }: { mod: any, index: number }) => {
    const isEven = index % 2 === 0;

    return (
        <div className="min-h-screen flex items-center justify-center py-24 px-6 md:px-12 sticky top-0 bg-background overflow-hidden border-t border-border/40">
            {/* Background Accent */}
            <div className={`absolute top-0 opacity-10 blur-[100px] w-full h-[500px] bg-gradient-to-br ${mod.color} ${isEven ? 'left-[-20%]' : 'right-[-20%]'}`} />

            <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center z-10">
                
                <motion.div 
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className={`space-y-8 ${isEven ? 'lg:order-1' : 'lg:order-2'}`}
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className={`text-sm tracking-[0.3em] uppercase font-bold bg-clip-text text-transparent bg-gradient-to-r ${mod.color}`}>
                                {mod.title}
                            </span>
                        </div>
                        <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-[0.9]">
                            {mod.name}
                        </h2>
                    </div>

                    <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
                        {mod.desc}
                    </p>

                    <div className="grid gap-6 pt-8 border-t border-border/50">
                        {mod.features.map((feat: any, i: number) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl bg-gradient-to-br ${mod.color} bg-opacity-10 dark:bg-opacity-20`}>
                                    <feat.icon className="w-5 h-5 text-foreground" />
                                </div>
                                <span className="text-sm md:text-base font-medium text-foreground/80">{feat.text}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Abstract Visual Representation */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative w-full aspect-square md:aspect-[4/3] rounded-[2rem] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-black border border-border/50 ${isEven ? 'lg:order-2' : 'lg:order-1'}`}
                >
                    {/* Big Typography Number */}
                    <div className="absolute -bottom-12 -right-12 text-[16rem] font-black text-foreground/5 leading-none select-none pointer-events-none">
                        {mod.id}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br ${mod.color} blur-3xl opacity-20`} />
                        <mod.icon className="absolute w-32 h-32 md:w-48 md:h-48 text-foreground/80 drop-shadow-2xl" strokeWidth={0.5} />
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

export default function PresentationInfoPage() {
    return (
        <div className="min-h-[200vh] bg-background text-foreground selection:bg-primary/20">
            <HeroSection />
            
            <div className="relative z-10">
                {modules.map((mod, index) => (
                    <PresentationSlide key={mod.id} mod={mod} index={index} />
                ))}
            </div>

            <section className="h-screen flex flex-col items-center justify-center border-t border-border/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center space-y-8 z-10"
                >
                    <div className="w-24 h-24 mx-auto relative opacity-50 grayscale">
                        <Image src="/logo.png" alt="AuditPro" fill className="object-contain" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-medium tracking-tighter">
                        Kesintisiz Entegrasyon.
                    </h2>
                    <p className="text-muted-foreground uppercase tracking-[0.3em] text-sm">
                        Veriden Aksiyona / AuditPro v2
                    </p>
                </motion.div>
            </section>
        </div>
    );
}


