"use client";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, GripVertical, Star } from "lucide-react";
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeaveType } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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

const PREDEFINED_COLORS = [
    { value: "#EF4444", label: "Kırmızı" },
    { value: "#F97316", label: "Turuncu" },
    { value: "#F59E0B", label: "Sarı" },
    { value: "#84CC16", label: "Limon Yeşili" },
    { value: "#10B981", label: "Yeşil" },
    { value: "#14B8A6", label: "Turkuaz" },
    { value: "#06B6D4", label: "Açık Mavi" },
    { value: "#0EA5E9", label: "Gök Mavisi" },
    { value: "#3B82F6", label: "Mavi" },
    { value: "#1E40AF", label: "Lacivert" },
    { value: "#6366F1", label: "İndigo" },
    { value: "#8B5CF6", label: "Mor" },
    { value: "#A855F7", label: "Eflatun" },
    { value: "#D946EF", label: "Fuşya" },
    { value: "#EC4899", label: "Pembe" },
    { value: "#F43F5E", label: "Gül Kurusu" },
    { value: "#713F12", label: "Kahverengi" },
    { value: "#78716C", label: "Taş Rengi" },
    { value: "#64748B", label: "Gri" },
    { value: "#0F172A", label: "Siyah" },
    { value: "#FDE047", label: "Açık Sarı" },
    { value: "#4D7C0F", label: "Zeytin Yeşili" },
    { value: "#047857", label: "Zümrüt Yeşili" },
    { value: "#0E7490", label: "Camgöbeği" },
    { value: "#4338CA", label: "Kraliyet Mavisi" },
    { value: "#BE123C", label: "Kızıl" },
    { value: "#451a03", label: "Koyu Kahve" },
];

