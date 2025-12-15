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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Loader2, Plus, Edit, Trash2, Settings, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface SectionTemplate {
    id: string;
    name: string;
    description: string;
    questionIds?: string[];
    createdAt: any;
    updatedAt: any;
}

export default function SectionsPage() {
    const [sections, setSections] = useState<SectionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SectionTemplate | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
    const [allQuestionIds, setAllQuestionIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadSections();
    }, []);

    const loadSections = async () => {
        try {
            const [sectionsSnapshot, questionsSnapshot] = await Promise.all([
                getDocs(collection(db, "sections")),
                getDocs(collection(db, "questions"))
            ]);

            const sectionsData = sectionsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SectionTemplate[];

            const questionIds = new Set(questionsSnapshot.docs.map(doc => doc.id));

            setSections(sectionsData);
            setAllQuestionIds(questionIds);
        } catch (error) {
            console.error("Error loading sections:", error);
            toast.error("Bölümler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error("Bölüm adı gerekli");
            return;
        }

        try {
            if (editing) {
                await updateDoc(doc(db, "sections", editing.id), {
                    ...formData,
                    updatedAt: Timestamp.now(),
                });
                toast.success("Bölüm güncellendi");
            } else {
                await addDoc(collection(db, "sections"), {
                    ...formData,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                toast.success("Bölüm oluşturuldu");
            }
            setDialogOpen(false);
            setEditing(null);
            setFormData({ name: "", description: "" });
            loadSections();
        } catch (error) {
            console.error("Error saving section:", error);
            toast.error("Kaydetme hatası");
        }
    };

    const handleEdit = (section: SectionTemplate) => {
        setEditing(section);
        setFormData({
            name: section.name,
            description: section.description,
        });
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!sectionToDelete) return;
        try {
            await deleteDoc(doc(db, "sections", sectionToDelete));
            setSections(sections.filter((s) => s.id !== sectionToDelete));
            toast.success("Bölüm silindi");
            setDeleteAlertOpen(false);
            setSectionToDelete(null);
        } catch (error) {
            console.error("Error deleting section:", error);
            toast.error("Silme hatası");
            setDeleteAlertOpen(false);
        }
    };

    const columns: ColumnDef<SectionTemplate>[] = [
        {
            accessorKey: "name",
            id: "Bölüm Adı",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Bölüm Adı
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
        },
        {
            accessorKey: "description",
            header: "Açıklama",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "-"}</span>
        },
        {
            id: "questionCount",
            header: "Atanan Soru Sayısı",
            cell: ({ row }) => {
                const validQuestions = (row.original.questionIds || []).filter(id => allQuestionIds.has(id));
                const count = validQuestions.length;
                return (
                    <Badge variant="secondary">
                        {count} soru
                    </Badge>
                );
            }
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                const section = row.original;
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
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/sections/edit?id=${section.id}`} className="flex items-center">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Soru Ata
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(section)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setSectionToDelete(section.id);
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
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold">Bölüm Havuzu</h1>
                    <p className="text-muted-foreground mt-2">
                        Bölümleri oluşturun, sorular atayın ve denetim formlarına ekleyin
                    </p>
                </div>
                <Dialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) {
                            setEditing(null);
                            setFormData({ name: "", description: "" });
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button size="lg">
                            <Plus className="mr-2 h-5 w-5" />
                            Yeni Bölüm
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? "Bölüm Düzenle" : "Yeni Bölüm"}
                            </DialogTitle>
                            <DialogDescription>
                                Bölüm havuzuna yeni bir bölüm ekleyin
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Bölüm Adı</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    placeholder="Örn: Temizlik"
                                />
                            </div>
                            <div>
                                <Label>Açıklama</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    placeholder="Bölüm açıklaması..."
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setDialogOpen(false)}
                                >
                                    İptal
                                </Button>
                                <Button onClick={handleSubmit}>
                                    {editing ? "Güncelle" : "Oluştur"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tüm Bölümler</CardTitle>
                    <CardDescription>{sections.length} bölüm</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={sections} searchKey="Bölüm Adı" searchPlaceholder="Bölüm ara..." />
                </CardContent>
            </Card>

            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Bölümü silmek istediğinizden emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. Bu bölümü kalıcı olarak silmek istediğinize emin misiniz?
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
        </div>
    );
}
