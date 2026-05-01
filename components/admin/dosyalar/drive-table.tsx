"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SharedFile, Folder } from "@/lib/shared-files";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, X, Loader2, Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileTypeIcon, fmt, fmtDate, downloadBlob } from "./file-helpers";

type SortKey = "name" | "date" | "size";
type SortDir = "asc" | "desc";

// ── Excel Viewer (SheetJS) ────────────────────────────────────────────────────
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
                const xlsxLib = await import("xlsx");
                const readFn = xlsxLib.read || xlsxLib.default?.read;
                const utilsObj = xlsxLib.utils || xlsxLib.default?.utils;
                
                const res = await fetch(url);
                const ab = await res.arrayBuffer();
                const wb = readFn(new Uint8Array(ab), { type: "array" });
                const result = wb.SheetNames.map(name => ({
                    name,
                    html: utilsObj.sheet_to_html(wb.Sheets[name], { editable: false }),
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
        <div className="flex flex-col" style={{ height: "100%" }}>
            {sheets.length > 1 && (
                <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-100 dark:border-slate-800 flex-wrap">
                    {sheets.map((s, i) => (
                        <button key={i} onClick={() => setActive(i)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border transition-colors ${active === i
                                ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-900 text-green-600"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-auto p-4" style={{ minHeight: 0 }}>
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
                // Use local worker via import.meta.url for Next.js
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    "pdfjs-dist/build/pdf.worker.min.mjs",
                    import.meta.url
                ).toString();

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
                    const ctx = canvas.getContext("2d"); if (ctx) { await (page.render as any)({ canvasContext: ctx, viewport }).promise; }
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
    const isOffice = /\.(xlsx?|docx?|pptx?|csv)$/i.test(file.name) ||
        t.includes("spreadsheet") || t.includes("excel") ||
        t.includes("wordprocessingml") || t.includes("msword") ||
        t.includes("presentationml") || t.includes("powerpoint");

    const canPreview = isImg || isPdf || isVideo || isAudio || isOffice;

    const isDoc = isOffice || isPdf;

    return (
        <Dialog open={!!file} onOpenChange={o => !o && onClose()}>
            <DialogContent 
                className={cn(
                    "p-0 overflow-hidden rounded-xl",
                    isDoc ? "w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] sm:w-[calc(100vw-48px)] sm:max-w-[calc(100vw-48px)]" : 
                    isImg ? "w-full sm:w-auto sm:max-w-[90vw]" : "max-w-5xl w-full"
                )} 
                style={isDoc ? { height: "95vh", maxHeight: "95vh" } : { maxHeight: "95vh" }}
            >
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

                <div 
                    className={cn("bg-slate-50 dark:bg-slate-900 flex flex-col", isDoc ? "overflow-hidden" : "overflow-y-auto")} 
                    style={isDoc ? { height: "calc(95vh - 70px)" } : { maxHeight: "calc(95vh - 70px)" }}
                >
                    {isImg && (
                        <div className="flex items-center justify-center p-4 bg-black/5 dark:bg-black/20" style={{ minHeight: 420 }}>
                            <img src={file.downloadUrl} alt={file.name} className="max-h-[80vh] w-auto max-w-full object-contain rounded shadow-sm" />
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

// Delete Confirm Dialog
export function DeleteConfirmDialog({ open, loading, title, desc, onConfirm, onCancel }: {
    open: boolean; loading: boolean; title: string; desc: string;
    onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <AlertDialog open={open} onOpenChange={o => !o && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{desc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel} disabled={loading}>Vazgec</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">
                        {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Sil
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// Sort Header
export function SortHeader({ label, sk, sortKey, sortDir, onSort }: {
    label: string; sk: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
    const active = sortKey === sk;
    return (
        <th
            className="py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            onClick={() => onSort(sk)}
        >
            <span className="flex items-center gap-1">
                {label}
                {active ? (sortDir === "asc" ? " up" : " down") : ""}
            </span>
        </th>
    );
}

// Name Editor
function NameEditor({ id, col, name, onDone }: { id: string; col: string; name: string; onDone: () => void }) {
    const [val, setVal] = useState(name);
    const [saving, setSaving] = useState(false);
    const save = async () => {
        const trimmed = val.trim();
        if (!trimmed || trimmed === name) { onDone(); return; }
        setSaving(true);
        try {
            await updateDoc(doc(db, col, id), { name: trimmed });
            toast.success("Ad guncellendi.");
        } catch { toast.error("Guncellenemedi."); }
        finally { setSaving(false); onDone(); }
    };
    return (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Input
                autoFocus value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }}
                className="h-7 text-sm py-0 px-2 w-48"
            />
            <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-green-50 text-green-600">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onDone} className="p-1 rounded hover:bg-red-50 text-red-500"><X className="h-3.5 w-3.5" /></button>
        </div>
    );
}

// Action Cells
function ActionCells({ onDownload, onRename, onDelete }: {
    onDownload: (e: React.MouseEvent) => void;
    onRename: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}) {
    return (
        <>
            <td className="py-2.5 px-2 text-center">
                <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={onDownload} title="Indir"
                >
                    <Download className="h-3.5 w-3.5" />
                </button>
            </td>
            <td className="py-2.5 px-2 text-center">
                <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={onRename} title="Yeniden Adlandir"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            </td>
            <td className="py-2.5 px-2 text-center">
                <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={onDelete} title="Sil"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </td>
        </>
    );
}

// Folder Row
export function FolderRow({ folder, onEnter, onDelete, isDropTarget, dragHandlers }: {
    folder: Folder; onEnter: (f: Folder) => void; onDelete: (f: Folder) => void;
    isDropTarget?: boolean; dragHandlers: React.HTMLAttributes<HTMLTableRowElement>;
}) {
    const [editing, setEditing] = useState(false);
    const [confirmDl, setConfirmDl] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const doDownload = async () => {
        setDownloading(true);
        try {
            const snap = await getDocs(query(collection(db, "shared_files"), where("folderId", "==", folder.id)));
            for (const d of snap.docs) {
                const f = d.data() as SharedFile;
                await downloadBlob(f.downloadUrl, f.name);
                await new Promise(r => setTimeout(r, 600));
            }
        } catch { toast.error("Indirilemedi."); }
        finally { setDownloading(false); setConfirmDl(false); }
    };

    return (
        <>
            <AlertDialog open={confirmDl} onOpenChange={o => !o && setConfirmDl(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Klasoru Indir</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>&quot;{folder.name}&quot;</strong> klasorundeki tum dosyalar tek tek indirilecek.
                            Dosya boyutlari buyuk olabilir, devam etmek istiyor musunuz?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgec</AlertDialogCancel>
                        <AlertDialogAction onClick={doDownload} disabled={downloading}>
                            {downloading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Indir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <tr {...dragHandlers}
                className={cn("group border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
                    isDropTarget && "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300")}
                onDoubleClick={() => onEnter(folder)}>
                <td className="py-2.5 px-4">
                    <div className="flex items-center gap-3">
                        <FileTypeIcon isFolder size="sm" />
                        {editing
                            ? <NameEditor id={folder.id} col="folders" name={folder.name} onDone={() => setEditing(false)} />
                            : <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate max-w-xs">{folder.name}</span>}
                    </div>
                </td>
                <td className="py-2.5 px-4 text-sm text-slate-500">{fmtDate(folder.createdAt)}</td>
                <td className="py-2.5 px-4 text-sm text-slate-400">&#8212;</td>
                <ActionCells
                    onDownload={e => { e.stopPropagation(); setConfirmDl(true); }}
                    onRename={e => { e.stopPropagation(); setEditing(true); }}
                    onDelete={e => { e.stopPropagation(); onDelete(folder); }}
                />
            </tr>
        </>
    );
}

// File Row
export function FileRow({ file, onDelete, onPreview, dragHandlers }: {
    file: SharedFile; onDelete: (f: SharedFile) => void; onPreview: (f: SharedFile) => void;
    dragHandlers: React.HTMLAttributes<HTMLTableRowElement>;
}) {
    const [editing, setEditing] = useState(false);
    const dl = async (e: React.MouseEvent) => { e.stopPropagation(); try { await downloadBlob(file.downloadUrl, file.name); } catch { toast.error("Indirilemedi."); } };

    return (
        <tr {...dragHandlers}
            className="group border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            onClick={() => onPreview(file)}
            onDoubleClick={dl}>
            <td className="py-2.5 px-4">
                <div className="flex items-center gap-3">
                    <FileTypeIcon type={file.fileType} size="sm" />
                    {editing
                        ? <NameEditor id={file.id} col="shared_files" name={file.name} onDone={() => setEditing(false)} />
                        : <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate max-w-xs">{file.name}</span>}
                </div>
            </td>
            <td className="py-2.5 px-4 text-sm text-slate-500">{fmtDate(file.createdAt)}</td>
            <td className="py-2.5 px-4 text-sm text-slate-500">{fmt(file.fileSize)}</td>
            <ActionCells
                onDownload={dl}
                onRename={e => { e.stopPropagation(); setEditing(true); }}
                onDelete={e => { e.stopPropagation(); onDelete(file); }}
            />
        </tr>
    );
}

// Grid Card
export function DriveGridCard({ item, isFolder, onEnter, onDelete, onPreview, dragHandlers }: {
    item: any; isFolder: boolean;
    onEnter?: () => void; onDelete: () => void; onPreview?: () => void;
    dragHandlers?: React.HTMLAttributes<HTMLDivElement>;
}) {
    const isImg = !isFolder && item.fileType?.startsWith("image/");
    const [showDel, setShowDel] = useState(false);
    const [deleting, setDeleting] = useState(false);

    return (
        <>
            <DeleteConfirmDialog
                open={showDel} loading={deleting}
                title={isFolder ? "Klasoru Sil" : "Dosyayi Sil"}
                desc={`"${item.name}" ${isFolder ? "klasoru" : "dosyasi"} kalici olarak silinecek.`}
                onConfirm={async () => { setDeleting(true); await onDelete(); setDeleting(false); setShowDel(false); }}
                onCancel={() => setShowDel(false)}
            />
            <div
                {...dragHandlers}
                onClick={() => { if (!isFolder && onPreview) onPreview(); }}
                onDoubleClick={() => { if (isFolder && onEnter) onEnter(); }}
                className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer select-none"
            >
                <div className="h-28 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden">
                    {isImg
                        ? <img src={item.downloadUrl} alt={item.name} className="h-full w-full object-cover" />
                        : <FileTypeIcon isFolder={isFolder} type={item.fileType} size="lg" />}
                </div>

                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isFolder && (
                        <button
                            className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-700 shadow flex items-center justify-center text-blue-600 hover:bg-blue-50"
                            onClick={async e => { e.stopPropagation(); try { await downloadBlob(item.downloadUrl, item.name); } catch { toast.error("Indirilemedi."); } }}
                        >
                            <Download className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-700 shadow flex items-center justify-center text-red-500 hover:bg-red-50"
                        onClick={e => { e.stopPropagation(); setShowDel(true); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="p-2.5">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                    {!isFolder && <p className="text-[10px] text-slate-400 mt-0.5">{fmt(item.fileSize)} &middot; {fmtDate(item.createdAt)}</p>}
                </div>
            </div>
        </>
    );
}