function SortableLeaveType({ type, onEdit, onDelete }: { type: LeaveType, onEdit: (type: LeaveType) => void, onDelete: (id: string) => void }) {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between p-4 rounded-lg border shadow-sm bg-white dark:bg-slate-950 transition-all hover:shadow-md group relative touch-none"
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"
                style={{ backgroundColor: type.color }}
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

                <div className="flex flex-col gap-1">
                    <div className="font-medium truncate pr-2 flex items-center gap-2">
                        {type.name}
                        {type.isDefault && (
                            <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-200 flex items-center gap-1 shadow-sm">
                                <Star className="w-3 h-3 fill-yellow-700" />
                                Varsayılan
                            </span>
                        )}
                    </div>
                </div>
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

                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(type.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function LeaveTypesPage() {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingType, setEditingType] = useState<LeaveType | null>(null);
    const [formData, setFormData] = useState({ name: "", color: PREDEFINED_COLORS[0].value, isDefault: false });
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchLeaveTypes();
    }, []);

    useEffect(() => {
        if (editingType) {
            setFormData({ name: editingType.name, color: editingType.color, isDefault: editingType.isDefault || false });
        } else {
            setFormData({ name: "", color: PREDEFINED_COLORS[0].value, isDefault: false });
        }
    }, [editingType]);

    const fetchLeaveTypes = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "leave_types"));
            const snapshot = await getDocs(q);
            let data = snapshot.docs.map((doc, index) => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    order: d.order ?? index
                } as LeaveType;
            });

            // Should already be sorted by query if order exists, but let's ensure reliable sort locally too if mixed
            data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            setLeaveTypes(data);
        } catch (error) {
            console.error("Error fetching leave types:", error);
            toast.error("Hata", { description: "Veriler yüklenirken bir hata oluştu." });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingType) {
                // Update
                const docRef = doc(db, "leave_types", editingType.id);
                await updateDoc(docRef, {
                    name: formData.name,
                    color: formData.color,
                    isDefault: formData.isDefault,
                    updatedAt: serverTimestamp()
                });
                toast.success("Başarılı", { description: "İzin türü güncellendi." });

                setLeaveTypes(prev => prev.map(t =>
                    t.id === editingType.id
                        ? { ...t, name: formData.name, color: formData.color, isDefault: formData.isDefault, updatedAt: Timestamp.now() }
                        : t
                ));
            } else {
                // Create
                const newOrder = leaveTypes.length > 0 ? (Math.max(...leaveTypes.map(t => t.order || 0)) + 1) : 0;

                const docRef = await addDoc(collection(db, "leave_types"), {
                    name: formData.name,
                    color: formData.color,
                    isDefault: formData.isDefault,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    order: newOrder
                });

                const newType = {
                    id: docRef.id,
                    name: formData.name,
                    color: formData.color,
                    isDefault: formData.isDefault,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    order: newOrder
                } as LeaveType;

                toast.success("Başarılı", { description: "Yeni izin türü eklendi." });
                setLeaveTypes(prev => [...prev, newType]);
            }
            setDialogOpen(false);
            setEditingType(null);
        } catch (error) {
            console.error("Error saving leave type:", error);
            toast.error("Hata", { description: "İşlem sırasında bir hata oluştu." });
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteDialog({ open: true, id });
    };

    const confirmDelete = async () => {
        if (!deleteDialog.id) return;
        try {
            await deleteDoc(doc(db, "leave_types", deleteDialog.id));
            setLeaveTypes(prev => prev.filter(t => t.id !== deleteDialog.id));
            toast.success("Başarılı", { description: "İzin türü silindi." });
        } catch (error) {
            console.error("Error deleting leave type:", error);
            toast.error("Hata", { description: "Silme işlemi başarısız." });
        } finally {
            setDeleteDialog({ open: false, id: null });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setLeaveTypes((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update implementation of order in DB
                // We do this asynchronously to not block UI
                const batch = writeBatch(db);
                newItems.forEach((item, index) => {
                    const ref = doc(db, "leave_types", item.id);
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
                        <h2 className="text-3xl font-bold tracking-tight">İzin Türleri Yönetimi</h2>
                        <p className="text-muted-foreground">
                            Denetçiler için kullanılacak izin ve rapor türlerini tanımlayın ve sıralayın.
                        </p>
                    </div>
                    <div>
                        <Dialog open={dialogOpen} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) setEditingType(null);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Yeni İzin Türü Ekle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingType ? "İzin Türünü Düzenle" : "Yeni İzin Türü Oluştur"}</DialogTitle>
                                    <DialogDescription>
                                        İzin türü adını ve takvimde görünecek rengini belirleyin.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">İzin Türü Adı</Label>
                                        <Input
                                            id="name"
                                            placeholder="Örn: Yıllık İzin, Raporlu, Ücretsiz İzin"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Görünüm Rengi</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {PREDEFINED_COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, color: color.value })}
                                                    className={cn(
                                                        "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center",
                                                        formData.color === color.value ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.label}
                                                >
                                                    {formData.color === color.value && (
                                                        <Check className="h-5 w-5 text-white/90 drop-shadow-md" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "flex items-center space-x-2 border p-3 rounded-md transition-colors",
                                        leaveTypes.find(t => t.isDefault && t.id !== editingType?.id)
                                            ? "bg-slate-100 dark:bg-slate-800 opacity-70"
                                            : "bg-slate-50 dark:bg-slate-900"
                                    )}>
                                        <Switch
                                            id="isDefault"
                                            checked={formData.isDefault}
                                            disabled={!!leaveTypes.find(t => t.isDefault && t.id !== editingType?.id)}
                                            onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                                        />
                                        <Label htmlFor="isDefault" className="cursor-pointer flex-1">
                                            <span className="font-semibold block">Varsayılan İzin Türü</span>
                                            {leaveTypes.find(t => t.isDefault && t.id !== editingType?.id) ? (
                                                <span className="text-xs text-red-500 font-medium mt-0.5">
                                                    Zaten "{leaveTypes.find(t => t.isDefault)?.name}" varsayılan olarak seçili.
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground font-normal">Bu seçenek aktif edilirse, tatil günlerine (Cmt/Paz) bu izin türü otomatik atanır.</span>
                                            )}
                                        </Label>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Kaydet</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tanımlı İzinler</CardTitle>
                        <CardDescription>Sistemde tanımlı olan izin türleri listesi.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : leaveTypes.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                Henüz izin türü tanımlanmamış.
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    <SortableContext
                                        items={leaveTypes.map(t => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {leaveTypes.map((type) => (
                                            <SortableLeaveType
                                                key={type.id}
                                                type={type}
                                                onEdit={(t) => { setEditingType(t); setDialogOpen(true); }}
                                                onDelete={handleDeleteClick}
                                            />
                                        ))}
                                    </SortableContext>
                                </div>
                            </DndContext>
                        )}
                    </CardContent>
                </Card>
                <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>İzin Türünü Sil?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu işlem geri alınamaz. Bu izin türü sistemden kalıcı olarak silinecektir.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </div>
    );
}
