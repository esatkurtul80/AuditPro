"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, BrainCircuit, Loader2, Download, CheckCircle2 } from "lucide-react";
import { Audit, DateRangeFilter } from "@/lib/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

interface BulkAIAnalysisDialogProps {
    audits: Audit[];
    dateRange: DateRangeFilter;
}

export function BulkAIAnalysisDialog({ audits, dateRange }: BulkAIAnalysisDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"ready" | "processing" | "result">("ready");
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string>("");
    const [elapsedTime, setElapsedTime] = useState(0);
    
    // Yalnızca tamamlanmış olanları baz al
    const completedAudits = audits.filter(a => a.status === "tamamlandi");

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

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (loading) {
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [loading]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    useEffect(() => {
        if (open) {
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
    }, [open]);

    const cssVars = {
        '--font-global': typography.fontGlobal,
        '--h1-size': `${typography.h1Size}px`,
        '--h1-weight': typography.h1Bold ? '700' : '400',
        '--h1-style': typography.h1Italic ? 'normal' : 'normal',
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
        if (!dateRange.from) {
            toast.error("Lütfen analiz edilecek bir gün seçin.");
            return;
        }

        const fromDate = new Date(dateRange.from);
        if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            if (fromDate.toDateString() !== toDate.toDateString()) {
                toast.error("Yapay zeka analizlerinde aşırı veri yüklenmesini ve token aşımını engellemek için lütfen aralık olarak sadece 1 GÜN seçiniz (örn: 07.01.2026 - 07.01.2026).");
                return;
            }
        }

        if (completedAudits.length === 0) {
            toast.error("Belirtilen tarih aralığında tamamlanmış denetim bulunamadı.");
            return;
        }

        setStep("processing");
        setLoading(true);
        setElapsedTime(0);

        try {
            const sectionsDataMap = new Map();
            const personnelList: any[] = [];

            completedAudits.forEach(audit => {
                audit.sections?.forEach(section => {
                    const sectionName = section.sectionName || (section as any).title || (section as any).name || "Adsız Bölüm";
                    const issues: string[] = [];

                    section.answers?.forEach(ans => {
                        // Kırılan Puan veya Hayır cevapları (Optimizasyon)
                        const isNo = String(ans.answer).toLowerCase().trim() === "hayır" || String(ans.answer).toLowerCase().trim() === "hayir";
                        const deducted = typeof ans.earnedPoints === "number" && typeof ans.maxPoints === "number" && ans.earnedPoints < ans.maxPoints;

                        if (isNo || deducted) {
                            issues.push(`Sorun: ${ans.questionText} (Puan: ${ans.earnedPoints || 0}/${ans.maxPoints || 0})`);
                        }

                        if (ans.notes && ans.notes.length > 0) {
                            ans.notes.forEach(note => {
                                // Geriye dönük uyumluluk: note nesne ise veya direkt string ise.
                                if (typeof note === 'object' && note !== null) {
                                    const type = (note as any).type || "NOT";
                                    const text = (note as any).text || "";
                                    issues.push(`[${String(type).toUpperCase()}] Notu: ${text}`);
                                } else {
                                    issues.push(`[NOT]: ${note}`);
                                }
                            });
                        }

                        const originalNotes = (ans.actionData as any)?.originalNotes || ans.actionData?.storeNote;
                        if (originalNotes) {
                            issues.push(`[SİSTEM NOTU]: ${originalNotes}`);
                        }
                    });

                    if (issues.length > 0) {
                        if (!sectionsDataMap.has(sectionName)) {
                            sectionsDataMap.set(sectionName, []);
                        }
                        sectionsDataMap.get(sectionName).push({
                            storeName: audit.storeName,
                            auditor: audit.auditorName || "Bilinmiyor",
                            issues: issues
                        });
                    }
                });
            });

            // Personel Değerlendirmeleri Çekimi
            const auditIds = completedAudits.map(a => a.id);
            const chunkArray = (arr: string[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
            const idChunks = chunkArray(auditIds, 30); // Firestore 'in' limitation
            
            for (const chunk of idChunks) {
                const q = query(collection(db, "personnel_evaluations"), where("auditId", "in", chunk));
                const snap = await getDocs(q);
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const isResigned = data.personnelStatus === 'resigned' || data.comment === '[İşten Ayrıldı]';
                    const isLeave = data.comment === '[İzinli]' || (data.score !== undefined && data.score < 0);
                    // Olumsuzluk ve yorum kriteri (Sadece sorun/yorum olanlar AI'a aktarılır)
                    const hasComment = data.comment && data.comment.trim() !== '';
                    const hasLowScore = data.score !== undefined && data.score < 100;
                    
                    if (!isResigned && !isLeave && (hasComment || hasLowScore)) {
                        const matchingAudit = completedAudits.find(a => a.id === data.auditId);
                        personnelList.push({
                            storeName: matchingAudit?.storeName || "Bilinmiyor",
                            personnelName: data.personnelName,
                            score: data.score,
                            comment: data.comment
                        });
                    }
                });
            }

            const compressedData = {
                totalAnalysedStores: completedAudits.length,
                sections: Array.from(sectionsDataMap.entries()).map(([k, v]) => ({ sectionName: k, notesByStore: v })),
                negativePersonnel: personnelList
            };

            const response = await fetch("/api/ai/analyze-bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ compressedData }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Toplu Analiz yapılamadı");
            }

            setReport(data.report);
            setStep("result");
        } catch (error: any) {
            console.error("Bulk AI Analysis Error:", error);
            toast.error(error.message);
            setStep("ready");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep("ready");
        setReport("");
    };

    const handleDownload = async () => {
        if (!reportRef.current || !window.html2pdf) return;
        
        const element = reportRef.current;
        const originalParent = element.parentElement;
        const originalNextSibling = element.nextSibling;

        const originalStyle = {
            width: element.style.width,
            margin: element.style.margin,
            boxShadow: element.style.boxShadow,
            height: element.style.height,
            minHeight: element.style.minHeight,
            transform: element.style.transform,
            transformOrigin: element.style.transformOrigin,
        };

        // Create a wrapper that escapes the modal constraints
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = `${window.scrollY}px`; 
        wrapper.style.left = '0px';
        wrapper.style.width = '794px';
        wrapper.style.background = '#f0f2f5'; 
        wrapper.style.zIndex = '-9999';
        
        element.style.width = '794px'; 
        element.style.margin = '0 auto'; 
        element.style.boxShadow = 'none';
        element.style.height = 'auto'; 
        element.style.minHeight = 'auto';
        element.style.transform = 'none';
        element.style.transformOrigin = '';

        wrapper.appendChild(element);
        document.body.appendChild(wrapper);

        // Ensure we're ready
        await new Promise<void>(r => setTimeout(r, 200));

        const dateString = formatDateRange();
        // Dinamik isim oluşturuluyor: Örn: "07.04.2026 Denetim Raporu Analizi.pdf"
        const fileName = `${dateString} Denetim Raporu Analizi.pdf`;
        const toastId = toast.loading("PDF hazırlanıyor, lütfen bekleyin...");

        try {
            const realContentHeight = element.scrollHeight;
            const SCALE = 2;
            const PAGE_H_CSS = 12000;
            const pages = Math.ceil(realContentHeight / PAGE_H_CSS);
            const pdfW_mm = +(794 * 0.264583).toFixed(2);

            const html2canvasCfg = {
                scale: SCALE,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                x: 0,
                windowWidth: 794,
                logging: false,
            };

            const jspdfModule = await import('jspdf');
            const jsPDFLib: any = jspdfModule.jsPDF ?? (jspdfModule as any).default?.jsPDF ?? (jspdfModule as any).default;
            if (!jsPDFLib) throw new Error('jsPDF yüklenemedi');

            const firstPageH = Math.min(PAGE_H_CSS, realContentHeight);
            const firstPageMm = +(firstPageH * 0.264583).toFixed(2);

            const pdf = new jsPDFLib({
                unit: 'mm',
                format: [pdfW_mm, firstPageMm],
                orientation: 'portrait',
            });

            for (let i = 0; i < pages; i++) {
                const yStart = i * PAGE_H_CSS;
                const chunkH = Math.min(PAGE_H_CSS, realContentHeight - yStart);
                const chunkMm = +(chunkH * 0.264583).toFixed(2);

                const chunkCanvas: HTMLCanvasElement = await window.html2pdf()
                    .set({ html2canvas: { ...html2canvasCfg, y: yStart, height: chunkH } })
                    .from(element)
                    .toCanvas()
                    .get('canvas');

                const imgData = chunkCanvas.toDataURL('image/jpeg', 0.92);

                if (i === 0) {
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW_mm, chunkMm);
                } else {
                    pdf.addPage([pdfW_mm, chunkMm], 'portrait');
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW_mm, chunkMm);
                }
            }

            pdf.save(fileName);
            toast.success("PDF İndirildi", { id: toastId });
        } catch (err) {
            console.error("PDF Hatası:", err);
            toast.error("PDF oluşturulurken hata oluştu", { id: toastId });
        } finally {
            // Restore back to original location
            if (originalNextSibling) {
                originalParent?.insertBefore(element, originalNextSibling);
            } else {
                originalParent?.appendChild(element);
            }
            if (document.body.contains(wrapper)) {
                document.body.removeChild(wrapper);
            }

            element.style.width = originalStyle.width;
            element.style.margin = originalStyle.margin;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.height = originalStyle.height;
            element.style.minHeight = originalStyle.minHeight;
            element.style.transform = originalStyle.transform;
            element.style.transformOrigin = originalStyle.transformOrigin;
        }
    };

    const formatDateRange = () => {
        if (!dateRange.from && !dateRange.to) return "Tüm Zamanlar";
        const from = dateRange.from ? new Date(dateRange.from).toLocaleDateString("tr-TR") : "...";
        const to = dateRange.to ? new Date(dateRange.to).toLocaleDateString("tr-TR") : "...";
        if (from === to) return from;
        return `${from} - ${to}`;
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) reset();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:border-purple-300 text-purple-700 shadow-sm animate-in fade-in zoom-in h-9 px-3 lg:px-4">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="hidden sm:inline">Toplu Yapay Zeka Analizi</span>
                    <span className="sm:hidden">Toplu AI</span>
                </Button>
            </DialogTrigger>

            <DialogContent className={`sm:max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 ${step === "result" ? "[&>button.absolute]:hidden" : ""}`}>
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
                    
                    /* NEW: Puan Tablosu Stilleri */
                    .summary-table-box { width: 100%; margin-bottom: 25px; border: var(--border-style); border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
                    .summary-table-header { background: var(--primary); color: white; padding: 12px 20px; font-weight: bold; font-size: 15px; }
                    .summary-table { width: 100%; border-collapse: collapse; }
                    .summary-table th { background: #f8f8f8; color: #444; font-weight: bold; text-align: left; padding: 10px 15px; border-bottom: 2px solid #ddd; font-size: var(--th-size); }
                    .summary-table td { padding: 10px 15px; border-bottom: 1px solid #eee; font-size: var(--td-size); }
                    .summary-table tr:hover { background-color: #fafafa; }
                    .summary-table tr:last-child td { border-bottom: none; }
                    .score-badge { background: #ffd700; padding: 3px 10px; border-radius: 4px; font-weight: bold; color: #000; font-size: 13px;}

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
                    .st-6 { --primary: #e67e22; } .st-6 .section-banner { border-left: 10px solid #e67e22; background: #333; } .st-6 .summary-table-header { background: #333; border-left: 10px solid #e67e22; }
                    .st-7 { --primary: #2c3e50; } .st-7 .report-header { border: 2px solid #2c3e50; background: #fff; text-align: center; justify-content: center; } .st-7 .section-banner, .st-7 .summary-table-header { background: transparent; color: #2c3e50; border-bottom: 1px solid #2c3e50; }
                    .st-8 { --primary: #4a69bd; } .st-8 .section-card, .st-8 .summary-table-box { border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: none; }
                    .st-9 { --primary: #c0392b; } .st-9 .report-header { border: 5px solid #c0392b; }
                    .st-10 { --primary: #7f8c8d; } .st-10 .section-card, .st-10 .summary-table-box { border: none; border-top: 1px solid #eee; }
                    .st-11 { --primary: #34495e; } .st-11 .report-header { border: 2px dashed #34495e; background: #ecf0f1; }
                    .st-14 { --primary: #8d6e63; } .st-14 .report-page { background: #fdf5e6; }
                    .st-16 { --primary: #192a56; } .st-16 .report-page { border: 10px double #192a56; }
                    .st-17 { --primary: #00b894; } .st-17 .report-header { border-top: 10px solid #00b894; }
                `}</style>

                <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-purple-600" />
                            Toplu Yapay Zeka Analizi
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                            Seçili tarih aralığındaki tüm denetimleri kapsayan stratejik ve bölüm bazlı AI raporu.
                        </DialogDescription>
                    </div>
                    {step === "result" && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={reset}>Kapat</Button>
                            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleDownload}>
                                <Download className="w-4 h-4 mr-2" /> PDF İndir
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
                    {step === "ready" && (
                        <div className="py-16 flex flex-col items-center gap-8 max-w-md mx-auto">
                            
                            <div className="bg-white p-6 rounded-xl border shadow-sm w-full space-y-4">
                                <div className="flex items-center gap-3 border-b pb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Seçili Tarih Aralığı</p>
                                        <p className="text-xs text-slate-500">{formatDateRange()}</p>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-sm font-medium text-slate-600">Tamamlanan Denetim Sayısı:</span>
                                    <span className="text-lg font-bold text-slate-800 px-3 py-1 bg-slate-100 rounded-md">
                                        {completedAudits.length} Adet
                                    </span>
                                </div>
                            </div>

                            <Button
                                onClick={handleAnalyze}
                                disabled={completedAudits.length === 0 || loading}
                                size="lg"
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                {completedAudits.length > 0 ? "Toplu Analizi Başlat" : "Analiz Edilecek Veri Yok"}
                            </Button>
                            
                            <div className="text-xs text-muted-foreground text-center bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-yellow-800">
                                <span className="font-semibold block mb-1">Optimizasyon Bilgisi:</span>
                                Token limitlerinin aşılmaması ve daha hedef odaklı bir sonuç çıkması için sadece **tam puan alınamayan (eksik)** sorular ve **denetmen notları** yapılandırılarak Yapay Zekaya aktarılır.
                            </div>
                        </div>
                    )}

                    {step === "processing" && (
                        <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-16 h-16 text-purple-600 animate-spin relative z-10" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent animate-pulse">
                                    Toplu Analiz Yürütülüyor...
                                </h3>
                                <div className="text-3xl font-mono text-purple-700 font-bold tracking-widest">
                                    {formatTime(elapsedTime)}
                                </div>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                    {completedAudits.length} denetimindeki tüm bölümler inceleniyor, mağazalar arası ortak zayıflıklar tespit ediliyor... Lütfen bekleyin.
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
                                        <h1>Denetim Analizi</h1>
                                        <h2>{formatDateRange()} | Ortak Performans Raporu</h2>
                                    </div>
                                </header>
                                <div className="content">
                                    
                                    {/* MAĞAZA ÖZET TABLOSU */}
                                    <div className="summary-table-box">
                                        <div className="summary-table-header">
                                            ANALİZ EDİLEN MAĞAZALARIN PUAN TABLOSU
                                        </div>
                                        <table className="summary-table">
                                            <thead>
                                                <tr>
                                                    <th>Mağaza Adı</th>
                                                    <th>Denetmen</th>
                                                    <th>Tarih</th>
                                                    <th>Puan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {completedAudits.map(audit => {
                                                    const formattedDate = audit.completedAt 
                                                        ? (typeof audit.completedAt.toDate === 'function' ? audit.completedAt.toDate() : new Date((audit.completedAt as any).seconds * 1000)).toLocaleDateString('tr-TR')
                                                        : '-';
                                                    
                                                    return (
                                                        <tr key={audit.id}>
                                                            <td><strong>{audit.storeName}</strong></td>
                                                            <td>{audit.auditorName || '-'}</td>
                                                            <td>{formattedDate}</td>
                                                            <td><span className="score-badge">{audit.totalScore || 0}</span></td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* AI RAPOR ÇIKTISI */}
                                    <ReactMarkdown 
                                        components={{
                                            h2: ({node, ...props}) => (
                                                <div className="section-card">
                                                    <div className="section-banner">
                                                        <span>{props.children}</span>
                                                        <span>ORTAK ANALİZ</span>
                                                    </div>
                                                </div>
                                            ),
                                            h3: ({node, ...props}) => <h3 className="md-h3">{props.children}</h3>,
                                            p: ({node, ...props}) => <p className="md-p">{props.children}</p>,
                                            ul: ({node, ...props}) => <ul className="pl-5 list-disc mb-4" style={{color: '#444'}}>{props.children}</ul>,
                                            li: ({node, ...props}) => <li className="md-li">{props.children}</li>,
                                            strong: ({node, ...props}) => <strong style={{ fontWeight: 800, color: '#000' }}>{props.children}</strong>,
                                            table: ({node, ...props}) => <table className="md-table">{props.children}</table>,
                                            th: ({node, ...props}) => <th>{props.children}</th>,
                                            td: ({node, ...props}) => <td>{props.children}</td>,
                                        }}
                                    >
                                        {report.replace(/\*{0,2}Tespit Edilen Eksiklikler:\*{0,2}/g, "**Tespit Edilen Eksiklikler:**")
                                               .replace(/\*{0,2}Gelişim Alanları:\*{0,2}/g, "**Gelişim Alanları:**")
                                               .replace(/\*{0,2}Denetmen Notları:\*{0,2}/g, "**Denetmen Notları:**")}
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
