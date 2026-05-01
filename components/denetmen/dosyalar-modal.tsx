"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SharedFile, Folder, getFileTypeInfo, formatFileSize, canPrint, downloadFileBlob, printFileBlob } from "@/lib/shared-files";
import { FileTypeIcon } from "@/components/admin/dosyalar/file-helpers";
import { FilePreviewDialog } from "@/components/admin/dosyalar/drive-table";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Download,
    Loader2,
    FolderOpen,
    Search,
    Printer,
    Mail,
    Share2,
    X,
    Folder as FolderIcon,
    ChevronRight,
    Home,
    LayoutGrid,
    LayoutList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// WhatsApp icon (inline SVG)
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

function PdfThumbnail({ url, className }: { url: string; className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const pdfjsLib = await import("pdfjs-dist");
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    "pdfjs-dist/build/pdf.worker.min.mjs",
                    import.meta.url
                ).toString();

                const res = await fetch(url);
                const ab = await res.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                if (cancelled) return;

                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 0.5 });
                const canvas = canvasRef.current;
                if (!canvas) return;
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    // @ts-expect-error - `canvas` might be required by types, but canvasContext is sufficient for rendering
                    await page.render({ canvasContext: ctx, viewport }).promise;
                }
            } catch (e) {
                console.error("PdfThumbnail:", e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]);

    return (
        <div className={cn("flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden relative", className)}>
            {!error && <canvas ref={canvasRef} className="w-full h-full object-cover" />}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 absolute" />}
            {error && <span className="text-[9px] font-bold text-slate-400">PDF</span>}
        </div>
    );
}

interface DosyalarModalProps {
    open: boolean;
    onClose: () => void;
}

