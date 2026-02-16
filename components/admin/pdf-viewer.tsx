"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from "lucide-react";

interface PdfViewerProps {
    pdfData: ArrayBuffer | null;
    filename?: string;
    loading?: boolean;
}

export function PdfViewer({ pdfData, filename = "rapor.pdf", loading = false }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1.0);
    const [numPages, setNumPages] = useState(0);
    const [rendering, setRendering] = useState(false);
    const [pdfjsLib, setPdfjsLib] = useState<any>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

    // Load pdfjs library
    useEffect(() => {
        const loadPdfjs = async () => {
            const pdfjs = await import("pdfjs-dist");
            // Use the bundled worker
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.mjs",
                import.meta.url
            ).toString();
            setPdfjsLib(pdfjs);
        };
        loadPdfjs();
    }, []);

    // Load PDF document when data changes
    useEffect(() => {
        if (!pdfjsLib || !pdfData) return;

        const loadDoc = async () => {
            try {
                const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                setPdfDoc(doc);
                setNumPages(doc.numPages);
            } catch (err) {
                console.error("PDF load error:", err);
            }
        };
        loadDoc();
    }, [pdfjsLib, pdfData]);

    // Render all pages
    const renderPages = useCallback(async () => {
        if (!pdfDoc || rendering) return;
        setRendering(true);

        try {
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: scale * 1.5 }); // 1.5x for sharpness
                
                const canvas = canvasRefs.current.get(i);
                if (!canvas) continue;

                const ctx = canvas.getContext("2d");
                if (!ctx) continue;

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width / 1.5}px`;
                canvas.style.height = `${viewport.height / 1.5}px`;

                await page.render({ canvasContext: ctx, viewport }).promise;
            }
        } catch (err) {
            console.error("Render error:", err);
        } finally {
            setRendering(false);
        }
    }, [pdfDoc, scale]);

    useEffect(() => {
        if (pdfDoc && numPages > 0) {
            renderPages();
        }
    }, [pdfDoc, numPages, scale, renderPages]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handleFitWidth = () => {
        if (!containerRef.current || !pdfDoc) return;
        // Reset to default fit
        setScale(1.0);
    };

    const handleDownload = () => {
        if (!pdfData) return;
        const blob = new Blob([pdfData], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading || !pdfData) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "400px",
                gap: "12px",
                color: "#64748b"
            }}>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span style={{ fontSize: "14px" }}>PDF oluşturuluyor...</span>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Toolbar */}
            <div style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#1e293b",
                borderBottom: "1px solid #334155",
                gap: "8px",
                flexShrink: 0,
            }}>
                {/* Zoom Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleZoomOut}
                        className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                        disabled={scale <= 0.5}
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span style={{ 
                        color: "#cbd5e1", 
                        fontSize: "13px", 
                        fontWeight: 500,
                        minWidth: "48px",
                        textAlign: "center",
                        userSelect: "none"
                    }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleZoomIn}
                        className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                        disabled={scale >= 3}
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleFitWidth}
                        className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Sığdır"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Download */}
                <Button 
                    onClick={handleDownload}
                    size="sm"
                    className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                    <Download className="h-3.5 w-3.5" />
                    PDF İndir
                </Button>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    overflow: "auto",
                    background: "#374151",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "16px 0",
                    gap: "12px",
                }}
            >
                {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                    <canvas
                        key={pageNum}
                        ref={el => {
                            if (el) canvasRefs.current.set(pageNum, el);
                        }}
                        style={{
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                            background: "#fff",
                            maxWidth: "100%",
                        }}
                    />
                ))}
                {rendering && (
                    <div style={{ color: "#94a3b8", fontSize: "12px", padding: "8px" }}>
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Render ediliyor...
                    </div>
                )}
            </div>
        </div>
    );
}
