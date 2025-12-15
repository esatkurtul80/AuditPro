"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Question {
    id: string;
    text: string;
    maxPoints: number;
    photoRequired: boolean;
}

interface Section {
    id: string;
    name: string;
    description: string;
    questionIds?: string[];
}

function SectionDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sectionId = searchParams.get("id");

    const [section, setSection] = useState<Section | null>(null);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (sectionId) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [sectionId]);

    // Auto-save when selections change
    useEffect(() => {
        if (!sectionId || loading) return;

        // Skip auto-save on initial load
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            try {
                await updateDoc(doc(db, "sections", sectionId), {
                    questionIds: selectedQuestions,
                    updatedAt: Timestamp.now(),
                });
                toast.success("Değişiklikler otomatik kaydedildi", { duration: 2000 });
            } catch (error) {
                console.error("Error auto-saving:", error);
                toast.error("Kaydetme hatası");
            } finally {
                setIsSaving(false);
            }
        }, 800); // Debounce for 800ms

        return () => clearTimeout(timeoutId);
    }, [selectedQuestions, sectionId, loading]);

    const loadData = async () => {
        if (!sectionId) return;
        try {
            const sectionDoc = await getDoc(doc(db, "sections", sectionId));
            if (!sectionDoc.exists()) {
                toast.error("Bölüm bulunamadı");
                router.push("/admin/sections");
                return;
            }
            const sectionData = { id: sectionDoc.id, ...sectionDoc.data() } as Section;
            setSection(sectionData);
            setSelectedQuestions(sectionData.questionIds || []);

            const questionsSnapshot = await getDocs(collection(db, "questions"));
            const questions = questionsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Question[];
            setAllQuestions(questions);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Yükleme hatası");
        } finally {
            setLoading(false);
        }
    };

    const toggleQuestion = (questionId: string) => {
        if (selectedQuestions.includes(questionId)) {
            setSelectedQuestions(selectedQuestions.filter(id => id !== questionId));
        } else {
            setSelectedQuestions([...selectedQuestions, questionId]);
        }
    };

    const columns: ColumnDef<Question>[] = [
        {
            id: "select",
            header: "",
            cell: ({ row }) => (
                <Checkbox
                    checked={selectedQuestions.includes(row.original.id)}
                    onCheckedChange={() => toggleQuestion(row.original.id)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "text",
            id: "Soru Metni",
            header: "Soru Metni",
            cell: ({ row }) => (
                <div className="whitespace-normal break-words max-w-md font-medium">
                    {row.original.text}
                </div>
            )
        },
        {
            accessorKey: "maxPoints",
            header: "Puan",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.original.maxPoints} Puan
                </Badge>
            ),
        },
        {
            accessorKey: "photoRequired",
            header: "Fotoğraf",
            cell: ({ row }) => {
                const photoRequired = row.original.photoRequired;
                return photoRequired ? (
                    <Badge className="bg-blue-500">Gerekli</Badge>
                ) : (
                    <span className="text-sm text-muted-foreground">İsteğe Bağlı</span>
                );
            },
        },
    ];

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!section) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Bölüm bulunamadı.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-6xl">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/admin/sections">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Geri
                    </Button>
                </Link>
                {isSaving && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Kaydediliyor...
                    </div>
                )}
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-bold">{section.name}</h1>
                <p className="text-muted-foreground mt-1">{section.description}</p>
                <div className="mt-2">
                    <Badge variant="secondary">
                        {selectedQuestions.length} Soru Seçildi
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Soru Seçimi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="all">Tüm Sorular</TabsTrigger>
                            <TabsTrigger value="assigned">
                                Atanan Sorular ({selectedQuestions.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="mt-4">
                            <DataTable
                                columns={columns}
                                data={allQuestions}
                                searchKey="Soru Metni"
                                searchPlaceholder="Soru ara..."
                                onRowClick={(row) => toggleQuestion(row.id)}
                            />
                        </TabsContent>

                        <TabsContent value="assigned" className="mt-4">
                            {selectedQuestions.length > 0 ? (
                                <DataTable
                                    columns={columns}
                                    data={allQuestions.filter(q => selectedQuestions.includes(q.id))}
                                    searchKey="Soru Metni"
                                    searchPlaceholder="Atanan soru ara..."
                                    onRowClick={(row) => toggleQuestion(row.id)}
                                />
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Henüz atanmış soru yok
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SectionDetailPage() {
    return (
        <Suspense fallback={
            <div className="container mx-auto py-8 max-w-6xl">
                <div className="mb-6 flex items-center justify-between">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-11 w-56" />
                </div>
                <div className="mb-6">
                    <Skeleton className="h-9 w-64 mb-2" />
                    <Skeleton className="h-5 w-96" />
                </div>
                <div className="rounded-lg border bg-card">
                    <div className="p-6 border-b">
                        <Skeleton className="h-7 w-40" />
                    </div>
                    <div className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
        }>
            <SectionDetailContent />
        </Suspense>
    );
}
