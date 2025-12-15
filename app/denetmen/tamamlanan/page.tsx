"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/components/auth-provider";
import {
    collection,
    getDocs,
    query,
    where,
    addDoc,
    Timestamp,
    doc,
    getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditType, Store, Audit, Section, Question } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Plus,
    Loader2,
    ClipboardList,
    Store as StoreIcon,
    Calculator,
    FileText,
    Check,
    ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
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
import { DataTable } from "@/components/ui/data-table";
import { auditColumns } from "../columns";

export default function DenetmenPage() {
    const router = useRouter();
    const { userProfile } = useAuth();

    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [myAudits, setMyAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState("");
    const [selectedAuditType, setSelectedAuditType] = useState("");
    const [creating, setCreating] = useState(false);
    const [step, setStep] = useState(1);
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);

    useEffect(() => {
        if (userProfile) {
            loadData();
        }
    }, [userProfile]);

    const loadData = async () => {
        try {
            const storesSnapshot = await getDocs(collection(db, "stores"));
            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];
            setStores(storesData);

            const auditTypesSnapshot = await getDocs(collection(db, "auditTypes"));
            const auditTypesData = auditTypesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AuditType[];
            setAuditTypes(auditTypesData);

            const auditsQuery = query(
                collection(db, "audits"),
                where("auditorId", "==", userProfile!.uid),
                where("status", "==", "tamamlandi")
            );
            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Audit[];
            setMyAudits(auditsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const createAudit = async (auditTypeId: string) => {
        if (!auditTypeId || !selectedStore || !userProfile) {
            setCreating(false);
            return;
        }

        try {
            const auditType = auditTypes.find((at) => at.id === auditTypeId);
            const store = stores.find((s) => s.id === selectedStore);

            if (!auditType || !store) {
                toast.error("Seçimler geçerli değil");
                setCreating(false);
                return;
            }

            if (!auditType.sectionIds || auditType.sectionIds.length === 0) {
                toast.error("Bu denetim türünde henüz bölüm tanımlanmamış!");
                setCreating(false);
                return;
            }

            const sectionsPromises = auditType.sectionIds.map(async (sectionId) => {
                const sectionDoc = await getDoc(doc(db, "sections", sectionId));
                if (!sectionDoc.exists()) return null;
                return { id: sectionDoc.id, ...sectionDoc.data() } as Section;
            });

            const fetchedSections = (await Promise.all(sectionsPromises)).filter(
                (s): s is Section => s !== null
            );

            if (fetchedSections.length === 0) {
                toast.error("Bölüm verileri yüklenemedi!");
                setCreating(false);
                return;
            }

            const auditSectionsPromises = fetchedSections.map(async (section) => {
                let answers: any[] = [];

                if (section.questionIds && section.questionIds.length > 0) {
                    const questionsPromises = section.questionIds.map(async (questionId) => {
                        const questionDoc = await getDoc(doc(db, "questions", questionId));
                        if (!questionDoc.exists()) return null;
                        return { id: questionDoc.id, ...questionDoc.data() } as Question;
                    });

                    const fetchedQuestions = (await Promise.all(questionsPromises)).filter(
                        (q): q is Question => q !== null
                    );

                    fetchedQuestions.sort((a, b) => a.order - b.order);

                    answers = fetchedQuestions.map((question) => {
                        // SADECE multiple_choice için maxPoints = en yüksek seçenek puanı
                        let calculatedMaxPoints = question.maxPoints || 0;
                        if (question.type === 'multiple_choice' && question.options && question.options.length > 0) {
                            const maxOptionPoints = Math.max(...question.options.map(opt => opt.points));
                            calculatedMaxPoints = maxOptionPoints;
                        }

                        return {
                            questionId: question.id,
                            questionText: question.text || "",
                            questionType: question.type,
                            maxPoints: calculatedMaxPoints,
                            originalMaxPoints: calculatedMaxPoints, // Muaf için orijinal değer
                            photoRequired: question.photoRequired || false,
                            ...(question.options && question.options.length > 0 ? { options: question.options } : {}),
                            ...(question.ratingMax ? { ratingMax: question.ratingMax } : {}), // Rating sorular için
                            selectedOptions: [],
                            answer: "",
                            earnedPoints: 0,
                            notes: [],
                            photos: [],
                        };
                    });
                }

                return {
                    sectionId: section.id,
                    sectionName: section.name || "",
                    order: section.order || 0,
                    answers,
                };
            });

            const sections = await Promise.all(auditSectionsPromises);
            sections.sort((a, b) => a.order - b.order);

            const totalQuestions = sections.reduce(
                (count, section) => count + section.answers.length,
                0
            );

            if (totalQuestions === 0) {
                toast.error("Bu denetim türündeki bölümlerde henüz soru tanımlanmamış!");
                setCreating(false);
                return;
            }

            const maxScore = sections.reduce(
                (total, section) =>
                    total +
                    section.answers.reduce((sum, answer) => sum + answer.maxPoints, 0),
                0
            );

            const newAudit: Omit<Audit, "id"> = {
                auditTypeId: auditType.id,
                auditTypeName: auditType.name || "",
                storeId: store.id,
                storeName: store.name || "",
                auditorId: userProfile.uid,
                auditorName: userProfile.displayName || userProfile.email || "",
                status: "devam_ediyor",
                sections,
                totalScore: 0,
                maxScore,
                startedAt: Timestamp.now(),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const docRef = await addDoc(collection(db, "audits"), newAudit);

            toast.success(`Denetim oluşturuldu! ${totalQuestions} soru yüklendi.`);
            setDialogOpen(false);
            router.push(`/audits/${docRef.id}`);
        } catch (error) {
            console.error("Error creating audit:", error);
            toast.error("Denetim oluşturulurken hata oluştu");
        } finally {
            setCreating(false);
        }
    };


    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["denetmen"]}>
                <DashboardLayout>
                    <div className="flex min-h-screen items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["denetmen"]}>
            <DashboardLayout>
                <div className="container mx-auto py-4 md:py-8 px-4 md:px-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-inter font-bold tracking-tight">Tamamlanan Denetimlerim</h1>
                            <p className="text-muted-foreground mt-2 font-inter">
                                Tamamladığınız denetimleri görüntüleyin
                            </p>
                        </div>
                        <Dialog
                            open={dialogOpen}
                            onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (!open) {
                                    setStep(1);
                                    setSelectedStore("");
                                    setSelectedAuditType("");
                                    setCreating(false);
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button size="lg" className="w-full md:w-auto bg-gradient-to-r from-[#8B0000] to-[#A0522D] hover:from-[#6B0000] hover:to-[#8B0000] text-white shadow-md border-0">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Yeni Denetim
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        {step === 1 ? "Denetim Türü Seçin" : "Mağaza Seçin"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {step === 1
                                            ? "Uygulanacak denetim türünü seçin"
                                            : "Denetim yapacağınız mağazayı seçin"
                                        }
                                    </DialogDescription>
                                </DialogHeader>

                                {step === 1 ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                                            {auditTypes.map((auditType) => (
                                                <div
                                                    key={auditType.id}
                                                    onClick={() => {
                                                        setSelectedAuditType(auditType.id);
                                                        setStep(2);
                                                    }}
                                                    className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            {auditType.isScored !== false ? (
                                                                <Calculator className="h-6 w-6 text-green-600" />
                                                            ) : (
                                                                <FileText className="h-6 w-6 text-blue-600" />
                                                            )}
                                                            <div>
                                                                <div className="font-semibold text-xl">{auditType.name}</div>
                                                                {auditType.description && (
                                                                    <div className="text-sm text-muted-foreground mt-1">
                                                                        {auditType.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                                        >
                                            ← Geri
                                        </button>
                                        <div>
                                            <Label>Mağaza Seçin</Label>
                                            <Popover open={openStoreCombobox} onOpenChange={setOpenStoreCombobox}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={openStoreCombobox}
                                                        className="w-full justify-between"
                                                    >
                                                        {selectedStore
                                                            ? stores.find((store) => store.id === selectedStore)?.name
                                                            : "Mağaza seçin..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Mağaza ara..." />
                                                        <CommandList>
                                                            <CommandEmpty>Mağaza bulunamadı.</CommandEmpty>
                                                            <CommandGroup>
                                                                {stores.map((store) => (
                                                                    <CommandItem
                                                                        key={store.id}
                                                                        value={store.name}
                                                                        onSelect={() => {
                                                                            setSelectedStore(store.id)
                                                                            setOpenStoreCombobox(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedStore === store.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <StoreIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                        {store.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex justify-end mt-4">
                                            <Button
                                                onClick={() => {
                                                    if (!creating && selectedAuditType) {
                                                        setCreating(true);
                                                        createAudit(selectedAuditType);
                                                    }
                                                }}
                                                disabled={!selectedStore || creating}
                                            >
                                                {creating ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Oluşturuluyor...
                                                    </>
                                                ) : (
                                                    "Denetimi Başlat"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Tüm Denetimler</CardTitle>
                            <CardDescription>
                                Başlattığınız tüm denetimlerin listesi
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 md:px-6">
                            {myAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Henüz denetim yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Başlamak için yeni bir denetim başlatın
                                    </p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={auditColumns}
                                    data={myAudits}
                                    searchKey="storeName"
                                    searchPlaceholder="Mağaza ara..."
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
