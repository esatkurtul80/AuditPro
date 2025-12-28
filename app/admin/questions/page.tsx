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
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Loader2, Plus, Edit, Trash2, X, Circle, Square, ArrowUpDown, MoreHorizontal, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";

interface QuestionTemplate {
    id: string;
    text: string;
    type: QuestionType;
    maxPoints: number;
    photoRequired: boolean;
    actionPhotoRequired: boolean;
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

// Shorter labels for table display
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
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<QuestionTemplate | null>(null);

    const [formData, setFormData] = useState({
        text: "",
        type: "yes_no" as QuestionType,
        maxPoints: 10,
        photoRequired: false,
        actionPhotoRequired: false,
        options: [] as QuestionOption[],
        ratingMax: 5,
    });
    const [openTypeCombobox, setOpenTypeCombobox] = useState(false);
    const [openRatingCombobox, setOpenRatingCombobox] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            const snapshot = await getDocs(collection(db, "questions"));
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as QuestionTemplate[];
            setQuestions(data);
        } catch (error) {
            console.error("Error loading questions:", error);
            toast.error("Sorular yüklenirken hata oluştu");
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
        if (!formData.text.trim()) {
            toast.error("Soru metni gerekli");
            return;
        }

        // Validate points
        if (formData.maxPoints <= 0) {
            toast.error("Puan değeri girilmeli ve 0'dan büyük olmalıdır");
            return;
        }

        // Validate options for multiple_choice and checkbox
        if ((formData.type === "multiple_choice" || formData.type === "checkbox") && formData.options.length === 0) {
            toast.error("En az bir seçenek eklemelisiniz");
            return;
        }

        try {
            const calculatedMaxPoints = calculateMaxPoints();
            const dataToSave: any = {
                text: formData.text,
                type: formData.type,
                maxPoints: calculatedMaxPoints,
                photoRequired: formData.photoRequired,
                actionPhotoRequired: formData.actionPhotoRequired,
                updatedAt: Timestamp.now(),
                // Explicitly set type-specific fields to null to remove them if not applicable
                options: null,
                ratingMax: null,
            };

            // Add type-specific fields only for relevant types
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
                await addDoc(collection(db, "questions"), {
                    ...dataToSave,
                    createdAt: Timestamp.now(),
                });
                toast.success("Soru oluşturuldu");
            }

            handleCloseDialog();
            loadQuestions();
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
            options: question.options || [],
            ratingMax: question.ratingMax || 5,
        });
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!questionToDelete) return;
        try {
            await deleteDoc(doc(db, "questions", questionToDelete));
            setQuestions(questions.filter((q) => q.id !== questionToDelete));
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
            options: [],
            ratingMax: 5,
        });
    };

    const addOption = () => {
        setFormData({
            ...formData,
            options: [
                ...formData.options,
                { id: Date.now().toString(), text: "", points: 0 },
            ],
        });
    };

    const updateOption = (id: string, field: "text" | "points", value: string | number) => {
        setFormData({
            ...formData,
            options: formData.options.map((opt) =>
                opt.id === id ? { ...opt, [field]: value } : opt
            ),
        });
    };

    const removeOption = (id: string) => {
        setFormData({
            ...formData,
            options: formData.options.filter((opt) => opt.id !== id),
        });
    };

    const columns: ColumnDef<QuestionTemplate>[] = [
        {
            accessorKey: "text",
            id: "Soru",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Soru
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => (
                <div className="whitespace-normal break-words max-w-md font-medium">
                    {row.original.text}
                </div>
            )
        },
        {
            accessorKey: "type",
            header: "Cevap Türü",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {QUESTION_TYPE_SHORT_LABELS[row.original.type]}
                </Badge>
            )
        },
        {
            accessorKey: "maxPoints",
            header: "Puan",
            cell: ({ row }) => row.original.maxPoints
        },
        {
            id: "features",
            header: "Özellikler",
            cell: ({ row }) => {
                const question = row.original;
                return (
                    <div className="flex gap-1 flex-wrap">
                        {question.photoRequired && (
                            <Badge variant="secondary" className="text-xs">
                                📷 Denetim Foto
                            </Badge>
                        )}
                        {question.actionPhotoRequired && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                📸 Aksiyon Foto
                            </Badge>
                        )}
                        {question.options && (
                            <Badge variant="secondary" className="text-xs">
                                {question.options.length} seçenek
                            </Badge>
                        )}
                    </div>
                );
            }
        },
        {
            id: "actions",
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
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setQuestionToDelete(question.id);
                                    setDeleteAlertOpen(true);
                                }}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
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
                        actionElement={
                            <Button
                                size="lg"
                                onClick={() => setDialogOpen(true)}
                                className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                Yeni Soru
                            </Button>
                        }
                    />

                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        if (!open) handleCloseDialog();
                        else setDialogOpen(true);
                    }}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>
                                    {editing ? "Soru Düzenle" : "Yeni Soru"}
                                </DialogTitle>
                                <DialogDescription>
                                    Lütfen soruyu ve cevap türünü girin
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Question Text */}
                                <div>
                                    <Label>Soru Metni</Label>
                                    <Textarea
                                        value={formData.text}
                                        onChange={(e) =>
                                            setFormData({ ...formData, text: e.target.value })
                                        }
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
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openTypeCombobox}
                                                className="w-full justify-between"
                                            >
                                                {formData.type
                                                    ? QUESTION_TYPE_LABELS[formData.type]
                                                    : "Cevap türü seçin..."}
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
                                                            <CommandItem
                                                                key={key}
                                                                value={label}
                                                                onSelect={() => {
                                                                    const newType = key as QuestionType;
                                                                    setFormData({
                                                                        ...formData,
                                                                        type: newType,
                                                                        // Reset type-specific fields
                                                                        options: [],
                                                                        ratingMax: 5,
                                                                    });
                                                                    setOpenTypeCombobox(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        formData.type === key ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
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
                                        <Input
                                            type="number"
                                            value={formData.maxPoints === 0 ? "" : formData.maxPoints}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    maxPoints: e.target.value === "" ? 0 : parseInt(e.target.value, 10),
                                                })
                                            }
                                            placeholder="0"
                                            min="0"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Evet = tam puan, Hayır = 0, Muaf = puanlamaya dahil değil
                                        </p>
                                    </div>
                                )}

                                {(formData.type === "multiple_choice" || formData.type === "checkbox") && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>Seçenekler</Label>
                                            <Button type="button" size="sm" onClick={addOption}>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Seçenek Ekle
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {formData.options.map((option, index) => (
                                                <div key={option.id} className="flex gap-2 items-start">
                                                    <div className="flex-1">
                                                        <Input
                                                            placeholder={`Seçenek ${index + 1}`}
                                                            value={option.text}
                                                            onChange={(e) =>
                                                                updateOption(option.id, "text", e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        placeholder="Puan"
                                                        value={option.points}
                                                        onChange={(e) =>
                                                            updateOption(option.id, "points", Number(e.target.value))
                                                        }
                                                        className="w-24"
                                                        min="0"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeOption(option.id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        {formData.type === "checkbox" && formData.options.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Maksimum puan (toplam): {calculateMaxPoints()}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {formData.type === "rating" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Maksimum Derece</Label>
                                            <Popover open={openRatingCombobox} onOpenChange={setOpenRatingCombobox}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={openRatingCombobox}
                                                        className="w-full justify-between"
                                                    >
                                                        {formData.ratingMax === 5 ? "5 (1-5)" : "10 (1-10)"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Derece ara..." />
                                                        <CommandList>
                                                            <CommandEmpty>Derece bulunamadı.</CommandEmpty>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    value="5 (1-5)"
                                                                    onSelect={() => {
                                                                        setFormData({ ...formData, ratingMax: 5 })
                                                                        setOpenRatingCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.ratingMax === 5 ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    5 (1-5)
                                                                </CommandItem>
                                                                <CommandItem
                                                                    value="10 (1-10)"
                                                                    onSelect={() => {
                                                                        setFormData({ ...formData, ratingMax: 10 })
                                                                        setOpenRatingCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.ratingMax === 10 ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    10 (1-10)
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div>
                                            <Label>Puan</Label>
                                            <Input
                                                type="number"
                                                value={formData.maxPoints === 0 ? "" : formData.maxPoints}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        maxPoints: e.target.value === "" ? 0 : parseInt(e.target.value, 10),
                                                    })
                                                }
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground col-span-2">
                                            Örnek: 3/5 seçilirse {Math.round((3 / (formData.ratingMax || 5)) * formData.maxPoints)} puan
                                        </p>
                                    </div>
                                )}

                                {(formData.type === "number" || formData.type === "date" || formData.type === "short_text") && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-sm text-blue-900">
                                            ℹ️ Bu soru tipi sadece bilgi toplamak içindir ve puanlamaya dahil edilmez.
                                        </p>
                                    </div>
                                )}

                                {/* Common fields */}
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.photoRequired}
                                        onCheckedChange={(checked) =>
                                            setFormData({
                                                ...formData,
                                                photoRequired: checked,
                                            })
                                        }
                                    />
                                    <Label>Denetim İçin Fotoğraf Zorunlu</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.actionPhotoRequired}
                                        onCheckedChange={(checked) =>
                                            setFormData({
                                                ...formData,
                                                actionPhotoRequired: checked,
                                            })
                                        }
                                    />
                                    <Label>Aksiyon İçin Fotoğraf Zorunlu</Label>
                                    <p className="text-xs text-muted-foreground ml-2">
                                        (Hayır cevabı verilirse)
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={handleCloseDialog}>
                                        İptal
                                    </Button>
                                    <Button onClick={handleSubmit}>
                                        {editing ? "Güncelle" : "Oluştur"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>



                    <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Soruyu silmek istediğinizden emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. Bu soruyu kalıcı olarak silmek istediğinize emin misiniz?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                    Sil
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent >
            </Card >
        </div >
    );
}
