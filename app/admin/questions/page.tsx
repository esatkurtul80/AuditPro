"use client";

import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QuestionType, QuestionOption } from "@/lib/types";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Edit, Trash2, X, ArrowUpDown, MoreHorizontal, Check, ChevronsUpDown, Tag, FolderOpen, Download, Pencil } from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { ColumnDef } from "@tanstack/react-table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface QuestionCategory {
    id: string;
    name: string;
    createdAt: any;
}

interface QuestionTemplate {
    id: string;
    text: string;
    type: QuestionType;
    maxPoints: number;
    photoRequired: boolean;
    actionPhotoRequired: boolean;
    categories?: string[]; // Array of category IDs
    options?: QuestionOption[];
    ratingMax?: number;
    createdAt: any;
    updatedAt: any;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    yes_no: "⚪ Evet/Hayır/Muaf",
    multiple_choice: "⚪ Çoktan Seçmeli (Radio buton)",
    checkbox: "☑️ Onay Kutuları (Checkbox)",
    rating: "⭐ Derece",
    number: "🔢 Sayı",
    date: "📅 Tarih",
    short_text: "📝 Kısa Metin",
};

const QUESTION_TYPE_SHORT_LABELS: Record<QuestionType, string> = {
    yes_no: "Evet/Hayır",
    multiple_choice: "Çoktan Seçmeli",
    checkbox: "Çoklu Seçim",
    rating: "Derece",
    number: "Sayı",
    date: "Tarih",
    short_text: "Metin",
};

