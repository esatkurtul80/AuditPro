"use client";
import { useState } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Folder } from "@/lib/shared-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FolderOpen, FolderPlus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
    folders: Folder[];
    currentId: string | null;
    currentFolderStoragePath: string;
    breadcrumbs: { id: string | null; name: string; storagePath?: string }[];
    onNavigate: (id: string | null, name: string) => void;
    onEnter: (folder: Folder) => void;
}

export function FolderNav({ folders, currentId, currentFolderStoragePath, breadcrumbs, onNavigate, onEnter }: Props) {
    const { userProfile } = useAuth();
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState("");
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
    const [editTarget, setEditTarget] = useState<Folder | null>(null);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);

    const createFolder = async () => {
        const name = createName.trim();
        if (!name || !userProfile) return;
        setCreating(true);
        try {
            const safeName = name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
            const storagePath = `${currentFolderStoragePath}/${safeName}`;
            await addDoc(collection(db, "folders"), {
                name,
                parentId: currentId,
                storagePath,
                createdBy: userProfile.uid,
                createdAt: Timestamp.now(),
            } satisfies Omit<Folder, "id">);
            toast.success(`"${name}" olusturuldu.`);
            setCreateName("");
            setShowCreate(false);
        } catch (e) {
            console.error("createFolder error:", e);
            toast.error("Klasor olusturulamadi.");
        } finally { setCreating(false); }
    };

    const deleteFolder = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, "folders", deleteTarget.id));
            toast.success("Klasor silindi.");
        } catch { toast.error("Klasor silinemedi."); }
        finally { setSaving(false); setDeleteTarget(null); }
    };

    const renameFolder = async () => {
        if (!editTarget || !editName.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "folders", editTarget.id), { name: editName.trim() });
            toast.success("Klasor adi guncellendi.");
        } catch { toast.error("Guncellenemedi."); }
        finally { setSaving(false); setEditTarget(null); }
    };

    return (
        <>
            {/* Create folder dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Yeni Klasor</DialogTitle></DialogHeader>
                    <Input
                        placeholder="Klasor adi"
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && createFolder()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Iptal</Button>
                        <Button onClick={createFolder} disabled={creating || !createName.trim()}>
                            {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Olustur
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename dialog */}
            <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Klasoru Yeniden Adlandir</DialogTitle></DialogHeader>
                    <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && renameFolder()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditTarget(null)}>Iptal</Button>
                        <Button onClick={renameFolder} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Klasoru Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>&quot;{deleteTarget?.name}&quot;</strong> klasoru silinecek. Icindeki dosyalar bu klasorden cikarilir ancak silinmez.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Iptal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={deleteFolder}
                            disabled={saving}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Breadcrumb + New Folder button */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <Breadcrumb>
                    <BreadcrumbList>
                        {breadcrumbs.map((bc, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <BreadcrumbSeparator />}
                                <BreadcrumbItem>
                                    {i === breadcrumbs.length - 1 ? (
                                        <BreadcrumbPage>{bc.name}</BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink
                                            className="cursor-pointer"
                                            onClick={() => onNavigate(bc.id, bc.name)}
                                        >
                                            {bc.name}
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </span>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>

                <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                    onClick={() => { setCreateName(""); setShowCreate(true); }}
                >
                    <FolderPlus className="h-3.5 w-3.5" /> Yeni Klasor
                </Button>
            </div>

            {/* Folder cards */}
            {folders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
                    {folders.map(f => (
                        <div
                            key={f.id}
                            onDoubleClick={() => onEnter(f)}
                            className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-sm cursor-pointer transition-all select-none"
                            title="Cift tiklayarak ac"
                        >
                            <FolderOpen className="h-10 w-10 text-amber-400" />
                            <span className="text-xs font-medium text-center text-slate-700 dark:text-slate-300 truncate w-full">{f.name}</span>
                            {/* Action buttons */}
                            <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={e => { e.stopPropagation(); setEditName(f.name); setEditTarget(f); }}
                                    className="p-1 rounded bg-white dark:bg-slate-700 shadow text-slate-500 hover:text-blue-600 transition-colors"
                                    title="Yeniden adlandir"
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={e => { e.stopPropagation(); setDeleteTarget(f); }}
                                    className="p-1 rounded bg-white dark:bg-slate-700 shadow text-slate-500 hover:text-red-600 transition-colors"
                                    title="Sil"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}