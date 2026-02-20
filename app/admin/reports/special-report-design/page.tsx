"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// User's Styles and Templates logic ported to constants/state
const STYLES = [
    { id: 'st-1', name: '1. Kurumsal Bordo', primary: '#800020' },
    { id: 'st-2', name: '2. Modern Gece', primary: '#002347' },
    // { id: 'st-3', name: '3. Minimalist', primary: '#333' }, REMOVED
    { id: 'st-4', name: '4. Altın & Siyah', primary: '#000' },
    { id: 'st-5', name: '5. Doğa Teması', primary: '#2d5a27' },
    { id: 'st-6', name: '6. Şantiye', primary: '#e67e22' },
    { id: 'st-7', name: '7. Resmi Serif', primary: '#2c3e50' },
    { id: 'st-8', name: '8. Dashboard', primary: '#4a69bd' },
    { id: 'st-9', name: '9. Alarm', primary: '#c0392b' },
    { id: 'st-10', name: '10. Mimari', primary: '#7f8c8d' },
    { id: 'st-11', name: '11. Lojistik', primary: '#34495e' },
    // { id: 'st-12', name: '12. Okul', primary: '#e84393' }, REMOVED
    // { id: 'st-13', name: '13. Dergi', primary: '#2d3436' }, REMOVED
    { id: 'st-14', name: '14. Retro', primary: '#8d6e63' },
    // { id: 'st-15', name: '15. Start-up', primary: '#0984e3' }, REMOVED
    { id: 'st-16', name: '16. Sertifika', primary: '#192a56' },
    { id: 'st-17', name: '17. Medikal', primary: '#00b894' },
    // { id: 'st-18', name: '18. Endüstriyel', primary: '#f1c40f' }, REMOVED
    // { id: 'st-19', name: '19. Dinamik', primary: '#e74c3c' }, REMOVED
    // { id: 'st-20', name: '20. Dark', primary: '#00d2d3' } REMOVED
];