export default function QuestionsPage() {
    const [questions, setQuestions] = useState<QuestionTemplate[]>([]);
    const [categories, setCategories] = useState<QuestionCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editing, setEditing] = useState<QuestionTemplate | null>(null);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [savingCategory, setSavingCategory] = useState(false);
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");

    const [formData, setFormData] = useState({
        text: "",
        type: "yes_no" as QuestionType,
        maxPoints: 10,
        photoRequired: false,
        actionPhotoRequired: false,
        categories: [] as string[],
        options: [] as QuestionOption[],
        ratingMax: 5,
    });
    const [openTypeCombobox, setOpenTypeCombobox] = useState(false);
    const [openRatingCombobox, setOpenRatingCombobox] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            const [qSnap, cSnap] = await Promise.all([
                getDocs(collection(db, "questions")),
                getDocs(collection(db, "question_categories")),
            ]);
            setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() })) as QuestionTemplate[]);
            setCategories(cSnap.docs.map(d => ({ id: d.id, ...d.data() })) as QuestionCategory[]);
        } catch (error) {
            console.error("Error loading:", error);
            toast.error("Yükleme hatası");
        } finally {
            setLoading(false);
        }
    };

    const calculateMaxPoints = () => {
        const { type, maxPoints, options } = formData;
        if (type === "checkbox" && options.length > 0) {
            return options.reduce((sum, opt) => sum + opt.points, 0);
        }
        return maxPoints;
    };

    const handleSubmit = async () => {
        if (!formData.text.trim()) { toast.error("Soru metni gerekli"); return; }
        if (formData.maxPoints <= 0) { toast.error("Puan değeri girilmeli ve 0'dan büyük olmalıdır"); return; }
        if ((formData.type === "multiple_choice" || formData.type === "checkbox") && formData.options.length === 0) {
            toast.error("En az bir seçenek eklemelisiniz"); return;
        }

        try {
            const calculatedMaxPoints = calculateMaxPoints();
            const dataToSave: any = {
                text: formData.text,
                type: formData.type,
                maxPoints: calculatedMaxPoints,
                photoRequired: formData.photoRequired,
                actionPhotoRequired: formData.actionPhotoRequired,
                categories: formData.categories,
                updatedAt: Timestamp.now(),
                options: null,
                ratingMax: null,
            };

            if (formData.type === "multiple_choice" || formData.type === "checkbox") {
                dataToSave.options = formData.options;
            }
            if (formData.type === "rating") {
                dataToSave.ratingMax = formData.ratingMax;
            }

            if (editing) {
                await updateDoc(doc(db, "questions", editing.id), dataToSave);
                toast.success("Soru güncellendi");
            } else {
                await addDoc(collection(db, "questions"), { ...dataToSave, createdAt: Timestamp.now() });
                toast.success("Soru oluşturuldu");
            }

            handleCloseDialog();
            loadAll();
        } catch (error) {
            console.error("Error saving question:", error);
            toast.error("Kaydetme hatası");
        }
    };

    const handleEdit = (question: QuestionTemplate) => {
        setEditing(question);
        setFormData({
            text: question.text,
            type: question.type,
            maxPoints: question.maxPoints,
            photoRequired: question.photoRequired,
            actionPhotoRequired: question.actionPhotoRequired || false,
            categories: question.categories || [],
            options: question.options || [],
            ratingMax: question.ratingMax || 5,
        });
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!questionToDelete) return;
        try {
            await deleteDoc(doc(db, "questions", questionToDelete));
            setQuestions(questions.filter(q => q.id !== questionToDelete));
            toast.success("Soru silindi");
            setDeleteAlertOpen(false);
            setQuestionToDelete(null);
        } catch (error) {
            console.error("Error deleting question:", error);
            toast.error("Silme hatası");
            setDeleteAlertOpen(false);
        }
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditing(null);
        setFormData({
            text: "",
            type: "yes_no",
            maxPoints: 10,
            photoRequired: false,
            actionPhotoRequired: false,
            categories: [],
            options: [],
            ratingMax: 5,
        });
    };

    // --- Category Management ---
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            toast.error("Bu kategori zaten var");
            return;
        }
        setSavingCategory(true);
        try {
            const ref = await addDoc(collection(db, "question_categories"), {
                name: newCategoryName.trim(),
                createdAt: Timestamp.now(),
            });
            const newCat: QuestionCategory = { id: ref.id, name: newCategoryName.trim(), createdAt: Timestamp.now() };
            setCategories(prev => [...prev, newCat]);
            setNewCategoryName("");
            toast.success("Kategori eklendi");
        } catch (e) {
            toast.error("Kategori eklenemedi");
        } finally {
            setSavingCategory(false);
        }
    };

    const handleDeleteCategory = async (catId: string) => {
        setDeletingCategoryId(catId);
        try {
            await deleteDoc(doc(db, "question_categories", catId));
            setCategories(prev => prev.filter(c => c.id !== catId));
            toast.success("Kategori silindi");
        } catch (e) {
            toast.error("Kategori silinemedi");
        } finally {
            setDeletingCategoryId(null);
        }
    };

    const handleRenameCategory = async (catId: string) => {
        const trimmed = editingCategoryName.trim();
        if (!trimmed) return;
        if (categories.some(c => c.id !== catId && c.name.toLowerCase() === trimmed.toLowerCase())) {
            toast.error("Bu isimde bir kategori zaten var");
            return;
        }
        try {
            await updateDoc(doc(db, "question_categories", catId), { name: trimmed });
            setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: trimmed } : c));
            toast.success("Kategori güncellendi");
        } catch {
            toast.error("Kategori güncellenemedi");
        } finally {
            setEditingCategoryId(null);
            setEditingCategoryName("");
        }
    };

    const toggleCategory = (catId: string) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.includes(catId)
                ? prev.categories.filter(id => id !== catId)
                : [...prev.categories, catId],
        }));
    };

    const addOption = () => {
        setFormData({ ...formData, options: [...formData.options, { id: Date.now().toString(), text: "", points: 0 }] });
    };
    const updateOption = (id: string, field: "text" | "points", value: string | number) => {
        setFormData({ ...formData, options: formData.options.map(opt => opt.id === id ? { ...opt, [field]: value } : opt) });
    };
    const removeOption = (id: string) => {
        setFormData({ ...formData, options: formData.options.filter(opt => opt.id !== id) });
    };

    // Faceted filter options
    const categoryFilterOptions = categories.map(c => ({ label: c.name, value: c.id }));
    const typeFilterOptions = Object.entries(QUESTION_TYPE_SHORT_LABELS).map(([value, label]) => ({ label, value }));
    const featureFilterOptions = [
        { label: "📷 Denetim Fotoğraf", value: "photoRequired" },
        { label: "📸 Aksiyon Fotoğraf", value: "actionPhotoRequired" },
    ];

    const getCategoryNames = (catIds?: string[]) => {
        if (!catIds || catIds.length === 0) return [];
        return catIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) as string[];
    };

    const columns: ColumnDef<QuestionTemplate>[] = [
        {
            accessorKey: "categories",
            id: "categories",
            meta: { title: "Kategori" },
            header: ({ column }) => (
                <div className="flex items-center gap-1">
                    <span>Kategori</span>
                    <DataTableFacetedFilter column={column} title="Kategori filtrele" options={categoryFilterOptions} />
                </div>
            ),
            cell: ({ row }) => {
                const names = getCategoryNames(row.original.categories);
                return names.length > 0
                    ? <div className="flex flex-wrap gap-1">{names.map(n => <Badge key={n} variant="outline" className="text-xs border-violet-300 text-violet-700 bg-violet-50">🏷️ {n}</Badge>)}</div>
                    : <span className="text-xs text-muted-foreground">—</span>;
            },
            filterFn: (row, id, filterValues: string[]) => {
                const rowCats = row.original.categories || [];
                return filterValues.some(fv => rowCats.includes(fv));
            },
        },
        {
            accessorKey: "text",
            id: "Soru",
            meta: { title: "Soru" },
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Soru <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="whitespace-normal break-words max-w-md font-medium">{row.original.text}</div>
            )

        },
        {
            accessorKey: "type",
            id: "type",
            meta: { title: "Cevap Türü" },
            header: ({ column }) => (
                <div className="flex items-center gap-1">
                    <span>Cevap Türü</span>
                    <DataTableFacetedFilter column={column} title="Cevap türü filtrele" options={typeFilterOptions} />
                </div>
            ),
            cell: ({ row }) => <Badge variant="outline">{QUESTION_TYPE_SHORT_LABELS[row.original.type]}</Badge>,
            filterFn: (row, id, filterValues: string[]) => filterValues.includes(row.original.type),
        },
        {
            accessorKey: "maxPoints",
            id: "maxPoints",
            meta: { title: "Puan" },
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Puan <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const q = row.original;
                const pts = q.type === "checkbox" && q.options && q.options.length > 0
                    ? q.options.reduce((sum, opt) => sum + opt.points, 0)
                    : q.maxPoints;
                const isInfoOnly = ["number", "date", "short_text"].includes(q.type);
                return isInfoOnly
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : <Badge variant="secondary" className="font-mono font-semibold tabular-nums bg-blue-50 text-blue-700 border-blue-200">{pts}</Badge>;
            },
        },
        {
            id: "features",
            meta: { title: "Özellikler" },
            accessorFn: (row) => {
                const f: string[] = [];
                if (row.photoRequired) f.push("photoRequired");
                if (row.actionPhotoRequired) f.push("actionPhotoRequired");
                return f;
            },
            header: ({ column }) => (
                <div className="flex items-center gap-1">
                    <span>Özellikler</span>
                    <DataTableFacetedFilter column={column} title="Özellik filtrele" options={featureFilterOptions} />
                </div>
            ),
            cell: ({ row }) => {
                const question = row.original;
                return (
                    <div className="flex gap-1 flex-wrap">
                        {question.photoRequired && <Badge variant="secondary" className="text-xs">📷 Denetim Foto</Badge>}
                        {question.actionPhotoRequired && <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">📸 Aksiyon Foto</Badge>}
                        {question.options && <Badge variant="secondary" className="text-xs">{question.options.length} seçenek</Badge>}
                    </div>
                );
            },
            filterFn: (row, id, filterValues: string[]) => {
                const q = row.original;
                return filterValues.some(fv => (q as any)[fv] === true);
            },
        },
        {
            id: "actions",
            meta: { title: "İşlemler" },
            enableHiding: false,
            cell: ({ row }) => {
                const question = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menüyü aç</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(question)}>
                                <Edit className="mr-2 h-4 w-4" /> Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => { setQuestionToDelete(question.id); setDeleteAlertOpen(true); }}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Sil
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }
        }
    ];

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
                <CardContent className="p-6 pt-0">
                    <DataTable
                        columns={columns}
                        data={questions}
                        searchKey="Soru"
                        searchPlaceholder="Soru ara..."
                        actionElement={(table) => (
                            <div className="flex gap-2">
                                {/* Excel Export Button */}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-green-300 text-green-700 hover:bg-green-50"
                                    disabled={table.getFilteredRowModel().rows.length === 0}
                                    onClick={() => {
                                        const rows = table.getFilteredRowModel().rows.map(row => row.original);
                                        const exportData = rows.map(q => ({
                                            "Kategori": getCategoryNames(q.categories).join(", ") || "-",
                                            "Soru": q.text,
                                            "Cevap Türü": QUESTION_TYPE_SHORT_LABELS[q.type] || q.type,
                                            "Denetim Foto_Zorunlu": q.photoRequired ? "Evet" : "Hayır",
                                            "Aksiyon Foto_Zorunlu": q.actionPhotoRequired ? "Evet" : "Hayır",
                                            "Puan_Degeri": q.maxPoints,
                                            "Seçenek_Sayisi": q.options?.length || 0
                                        }));
                                        const wb = XLSX.utils.book_new();
                                        const ws = XLSX.utils.json_to_sheet(exportData);
                                        XLSX.utils.book_append_sheet(wb, ws, "Sorular");
                                        XLSX.writeFile(wb, "denetim_sorulari.xlsx");
                                    }}
                                >
                                    <Download className="mr-2 h-5 w-5" />
                                    Excel İndir  ({table.getFilteredRowModel().rows.length})
                                </Button>
                                {/* Category Management Button */}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => setCategoryDialogOpen(true)}
                                    className="border-violet-300 text-violet-700 hover:bg-violet-50"
                                >
                                    <FolderOpen className="mr-2 h-5 w-5" />
                                    Kategoriler
                                    {categories.length > 0 && (
                                        <Badge variant="secondary" className="ml-2 text-xs">{categories.length}</Badge>
                                    )}
                                </Button>
                                {/* New Question Button */}
                                <Button
                                    size="lg"
                                    onClick={() => setDialogOpen(true)}
                                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    Yeni Soru
                                </Button>
                            </div>
                        )}
                    />

                    {/* ---------- QUESTION FORM DIALOG ---------- */}
                    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{editing ? "Soru Düzenle" : "Yeni Soru"}</DialogTitle>
                                <DialogDescription>Lütfen soruyu ve cevap türünü girin</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Question Text */}
                                <div>
                                    <Label>Soru Metni</Label>
                                    <Textarea
                                        value={formData.text}
                                        onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                        placeholder="Soru metnini girin..."
                                        rows={3}
                                        className="mt-2"
                                    />
                                </div>

                                {/* Question Type */}
                                <div>
                                    <Label>Cevap Türü</Label>
                                    <Popover open={openTypeCombobox} onOpenChange={setOpenTypeCombobox}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={openTypeCombobox} className="w-full justify-between mt-2">
                                                {formData.type ? QUESTION_TYPE_LABELS[formData.type] : "Cevap türü seçin..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0">
                                            <Command>
                                                <CommandInput placeholder="Cevap türü ara..." />
                                                <CommandList>
                                                    <CommandEmpty>Cevap türü bulunamadı.</CommandEmpty>
                                                    <CommandGroup>
                                                        {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                                                            <CommandItem key={key} value={label} onSelect={() => {
                                                                setFormData({ ...formData, type: key as QuestionType, options: [], ratingMax: 5 });
                                                                setOpenTypeCombobox(false);
                                                            }}>
                                                                <Check className={cn("mr-2 h-4 w-4", formData.type === key ? "opacity-100" : "opacity-0")} />
                                                                {label}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Type-specific fields */}
                                {formData.type === "yes_no" && (
                                    <div>
                                        <Label>Puan</Label>
                                        <Input type="number" value={formData.maxPoints === 0 ? "" : formData.maxPoints}
                                            onChange={(e) => setFormData({ ...formData, maxPoints: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                                            placeholder="0" min="0" />
                                        <p className="text-xs text-muted-foreground mt-1">Evet = tam puan, Hayır = 0, Muaf = puanlamaya dahil değil</p>
                                    </div>
                                )}

                                {(formData.type === "multiple_choice" || formData.type === "checkbox") && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>Seçenekler</Label>
                                            <Button type="button" size="sm" onClick={addOption}><Plus className="h-4 w-4 mr-1" />Seçenek Ekle</Button>
                                        </div>
                                        <div className="space-y-2">
                                            {formData.options.map((option, index) => (
                                                <div key={option.id} className="flex gap-2 items-start">
                                                    <div className="flex-1">
                                                        <Input placeholder={`Seçenek ${index + 1}`} value={option.text} onChange={(e) => updateOption(option.id, "text", e.target.value)} />
                                                    </div>
                                                    <Input type="number" placeholder="Puan" value={option.points} onChange={(e) => updateOption(option.id, "points", Number(e.target.value))} className="w-24" min="0" />
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(option.id)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                        {formData.type === "checkbox" && formData.options.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-2">Maksimum puan (toplam): {calculateMaxPoints()}</p>
                                        )}
                                    </div>
                                )}

                                {formData.type === "rating" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Maksimum Derece</Label>
                                            <Popover open={openRatingCombobox} onOpenChange={setOpenRatingCombobox}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                                        {formData.ratingMax === 5 ? "5 (1-5)" : "10 (1-10)"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                <CommandItem value="5 (1-5)" onSelect={() => { setFormData({ ...formData, ratingMax: 5 }); setOpenRatingCombobox(false); }}>
                                                                    <Check className={cn("mr-2 h-4 w-4", formData.ratingMax === 5 ? "opacity-100" : "opacity-0")} />5 (1-5)
                                                                </CommandItem>
                                                                <CommandItem value="10 (1-10)" onSelect={() => { setFormData({ ...formData, ratingMax: 10 }); setOpenRatingCombobox(false); }}>
                                                                    <Check className={cn("mr-2 h-4 w-4", formData.ratingMax === 10 ? "opacity-100" : "opacity-0")} />10 (1-10)
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div>
                                            <Label>Puan</Label>
                                            <Input type="number" value={formData.maxPoints === 0 ? "" : formData.maxPoints}
                                                onChange={(e) => setFormData({ ...formData, maxPoints: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                                                placeholder="0" min="0" />
                                        </div>
                                        <p className="text-xs text-muted-foreground col-span-2">Örnek: 3/5 seçilirse {Math.round((3 / (formData.ratingMax || 5)) * formData.maxPoints)} puan</p>
                                    </div>
                                )}

                                {(formData.type === "number" || formData.type === "date" || formData.type === "short_text") && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-sm text-blue-900">ℹ️ Bu soru tipi sadece bilgi toplamak içindir ve puanlamaya dahil edilmez.</p>
                                    </div>
                                )}

                                {/* Categories multi-select combobox */}
                                <div>
                                    <Label className="mb-2 block">
                                        Kategoriler <span className="text-muted-foreground text-xs">(isteğe bağlı, birden fazla seçilebilir)</span>
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between"
                                                disabled={categories.length === 0}
                                            >
                                                <span className="text-muted-foreground">
                                                    {categories.length === 0
                                                        ? "Önce kategori oluşturun..."
                                                        : "Kategori seç..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Kategori ara..." />
                                                <CommandList>
                                                    <CommandEmpty>Kategori bulunamadı.</CommandEmpty>
                                                    <CommandGroup>
                                                        {categories.map(cat => {
                                                            const isSelected = formData.categories.includes(cat.id);
                                                            return (
                                                                <CommandItem
                                                                    key={cat.id}
                                                                    value={cat.name}
                                                                    onSelect={() => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            categories: isSelected
                                                                                ? prev.categories.filter(id => id !== cat.id)
                                                                                : [...prev.categories, cat.id],
                                                                        }));
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                        isSelected
                                                                            ? "bg-primary text-primary-foreground"
                                                                            : "opacity-50 [&_svg]:invisible"
                                                                    )}>
                                                                        <Check className="h-4 w-4" />
                                                                    </div>
                                                                    🏷️ {cat.name}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                    {formData.categories.length > 0 && (
                                                        <>
                                                            <div className="border-t" />
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => setFormData(prev => ({ ...prev, categories: [] }))}
                                                                    className="justify-center text-center text-muted-foreground"
                                                                >
                                                                    Seçimleri Temizle
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {/* Selected category badges */}
                                    {formData.categories.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {formData.categories.map(catId => {
                                                const cat = categories.find(c => c.id === catId);
                                                if (!cat) return null;
                                                return (
                                                    <Badge
                                                        key={catId}
                                                        variant="secondary"
                                                        className="pl-2 pr-1 py-1 gap-1 border-violet-200 bg-violet-50 text-violet-800"
                                                    >
                                                        🏷️ {cat.name}
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, categories: prev.categories.filter(id => id !== catId) }))}
                                                            className="ml-0.5 rounded-sm hover:bg-violet-200 p-0.5"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>


                                {/* Switches */}
                                <div className="flex items-center gap-2">
                                    <Switch checked={formData.photoRequired} onCheckedChange={(checked) => setFormData({ ...formData, photoRequired: checked })} />
                                    <Label>Denetim İçin Fotoğraf Zorunlu</Label>
                                    <p className="text-xs text-muted-foreground ml-2">(Hayır veya tam puan alınamazsa)</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Switch checked={formData.actionPhotoRequired} onCheckedChange={(checked) => setFormData({ ...formData, actionPhotoRequired: checked })} />
                                    <Label>Aksiyon İçin Fotoğraf Zorunlu</Label>
                                    <p className="text-xs text-muted-foreground ml-2">(Hayır veya tam puan alınamazsa)</p>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={handleCloseDialog}>İptal</Button>
                                    <Button onClick={handleSubmit}>{editing ? "Güncelle" : "Oluştur"}</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* ---------- CATEGORY MANAGEMENT DIALOG ---------- */}
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FolderOpen className="h-5 w-5 text-violet-600" />
                                    Soru Kategorileri
                                </DialogTitle>
                                <DialogDescription>Kategoriler soruları gruplamak için kullanılır</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Add new */}
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Yeni kategori adı..."
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                                        className="flex-1"
                                    />
                                    <Button onClick={handleAddCategory} disabled={savingCategory || !newCategoryName.trim()}>
                                        {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {/* Category list */}
                                {categories.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        Henüz kategori yok. Yukarıdan ekleyin.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {categories.map(cat => (
                                            <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/20">
                                                {editingCategoryId === cat.id ? (
                                                    <div className="flex items-center gap-2 flex-1 mr-2">
                                                        <Input
                                                            autoFocus
                                                            value={editingCategoryName}
                                                            onChange={e => setEditingCategoryName(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") handleRenameCategory(cat.id);
                                                                if (e.key === "Escape") { setEditingCategoryId(null); setEditingCategoryName(""); }
                                                            }}
                                                            className="h-8 text-sm"
                                                        />
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleRenameCategory(cat.id)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingCategoryId(null); setEditingCategoryName(""); }}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Tag className="h-4 w-4 text-violet-600" />
                                                        <span className="font-medium">{cat.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({questions.filter(q => q.categories?.includes(cat.id)).length} soru)
                                                        </span>
                                                    </div>
                                                )}
                                                {editingCategoryId !== cat.id && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                                            onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeleteCategory(cat.id)}
                                                            disabled={deletingCategoryId === cat.id}
                                                        >
                                                            {deletingCategoryId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Delete alert */}
                    <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Soruyu silmek istediğinizden emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>Bu işlem geri alınamaz. Bu soruyu kalıcı olarak silmek istediğinize emin misiniz?</AlertDialogDescription>
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
