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
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    ColumnFiltersState,
    SortingState,
} from "@tanstack/react-table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Section {
    id: string;
    name: string;
    description: string;
    questionIds?: string[];
}

interface AuditType {
    id: string;
    name: string;
    description: string;
    sectionIds?: string[];
}

function AuditTypeDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const auditTypeId = searchParams.get("id");

    const [auditType, setAuditType] = useState<AuditType | null>(null);
    const [allSections, setAllSections] = useState<Section[]>([]);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [allQuestionIds, setAllQuestionIds] = useState<Set<string>>(new Set());
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (auditTypeId) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [auditTypeId]);

    // Auto-save when selections change
    useEffect(() => {
        if (!auditTypeId || loading) return;

        // Skip auto-save on initial load
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            try {
                await updateDoc(doc(db, "auditTypes", auditTypeId), {
                    sectionIds: selectedSections,
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
    }, [selectedSections, auditTypeId, loading]);

    const loadData = async () => {
        if (!auditTypeId) return;
        try {
            const auditTypeDoc = await getDoc(doc(db, "auditTypes", auditTypeId));
            if (!auditTypeDoc.exists()) {
                toast.error("Denetim formu bulunamadı");
                router.push("/admin/audit-types");
                return;
            }
            const auditTypeData = {
                id: auditTypeDoc.id,
                ...auditTypeDoc.data(),
            } as AuditType;
            setAuditType(auditTypeData);
            setSelectedSections(auditTypeData.sectionIds || []);

            const [sectionsSnapshot, questionsSnapshot] = await Promise.all([
                getDocs(collection(db, "sections")),
                getDocs(collection(db, "questions"))
            ]);

            const sections = sectionsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Section[];

            const questionIds = new Set(questionsSnapshot.docs.map(doc => doc.id));

            setAllSections(sections);
            setAllQuestionIds(questionIds);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Yükleme hatası");
        } finally {
            setLoading(false);
        }
    };



    const columns: ColumnDef<Section>[] = [
        {
            id: "select",
            header: "",
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={selectedSections.includes(row.original.id)}
                    onChange={() => {
                        if (selectedSections.includes(row.original.id)) {
                            setSelectedSections(selectedSections.filter(id => id !== row.original.id));
                        } else {
                            setSelectedSections([...selectedSections, row.original.id]);
                        }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4"
                    >
                        Bölüm Adı
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "description",
            header: "Açıklama",
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">{row.getValue("description")}</div>
            ),
        },
        {
            accessorKey: "questionIds",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4"
                    >
                        Soru Sayısı
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const questionIds = row.getValue("questionIds") as string[] | undefined;
                const validQuestions = (questionIds || []).filter(id => allQuestionIds.has(id));
                return (
                    <Badge variant="outline">
                        {validQuestions.length} Soru
                    </Badge>
                );
            },
            sortingFn: (rowA, rowB) => {
                const a = (rowA.getValue("questionIds") as string[] | undefined)?.length || 0;
                const b = (rowB.getValue("questionIds") as string[] | undefined)?.length || 0;
                return a - b;
            },
        },
    ];

    const table = useReactTable({
        data: allSections,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    });

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!auditType) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Denetim formu bulunamadı.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-6xl">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/admin/audit-types">
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
                <h1 className="text-3xl font-bold">{auditType.name}</h1>
                <p className="text-muted-foreground mt-1">{auditType.description}</p>
                <div className="mt-2">
                    <Badge variant="secondary">
                        {selectedSections.length} Bölüm Seçildi
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bölüm Seçimi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="all">Tüm Bölümler</TabsTrigger>
                            <TabsTrigger value="assigned">
                                Atanan Bölümler ({selectedSections.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="mt-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <TableHead key={header.id}>
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? (
                                            table.getRowModel().rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    data-state={selectedSections.includes(row.original.id) && "selected"}
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        if (selectedSections.includes(row.original.id)) {
                                                            setSelectedSections(selectedSections.filter(id => id !== row.original.id));
                                                        } else {
                                                            setSelectedSections([...selectedSections, row.original.id]);
                                                        }
                                                    }}
                                                >
                                                    {row.getVisibleCells().map((cell) => (
                                                        <TableCell key={cell.id} onClick={(e) => {
                                                            if (cell.column.id === "select") {
                                                                e.stopPropagation();
                                                            }
                                                        }}>
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                                    Sonuç bulunamadı.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-between space-x-2 py-4">
                                <p className="text-sm text-muted-foreground">
                                    Toplam {table.getFilteredRowModel().rows.length} bölümden {selectedSections.length} tanesi seçildi
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="assigned" className="mt-4">
                            {selectedSections.length > 0 ? (
                                <>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <TableRow key={headerGroup.id}>
                                                        {headerGroup.headers.map((header) => (
                                                            <TableHead key={header.id}>
                                                                {header.isPlaceholder
                                                                    ? null
                                                                    : flexRender(
                                                                        header.column.columnDef.header,
                                                                        header.getContext()
                                                                    )}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableHeader>
                                            <TableBody>
                                                {allSections.filter(s => selectedSections.includes(s.id)).map((section) => {
                                                    const row = table.getRowModel().rows.find(r => r.original.id === section.id);
                                                    if (!row) return null;
                                                    return (
                                                        <TableRow
                                                            key={row.id}
                                                            data-state="selected"
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedSections(selectedSections.filter(id => id !== section.id));
                                                            }}
                                                        >
                                                            {row.getVisibleCells().map((cell) => (
                                                                <TableCell key={cell.id} onClick={(e) => {
                                                                    if (cell.column.id === "select") {
                                                                        e.stopPropagation();
                                                                    }
                                                                }}>
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex items-center justify-between space-x-2 py-4">
                                        <p className="text-sm text-muted-foreground">
                                            {selectedSections.length} bölüm atandı
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Henüz atanmış bölüm yok
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AuditTypeDetailPage() {
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
            <AuditTypeDetailContent />
        </Suspense>
    );
}
