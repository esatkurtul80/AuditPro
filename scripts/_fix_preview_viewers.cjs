/**
 * _fix_preview_viewers.cjs
 * Replaces the FilePreviewDialog in drive-table.tsx with:
 *  - Excel: SheetJS client-side parser → HTML table render
 *  - PDF:   pdfjs-dist canvas render (multi-page)
 *  - Image/Video/Audio: unchanged
 */
const fs = require('fs');
const filePath = 'components/admin/dosyalar/drive-table.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// ── 1. Replace the import line block at top ─────────────────────────────────
// Add useRef, useEffect to the react import
content = content.replace(
  /import \{ useState \} from "react";/,
  'import { useState, useRef, useEffect, useCallback } from "react";'
);

// ── 2. Remove old FilePreviewDialog entirely and replace ────────────────────
const oldDialogStart = '// File Preview Dialog';
const oldDialogEnd = '// Delete Confirm Dialog';

const startIdx = content.indexOf(oldDialogStart);
const endIdx = content.indexOf(oldDialogEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find FilePreviewDialog boundaries');
  process.exit(1);
}

const newDialog = `// ── Excel Viewer (SheetJS) ────────────────────────────────────────────────────
function ExcelViewer({ url }: { url: string }) {
    const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(false);
        (async () => {
            try {
                const XLSX = (await import("xlsx")).default;
                const res = await fetch(url);
                const ab = await res.arrayBuffer();
                const wb = XLSX.read(ab, { type: "array" });
                const result = wb.SheetNames.map(name => ({
                    name,
                    html: XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false }),
                }));
                if (!cancelled) { setSheets(result); setActive(0); }
            } catch (e) {
                console.error("ExcelViewer:", e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            <p className="text-sm text-slate-500">Excel dosyasi yukleniyor...</p>
        </div>
    );
    if (error || sheets.length === 0) return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-slate-500">Onizleme yuklenemedi.</p>
        </div>
    );
    return (
        <div className="flex flex-col h-full">
            {sheets.length > 1 && (
                <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-100 dark:border-slate-800 flex-wrap">
                    {sheets.map((s, i) => (
                        <button key={i} onClick={() => setActive(i)}
                            className={\`px-3 py-1.5 text-xs font-medium rounded-t-lg border transition-colors \${active === i
                                ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-900 text-green-600"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}>
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-auto p-4">
                <div
                    className="excel-table-wrapper text-xs"
                    dangerouslySetInnerHTML={{ __html: sheets[active]?.html ?? "" }}
                />
            </div>
        </div>
    );
}

// ── PDF Viewer (pdfjs-dist) ───────────────────────────────────────────────────
function PdfViewer({ url }: { url: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [pageCount, setPageCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(false);
        (async () => {
            try {
                const pdfjsLib = await import("pdfjs-dist");
                // Use CDN worker to avoid bundling issues
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    \`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/\${pdfjsLib.version}/pdf.worker.min.mjs\`;

                const res = await fetch(url);
                const ab = await res.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                if (cancelled) return;

                setPageCount(pdf.numPages);
                if (!containerRef.current) return;
                containerRef.current.innerHTML = "";

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    if (cancelled) return;
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement("canvas");
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.className = "w-full mb-3 rounded shadow-sm border border-slate-100 dark:border-slate-800";
                    containerRef.current?.appendChild(canvas);
                    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
                }
            } catch (e) {
                console.error("PdfViewer:", e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]);

    if (error) return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-slate-500">PDF yuklenemedi.</p>
        </div>
    );
    return (
        <div className="relative overflow-auto" style={{ height: "70vh" }}>
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                    <p className="text-sm text-slate-500">PDF yukleniyor...</p>
                </div>
            )}
            <div ref={containerRef} className="p-4" />
        </div>
    );
}

// ── File Preview Dialog ────────────────────────────────────────────────────────
export function FilePreviewDialog({ file, onClose }: { file: SharedFile | null; onClose: () => void }) {
    const dl = async () => { try { await downloadBlob(file!.downloadUrl, file!.name); } catch { toast.error("Indirilemedi."); } };
    if (!file) return null;
    const t = file.fileType;
    const isImg = t.startsWith("image/");
    const isPdf = t === "application/pdf";
    const isVideo = t.startsWith("video/");
    const isAudio = t.startsWith("audio/");
    const isOffice = /\\.(xlsx?|docx?|pptx?|csv)$/i.test(file.name) ||
        t.includes("spreadsheet") || t.includes("excel") ||
        t.includes("wordprocessingml") || t.includes("msword") ||
        t.includes("presentationml") || t.includes("powerpoint");

    const canPreview = isImg || isPdf || isVideo || isAudio || isOffice;

    return (
        <Dialog open={!!file} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-5xl w-full p-0 overflow-hidden" style={{ maxHeight: "90vh" }}>
                <DialogHeader className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileTypeIcon type={file.fileType} size="sm" />
                        <div className="min-w-0">
                            <DialogTitle className="text-sm font-semibold truncate">{file.name}</DialogTitle>
                            <p className="text-xs text-slate-400 mt-0.5">{fmt(file.fileSize)} &middot; {fmtDate(file.createdAt)}</p>
                        </div>
                    </div>
                    <div className="shrink-0 mr-8">
                        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={dl}>
                            <Download className="h-3.5 w-3.5" />Indir
                        </Button>
                    </div>
                </DialogHeader>

                <div className="bg-slate-50 dark:bg-slate-900 overflow-hidden" style={{ maxHeight: "calc(90vh - 70px)" }}>
                    {isImg && (
                        <div className="flex items-center justify-center p-4" style={{ minHeight: 420 }}>
                            <img src={file.downloadUrl} alt={file.name} className="max-h-[70vh] max-w-full object-contain rounded" />
                        </div>
                    )}
                    {isPdf && <PdfViewer url={file.downloadUrl} />}
                    {isOffice && <ExcelViewer url={file.downloadUrl} />}
                    {isVideo && (
                        <div className="flex items-center justify-center p-4">
                            <video src={file.downloadUrl} controls className="max-h-[70vh] max-w-full rounded" />
                        </div>
                    )}
                    {isAudio && (
                        <div className="flex flex-col items-center gap-4 p-8" style={{ minHeight: 420 }}>
                            <FileTypeIcon type={file.fileType} size="lg" />
                            <p className="font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                            <audio src={file.downloadUrl} controls className="w-80" />
                        </div>
                    )}
                    {!canPreview && (
                        <div className="flex flex-col items-center gap-4 p-10 text-center" style={{ minHeight: 420 }}>
                            <FileTypeIcon type={file.fileType} size="lg" />
                            <div>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{file.name}</p>
                                <p className="text-sm text-slate-400 mt-1">{fmt(file.fileSize)}</p>
                                <p className="text-xs text-slate-400 mt-0.5">Bu dosya turu onizlenemiyor</p>
                            </div>
                            <Button onClick={dl} className="gap-1.5 mt-2"><Download className="h-4 w-4" />Dosyayi Indir</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

`;

content = content.slice(0, startIdx) + newDialog + content.slice(endIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('drive-table.tsx updated successfully.');

// Verify key strings
const out = fs.readFileSync(filePath, 'utf8');
console.log('ExcelViewer present:', out.includes('ExcelViewer'));
console.log('PdfViewer present:', out.includes('PdfViewer'));
console.log('pdfjs-dist import:', out.includes('pdfjs-dist'));
console.log('xlsx import:', out.includes('"xlsx"'));
console.log('Old gdocsUrl gone:', !out.includes('gdocsUrl'));
console.log('Old officeapps gone:', !out.includes('officeapps'));
