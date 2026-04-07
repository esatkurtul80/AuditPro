"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, BrainCircuit, Loader2, Download } from "lucide-react";
import { Store } from "@/lib/types";
import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AIAnalysisDialogProps {
    trigger?: React.ReactNode;
}

export function AIAnalysisDialog({ trigger }: AIAnalysisDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"select" | "processing" | "result">("select");
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string>("");
    const [metadata, setMetadata] = useState<any>(null);
    
    // Theme states
    const [templateId, setTemplateId] = useState('st-1');
    const [logo, setLogo] = useState<string>("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3e%3crect width='200' height='80' fill='%23eee'/%3e%3ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23666'%3eLOGO%3c/text%3e%3c/svg%3e");
    const [typography, setTypography] = useState({
        fontGlobal: "'Roboto', sans-serif",
        h1Size: 26, h1Bold: true, h1Italic: false,
        h2Size: 15, h2Bold: false, h2Italic: false,
        thSize: 13, thBold: true, thItalic: false,
        tdSize: 13, tdBold: false, tdItalic: false,
    });
    const reportRef = useRef<HTMLDivElement>(null);

    // Fetch stores & design config on open
    useEffect(() => {
        if (open) {
            if (stores.length === 0) {
                const fetchStores = async () => {
                    const q = query(collection(db, "stores"), orderBy("name"));
                    const snapshot = await getDocs(q);
                    setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store)));
                };
                fetchStores();
            }

            const loadConfig = async () => {
                try {
                    const docRef = doc(db, "settings", "special-report-design");
                    const docSnap = await getDoc(docRef);
                    let config = null;

                    if (docSnap.exists()) {
                        config = docSnap.data();
                    } else {
                        const savedData = localStorage.getItem('auditPro_DesignConfig');
                        if (savedData) config = JSON.parse(savedData);
                    }

                    if (config) {
                        if (config.templateId) setTemplateId(config.templateId);
                        if (config.logo) setLogo(config.logo);

                        setTypography(prev => ({
                            ...prev,
                            fontGlobal: config.globalFont || prev.fontGlobal,
                            h1Size: config.h1_size || prev.h1Size,
                            h1Bold: config.h1_bold !== undefined ? config.h1_bold : prev.h1Bold,
                            h1Italic: config.h1_italic !== undefined ? config.h1_italic : prev.h1Italic,
                            h2Size: config.h2_size || prev.h2Size,
                            h2Bold: config.h2_bold !== undefined ? config.h2_bold : prev.h2Bold,
                            h2Italic: config.h2_italic !== undefined ? config.h2_italic : prev.h2Italic,
                            thSize: config.th_size || prev.thSize,
                            thBold: config.th_bold !== undefined ? config.th_bold : prev.thBold,
                            thItalic: config.th_italic !== undefined ? config.th_italic : prev.thItalic,
                            tdSize: config.td_size || prev.tdSize,
                            tdBold: config.td_bold !== undefined ? config.td_bold : prev.tdBold,
                            tdItalic: config.td_italic !== undefined ? config.td_italic : prev.tdItalic,
                        }));
                    }
                } catch (e) {
                    console.error("Design config load error", e);
                }
            };
            loadConfig();
        }
    }, [open, stores.length]);

    const cssVars = {
        '--font-global': typography.fontGlobal,
        '--h1-size': `${typography.h1Size}px`,
        '--h1-weight': typography.h1Bold ? '700' : '400',
        '--h1-style': typography.h1Italic ? 'italic' : 'normal',
        '--h2-size': `${typography.h2Size}px`,
        '--h2-weight': typography.h2Bold ? '700' : '400',
        '--h2-style': typography.h2Italic ? 'italic' : 'normal',
        '--th-size': `${typography.thSize}px`,
        '--th-weight': typography.thBold ? '700' : '400',
        '--th-style': typography.thItalic ? 'italic' : 'normal',
        '--td-size': `${typography.tdSize}px`,
        '--td-weight': typography.tdBold ? '700' : '400',
        '--td-style': typography.tdItalic ? 'italic' : 'normal',
    } as React.CSSProperties;

    const handleAnalyze = async () => {
        if (!selectedStoreId) return;

        setStep("processing");
        setLoading(true);

        try {
            const response = await fetch("/api/ai/analyze-store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId: selectedStoreId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Analiz yapılamadı");
            }

            setReport(data.report);
            setMetadata(data.metadata || null);
            setStep("result");
        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            toast.error(error.message);
            setStep("select");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep("select");
        setSelectedStoreId("");
        setReport("");
        setMetadata(null);
    };

    const handleDownload = async () => {
        if (!reportRef.current || !window.html2pdf) return;
        
        const element = reportRef.current;
        const originalStyle = {
            width: element.style.width,
            margin: element.style.margin,
            boxShadow: element.style.boxShadow,
            height: element.style.height,
            minHeight: element.style.minHeight
        };

        element.style.width = '794px'; 
        element.style.margin = '0 auto'; 
        element.style.boxShadow = 'none';
        element.style.height = 'auto'; 
        element.style.minHeight = 'auto';

        const contentHeight = element.scrollHeight; 
        const opt = {
            margin: 0, 
            filename: 'AI_Sube_Analizi.pdf',
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, x: 0, y: 0, windowWidth: 794, height: contentHeight },
            jsPDF: { unit: 'px', format: [794, contentHeight], orientation: 'portrait' } 
        };

        try {
            await window.html2pdf().set(opt).from(element).save();
            toast.success("PDF İndirildi");
        } catch (err) {
            console.error("PDF Hatası:", err);
            toast.error("PDF oluşturulurken hata oluştu");
        } finally {
            element.style.width = originalStyle.width;
            element.style.margin = originalStyle.margin;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.height = originalStyle.height;
            element.style.minHeight = originalStyle.minHeight;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) reset();
        }}>
            {trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : (
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        AI Analiz
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&family=Open+Sans:wght@300;400;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Playfair+Display:wght@400;700&family=Merriweather:wght@300;400;700&family=Nunito:wght@300;400;700&family=Raleway:wght@300;400;700&family=Oswald:wght@300;400;700&family=PT+Serif:wght@400;700&family=Poppins:wght@300;400;700&family=Ubuntu:wght@300;400;700&family=Roboto+Slab:wght@300;400;700&family=Quicksand:wght@300;400;700&family=Inconsolata:wght@300;400;700&family=Crimson+Text:wght@400;700&family=Work+Sans:wght@300;400;700&display=swap" rel="stylesheet" />
                <style jsx global>{`
                    :root {
                        --primary: #800020;
                        --header-bg: #fff;
                        --border-style: 1px solid #ccc;
                    }

                    .report-wrapper { background-color: #f0f2f5; display: flex; flex-direction: column; align-items: center; padding: 20px; }
                    .report-page { width: 100%; max-width: 210mm; min-height: 297mm; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); color: #333; font-family: var(--font-global); margin-bottom: 20px; }
                    
                    .report-header { width: 100%; min-height: 140px; display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; background: var(--header-bg); border-bottom: 4px solid var(--primary); transition: all 0.3s ease; }
                    .logo-box img { max-height: 80px; max-width: 200px; object-fit: contain; }
                    .head-text { text-align: right; }
                    .head-text h1 { font-size: var(--h1-size) !important; font-weight: var(--h1-weight) !important; font-style: var(--h1-style) !important; color: var(--primary); font-family: var(--font-global); margin-bottom: 5px; }
                    .head-text h2 { font-size: var(--h2-size) !important; font-weight: var(--h2-weight) !important; font-style: var(--h2-style) !important; color: #777; font-family: var(--font-global); }
                    
                    .content { padding: 30px 40px; font-size: var(--td-size); }
                    .info-panel { background: #fff; padding: 5px 0 5px 25px; margin-bottom: 30px; border-left: 8px solid var(--primary); display: flex; flex-direction: column; justify-content: center; }
                    .info-title { color: var(--primary); margin-bottom: 15px; font-size: 16px; text-transform: uppercase; font-weight: bold; }
                    .info-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 40px; }
                    .info-row { display: flex; align-items: center; margin-bottom: 6px; }
                    .info-label { font-weight: bold; margin-right: 8px; color: #333; min-width: 110px; }
                    .info-val { color: #555; }
                    .score-badge { background: #ffd700; padding: 3px 10px; border-radius: 4px; font-weight: bold; color: #000; }
                    
                    .section-card { margin-top: 30px; margin-bottom: 20px; border: var(--border-style); page-break-inside: avoid; }
                    .section-banner { background: var(--primary); color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; font-size: var(--th-size) !important; font-weight: var(--th-weight) !important; font-style: var(--th-style) !important; }
                    
                    .md-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .md-table th { background: #f5f5f5; font-weight: bold; }
                    .md-table td, .md-table th { padding: 10px 15px; border: var(--border-style); text-align: left; font-size: var(--td-size); }
                    
                    .md-p { margin-bottom: 15px; line-height: 1.6; font-size: var(--td-size); color: #444; }
                    .md-h3 { color: var(--primary); font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
                    .md-li { margin-bottom: 6px; line-height: 1.5; font-size: var(--td-size); }

                    /* Themes */
                    .st-1 { --primary: #800020; } .st-1 .report-header { background: linear-gradient(110deg, #fff 65%, #f8f8f8 65%); }
                    .st-2 { --primary: #002347; --header-bg: #002347; } .st-2 .report-header { color: white; flex-direction: row-reverse; } .st-2 .head-text h1, .st-2 .head-text h2 { color: white !important; }
                    .st-4 { --primary: #000; } .st-4 .report-header { background: #FFD700; border: none; }
                    .st-5 { --primary: #2d5a27; } .st-5 .report-header { border-radius: 0 0 50px 50px; background: #f0f4f0; }
                    .st-6 { --primary: #e67e22; } .st-6 .section-banner { border-left: 10px solid #e67e22; background: #333; }
                    .st-7 { --primary: #2c3e50; } .st-7 .report-header { border: 2px solid #2c3e50; background: #fff; text-align: center; justify-content: center; } .st-7 .section-banner { background: transparent; color: #2c3e50; border-bottom: 1px solid #2c3e50; }
                    .st-8 { --primary: #4a69bd; } .st-8 .section-card { border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: none; }
                    .st-9 { --primary: #c0392b; } .st-9 .report-header { border: 5px solid #c0392b; }
                    .st-10 { --primary: #7f8c8d; } .st-10 .section-card { border: none; border-top: 1px solid #eee; }
                    .st-11 { --primary: #34495e; } .st-11 .report-header { border: 2px dashed #34495e; background: #ecf0f1; }
                    .st-14 { --primary: #8d6e63; } .st-14 .report-page { background: #fdf5e6; }
                    .st-16 { --primary: #192a56; } .st-16 .report-page { border: 10px double #192a56; }
                    .st-17 { --primary: #00b894; } .st-17 .report-header { border-top: 10px solid #00b894; }
                `}</style>

                <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-purple-600" />
                            Mağaza Yapay Zeka Analizi
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                            Mağaza denetim verilerinden elde edilen yapılandırılmış analiz raporu.
                        </DialogDescription>
                    </div>
                    {step === "result" && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={reset}>Yeni Analiz</Button>
                            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleDownload}>
                                <Download className="w-4 h-4 mr-2" /> PDF İndir
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
                    {step === "select" && (
                        <div className="py-12 flex flex-col items-center gap-6 max-w-sm mx-auto">
                            <div className="w-full space-y-2">
                                <label className="text-sm font-medium">Analiz Edilecek Mağaza</label>
                                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mağaza Seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map(store => (
                                            <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleAnalyze}
                                disabled={!selectedStoreId}
                                size="lg"
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Analizi Başlat
                            </Button>
                            <div className="text-xs text-muted-foreground text-center">
                                * Son denetim verileri, geçmiş performans trendleri ve stratejik hedefler detaylı olarak yapay zeka ile incelenecektir.
                            </div>
                        </div>
                    )}

                    {step === "processing" && (
                        <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-16 h-16 text-purple-600 animate-spin relative z-10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent animate-pulse">
                                    Yapay Zeka Analiz Ediyor...
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Mevcut sorunlar tespit ediliyor, trendler analiz ediliyor ve özel aksiyon planı oluşturuluyor. Lütfen bekleyin.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === "result" && (
                        <div className="report-wrapper">
                            <div className={`report-page ${templateId}`} style={cssVars} ref={reportRef}>
                                <header className="report-header">
                                    <div className="logo-box">
                                        <img src={logo} alt="Logo" />
                                    </div>
                                    <div className="head-text">
                                        <h1>Şube Yapay Zeka Şube Analizi</h1>
                                        <h2>Kapsamlı Değerlendirme & Gelişim Raporu</h2>
                                    </div>
                                </header>
                                <div className="content">
                                    <div className="info-panel">
                                        <div className="info-title">
                                            {stores.find(s => s.id === selectedStoreId)?.name?.toUpperCase() || "MAĞAZA"} - MAĞAZA BİLGİLERİ
                                        </div>
                                        {metadata ? (
                                            <div className="info-grid-2col">
                                                <div className="col-left">
                                                    <div className="info-row"><span className="info-label">Mağaza Adı:</span> <span className="info-val">{metadata.storeName}</span></div>
                                                    <div className="info-row"><span className="info-label">Denetimi Yapan:</span> <span className="info-val">{metadata.auditorName}</span></div>
                                                    <div className="info-row"><span className="info-label">İlgili Hafta:</span> <span className="info-val">{metadata.relatedWeek}</span></div>
                                                    <div className="info-row"><span className="info-label">Mağaza Puanı:</span> <span className="score-badge">{metadata.totalScore}</span></div>
                                                </div>
                                                <div className="col-right">
                                                    <div className="info-row"><span className="info-label">Denetim Tarihi:</span> <span className="info-val">{metadata.auditDate}</span></div>
                                                    <div className="info-row"><span className="info-label">Başlama Saati:</span> <span className="info-val">{metadata.startTime}</span></div>
                                                    <div className="info-row"><span className="info-label">Bitiş Saati:</span> <span className="info-val">{metadata.endTime}</span></div>
                                                    <div className="info-row"><span className="info-label">Önceki Denetmen:</span> <span className="info-val">{metadata.previousAuditor}</span></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "14px", color: "#555" }}>
                                                Bu rapor mağazanın en son denetim ve geçmiş verilerini baz alarak hazırlanmış yapay zeka değerlendirmesidir.
                                            </div>
                                        )}
                                    </div>

                                    <ReactMarkdown 
                                        components={{
                                            h2: ({node, ...props}) => (
                                                <div className="section-card">
                                                    <div className="section-banner">
                                                        <span>{props.children}</span>
                                                        <span>ANALİZ NOTLARI</span>
                                                    </div>
                                                </div>
                                            ),
                                            h3: ({node, ...props}) => <h3 className="md-h3">{props.children}</h3>,
                                            p: ({node, ...props}) => <p className="md-p">{props.children}</p>,
                                            ul: ({node, ...props}) => <ul className="pl-5 list-disc mb-4" style={{color: '#444'}}>{props.children}</ul>,
                                            li: ({node, ...props}) => <li className="md-li">{props.children}</li>,
                                            table: ({node, ...props}) => <table className="md-table">{props.children}</table>,
                                            th: ({node, ...props}) => <th>{props.children}</th>,
                                            td: ({node, ...props}) => <td>{props.children}</td>,
                                        }}
                                    >
                                        {report}
                                    </ReactMarkdown>
                                </div>
                                <footer style={{ textAlign: "center", fontSize: "11px", color: "#999", padding: "20px 0" }}>
                                    AuditPro Yapay Zeka Servisi | © {new Date().getFullYear()} Tüm Hakları Saklıdır.
                                </footer>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