export function DosyalarModal({ open, onClose }: DosyalarModalProps) {
    const { userProfile } = useAuth();
    const [files, setFiles] = useState<SharedFile[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "Dosyalar" }]);
    const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
    const [isPrinting, setIsPrinting] = useState<Record<string, boolean>>({});
    const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");

    const currentId = breadcrumbs[breadcrumbs.length - 1].id;

    useEffect(() => {
        if (!open || !userProfile) return;
        setLoading(true);

        const qf = query(collection(db, "shared_files"), where("folderId", "==", currentId));
        const unsubF = onSnapshot(qf, (snap) => {
            setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SharedFile)));
            setLoading(false);
        }, (err) => {
            console.error("dosyalar modal files:", err);
            setLoading(false);
        });

        const qd = query(collection(db, "folders"), where("parentId", "==", currentId));
        const unsubD = onSnapshot(qd, (snap) => {
            setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Folder)));
        }, (err) => {
            console.error("dosyalar modal folders:", err);
        });

        return () => { unsubF(); unsubD(); };
    }, [open, userProfile, currentId]);

    // Sorting
    const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, "tr"));

    const filteredFolders = sortedFolders.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );
    const filteredFiles = sortedFiles.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    const enterFolder = (f: Folder) => {
        setBreadcrumbs(prev => [...prev, { id: f.id, name: f.name }]);
        setSearch("");
    };

    const navTo = (bcId: string | null) => {
        setBreadcrumbs(prev => prev.slice(0, prev.findIndex(b => b.id === bcId) + 1));
        setSearch("");
    };

    // ── Actions ────────────────────────────────────────────────
    const handleDownload = async (file: SharedFile) => {
        setIsDownloading(prev => ({ ...prev, [file.id]: true }));
        try {
            await downloadFileBlob(file.downloadUrl, file.name);
            toast.success("İndirme başladı.");
        } catch (error) {
            console.error("İndirme hatası:", error);
            toast.error("Dosya indirilemedi.");
        } finally {
            setIsDownloading(prev => ({ ...prev, [file.id]: false }));
        }
    };

    const handlePrint = async (file: SharedFile) => {
        setIsPrinting(prev => ({ ...prev, [file.id]: true }));
        toast.info("Yazdırma hazırlanıyor, lütfen bekleyin...");
        try {
            await printFileBlob(file.downloadUrl, file.fileType);
        } catch (error) {
            console.error("Yazdırma hatası:", error);
            toast.error("Yazdırma başlatılamadı.");
        } finally {
            setIsPrinting(prev => ({ ...prev, [file.id]: false }));
        }
    };

    const handleWhatsApp = (file: SharedFile) => {
        const text = encodeURIComponent(`📎 ${file.name}\n${file.downloadUrl}`);
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    };

    const handleEmail = (file: SharedFile) => {
        const subject = encodeURIComponent(`Dosya: ${file.name}`);
        const body = encodeURIComponent(`Merhaba,\n\nAşağıdaki dosyayı paylaşıyorum:\n\n${file.name}\n${file.downloadUrl}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    };

    const handleNativeShare = async (file: SharedFile) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: file.name,
                    text: `📎 ${file.name}`,
                    url: file.downloadUrl,
                });
            } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(file.downloadUrl);
            toast.success("Bağlantı panoya kopyalandı.");
        }
    };

    // ─────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={(o) => {
            if (!o) {
                onClose();
                // Reset on close
                setTimeout(() => {
                    setBreadcrumbs([{ id: null, name: "Dosyalar" }]);
                    setSearch("");
                }, 300);
            }
        }}>
            <DialogContent showCloseButton={false} className="max-w-lg w-full p-0 gap-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-5 pt-5 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
                                <FolderOpen className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-white text-lg">Dosyalar</DialogTitle>
                                <p className="text-blue-100 text-xs mt-0.5">Admin tarafından paylaşılan dosyalar</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Breadcrumbs */}
                <div className="px-4 py-2 border-b bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {breadcrumbs.map((bc, idx) => {
                        const isLast = idx === breadcrumbs.length - 1;
                        return (
                            <div key={bc.id || "root"} className="flex items-center gap-1.5">
                                <button
                                    onClick={() => !isLast && navTo(bc.id)}
                                    className={cn(
                                        "text-xs font-medium transition-colors flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md",
                                        isLast ? "text-slate-800 dark:text-slate-200" : "text-blue-600 dark:text-blue-400"
                                    )}
                                >
                                    {idx === 0 && <Home className="h-3.5 w-3.5" />}
                                    {bc.name}
                                </button>
                                {!isLast && <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                            </div>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Dosya veya klasör ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 text-sm bg-white dark:bg-slate-800"
                        />
                    </div>
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                        <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1.5 transition-colors", viewMode === "list" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 bg-white dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white")}>
                            <LayoutList className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewMode("grid")} className={cn("px-2.5 py-1.5 transition-colors", viewMode === "grid" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 bg-white dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white")}>
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* File/Folder list */}
                <div className={cn("overflow-y-auto max-h-[55vh]", viewMode === "list" ? "divide-y divide-slate-100 dark:divide-slate-800" : "p-4")}>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                        </div>
                    ) : (filteredFiles.length === 0 && filteredFolders.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <FolderOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                                {search ? "Arama sonucu bulunamadı" : "Bu klasör boş"}
                            </p>
                        </div>
                    ) : (
                        viewMode === "grid" ? (
                            <div className="grid grid-cols-2 gap-4">
                                {filteredFolders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        onClick={() => enterFolder(folder)}
                                        className="group relative flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 mb-3 relative">
                                            <FolderIcon className="h-7 w-7 fill-current opacity-20 absolute" />
                                            <FolderIcon className="h-7 w-7 relative z-10" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center w-full truncate px-2">
                                            {folder.name}
                                        </p>
                                    </div>
                                ))}

                                {filteredFiles.map((file) => {
                                    const { label, color, bg } = getFileTypeInfo(file.fileType);
                                    const printable = canPrint(file.fileType);
                                    const isImg = file.fileType.startsWith("image/");
                                    return (
                                        <div
                                            key={file.id}
                                            onClick={() => setPreviewFile(file)}
                                            className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer select-none"
                                        >
                                            <div className="h-32 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden shrink-0">
                                                {isImg ? (
                                                    <img src={file.downloadUrl} alt={file.name} className="h-full w-full object-cover" />
                                                ) : file.fileType === "application/pdf" ? (
                                                    <PdfThumbnail url={file.downloadUrl} className="h-full w-full" />
                                                ) : (
                                                    <FileTypeIcon type={file.fileType} size="lg" />
                                                )}
                                            </div>
                                            <div className="p-3 flex flex-col flex-1">
                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>{file.name}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 h-3.5 font-medium", bg, color)}>
                                                        {label}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400">{formatFileSize(file.fileSize)}</span>
                                                </div>
                                                <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                        disabled={isDownloading[file.id]}
                                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded border border-blue-200 dark:border-blue-800 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 disabled:opacity-50"
                                                        title="İndir"
                                                    >
                                                        {isDownloading[file.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                                    </button>
                                                    {printable && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePrint(file); }}
                                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                            title="Yazdır"
                                                        >
                                                            <Printer className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleWhatsApp(file); }}
                                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded border border-green-200 dark:border-green-800 text-[10px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100"
                                                        title="WhatsApp"
                                                    >
                                                        <WhatsAppIcon className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEmail(file); }}
                                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded border border-orange-200 dark:border-orange-800 text-[10px] font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100"
                                                        title="E-posta"
                                                    >
                                                        <Mail className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleNativeShare(file); }}
                                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded border border-purple-200 dark:border-purple-800 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                                                        title="Paylaş"
                                                    >
                                                        <Share2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <>
                                {filteredFolders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        onClick={() => enterFolder(folder)}
                                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center gap-3"
                                    >
                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400">
                                            <FolderIcon className="h-5 w-5 fill-current opacity-20" />
                                            <FolderIcon className="h-5 w-5 absolute" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                                {folder.name}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                    </div>
                                ))}

                                {filteredFiles.map((file) => {
                                    const { label, color, bg } = getFileTypeInfo(file.fileType);
                                    const printable = canPrint(file.fileType);
                                    const isImg = file.fileType.startsWith("image/");
                                    return (
                                        <div 
                                            key={file.id} 
                                            onClick={() => setPreviewFile(file)}
                                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-start gap-3">
                                                {isImg ? (
                                                    <img src={file.downloadUrl} alt={file.name} className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0" />
                                                ) : file.fileType === "application/pdf" ? (
                                                    <PdfThumbnail url={file.downloadUrl} className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                                        <FileTypeIcon type={file.fileType} size="sm" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                                        {file.name}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 font-medium", bg, color)}>
                                                            {label}
                                                        </Badge>
                                                        <span className="text-[11px] text-slate-400">{formatFileSize(file.fileSize)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                    disabled={isDownloading[file.id]}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isDownloading[file.id] ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3.5 w-3.5" />
                                                    )}
                                                    {isDownloading[file.id] ? "İndiriliyor..." : "İndir"}
                                                </button>
                                                {printable && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePrint(file); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                    >
                                                        <Printer className="h-3.5 w-3.5" />
                                                        Yazdır
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleWhatsApp(file); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                                                >
                                                    <WhatsAppIcon className="h-3.5 w-3.5" />
                                                    WhatsApp
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEmail(file); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                                                >
                                                    <Mail className="h-3.5 w-3.5" />
                                                    E-posta
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleNativeShare(file); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                                                >
                                                    <Share2 className="h-3.5 w-3.5" />
                                                    Paylaş
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )
                    )}
                </div>

                {/* Footer */}
                {!loading && (files.length > 0 || folders.length > 0) && (
                    <div className="px-4 py-2.5 border-t bg-slate-50 dark:bg-slate-900/50 text-center flex items-center justify-between">
                        <p className="text-[11px] text-slate-400">
                            {filteredFolders.length} klasör, {filteredFiles.length} dosya gösteriliyor
                        </p>
                    </div>
                )}
            </DialogContent>
            
            <FilePreviewDialog 
                file={previewFile} 
                onClose={() => setPreviewFile(null)} 
            />
        </Dialog>
    );
}
