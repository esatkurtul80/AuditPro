"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { collection, addDoc, deleteDoc, doc, getDocs, onSnapshot, query, Timestamp, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { SharedFile, Folder } from "@/lib/shared-files";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { FolderPlus, Upload, Loader2, FolderOpen, LayoutGrid, LayoutList, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ALLOWED_TYPES, MAX_SIZE, FileTypeIcon, fmt, fmtDate } from "./file-helpers";
import { SortHeader, FolderRow, FileRow, FilePreviewDialog, DriveGridCard, DeleteConfirmDialog } from "./drive-table";

type SortKey = "name" | "date" | "size";
type SortDir = "asc" | "desc";
type BC = { id: string | null; name: string; storagePath: string };
type DragItem = { kind: "file" | "folder"; id: string; folderId: string | null; storagePath: string };




export function FileManager() {
    const { userProfile } = useAuth();
    const [files, setFiles] = useState<SharedFile[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [uploads, setUploads] = useState<{ id: string; file: File; progress: number }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
    const [delFile, setDelFile] = useState<SharedFile | null>(null);
    const [delFolder, setDelFolder] = useState<Folder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [breadcrumbs, setBreadcrumbs] = useState<BC[]>([{ id: null, name: "Drive", storagePath: "shared-files" }]);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creating, setCreating] = useState(false);
    const dragItem = useRef<DragItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentBC = breadcrumbs[breadcrumbs.length - 1];
    const currentId = currentBC.id;
    const currentStoragePath = currentBC.storagePath;

    // Listeners
    useEffect(() => {
        if (!userProfile) return;
        setLoading(true);
        const qf = query(collection(db, "shared_files"), where("folderId", "==", currentId));
        const unF = onSnapshot(qf, snap => {
            setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as SharedFile)));
            setLoading(false);
        }, err => { console.error(err); setLoading(false); });
        const qd = query(collection(db, "folders"), where("parentId", "==", currentId));
        const unD = onSnapshot(qd, snap => setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Folder))), console.error);
        return () => { unF(); unD(); };
    }, [userProfile, currentId]);

    // Sort
    const sortFn = (a: any, b: any) => {
        let res = 0;
        if (sortKey === "name") res = a.name.localeCompare(b.name, "tr");
        else if (sortKey === "date") res = (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
        else if (sortKey === "size") res = (a.fileSize ?? 0) - (b.fileSize ?? 0);
        return sortDir === "asc" ? res : -res;
    };
    const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

    const sortedFolders = [...folders].sort(sortFn);
    const sortedFiles = [...files].sort(sortFn);

    // Navigate
    const enterFolder = (f: Folder) => {
        setBreadcrumbs(prev => [...prev, { id: f.id, name: f.name, storagePath: f.storagePath ?? `${currentStoragePath}/${f.name}` }]);
        setLoading(true);
    };
    const navTo = (bc: BC) => {
        setBreadcrumbs(prev => prev.slice(0, prev.findIndex(b => b.id === bc.id) + 1));
        setLoading(true);
    };

    // Create folder — also upload a .keep placeholder to mirror structure in Storage
    const createFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        setCreating(true);
        const safeName = name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
        const folderStoragePath = `${currentStoragePath}/${safeName}`;
        try {
            // Upload placeholder so folder is visible in Firebase Storage console
            const keepRef = ref(storage, `${folderStoragePath}/.keep`);
            await uploadBytes(keepRef, new Uint8Array(0), { contentType: "application/octet-stream" });

            await addDoc(collection(db, "folders"), {
                name, parentId: currentId,
                storagePath: folderStoragePath,
                createdBy: userProfile?.uid ?? "", createdAt: Timestamp.now(),
            } satisfies Omit<Folder, "id">);
            toast.success(`"${name}" oluşturuldu.`);
            setNewFolderName(""); setShowNewFolder(false);
        } catch (e) { console.error(e); toast.error("Oluşturulamadı."); }
        finally { setCreating(false); }
    };

    // Upload
    const handleFiles = useCallback((sel: FileList | File[]) => {
        Array.from(sel).forEach(file => {
            if (!ALLOWED_TYPES.includes(file.type)) { toast.error(`"${file.name}" desteklenmeyen tür.`); return; }
            if (file.size > MAX_SIZE) { toast.error(`"${file.name}" 50MB sınırını aşıyor.`); return; }
            const uid = crypto.randomUUID();
            const safe = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const path = `${currentStoragePath}/${safe}`;
            const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
            setUploads(p => [...p, { id: uid, file, progress: 0 }]);
            task.on("state_changed",
                s => setUploads(p => p.map(u => u.id === uid ? { ...u, progress: s.bytesTransferred / s.totalBytes * 100 } : u)),
                () => { toast.error(`"${file.name}" yüklenemedi.`); setUploads(p => p.filter(u => u.id !== uid)); },
                async () => {
                    const url = await getDownloadURL(task.snapshot.ref);
                    await addDoc(collection(db, "shared_files"), {
                        name: file.name, fileName: safe, storagePath: path, downloadUrl: url,
                        fileType: file.type, fileSize: file.size, folderId: currentId,
                        uploadedBy: userProfile?.uid ?? "", uploadedByName: userProfile?.displayName ?? "Admin",
                        createdAt: Timestamp.now(),
                    } satisfies Omit<SharedFile, "id">);
                    toast.success(`"${file.name}" yüklendi.`);
                    setUploads(p => p.filter(u => u.id !== uid));
                }
            );
        });
    }, [currentStoragePath, currentId, userProfile]);

    // Drag & drop — internal item movement
    const onDragStart = (item: DragItem) => (e: React.DragEvent) => {
        dragItem.current = item;
        e.dataTransfer.effectAllowed = "move";
        // Mark as internal so page-level drop zone stays hidden
        e.dataTransfer.setData("text/internal", "1");
    };
    const isExternalDrag = (e: React.DragEvent) =>
        Array.from(e.dataTransfer.types).includes("Files") && !Array.from(e.dataTransfer.types).includes("text/internal");

    const onFolderDragOver = (folderId: string) => (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (dragItem.current?.id !== folderId) setDropTarget(folderId);
    };
    const onFolderDrop = (targetFolder: Folder) => async (e: React.DragEvent) => {
        e.preventDefault(); setDropTarget(null);
        const item = dragItem.current;
        if (!item || item.id === targetFolder.id) return;
        try {
            if (item.kind === "file") await updateDoc(doc(db, "shared_files", item.id), { folderId: targetFolder.id });
            else if (item.kind === "folder") await updateDoc(doc(db, "folders", item.id), { parentId: targetFolder.id });
            toast.success("Taşındı.");
        } catch { toast.error("Taşınamadı."); }
        dragItem.current = null;
    };
    // Drop onto breadcrumb item to move to that directory
    const onBreadcrumbDrop = (bc: BC) => async (e: React.DragEvent) => {
        e.preventDefault();
        const item = dragItem.current;
        if (!item) return;
        try {
            if (item.kind === "file") await updateDoc(doc(db, "shared_files", item.id), { folderId: bc.id });
            else if (item.kind === "folder") await updateDoc(doc(db, "folders", item.id), { parentId: bc.id });
            toast.success(`"${bc.name}" dizinine taşındı.`);
        } catch { toast.error("Taşınamadı."); }
        dragItem.current = null;
    };

    // Delete
    const deleteFile = async () => {
        if (!delFile) return;
        setIsDeleting(true);
        try {
            try { await deleteObject(ref(storage, delFile.storagePath)); } catch (e) { console.error("storage del:", e); }
            await deleteDoc(doc(db, "shared_files", delFile.id));
            toast.success("Dosya silindi.");
        } catch { toast.error("Silinemedi."); }
        finally { setIsDeleting(false); setDelFile(null); }
    };
    const deleteFolderFn = async () => {
        if (!delFolder) return;
        setIsDeleting(true);
        try {
            // Delete all files inside this folder from Storage + Firestore
            const snap = await getDocs(query(collection(db, "shared_files"), where("folderId", "==", delFolder.id)));
            await Promise.all(snap.docs.map(async d => {
                const f = d.data();
                try { await deleteObject(ref(storage, f.storagePath)); } catch { /* file may not exist */ }
                await deleteDoc(doc(db, "shared_files", d.id));
            }));
            // Delete the .keep placeholder if it exists
            try { await deleteObject(ref(storage, `${delFolder.storagePath}/.keep`)); } catch { }
            // Delete the folder doc
            await deleteDoc(doc(db, "folders", delFolder.id));
            toast.success(`"${delFolder.name}" klasörü ve içeriği silindi.`);
        } catch { toast.error("Silinemedi."); }
        finally { setIsDeleting(false); setDelFolder(null); }
    };

    return (
        <>
            {/* File Preview */}
            <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />

            {/* Delete file dialog */}
            <DeleteConfirmDialog
                open={!!delFile} loading={isDeleting}
                title="Dosyayı Sil"
                desc={`"${delFile?.name}" kalıcı olarak silinecek.`}
                onConfirm={deleteFile}
                onCancel={() => setDelFile(null)}
            />

            {/* Delete folder dialog */}
            <DeleteConfirmDialog
                open={!!delFolder} loading={isDeleting}
                title="Klasörü Sil"
                desc={`"${delFolder?.name}" klasörü ve içeriği silinecek.`}
                onConfirm={deleteFolderFn}
                onCancel={() => setDelFolder(null)}
            />

            {/* New folder dialog */}
            <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Yeni Klasör</DialogTitle></DialogHeader>
                    <Input autoFocus placeholder="Klasör adı" value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && createFolder()} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNewFolder(false)}>İptal</Button>
                        <Button onClick={createFolder} disabled={creating || !newFolderName.trim()}>
                            {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Oluştur</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4"
                onDragOver={e => { if (isExternalDrag(e) && !dropTarget) { e.preventDefault(); setIsDragging(true); } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (!dropTarget && isExternalDrag(e)) handleFiles(e.dataTransfer.files); }}
                onDragEnd={() => { dragItem.current = null; setDropTarget(null); }}
            >
                {/* Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40"><FolderOpen className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dosya Yönetimi</h1>
                            <p className="text-xs text-slate-500">Denetmenlerin erişeceği dosyaları yönetin</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewFolderName(""); setShowNewFolder(true); }}>
                            <FolderPlus className="h-4 w-4" />Klasör
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-4 w-4" />Yükle
                        </Button>
                        <input ref={fileInputRef} type="file" multiple accept={ALLOWED_TYPES.join(",")} className="hidden"
                            onChange={e => e.target.files && handleFiles(e.target.files)} />
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1.5 transition-colors", viewMode === "list" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-900")}>
                                <LayoutList className="h-4 w-4" /></button>
                            <button onClick={() => setViewMode("grid")} className={cn("px-2.5 py-1.5 transition-colors", viewMode === "grid" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-900")}>
                                <LayoutGrid className="h-4 w-4" /></button>
                        </div>
                        <Badge variant="secondary">{sortedFolders.length + sortedFiles.length} öğe</Badge>
                    </div>
                </div>

                {/* Breadcrumb — items are drop targets for moving files/folders */}
                <Breadcrumb>
                    <BreadcrumbList>
                        {breadcrumbs.map((bc, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <BreadcrumbSeparator />}
                                <BreadcrumbItem>
                                    {i === breadcrumbs.length - 1
                                        ? <BreadcrumbPage>{bc.name}</BreadcrumbPage>
                                        : (
                                            <BreadcrumbLink
                                                className="cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                onClick={() => navTo(bc)}
                                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("bg-blue-100", "dark:bg-blue-900/30"); }}
                                                onDragLeave={e => e.currentTarget.classList.remove("bg-blue-100", "dark:bg-blue-900/30")}
                                                onDrop={e => { e.currentTarget.classList.remove("bg-blue-100", "dark:bg-blue-900/30"); onBreadcrumbDrop(bc)(e); }}
                                            >{bc.name}</BreadcrumbLink>
                                        )}
                                </BreadcrumbItem>
                            </span>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>

                {/* Upload progress */}
                {uploads.length > 0 && (
                    <div className="space-y-1.5">
                        {uploads.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <FileTypeIcon type={u.file.type} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{u.file.name}</p>
                                    <Progress value={u.progress} className="h-1 mt-1" />
                                </div>
                                <span className="text-xs text-slate-500 shrink-0">{Math.round(u.progress)}%</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Drop overlay */}
                {isDragging && (
                    <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-blue-600 font-medium text-sm">Dosyaları buraya bırakın</p>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FolderOpen className="h-14 w-14 text-slate-200 dark:text-slate-700 mb-3" />
                        <p className="text-slate-500 font-medium">Bu dizin boş</p>
                        <p className="text-slate-400 text-sm">Dosya yükleyin veya klasör oluşturun</p>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {sortedFolders.map(f => (
                            <DriveGridCard key={f.id} item={f} isFolder
                                onEnter={() => enterFolder(f)}
                                onDelete={() => deleteDoc(doc(db, "folders", f.id)).then(() => toast.success("Klasör silindi.")).catch(() => toast.error("Silinemedi."))}
                                dragHandlers={{
                                    draggable: true,
                                    onDragStart: onDragStart({ kind: "folder", id: f.id, folderId: f.parentId, storagePath: f.storagePath }),
                                    onDragOver: onFolderDragOver(f.id),
                                    onDragLeave: () => setDropTarget(null),
                                    onDrop: onFolderDrop(f),
                                }}
                            />
                        ))}
                        {sortedFiles.map(f => (
                            <DriveGridCard key={f.id} item={f} isFolder={false}
                                onPreview={() => setPreviewFile(f)}
                                onDelete={() => deleteDoc(doc(db, "shared_files", f.id)).then(() => toast.success("Dosya silindi.")).catch(() => toast.error("Silinemedi."))}
                                dragHandlers={{
                                    draggable: true,
                                    onDragStart: onDragStart({ kind: "file", id: f.id, folderId: f.folderId, storagePath: f.storagePath }),
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <SortHeader label="Ad" sk="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    <SortHeader label="Tarih" sk="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    <SortHeader label="Boyut" sk="size" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    <th className="py-2.5 px-2 w-10 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">İndir</th>
                                    <th className="py-2.5 px-2 w-10 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Adlandır</th>
                                    <th className="py-2.5 px-2 w-10 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Sil</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedFolders.map(f => (
                                    <FolderRow key={f.id} folder={f} onEnter={enterFolder} onDelete={setDelFolder}
                                        isDropTarget={dropTarget === f.id}
                                        dragHandlers={{
                                            draggable: true,
                                            onDragStart: onDragStart({ kind: "folder", id: f.id, folderId: f.parentId, storagePath: f.storagePath }),
                                            onDragOver: onFolderDragOver(f.id),
                                            onDragLeave: () => setDropTarget(null),
                                            onDrop: onFolderDrop(f),
                                        }} />
                                ))}
                                {sortedFiles.map(f => (
                                    <FileRow key={f.id} file={f} onDelete={setDelFile} onPreview={setPreviewFile}
                                        dragHandlers={{
                                            draggable: true,
                                            onDragStart: onDragStart({ kind: "file", id: f.id, folderId: f.folderId, storagePath: f.storagePath }),
                                            onDragOver: e => e.preventDefault(),
                                        }} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}



