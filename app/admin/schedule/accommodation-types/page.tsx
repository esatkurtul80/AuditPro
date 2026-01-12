"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs, orderBy, query, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccommodationType } from "@/lib/types";
import { ACCOMMODATION_ICONS } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
function SortableAccommodationType({ type, onEdit, onDelete }: { type: AccommodationType, onEdit: (type: AccommodationType) => void, onDelete: (id: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: type.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Icon = ACCOMMODATION_ICONS[type.icon] || ACCOMMODATION_ICONS['hotel'];

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between p-4 rounded-lg border shadow-sm bg-white dark:bg-slate-950 transition-all hover:shadow-md group relative touch-none"
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg bg-blue-500"
            />

            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-move p-2 -ml-2 text-slate-400 hover:text-slate-600 outline-none"
                    title="Sıralamak için sürükleyin"
                >
                    <GripVertical className="h-5 w-5" />
                </div>

                <div className="p-2 bg-blue-50 rounded-full text-blue-600 flex-shrink-0">
                    <Icon className="h-5 w-5" />
                </div>

                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {type.name}
                </span>
            </div>

            <div className="flex items-center gap-1 z-10 bg-white dark:bg-slate-950 pl-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-slate-900"
                    onClick={() => onEdit(type)}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                    onClick={() => onDelete(type.id)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export default function AccommodationTypesPage() {
    const [types, setTypes] = useState<AccommodationType[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Type State
    const [editingType, setEditingType] = useState<AccommodationType | null>(null);
    const [newName, setNewName] = useState("");
    const [newIcon, setNewIcon] = useState("hotel");

    // Delete Dialog State
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchTypes();
    }, []);

    // Reset form
    useEffect(() => {
        if (dialogOpen) {
            if (editingType) {
                setNewName(editingType.name);
                setNewIcon(editingType.icon);
            } else {
                setNewName("");
                setNewIcon("hotel");
            }
        } else {
            setTimeout(() => {
                setEditingType(null);
                setNewName("");
                setNewIcon("hotel");
            }, 300);
        }
    }, [dialogOpen, editingType]);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "accommodation_types"));
            const snapshot = await getDocs(q);
            // Fallback for types without order: use index or append
            let data = snapshot.docs.map((doc, index) => {
                const d = doc.data();
                return {
                    id: doc.id,
                    name: d.name,
                    icon: d.icon,
                    createdAt: d.createdAt,
                    updatedAt: d.updatedAt,
                    order: d.order ?? index
                } as AccommodationType;
            });

            // Should already be sorted by query if order exists, but let's ensure reliable sort locally too if mixed
            data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            setTypes(data);
        } catch (error) {
            console.error("Error fetching types:", error);
            toast.error("Hata", { description: "Veriler yüklenirken bir hata oluştu." });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newName.trim()) return;

        try {
            if (editingType) {
                const docRef = doc(db, "accommodation_types", editingType.id);
                await updateDoc(docRef, {
                    name: newName,
                    icon: newIcon,
                    updatedAt: Timestamp.now()
                });

                setTypes(prev => prev.map(t =>
                    t.id === editingType.id
                        ? { ...t, name: newName, icon: newIcon, updatedAt: Timestamp.now() }
                        : t
                ));
                toast.success("Güncellendi", { description: "Konaklama türü güncellendi." });
            } else {
                const newOrder = types.length > 0 ? (Math.max(...types.map(t => t.order || 0)) + 1) : 0;

                const docRef = await addDoc(collection(db, "accommodation_types"), {
                    name: newName,
                    icon: newIcon,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    order: newOrder
                });

                const newType: AccommodationType = {
                    id: docRef.id,
                    name: newName,
                    icon: newIcon,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    order: newOrder
                };

                setTypes(prev => [...prev, newType]);
                toast.success("Eklendi", { description: "Yeni konaklama türü eklendi." });
            }
            setDialogOpen(false);
        } catch (error) {
            console.error("Error saving type:", error);
            toast.error("Hata", { description: "İşlem başarısız." });
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteDialog({ open: true, id });
    };

    const confirmDelete = async () => {
        if (!deleteDialog.id) return;
        try {
            await deleteDoc(doc(db, "accommodation_types", deleteDialog.id));
            setTypes(prev => prev.filter(t => t.id !== deleteDialog.id));
            toast.success("Silindi", { description: "Konaklama türü silindi." });
        } catch (error) {
            console.error("Error deleting type:", error);
            toast.error("Hata", { description: "Silinemedi." });
        } finally {
            setDeleteDialog({ open: false, id: null });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setTypes((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update implementation of order in DB
                // We do this asynchronously to not block UI
                const batch = writeBatch(db);
                newItems.forEach((item, index) => {
                    const ref = doc(db, "accommodation_types", item.id);
                    batch.update(ref, { order: index });
                });
                batch.commit().catch(e => console.error("Batch order update failed", e));

                return newItems;
            });
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
            <main className="flex-1 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-bold tracking-tight">Konaklama Türleri</h2>
                        <p className="text-muted-foreground">
                            Denetçilerin konaklama seçeneklerini yönetin ve sıralayın.
                        </p>
                    </div>
                    <div>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setEditingType(null)} className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="mr-2 h-4 w-4" /> Yeni Tür Ekle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingType ? "Konaklama Türünü Düzenle" : "Yeni Konaklama Türü"}</DialogTitle>
                                    <DialogDescription>
                                        {editingType ? "Mevcut türün adını veya ikonunu güncelleyin." : "Yeni bir konaklama türü ve ikonu seçin."}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Tür Adı</Label>
                                        <Input
                                            id="name"
                                            placeholder="Örn: Otel, Misafirhane..."
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Simge Seçin</Label>
                                        <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-[150px] overflow-y-auto">
                                            {Object.entries(ACCOMMODATION_ICONS).map(([key, Icon]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setNewIcon(key)}
                                                    className={cn(
                                                        "p-3 rounded-md border transition-all hover:bg-slate-50 flex flex-col items-center gap-1 min-w-[3rem]",
                                                        newIcon === key ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200"
                                                    )}
                                                    title={key}
                                                >
                                                    <Icon className={cn("h-5 w-5", newIcon === key ? "text-blue-600" : "text-slate-600")} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSave} disabled={!newName.trim()}>
                                        {editingType ? "Güncelle" : "Ekle"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tanımlı Konaklama Türleri</CardTitle>
                        <CardDescription>Sisteme kayıtlı ve sıralanabilir konaklama seçenekleri.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                <SortableContext
                                    items={types.map(t => t.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {types.map((type) => (
                                        <SortableAccommodationType
                                            key={type.id}
                                            type={type}
                                            onEdit={(t) => { setEditingType(t); setDialogOpen(true); }}
                                            onDelete={handleDeleteClick}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </DndContext>

                        {types.length === 0 && !loading && (
                            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                Henüz kayıtlı konaklama türü bulunmamaktadır.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Bu türü silmek istediğinize emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu işlem geri alınamaz. Bu konaklama türü kalıcı olarak silinecektir.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                                Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </div>
    );
}
