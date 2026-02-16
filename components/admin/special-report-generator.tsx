"use client";

import { useState, useEffect, useRef } from "react";
import { Audit, Store } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

interface SpecialReportGeneratorProps {
    audit: Audit;
    store?: Store; // Optional, can be derived from audit if not passed
    onComplete?: () => void;
    onError?: (error: any) => void;
}

declare global {
    interface Window {
        html2pdf: any;
    }
}

export function SpecialReportGenerator({ audit, store, onComplete, onError }: SpecialReportGeneratorProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const [templateId, setTemplateId] = useState('st-1');
    const [typography, setTypography] = useState({
        fontGlobal: "'Roboto', sans-serif",
        h1Size: 26, h1Bold: true, h1Italic: false,
        h2Size: 15, h2Bold: false, h2Italic: false,
        thSize: 13, thBold: true, thItalic: false,
        tdSize: 13, tdBold: false, tdItalic: false,
    });
    const [logo, setLogo] = useState<string>("");
    
    // Config state to track if loaded
    const [configLoaded, setConfigLoaded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [fetchedStore, setFetchedStore] = useState<Store | null>(null);

    const activeStore = store || fetchedStore;

    // CSS Variables injection
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

    useEffect(() => {
        // Load settings from new config key
        const savedData = localStorage.getItem('auditPro_DesignConfig');
        if (savedData) {
            try {
                const config = JSON.parse(savedData);
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
            } catch (e) {
                console.error("Error loading design config for generator", e);
            }
        }
        setConfigLoaded(true);
    }, []);

    // Check if script is already loaded (fix for re-download issue)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.html2pdf) {
            setScriptLoaded(true);
        }
    }, []);

    // Fetch store if missing
    useEffect(() => {
        if (!store && audit.storeId) {
            const fetchStore = async () => {
                try {
                    const docRef = doc(db, "stores", audit.storeId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setFetchedStore({ id: docSnap.id, ...docSnap.data() } as Store);
                    }
                } catch (error) {
                    console.error("Error fetching store for report:", error);
                }
            };
            fetchStore();
        }
    }, [store, audit.storeId]);

    // Helper to proxy images to avoid CORS
    const getProxiedUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("data:")) return url; // Already base64
        return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    };

    const generatePDF = async () => {
        if (!reportRef.current || !configLoaded) return;
        if (!window.html2pdf) {
            toast.error("PDF kütüphanesi henüz yüklenmedi, lütfen birkaç saniye bekleyip tekrar deneyin.");
            return;
        }
        
        setGenerating(true);

        const element = reportRef.current;
        
        // Snapshot current style
        const originalStyle = {
            width: element.style.width,
            margin: element.style.margin,
            boxShadow: element.style.boxShadow,
            height: element.style.height,
            minHeight: element.style.minHeight
        };

        // Modify for print to ensure single page look
        element.style.width = '794px'; 
        element.style.margin = '0 auto'; 
        element.style.boxShadow = 'none';
        element.style.height = 'auto'; 
        element.style.minHeight = 'auto';

        const contentHeight = element.scrollHeight; 
        
        const opt = {
            margin: 0, 
            filename: `Ozel_Rapor_${audit.storeName}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, x: 0, y: 0, windowWidth: 794, height: contentHeight },
            jsPDF: { unit: 'px', format: [794, contentHeight], orientation: 'portrait' } 
        };

        window.scrollTo(0, 0);

        try {
            await window.html2pdf().set(opt).from(element).save();
            onComplete?.();
        } catch (error) {
            console.error("PDF Generation Error:", error);
            onError?.(error);
        } finally {
            // Restore style
            element.style.width = originalStyle.width;
            element.style.margin = originalStyle.margin;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.height = originalStyle.height;
            element.style.minHeight = originalStyle.minHeight;
            setGenerating(false);
        }
    };

    // Trigger generation once script and settings are ready
    useEffect(() => {
        if (scriptLoaded && configLoaded && !generating) {
            // We wait a bit more logic:
            // If we need to fetch store (no store prop, audit.storeId exists, and valid fetchedStore is null)
            // But we don't want to hang forever if fetch fails.
            // Let's just use a timeout to allow fetch to complete 'likely'.
            // Or better: valid dependency.
            
            const timeOut = setTimeout(() => {
                generatePDF();
            }, 500); // Reduced to 500ms
            return () => clearTimeout(timeOut);
        }
    }, [scriptLoaded, configLoaded]);

    // State for previous auditor
    const [prevAuditor, setPrevAuditor] = useState<string>("-");

    useEffect(() => {
        const fetchPrevAuditor = async () => {
            if (!audit.storeId || !audit.createdAt) return;
            try {
                // Determine the comparison date properly
                let compareDate = audit.createdAt;
                // If it's a timestamp object (seconds/nanoseconds), we use it directly in query
                // If it's something else, we might need conversion, but Firestore usually handles standard field comparisons if types match.
                
                const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");
                const auditsRef = collection(db, 'audits');
                const q = query(
                    auditsRef,
                    where('storeId', '==', audit.storeId),
                    where('createdAt', '<', compareDate),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const prevStats = snapshot.docs[0].data();
                    setPrevAuditor(prevStats.auditorName || "-");
                }
            } catch (e) {
                console.error("Error fetching prev auditor", e);
            }
        };
        fetchPrevAuditor();
    }, [audit.storeId, audit.createdAt]);

    if (!configLoaded) return null;

    // Format helpers
    const getFormattedDate = (dateVal: any) => {
         if (!dateVal) return "-";
         const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
         return format(d, "dd.MM.yyyy");
    };
    
    const getFormattedTime = (dateVal: any) => {
         if (!dateVal) return "-";
         const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
         return format(d, "HH:mm");
    };

    const getWeekString = (dateVal: any) => {
        if (!dateVal) return "-";
        const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
        return format(d, "yyyy / ww. 'Hafta'", { locale: tr });
    };

    return (
        <>
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
                onReady={() => setScriptLoaded(true)}
                strategy="afterInteractive"
            />
            
            <style jsx global>{`
                /* ... (Font Imports remain same) ... */
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&family=Open+Sans:wght@300;400;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Playfair+Display:wght@400;700&family=Merriweather:wght@300;400;700&family=Nunito:wght@300;400;700&family=Raleway:wght@300;400;700&family=Oswald:wght@300;400;700&family=PT+Serif:wght@400;700&family=Poppins:wght@300;400;700&family=Ubuntu:wght@300;400;700&family=Roboto+Slab:wght@300;400;700&family=Quicksand:wght@300;400;700&family=Inconsolata:wght@300;400;700&family=Crimson+Text:wght@400;700&family=Work+Sans:wght@300;400;700&display=swap');

                .generator-wrapper {
                   /* Reset */
                   box-sizing: border-box;
                   margin: 0; 
                   padding: 0;
                   
                   /* Defaults from User Config */
                   --primary: #800020;
                   --header-bg: #fff;
                   --border-style: 1px solid #eee;

                   /* Font Defaults */
                   font-family: var(--font-global);
                   color: #333;
                }

                .generator-wrapper * { box-sizing: border-box; }

                .generator-wrapper .report-page {
                    width: 794px; /* A4 width in px at 96dpi */
                    background: white; 
                    position: relative; 
                    overflow: hidden; /* Ensure no spillover */
                }

                /* DINAMIK TIPOGRAFI UYGULAMALARI */
                .generator-wrapper .head-text h1 { 
                    font-size: var(--h1-size) !important; font-weight: var(--h1-weight) !important; font-style: var(--h1-style) !important;
                    color: var(--primary); font-family: var(--font-global); margin-bottom: 5px;
                }
                .generator-wrapper .head-text h2 { 
                    font-size: var(--h2-size) !important; font-weight: var(--h2-weight) !important; font-style: var(--h2-style) !important;
                    color: #777; font-family: var(--font-global);
                }
                
                /* SCOPED TYPOGRAPHY AS REQUESTED */
                .generator-wrapper .section-banner span {
                    font-size: var(--th-size) !important; font-weight: var(--th-weight) !important; font-style: var(--th-style) !important;
                    font-family: var(--font-global);
                }

                .generator-wrapper table th, .generator-wrapper table td, .generator-wrapper .opinion-text, .generator-wrapper .info-item {
                    font-size: var(--td-size) !important; font-weight: var(--td-weight) !important; font-style: var(--td-style) !important;
                    font-family: var(--font-global);
                }

                /* STANDART RAPOR CSS */
                .generator-wrapper .report-header { width: 100%; min-height: 140px; display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; background: var(--header-bg); border-bottom: 4px solid var(--primary); }
                .generator-wrapper .logo-box img { max-height: 80px; max-width: 200px; object-fit: contain; }
                .generator-wrapper .head-text { text-align: right; }
                .generator-wrapper .content { padding: 30px 40px; }
                
                /* Updated Info Panel CSS */
                .generator-wrapper .info-panel { 
                    background: #fff; 
                    padding: 5px 0 5px 25px; /* Left padding for the text */
                    margin-bottom: 30px; 
                    border-left: 8px solid var(--primary); 
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .generator-wrapper .info-title {
                    color: var(--primary);
                    margin-bottom: 15px;
                    font-size: 16px;
                    text-transform: uppercase;
                    font-weight: bold;
                }

                .generator-wrapper .info-grid-2col { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 15px 40px; 
                }
                
                .generator-wrapper .info-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 6px;
                }
                
                .generator-wrapper .info-label {
                    font-weight: bold;
                    margin-right: 8px;
                    color: #333;
                    min-width: 110px;
                }
                
                .generator-wrapper .info-val {
                    color: #555;
                }

                .generator-wrapper .score-badge {
                    background: #ffd700; 
                    padding: 3px 10px; 
                    borderRadius: 4px; 
                    fontWeight: bold;
                    color: #000;
                }
                
                .generator-wrapper .section-card { margin-bottom: 25px; border: var(--border-style); page-break-inside: avoid; }
                .generator-wrapper .section-banner { background: var(--primary); color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; }
                
                .generator-wrapper table { width: 100%; border-collapse: collapse; }
                .generator-wrapper td, .generator-wrapper th { padding: 10px 15px; border-bottom: 1px solid #f0f0f0; text-align: left; border-right: none; border-left: none; border-top: none; } 
                
                .generator-wrapper .opinion-box { display: flex; gap: 20px; padding: 15px; background: #fff; }
                .generator-wrapper .opinion-text { flex: 2; border-left: 3px solid #ddd; padding-left: 10px; color: #666; }
                .generator-wrapper .opinion-photo { flex: 1; height: 110px; background: #f5f5f5; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                .generator-wrapper .opinion-photo img { width: 100%; height: 100%; object-fit: cover; }

                /* Tasarım Sınıfları */
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
            
            {/* Hidden Report Container */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                <div 
                    ref={reportRef} 
                    className={`generator-wrapper ${templateId}`}
                    style={cssVars}
                >
                    <div className="report-page">
                        
                        <header className="report-header">
                            <div className="logo-box">
                                {logo && <img src={logo.startsWith('http') ? getProxiedUrl(logo) : logo} alt="Logo" crossOrigin="anonymous" />}
                            </div>
                            <div className="head-text">
                                <h1>Şube Denetim Raporu</h1>
                                <h2>Görüş, Öneri ve Tespit Formu</h2>
                            </div>
                        </header>

                        <div className="content">
                            
                            <div className="info-panel">
                                <div className="info-title">
                                    {(activeStore?.city || "MAĞAZA").toUpperCase()} - MAĞAZA BİLGİLERİ
                                </div>
                                <div className="info-grid-2col">
                                    <div className="col-left">
                                        <div className="info-row"><span className="info-label">Mağaza Adı:</span> <span className="info-val">{audit.storeName}</span></div>
                                        <div className="info-row"><span className="info-label">Denetimi Yapan:</span> <span className="info-val">{audit.auditorName}</span></div>
                                        <div className="info-row"><span className="info-label">İlgili Hafta:</span> <span className="info-val">{getWeekString(audit.createdAt)}</span></div>
                                        <div className="info-row"><span className="info-label">Mağaza Puanı:</span> <span className="score-badge">{audit.totalScore} / 100</span></div>
                                    </div>
                                    <div className="col-right">
                                        <div className="info-row"><span className="info-label">Denetim Tarihi:</span> <span className="info-val">{getFormattedDate(audit.createdAt)}</span></div>
                                        <div className="info-row"><span className="info-label">Başlama Saati:</span> <span className="info-val">{getFormattedTime(audit.startedAt)}</span></div>
                                        <div className="info-row"><span className="info-label">Bitiş Saati:</span> <span className="info-val">{getFormattedTime(audit.completedAt)}</span></div>
                                        <div className="info-row"><span className="info-label">Önceki Denetmen:</span> <span className="info-val">{prevAuditor}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTIONS */}
                            {audit.sections.map((section, sIndex) => {
                                // Check if the section has at least one answered question
                                const sectionHasAnswers = section.answers.some(
                                    a => a.answer && a.answer.trim() !== ""
                                );

                                const reportAnswers = section.answers.filter(a => {
                                    const hasAnswer = a.answer && a.answer.trim() !== "";
                                    const hasNotes = a.notes && a.notes.some(n => n && n.trim() !== "");
                                    const hasPhotos = a.photos && a.photos.length > 0;

                                    // 1. "Hayır" — always include
                                    if (a.answer === "hayir") return true;

                                    // 2. Checkbox/rating with partial points — only if section has answers
                                    if (sectionHasAnswers && hasAnswer && a.answer !== "muaf" &&
                                        (a.questionType === "checkbox" || a.questionType === "rating") &&
                                        a.earnedPoints < a.maxPoints) return true;

                                    // 3. Any question with notes or photos — include (even evet, even muaf)
                                    if (hasNotes || hasPhotos) return true;

                                    // Everything else excluded (plain evet, unanswered, muaf without notes/photos)
                                    return false;
                                });

                                const hasFeedback = section.feedback && (section.feedback.note || (section.feedback.images && section.feedback.images.length > 0));

                                // If no negative answers and no feedback, skip section
                                if (reportAnswers.length === 0 && !hasFeedback) return null;

                                return (
                                    <div key={sIndex} className="section-card">
                                        {/* Section Header */}
                                        <div className="section-banner">
                                            <span>{section.sectionName}</span>
                                            <span>DEĞERLENDİRME</span>
                                        </div>
                                        
                                        {/* Questions Table */}
                                        {reportAnswers.length > 0 && (
                                        <table>
                                            <tbody>
                                                {reportAnswers.map((answer, aIndex) => (
                                                    <tr key={aIndex}>
                                                        <td style={{ width: '75%', verticalAlign: 'top' }}>
                                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                                {answer.questionText}
                                                            </div>
                                                            {/* Notes under the question */}
                                                            {answer.notes && answer.notes.length > 0 && (
                                                                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', fontStyle: 'italic', background: '#f9f9f9', padding: '4px', borderRadius: '4px' }}>
                                                                    <strong>Not:</strong> {answer.notes.join(", ")}
                                                                </div>
                                                            )}
                                                            {/* Photos under the question/notes */}
                                                            {answer.photos && answer.photos.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                                     {answer.photos.map((p, pi) => (
                                                                         <img key={pi} src={getProxiedUrl(p)} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }} crossOrigin="anonymous" />
                                                                     ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold' }}>
                                                            {answer.answer === "hayir" ? (
                                                                <span style={{ color: 'red' }}>HAYIR</span>
                                                            ) : answer.answer === "evet" ? (
                                                                <span style={{ color: 'green' }}>EVET</span>
                                                            ) : answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints ? (
                                                                <span style={{ color: 'orange' }}>EKSİKLER VAR</span>
                                                            ) : answer.questionType === "rating" ? (
                                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                                                                    {[...Array(answer.ratingMax || 5)].map((_, i) => (
                                                                        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < parseInt(answer.answer || "0") ? "#ffd700" : "#e0e0e0"} stroke="none">
                                                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                                        </svg>
                                                                    ))}
                                                                </div>
                                                            ) : answer.questionType === "multiple_choice" ? (
                                                                <span>
                                                                    {answer.options?.find(opt => opt.id === answer.answer)?.text || answer.answer || "-"}
                                                                </span>
                                                            ) : answer.answer === "muaf" ? (
                                                                <span style={{ color: '#999' }}>MUAF</span>
                                                            ) : (
                                                                // For other types like number/text
                                                                <span>{answer.answer || "NOT VAR"}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        )}
                                        
                                        {/* Dedicated Section Feedback Table/Block */}
                                        {hasFeedback && (
                                            <div style={{ marginTop: '0' }}> 
                                                <div style={{ 
                                                    background: '#333', 
                                                    color: '#fff', 
                                                    padding: '8px 15px', 
                                                    fontSize: '12px', 
                                                    fontWeight: 'bold',
                                                    marginTop: reportAnswers.length > 0 ? '0' : '0', // attach to table if exists
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {section.sectionName} GÖRÜŞ VE ÖNERİLERİNİZ
                                                </div>
                                                <div style={{ 
                                                    padding: '15px', 
                                                    border: '1px solid #eee', 
                                                    borderTop: 'none',
                                                    background: '#fff',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '10px'
                                                }}>
                                                    {section.feedback?.note && (
                                                        <div style={{ fontSize: '13px', color: '#333', fontStyle: 'italic' }}>
                                                            "{section.feedback.note}"
                                                        </div>
                                                    )}
                                                    
                                                    {section.feedback?.images && section.feedback.images.length > 0 && (
                                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                                                             {section.feedback.images.map((img, i) => (
                                                                 <div key={i} style={{ width: '120px', height: '120px', border: '1px dashed #ccc', padding: '2px' }}>
                                                                    <img src={getProxiedUrl(img)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                                                                 </div>
                                                             ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <footer style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '20px', paddingBottom: '20px' }}>
                            AuditPro Denetim Sistemi | © {new Date().getFullYear()} Tüm Hakları Saklıdır.
                        </footer>
                    </div>
                </div>
            </div>
            
            {generating && (
                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <Loader2 className="animate-spin" />
                        <span>PDF Oluşturuluyor...</span>
                    </div>
                </div>
            )}
        </>
    );
}