export default function SpecialReportDesignPage() {
    // State management
    const [templateId, setTemplateId] = useState('st-1');
    const [typography, setTypography] = useState({
        fontGlobal: "'Roboto', sans-serif",
        h1Size: 26, h1Bold: true, h1Italic: false,
        h2Size: 15, h2Bold: false, h2Italic: false,
        thSize: 13, thBold: true, thItalic: false,
        tdSize: 13, tdBold: false, tdItalic: false,
    });

    const [logo, setLogo] = useState<string>("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3e%3crect width='200' height='80' fill='%23eee'/%3e%3ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23666'%3eLOGO YÜKLE%3c/text%3e%3c/svg%3e");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

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

    // Load saved design
    useEffect(() => {
        const loadConfig = async () => {
            try {
                // Try Firestore first
                const docRef = doc(db, "settings", "special-report-design");
                const docSnap = await getDoc(docRef);

                let config = null;

                if (docSnap.exists()) {
                    config = docSnap.data();
                    // Update local storage to keep in sync
                    localStorage.setItem('auditPro_DesignConfig', JSON.stringify(config));
                } else {
                    // Fallback to local storage if no firestore data
                    const savedData = localStorage.getItem('auditPro_DesignConfig');
                    if (savedData) {
                        config = JSON.parse(savedData);
                    }
                }

                if (config) {
                    if (config.templateId) setTemplateId(config.templateId);
                    if (config.logo) setLogo(config.logo);

                    // Safe recursive update for typography to merge with defaults
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
                console.error("Error loading design config", e);
            }
        };

        loadConfig();
    }, []);

    const handleSave = async () => {
        const config = {
            templateId,
            logo,
            globalFont: typography.fontGlobal,
            h1_size: typography.h1Size,
            h1_bold: typography.h1Bold,
            h1_italic: typography.h1Italic,
            h2_size: typography.h2Size,
            h2_bold: typography.h2Bold,
            h2_italic: typography.h2Italic,
            th_size: typography.thSize,
            th_bold: typography.thBold,
            th_italic: typography.thItalic,
            td_size: typography.tdSize,
            td_bold: typography.tdBold,
            td_italic: typography.tdItalic,
        };

        try {
            // Save to Firestore
            await setDoc(doc(db, "settings", "special-report-design"), config);
            
            // Still save to local storage as backup/cache
            localStorage.setItem('auditPro_DesignConfig', JSON.stringify(config));
            
            toast.success("Tasarım ayarları kaydedildi!");
        } catch (error) {
            console.error("Error saving design config:", error);
            toast.error("Ayarlar kaydedilirken hata oluştu");
        }
    };

    const handleReset = () => {
        setTemplateId('st-1');
        setTypography({
            fontGlobal: "'Roboto', sans-serif",
            h1Size: 26, h1Bold: true, h1Italic: false,
            h2Size: 15, h2Bold: false, h2Italic: false,
            thSize: 13, thBold: true, thItalic: false,
            tdSize: 13, tdBold: false, tdItalic: false,
        });
        toast.info("Ayarlar sıfırlandı");
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading("Logo yükleniyor...");

        try {
            // Create a reference to 'design/logo-[timestamp]-[filename]'
            const storageRef = ref(storage, `design/logo-${Date.now()}-${file.name}`);
            
            // Upload the file
            await uploadBytes(storageRef, file);
            
            // Get the download URL
            const downloadURL = await getDownloadURL(storageRef);
            
            setLogo(downloadURL);
            toast.success("Logo başarıyla yüklendi", { id: toastId });
        } catch (error) {
            console.error("Logo upload error:", error);
            toast.error("Logo yüklenirken hata oluştu", { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async () => {
        if (!reportRef.current || !window.html2pdf) return;
        
        setIsGenerating(true);
        const element = reportRef.current;
        
        // Snapshot current style
        const originalStyle = {
            width: element.style.width,
            margin: element.style.margin,
            boxShadow: element.style.boxShadow,
            height: element.style.height,
            minHeight: element.style.minHeight
        };

        // Modify for print
        element.style.width = '794px'; 
        element.style.margin = '0 auto'; 
        element.style.boxShadow = 'none';
        element.style.height = 'auto'; 
        element.style.minHeight = 'auto';

        const contentHeight = element.scrollHeight; 
        const opt = {
            margin: 0, 
            filename: 'Denetim_Raporu_v5.8.pdf',
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
            // Restore style
            element.style.width = originalStyle.width;
            element.style.margin = originalStyle.margin;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.height = originalStyle.height;
            element.style.minHeight = originalStyle.minHeight;
            setIsGenerating(false);
        }
    };

    return (
        <>
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
                strategy="lazyOnload"
                onLoad={() => setScriptLoaded(true)}
            />
            {/* GOOGLE FONTS IMPORT - Link tag as specifically requested */}
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&family=Open+Sans:wght@300;400;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Playfair+Display:wght@400;700&family=Merriweather:wght@300;400;700&family=Nunito:wght@300;400;700&family=Raleway:wght@300;400;700&family=Oswald:wght@300;400;700&family=PT+Serif:wght@400;700&family=Poppins:wght@300;400;700&family=Ubuntu:wght@300;400;700&family=Roboto+Slab:wght@300;400;700&family=Quicksand:wght@300;400;700&family=Inconsolata:wght@300;400;700&family=Crimson+Text:wght@400;700&family=Work+Sans:wght@300;400;700&display=swap" rel="stylesheet" />
            
            {/* INJECT USER'S CSS - EXACT COPY WITH REACT ADAPTATIONS */}
            <style jsx global>{`
                /* GENEL YAPI */
                /* body { background-color: #f0f2f5; font-family: var(--font-global); color: #333; overflow-x: hidden; position: relative; display: flex; } */
                /* Note: Body styles handled by layout, but we apply needed vars to wrapper */

                :root {
                    /* Varsayılan Tipografi Ayarları - Fallback */
                    --font-global: 'Roboto', sans-serif;
                    --primary: #800020;
                    --secondary: #333;
                    --bg-page: #fff;
                    --header-bg: #fff;
                    --border-style: 1px solid #eee;
                    --sidebar-width: 320px;
                    --sb-bg: #ffffff;
                    --sb-text: #333;
                    --sb-border: #ddd;
                }

                /* SIDEBAR TASARIMI */
                /* SIDEBAR TASARIMI */
                .design-sidebar {
                    background: var(--sb-bg); 
                    color: var(--sb-text); 
                    display: flex; 
                    flex-direction: column;
                    padding: 15px; 
                    border-right: 1px solid var(--sb-border); 
                    font-family: 'Roboto', sans-serif;
                    height: 100%;
                    overflow-y: hidden;
                    z-index: 10;
                    box-shadow: 2px 0 10px rgba(0,0,0,0.05);
                }

                .sidebar-title {
                    font-size: 16px; font-weight: 800; margin-bottom: 15px; color: #2c3e50;
                    border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;
                    display: flex; justify-content: space-between; align-items: center;
                }

                .sidebar-content { flex: 1; overflow-y: auto; padding-right: 5px; margin-bottom: 10px; }
                .sidebar-content::-webkit-scrollbar { width: 5px; }
                .sidebar-content::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

                .control-group { margin-bottom: 15px; border-bottom: 1px solid #f5f5f5; padding-bottom: 15px; }
                .control-label { display: block; margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }

                .style-list { max-height: 150px; overflow-y: auto; border: 1px solid #eee; border-radius: 6px; background: #fff; }
                .style-item {
                    width: 100%; text-align: left; padding: 6px 10px; border: none; background: transparent;
                    color: #555; font-size: 12px; cursor: pointer; display: flex; align-items: center;
                    border-bottom: 1px solid #f9f9f9;
                }
                .style-item:hover { background-color: #f5f5f5; color: #000; }
                .style-item.active { background-color: #e3f2fd; color: #1976d2; font-weight: 600; }
                .style-item::before { content: '•'; margin-right: 6px; color: #ccc; }
                .style-item.active::before { content: '●'; color: #1976d2; }

                .font-select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; margin-bottom: 10px; cursor: pointer; color: black; }

                details { margin-bottom: 8px; background: #fafafa; border-radius: 4px; border: 1px solid #eee; }
                summary { padding: 10px; cursor: pointer; font-size: 12px; font-weight: 600; outline: none; user-select: none; color: black; }
                summary:hover { background: #f0f0f0; }
                .detail-content { padding: 10px; border-top: 1px solid #eee; background: #fff; }

                .range-control { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 11px; color: black; }
                .range-control input[type="range"] { width: 60%; }
                .checkbox-group { display: flex; gap: 10px; margin-top: 5px; color: black; }
                .checkbox-label { display: flex; align-items: center; font-size: 11px; cursor: pointer; }
                .checkbox-label input { margin-right: 4px; }

                .sidebar-footer { margin-top: auto; padding-top: 15px; border-top: 1px solid #ddd; background: #fff; }
                
                .btn-action {
                    display: flex; align-items: center; justify-content: center; width: 100%; padding: 10px;
                    margin-bottom: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;
                    transition: all 0.2s; text-align: center; border: 1px solid transparent; gap: 5px;
                }
                
                .btn-reset { background: #f8f9fa; color: #d63031; border: 1px solid #ddd; }
                .btn-reset:hover { background: #fee2e2; border-color: #d63031; }

                .btn-save { background: #e3f2fd; color: #1976d2; border: 1px solid #bbdefb; }
                .btn-save:hover { background: #bbdefb; }

                .btn-logo-upload { 
                    background: #fff !important; color: #333 !important; 
                    border: 1px solid #ccc !important; box-shadow: none !important;
                }
                .btn-logo-upload:hover { background: #f5f5f5 !important; }

                .btn-download { background: #27ae60; color: white; }
                .btn-download:hover { background: #219150; transform: translateY(-1px); }

                /* RAPOR ALANI CSS - Simplified */
                .report-wrapper {
                    /* Layout items handled inline to ensure priority */
                    background-color: #f0f2f5;
                }
                .report-page {
                    flex-shrink: 0;
                    width: 210mm; 
                    min-height: 297mm; 
                    background: white; 
                    position: relative; 
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    color: #333;
                    font-family: var(--font-global);
                    margin-bottom: 40px;
                }

                /* DINAMIK TIPOGRAFI UYGULAMALARI */
                .head-text h1 { 
                    font-size: var(--h1-size) !important; font-weight: var(--h1-weight) !important; font-style: var(--h1-style) !important;
                    color: var(--primary); font-family: var(--font-global); margin-bottom: 5px;
                }
                .head-text h2 { 
                    font-size: var(--h2-size) !important; font-weight: var(--h2-weight) !important; font-style: var(--h2-style) !important;
                    color: #777; font-family: var(--font-global);
                }
                table th, .section-banner span {
                    /* font-size: var(--th-size) !important; REMOVED - Controlled below */
                    font-family: var(--font-global);
                }
                
                /* 3. Tablo & Bölüm Başlıkları -> Sadece Bölüm Başlığı (Örn: 1. DIŞ CEPHE...) */
                .section-banner span {
                    font-size: var(--th-size) !important; font-weight: var(--th-weight) !important; font-style: var(--th-style) !important;
                }

                /* 4. Tablo & İçerik Yazıları -> Sorular, Cevaplar, Görüşler (Örn: Vitrin camları temiz mi?) */
                table th, table td, .opinion-text, .info-item {
                    font-size: var(--td-size) !important; font-weight: var(--td-weight) !important; font-style: var(--td-style) !important;
                    font-family: var(--font-global);
                }

                /* STANDART RAPOR CSS */
                .report-header { width: 100%; min-height: 140px; display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; background: var(--header-bg); border-bottom: 4px solid var(--primary); transition: all 0.3s ease; }
                .logo-box img { max-height: 80px; max-width: 200px; object-fit: contain; }
                .head-text { text-align: right; }
                .content { padding: 30px 40px; }
                .info-panel { 
                    background: #fff; 
                    padding: 5px 0 5px 25px; /* Left padding for the text */
                    margin-bottom: 30px; 
                    border-left: 8px solid var(--primary); 
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .info-title {
                    color: var(--primary);
                    margin-bottom: 15px;
                    font-size: 16px;
                    text-transform: uppercase;
                    font-weight: bold;
                }

                .info-grid-2col { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 15px 40px; 
                }
                
                .info-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 6px;
                }
                
                .info-label {
                    font-weight: bold;
                    margin-right: 8px;
                    color: #333;
                    min-width: 110px;
                }
                
                .info-val {
                    color: #555;
                }

                .score-badge {
                    background: #ffd700; 
                    padding: 3px 10px; 
                    border-radius: 4px; 
                    font-weight: bold;
                    color: #000;
                }

                .section-card { margin-bottom: 25px; border: var(--border-style); page-break-inside: avoid; }
                .section-banner { background: var(--primary); color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; }
                
                /* TABLE STYLES - with user requested full borders */
                table { width: 100%; border-collapse: collapse; }
                td, th { padding: 10px 15px; border: 1px solid #ccc; text-align: left; } /* Using full border as requested */

                .opinion-box { display: flex; gap: 20px; padding: 15px; background: #fff; }
                .opinion-text { flex: 2; border-left: 3px solid #ddd; padding-left: 10px; color: #666; }
                .opinion-photo { flex: 1; height: 110px; background: #f5f5f5; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                .opinion-photo img { width: 100%; height: 100%; object-fit: cover; }

                /* Tasarım Sınıfları */
                .st-1 { --primary: #800020; } .st-1 .report-header { background: linear-gradient(110deg, #fff 65%, #f8f8f8 65%); }
                .st-2 { --primary: #002347; --header-bg: #002347; } .st-2 .report-header { color: white; flex-direction: row-reverse; } .st-2 .head-text h1, .st-2 .head-text h2 { color: white !important; }
                /* .st-3 { --primary: #333; --border-style: none; } .st-3 .report-header { border-bottom: 1px solid #333; justify-content: center; flex-direction: column; text-align: center; } REMOVED */
                .st-4 { --primary: #000; } .st-4 .report-header { background: #FFD700; border: none; }
                .st-5 { --primary: #2d5a27; } .st-5 .report-header { border-radius: 0 0 50px 50px; background: #f0f4f0; }
                .st-6 { --primary: #e67e22; } .st-6 .section-banner { border-left: 10px solid #e67e22; background: #333; }
                .st-7 { --primary: #2c3e50; } .st-7 .report-header { border: 2px solid #2c3e50; background: #fff; text-align: center; justify-content: center; } .st-7 .section-banner { background: transparent; color: #2c3e50; border-bottom: 1px solid #2c3e50; }
                .st-8 { --primary: #4a69bd; } .st-8 .section-card { border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: none; }
                .st-9 { --primary: #c0392b; } .st-9 .report-header { border: 5px solid #c0392b; }
                .st-10 { --primary: #7f8c8d; } .st-10 .section-card { border: none; border-top: 1px solid #eee; }
                .st-11 { --primary: #34495e; } .st-11 .report-header { border: 2px dashed #34495e; background: #ecf0f1; }
                /* .st-12 { --primary: #e84393; } .st-12 .report-header { background: #ffeaa7; border-radius: 20px; border: 3px solid #e84393; } REMOVED */
                /* .st-13 { --primary: #2d3436; } .st-13 .report-header { background: #2d3436; color: #fff; align-items: flex-end; } REMOVED */
                .st-14 { --primary: #8d6e63; } .st-14 .report-page { background: #fdf5e6; }
                /* .st-15 { --primary: #0984e3; } .st-15 .report-header { background: linear-gradient(120deg, #0984e3, #00cec9); border: none; } REMOVED */
                .st-16 { --primary: #192a56; } .st-16 .report-page { border: 10px double #192a56; }
                .st-17 { --primary: #00b894; } .st-17 .report-header { border-top: 10px solid #00b894; }
                /* .st-18 { --primary: #f1c40f; } .st-18 .report-header { background: repeating-linear-gradient(135deg, #f1c40f, #f1c40f 10px, #000 10px, #000 20px); } REMOVED */
                /* .st-19 { --primary: #e74c3c; } .st-19 .report-header { transform: skewY(-2deg); background: #e74c3c; } REMOVED */
                /* .st-20 { --primary: #00d2d3; } .st-20 .report-page { background: #222f3e; color: #c8d6e5; } REMOVED */
            `}</style>

            {/* Main Wrapper with Flex Row to side-by-side layout */}
            <div 
                className={`design-studio-wrapper ${templateId}`} 
                style={{
                    display: 'flex',
                    flexDirection: 'row', /* Ensure side-by-side */
                    width: '100%',
                    height: 'calc(100vh - 65px)', /* Full height minus header */
                    overflow: 'hidden',
                    ...cssVars
                }}
            >
                
                {/* SIDEBAR PANEL - Fixed width, no position:fixed needed in flex */}
                <div className="design-sidebar" style={{ width: '320px', minWidth: '320px', flexShrink: 0 }}>
                    <div className="sidebar-title">
                        <span>Tasarım Ayarları</span>
                    </div>

                    <div className="sidebar-content">
                        <div className="control-group">
                            <label className="control-label">TASARIM ŞABLONU</label>
                            <div className="style-list">
                                {STYLES.map(style => (
                                    <button 
                                        key={style.id}
                                        className={`style-item ${templateId === style.id ? 'active' : ''}`}
                                        onClick={() => setTemplateId(style.id)}
                                    >
                                        {style.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="control-group">
                            <label className="control-label">YAZI TİPİ (GOOGLE FONTS)</label>
                            <select 
                                className="font-select" 
                                value={typography.fontGlobal}
                                onChange={(e) => setTypography({...typography, fontGlobal: e.target.value})}
                            >
                                <option value="'Roboto', sans-serif">Roboto (Varsayılan)</option>
                                <option value="'Open Sans', sans-serif">Open Sans</option>
                                <option value="'Lato', sans-serif">Lato</option>
                                <option value="'Montserrat', sans-serif">Montserrat</option>
                                <option value="'Playfair Display', serif">Playfair Display</option>
                                <option value="'Merriweather', serif">Merriweather</option>
                                <option value="'Nunito', sans-serif">Nunito</option>
                                <option value="'Raleway', sans-serif">Raleway</option>
                                <option value="'Oswald', sans-serif">Oswald</option>
                                <option value="'PT Serif', serif">PT Serif</option>
                                <option value="'Poppins', sans-serif">Poppins</option>
                                <option value="'Ubuntu', sans-serif">Ubuntu</option>
                                <option value="'Roboto Slab', serif">Roboto Slab</option>
                                <option value="'Quicksand', sans-serif">Quicksand</option>
                                <option value="'Inconsolata', monospace">Inconsolata</option>
                                <option value="'Crimson Text', serif">Crimson Text</option>
                                <option value="'Work Sans', sans-serif">Work Sans</option>
                            </select>
                        </div>

                        <label className="control-label">DETAYLI YAZI AYARLARI</label>

                        <details>
                            <summary>1. Ana Başlık (Rapor Adı)</summary>
                            <div className="detail-content">
                                <div className="range-control">
                                    <span>Boyut: {typography.h1Size}px</span>
                                    <input type="range" min="18" max="48" value={typography.h1Size} onChange={(e) => setTypography({...typography, h1Size: Number(e.target.value)})} />
                                </div>
                                <div className="checkbox-group">
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.h1Bold} onChange={(e) => setTypography({...typography, h1Bold: e.target.checked})} /> Kalın</label>
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.h1Italic} onChange={(e) => setTypography({...typography, h1Italic: e.target.checked})} /> İtalik</label>
                                </div>
                            </div>
                        </details>

                        <details>
                            <summary>2. Alt Başlık (Form Adı)</summary>
                            <div className="detail-content">
                                <div className="range-control">
                                    <span>Boyut: {typography.h2Size}px</span>
                                    <input type="range" min="10" max="24" value={typography.h2Size} onChange={(e) => setTypography({...typography, h2Size: Number(e.target.value)})} />
                                </div>
                                <div className="checkbox-group">
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.h2Bold} onChange={(e) => setTypography({...typography, h2Bold: e.target.checked})} /> Kalın</label>
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.h2Italic} onChange={(e) => setTypography({...typography, h2Italic: e.target.checked})} /> İtalik</label>
                                </div>
                            </div>
                        </details>

                        <details>
                            <summary>3. Tablo & Bölüm Başlıkları</summary>
                            <div className="detail-content">
                                <div className="range-control">
                                    <span>Boyut: {typography.thSize}px</span>
                                    <input type="range" min="10" max="20" value={typography.thSize} onChange={(e) => setTypography({...typography, thSize: Number(e.target.value)})} />
                                </div>
                                <div className="checkbox-group">
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.thBold} onChange={(e) => setTypography({...typography, thBold: e.target.checked})} /> Kalın</label>
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.thItalic} onChange={(e) => setTypography({...typography, thItalic: e.target.checked})} /> İtalik</label>
                                </div>
                            </div>
                        </details>

                        <details>
                            <summary>4. Tablo & İçerik Yazıları</summary>
                            <div className="detail-content">
                                <div className="range-control">
                                    <span>Boyut: {typography.tdSize}px</span>
                                    <input type="range" min="9" max="18" value={typography.tdSize} onChange={(e) => setTypography({...typography, tdSize: Number(e.target.value)})} />
                                </div>
                                <div className="checkbox-group">
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.tdBold} onChange={(e) => setTypography({...typography, tdBold: e.target.checked})} /> Kalın</label>
                                    <label className="checkbox-label"><input type="checkbox" checked={typography.tdItalic} onChange={(e) => setTypography({...typography, tdItalic: e.target.checked})} /> İtalik</label>
                                </div>
                            </div>
                        </details>

                    </div>

                    <div className="sidebar-footer">
                        <button onClick={handleReset} className="btn-action btn-reset">↺ Ayarları Sıfırla</button>
                        <button onClick={handleSave} className="btn-action btn-save">💾 Tasarımı Kaydet</button>
                        
                        <input type="file" id="logoInp" style={{ display: 'none' }} accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                        <label htmlFor="logoInp" className="btn-action btn-logo-upload">
                            {isUploading ? "⏳ Yükleniyor..." : "📷 Logo Yükle"}
                        </label>
                        
                        <button onClick={handleDownload} disabled={isGenerating} className="btn-action btn-download">
                            {isGenerating ? "⏳ Hazırlanıyor..." : "⬇️ ÖRNEK PDF İNDİR"}
                        </button>
                    </div>
                </div>

                {/* REPORT AREA */}
                <div 
                    className="report-wrapper"
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        padding: '20px',
                        overflowY: 'auto',
                        height: '100%'
                    }}
                >
                    <div 
                        className={`report-page ${templateId}`} 
                        id="reportArea" 
                        ref={reportRef}
                        style={cssVars}
                    >
                        
                        <header className="report-header">
                            <div className="logo-box">
                                <img id="logoImg" src={logo} alt="Logo" />
                            </div>
                            <div className="head-text">
                                <h1 contentEditable="true" suppressContentEditableWarning>Şube Denetim Raporu</h1>
                                <h2 contentEditable="true" suppressContentEditableWarning>Görüş, Öneri ve Tespit Formu</h2>
                            </div>
                        </header>

                        <div className="content">
                            
                            <div className="info-panel">
                                <div className="info-title">
                                    AFYON - MAĞAZA BİLGİLERİ
                                </div>
                                <div className="info-grid-2col">
                                    <div className="col-left">
                                        <div className="info-row"><span className="info-label">Mağaza Adı:</span> <span className="info-val">Tuğba Kuruyemiş - Afyon Şubesi</span></div>
                                        <div className="info-row"><span className="info-label">Denetimi Yapan:</span> <span className="info-val">Ahmet Yılmaz</span></div>
                                        <div className="info-row"><span className="info-label">İlgili Hafta:</span> <span className="info-val">2024 / 07. Hafta</span></div>
                                        <div className="info-row"><span className="info-label">Mağaza Puanı:</span> <span className="score-badge">88 / 100</span></div>
                                    </div>
                                    <div className="col-right">
                                        <div className="info-row"><span className="info-label">Denetim Tarihi:</span> <span className="info-val">12.02.2024</span></div>
                                        <div className="info-row"><span className="info-label">Başlama Saati:</span> <span className="info-val">09:30</span></div>
                                        <div className="info-row"><span className="info-label">Bitiş Saati:</span> <span className="info-val">11:45</span></div>
                                        <div className="info-row"><span className="info-label">Önceki Denetmen:</span> <span className="info-val">Mehmet Demir</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="section-card">
                                <div className="section-banner">
                                    <span>1. DIŞ CEPHE VE VİTRİN</span>
                                    <span>DEĞERLENDİRME</span>
                                </div>
                                <table>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '75%', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                    Vitrin camları temiz mi?
                                                </div>
                                            </td>
                                            <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold' }}>
                                                <span style={{ color: 'green' }}>EVET</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ width: '75%', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                    Dış aydınlatmalar aktif mi?
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', fontStyle: 'italic', background: '#f9f9f9', padding: '4px', borderRadius: '4px' }}>
                                                    <strong>Not:</strong> Bazı ampuller patlak.
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                    <div style={{ width: '80px', height: '80px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999', borderRadius: '4px' }}>FOTO</div>
                                                </div>
                                            </td>
                                            <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold' }}>
                                                <span style={{ color: 'red' }}>HAYIR</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div style={{ marginTop: '0' }}>
                                    <div style={{ background: '#333', color: '#fff', padding: '8px 15px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        DIŞ CEPHE VE VİTRİN GÖRÜŞ VE ÖNERİLERİNİZ
                                    </div>
                                    <div style={{ padding: '15px', border: '1px solid #eee', borderTop: 'none', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ fontSize: '13px', color: '#333', fontStyle: 'italic' }}>
                                            "Mağaza dış cephesi genel olarak temiz ancak aydınlatma eksikliği dikkat çekiyor."
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                                            <div style={{ width: '120px', height: '120px', border: '1px dashed #ccc', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', color: '#aaa', fontSize: '10px' }}>
                                                CEPHE FORM FOTO
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="section-card">
                                <div className="section-banner">
                                    <span>2. KASA VE MÜŞTERİ HİZMETLERİ</span>
                                    <span>DEĞERLENDİRME</span>
                                </div>
                                <table>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '75%', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                    Kasa çevresi tertipli mi?
                                                </div>
                                            </td>
                                            <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold' }}>
                                                <span style={{ color: 'orange' }}>EKSİKLER VAR</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ width: '75%', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                    Müşteri karşılama performansı (1-5)
                                                </div>
                                            </td>
                                            <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                                                    {[...Array(5)].map((_, i) => (
                                                        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < 3 ? "#ffd700" : "#e0e0e0"} stroke="none">
                                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                        </svg>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                {/* No feedback example */}
                            </div>

                        </div>

                        <footer style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '20px', paddingBottom: '20px' }}>
                            AuditPro Denetim Sistemi | © 2026 Tüm Hakları Saklıdır.
                        </footer>
                    </div>
                </div>
            </div>
        </>
    );
}
