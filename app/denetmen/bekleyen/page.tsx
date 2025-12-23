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
import { AuditType, Store, Audit, Section, Question, DateRangeFilter } from "@/lib/types";
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
    Search,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import { getAuditColumns } from "../columns";
import { DateRangePicker } from "@/components/ui/date-range-picker";

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
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [auditToCancel, setAuditToCancel] = useState<string | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [step, setStep] = useState(1);
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);
    const [dateRange, setDateRange] = useState<DateRangeFilter>({
        from: undefined,
        to: undefined,
    });
    const [searchTerm, setSearchTerm] = useState("");

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
                where("status", "==", "devam_ediyor")
            );
            const auditsSnapshot = await getDocs(auditsQuery);
            const auditsData = auditsSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    auditorName: userProfile?.firstName && userProfile?.lastName
                        ? `${userProfile.firstName} ${userProfile.lastName}`
                        : data.auditorName
                };
            }) as Audit[];
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
                            actionPhotoRequired: question.actionPhotoRequired || false,
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
                auditorName: (userProfile.firstName && userProfile.lastName)
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : (userProfile.displayName || userProfile.email || ""),
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

    const handleCancelAudit = async () => {
        if (!auditToCancel) return;

        try {
            setCanceling(true);
            const { cancelAudit } = await import("@/lib/firebase-utils");
            await cancelAudit(auditToCancel);
            toast.success("Denetim iptal edildi ve tüm verileri silindi");
            setCancelDialogOpen(false);
            setAuditToCancel(null);
            await loadData();
        } catch (error) {
            console.error("Error canceling audit:", error);
            toast.error("Denetim iptal edilirken hata oluştu");
        } finally {
            setCanceling(false);
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
                            <h1 className="text-3xl md:text-4xl font-inter font-bold tracking-tight">Bekleyen Denetimler</h1>
                            <p className="text-muted-foreground mt-2 font-inter">
                                Devam eden denetimlerinizi görüntüleyin ve yeni denetim başlatın
                            </p>
                        </div>

                    </div>



                    <Card>

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
                                    toolbar={
                                        <>
                                            <div className="relative flex-1 md:max-w-sm">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Mağaza ara..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <DateRangePicker value={dateRange} onChange={setDateRange} />
                                        </>
                                    }
                                    columns={getAuditColumns((auditId: string) => {
                                        setAuditToCancel(auditId);
                                        setCancelDialogOpen(true);
                                    })}
                                    mobileHiddenColumns={["startTime", "endTime"]}
                                    initialColumnVisibility={{
                                        auditTypeName: false,
                                        status: false
                                    }}
                                    data={myAudits.filter((audit) => {
                                        // Date Filter
                                        if (dateRange.from || dateRange.to) {
                                            const auditDate = audit.createdAt.toDate();
                                            const checkDate = new Date(auditDate);
                                            checkDate.setHours(0, 0, 0, 0);

                                            if (dateRange.from) {
                                                const fromDate = new Date(dateRange.from);
                                                fromDate.setHours(0, 0, 0, 0);
                                                if (checkDate < fromDate) return false;
                                            }

                                            if (dateRange.to) {
                                                const effectiveTo = new Date(dateRange.to);
                                                effectiveTo.setHours(23, 59, 59, 999);
                                                if (auditDate > effectiveTo) return false;
                                            }
                                        }

                                        // Search Filter
                                        if (searchTerm) {
                                            const term = searchTerm.toLowerCase();
                                            return (
                                                audit.storeName?.toLowerCase().includes(term) ||
                                                false
                                            );
                                        }

                                        return true;
                                    })}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Cancel Audit Confirmation Dialog */}
                    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Denetimi İptal Et</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu denetimi iptal etmek istediğinizden emin misiniz? Denetim durumu "İptal Edildi" olarak güncellenecek ve işlem sonlandırılacaktır.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={canceling}>Vazgeç</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleCancelAudit();
                                    }}
                                    disabled={canceling}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {canceling ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            İptal Ediliyor...
                                        </>
                                    ) : (
                                        "Evet, İptal Et"
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute >
    );
}
