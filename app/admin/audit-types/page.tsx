"use client";

import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditType } from "@/lib/types";

interface Section {
    id: string;
    questionIds?: string[];
}
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
import { Loader2, Plus, Settings, Trash2, Calculator, FileText, Edit, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Switch } from "@/components/ui/switch";

export default function AuditTypesPage() {
    const router = useRouter();
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AuditType | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "", isScored: true });
    const [saving, setSaving] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [auditTypeToDelete, setAuditTypeToDelete] = useState<{ id: string, name: string } | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [allQuestionIds, setAllQuestionIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadAuditTypes();
    }, []);

    const loadAuditTypes = async () => {
        try {
            const [auditTypesSnapshot, sectionsSnapshot, questionsSnapshot] = await Promise.all([
                getDocs(collection(db, "auditTypes")),
                getDocs(collection(db, "sections")),
                getDocs(collection(db, "questions"))
            ]);

            const auditTypesData = auditTypesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AuditType[];

            const sectionsData = sectionsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Section[];

            const questionIds = new Set(questionsSnapshot.docs.map(doc => doc.id));

            setAuditTypes(auditTypesData);
            setSections(sectionsData);
            setAllQuestionIds(questionIds);
        } catch (error) {
            console.error("Error loading audit types:", error);
            toast.error("Denetim formları yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error("Form adı gerekli");
            return;
        }

        setSaving(true);
        try {
            if (editing) {
                // Update existing
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
                // Create new
                const docRef = await addDoc(collection(db, "auditTypes"), {
                    name: formData.name,
                    description: formData.description,
                    isScored: formData.isScored,
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
            console.error("Error saving audit type:", error);
            toast.error(editing ? "Güncelleme hatası" : "Oluşturma hatası");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (auditType: AuditType) => {
        setEditing(auditType);
        setFormData({
            name: auditType.name,
            description: auditType.description,
            isScored: auditType.isScored !== false,
        });
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!auditTypeToDelete) return;
        try {
            await deleteDoc(doc(db, "auditTypes", auditTypeToDelete.id));
            setAuditTypes(auditTypes.filter((at) => at.id !== auditTypeToDelete.id));
            toast.success("Denetim formu silindi");
            setDeleteAlertOpen(false);
            setAuditTypeToDelete(null);
        } catch (error) {
            console.error("Error deleting audit type:", error);
            toast.error("Silme işleminde hata oluştu");
            setDeleteAlertOpen(false);
        }
    };

    const columns: ColumnDef<AuditType>[] = [
        {
            accessorKey: "name",
            id: "Form Adı",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Form Adı
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
            accessorKey: "isScored",
            header: "Tip",
            cell: ({ row }) => {
                const isScored = row.original.isScored;
                return isScored !== false ? (
                    <Badge className="bg-green-500">
                        <Calculator className="mr-1 h-3 w-3" />
                        Puanlı
                    </Badge>
                ) : (
                    <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" />
                        Bilgi
                    </Badge>
                );
            }
        },
        {
            id: "sectionCount",
            header: "Bölüm Sayısı",
            cell: ({ row }) => {
                const auditType = row.original;
                return <span>{auditType.sectionIds?.length || 0} bölüm</span>;
            }
        },
        {
            id: "totalQuestions",
            header: "Toplam Soru",
            cell: ({ row }) => {
                const auditType = row.original;
                const totalQuestions = (auditType.sectionIds || []).reduce((total, sectionId) => {
                    const section = sections.find(s => s.id === sectionId);
                    if (!section) return total;
                    const validQuestions = (section.questionIds || []).filter(id => allQuestionIds.has(id));
                    return total + validQuestions.length;
                }, 0);
                return (
                    <Badge variant="outline">
                        {totalQuestions} soru
                    </Badge>
                );
            }
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                const auditType = row.original;
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
                                <Link href={`/admin/audit-types/edit?id=${auditType.id}`} className="flex items-center">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Bölüm Ata
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(auditType)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setAuditTypeToDelete({ id: auditType.id, name: auditType.name });
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
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold">Denetim Formları</h1>
                    <p className="text-muted-foreground mt-2">
                        Denetim formlarını oluşturun ve yönetin
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        setEditing(null);
                        setFormData({ name: "", description: "", isScored: true });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button size="lg">
                            <Plus className="mr-2 h-5 w-5" />
                            Yeni Form
                        </Button>
                    </DialogTrigger>
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
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    placeholder="Örn: Genel Mağaza Denetimi"
                                />
                            </div>
                            <div>
                                <Label>Açıklama</Label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    placeholder="Form açıklaması..."
                                    rows={3}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Form Tipi</Label>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-medium ${formData.isScored ? 'text-green-600' : 'text-muted-foreground'}`}>
                                            Puanlı
                                        </span>
                                        <Switch
                                            checked={!formData.isScored}
                                            onCheckedChange={(checked) => setFormData({ ...formData, isScored: !checked })}
                                        />
                                        <span className={`text-sm font-medium ${!formData.isScored ? 'text-blue-600' : 'text-muted-foreground'}`}>
                                            Puansız
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        (Puanlı: Puan sistemi ile, Puansız: Sadece bilgi toplar)
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setDialogOpen(false)}
                                >
                                    İptal
                                </Button>
                                <Button onClick={handleSubmit} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {editing ? "Güncelleniyor..." : "Oluşturuluyor..."}
                                        </>
                                    ) : (
                                        editing ? "Güncelle" : "Oluştur"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tüm Formlar</CardTitle>
                    <CardDescription>
                        {auditTypes.length} denetim formu
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={auditTypes} searchKey="Form Adı" searchPlaceholder="Form ara..." />
                </CardContent>
            </Card>

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
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
