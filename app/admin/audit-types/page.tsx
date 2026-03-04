"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditType } from "@/lib/types";

interface Section {
    id: string;
    questionIds?: string[];
}

// --- dnd-kit ---
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2, Plus, Settings, Trash2, Calculator, FileText,
    Edit, MoreHorizontal, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";

// ─── Sortable Row ───────────────────────────────────────────────────────────
interface SortableRowProps {
    auditType: AuditType;
    sections: Section[];
    allQuestionIds: Set<string>;
    onEdit: (at: AuditType) => void;
    onDelete: (at: { id: string; name: string }) => void;
}

function SortableRow({ auditType, sections, allQuestionIds, onEdit, onDelete }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: auditType.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : "auto",
    } as React.CSSProperties;

    const totalQuestions = (auditType.sectionIds || []).reduce((total, sectionId) => {
        const section = sections.find((s) => s.id === sectionId);
        if (!section) return total;
        const valid = (section.questionIds || []).filter((id) => allQuestionIds.has(id));
        return total + valid.length;
    }, 0);

    return (
        <tr ref={setNodeRef} style={style} className="border-b hover:bg-muted/30 transition-colors">
            {/* Drag Handle */}
            <td className="px-3 py-3 w-8">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
                    title="Sürükleyerek sırala"
                >
                    <GripVertical className="h-5 w-5" />
                </button>
            </td>

            {/* Sıra No */}
            <td className="px-3 py-3 w-12">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                    {(auditType as any).displayOrder ?? "—"}
                </span>
            </td>

            {/* Form Adı */}
            <td className="px-3 py-3">
                <span className="font-medium">{auditType.name}</span>
                {auditType.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{auditType.description}</p>
                )}
            </td>

            {/* Tip */}
            <td className="px-3 py-3">
                {auditType.isScored !== false ? (
                    <Badge className="bg-green-500">
                        <Calculator className="mr-1 h-3 w-3" /> Puanlı
                    </Badge>
                ) : (
                    <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" /> Bilgi
                    </Badge>
                )}
            </td>

            {/* Bölüm */}
            <td className="px-3 py-3 text-sm text-muted-foreground">
                {auditType.sectionIds?.length || 0} bölüm
            </td>

            {/* Soru */}
            <td className="px-3 py-3">
                <Badge variant="outline">{totalQuestions} soru</Badge>
            </td>

            {/* Actions */}
            <td className="px-3 py-3 text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Menüyü aç</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link href={`/admin/audit-types/edit?id=${auditType.id}`} className="flex items-center">
                                <Settings className="mr-2 h-4 w-4" /> Bölüm Ata
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(auditType)}>
                            <Edit className="mr-2 h-4 w-4" /> Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete({ id: auditType.id, name: auditType.name })}
                            className="text-red-600 focus:text-red-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Sil
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AuditTypesPage() {
    const router = useRouter();
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AuditType | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "", isScored: true });
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [auditTypeToDelete, setAuditTypeToDelete] = useState<{ id: string; name: string } | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [allQuestionIds, setAllQuestionIds] = useState<Set<string>>(new Set());

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => { loadAuditTypes(); }, []);

    const loadAuditTypes = async () => {
        try {
            const [auditTypesSnapshot, sectionsSnapshot, questionsSnapshot] = await Promise.all([
                getDocs(collection(db, "auditTypes")),
                getDocs(collection(db, "sections")),
                getDocs(collection(db, "questions")),
            ]);

            const data = auditTypesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as AuditType[];
            data.sort((a, b) => (((a as any).displayOrder ?? 999) - ((b as any).displayOrder ?? 999)));

            setSections(sectionsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Section[]);
            setAllQuestionIds(new Set(questionsSnapshot.docs.map((d) => d.id)));
            setAuditTypes(data);
        } catch (error) {
            console.error(error);
            toast.error("Denetim formları yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = auditTypes.findIndex((at) => at.id === active.id);
        const newIndex = auditTypes.findIndex((at) => at.id === over.id);
        const reordered = arrayMove(auditTypes, oldIndex, newIndex);

        // Optimistic update
        setAuditTypes(reordered);

        // Persist to Firestore
        try {
            const batch = writeBatch(db);
            reordered.forEach((at, index) => {
                batch.update(doc(db, "auditTypes", at.id), { displayOrder: index + 1 });
            });
            await batch.commit();
            // Update local displayOrder values
            setAuditTypes(reordered.map((at, i) => ({ ...at, displayOrder: i + 1 } as any)));
            toast.success("Sıralama kaydedildi");
        } catch (error) {
            console.error(error);
            toast.error("Sıralama kaydedilemedi");
            loadAuditTypes(); // rollback
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) { toast.error("Form adı gerekli"); return; }
        setSaving(true);
        try {
            if (editing) {
                await updateDoc(doc(db, "auditTypes", editing.id), {
                    name: formData.name,
                    description: formData.description,
                    isScored: formData.isScored,
                    updatedAt: Timestamp.now(),
                });
                toast.success("Denetim formu güncellendi");
                setDialogOpen(false);
                setEditing(null);
                setFormData({ name: "", description: "", isScored: true });
                loadAuditTypes();
            } else {
                const nextOrder = auditTypes.length + 1;
                const docRef = await addDoc(collection(db, "auditTypes"), {
                    name: formData.name,
                    description: formData.description,
                    isScored: formData.isScored,
                    displayOrder: nextOrder,
                    sectionIds: [],
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                toast.success("Denetim formu oluşturuldu");
                setDialogOpen(false);
                setFormData({ name: "", description: "", isScored: true });
                router.push(`/admin/audit-types/edit?id=${docRef.id}`);
            }
        } catch (error) {
            console.error(error);
            toast.error(editing ? "Güncelleme hatası" : "Oluşturma hatası");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (auditType: AuditType) => {
        setEditing(auditType);
        setFormData({ name: auditType.name, description: auditType.description, isScored: auditType.isScored !== false });
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!auditTypeToDelete) return;
        try {
            await deleteDoc(doc(db, "auditTypes", auditTypeToDelete.id));
            setAuditTypes((prev) => prev.filter((at) => at.id !== auditTypeToDelete.id));
            toast.success("Denetim formu silindi");
        } catch {
            toast.error("Silme işleminde hata oluştu");
        } finally {
            setDeleteAlertOpen(false);
            setAuditTypeToDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-4 md:py-8 px-4 md:px-6">
            <Card>
                <CardContent className="p-6 pt-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-muted-foreground">
                            Toplam <span className="font-semibold">{auditTypes.length}</span> denetim formu •{" "}
                            <span className="text-blue-600">Sürükleyerek sıralayın</span>
                        </p>
                        <Button
                            size="lg"
                            onClick={() => setDialogOpen(true)}
                            className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                        >
                            <Plus className="mr-2 h-5 w-5" /> Yeni Form
                        </Button>
                    </div>

                    {/* Sortable Table */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr className="border-b">
                                        <th className="px-3 py-2 w-8" />
                                        <th className="px-3 py-2 w-12 text-left font-medium text-muted-foreground">Sıra</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Form Adı</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tip</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Bölüm</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Soru</th>
                                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlemler</th>
                                    </tr>
                                </thead>
                                <SortableContext
                                    items={auditTypes.map((at) => at.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <tbody>
                                        {auditTypes.map((at) => (
                                            <SortableRow
                                                key={at.id}
                                                auditType={at}
                                                sections={sections}
                                                allQuestionIds={allQuestionIds}
                                                onEdit={handleEdit}
                                                onDelete={(x) => { setAuditTypeToDelete(x); setDeleteAlertOpen(true); }}
                                            />
                                        ))}
                                    </tbody>
                                </SortableContext>
                            </table>
                            {auditTypes.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    Henüz denetim formu yok. Yeni Form butonuna tıklayın.
                                </div>
                            )}
                        </div>
                    </DndContext>

                    {/* Edit/Create Dialog */}
                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) { setEditing(null); setFormData({ name: "", description: "", isScored: true }); }
                    }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editing ? "Denetim Formunu Düzenle" : "Yeni Denetim Formu"}</DialogTitle>
                                <DialogDescription>
                                    {editing ? "Denetim formunu güncelleyin" : "Yeni bir denetim formu oluşturun"}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Form Adı</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Örn: Genel Mağaza Denetimi"
                                    />
                                </div>
                                <div>
                                    <Label>Açıklama</Label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Form açıklaması..."
                                        rows={3}
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Form Tipi</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-medium ${formData.isScored ? "text-green-600" : "text-muted-foreground"}`}>
                                                Puanlı
                                            </span>
                                            <Switch
                                                checked={!formData.isScored}
                                                onCheckedChange={(checked) => setFormData({ ...formData, isScored: !checked })}
                                            />
                                            <span className={`text-sm font-medium ${!formData.isScored ? "text-blue-600" : "text-muted-foreground"}`}>
                                                Puansız
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            (Puanlı: Puan sistemi ile, Puansız: Sadece bilgi toplar)
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                                    <Button onClick={handleSubmit} disabled={saving}>
                                        {saving ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editing ? "Güncelleniyor..." : "Oluşturuluyor..."}</>
                                        ) : (
                                            editing ? "Güncelle" : "Oluştur"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Alert */}
                    <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Denetim formunu silmek istediğinizden emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. "{auditTypeToDelete?.name}" denetim formunu kalıcı olarak silmek istediğinize emin misiniz?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}
