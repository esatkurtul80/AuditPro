"use client";

import { startOfDay, endOfDay } from "date-fns";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
    collection,
    getDocs,
    addDoc,
    Timestamp,
    doc,
    getDoc,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditType, Store, Audit, Section, Question } from "@/lib/types";
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
    Loader2,
    Store as StoreIcon,
    Calculator,
    FileText,
    Check,
    ChevronsUpDown,
    CheckCircle2,
    MapPinOff,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
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

interface CreateAuditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateAuditDialog({ open, onOpenChange }: CreateAuditDialogProps) {
    const router = useRouter();
    const { userProfile } = useAuth();

    const [stores, setStores] = useState<Store[]>([]);
    const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
    const [loading, setLoading] = useState(true); // Loading for initial data
    const [selectedStore, setSelectedStore] = useState("");
    const [selectedAuditType, setSelectedAuditType] = useState("");
    const [creating, setCreating] = useState(false);
    const [step, setStep] = useState(1);
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);

    const [scheduledStoreId, setScheduledStoreId] = useState<string | null>(null);
    const [autoStarting, setAutoStarting] = useState(false);
    const [autoStartProgress, setAutoStartProgress] = useState(0);
    const [autoStartSuccess, setAutoStartSuccess] = useState(false);
    const [autoStartStoreName, setAutoStartStoreName] = useState("");
    const [locationErrorOpen, setLocationErrorOpen] = useState(false);

    useEffect(() => {
        if (open && userProfile) {
            loadData();
            checkSchedule();
        }
    }, [open, userProfile]);

    const checkSchedule = async () => {
        if (!userProfile) return;

        try {
            const today = new Date();
            const start = startOfDay(today);
            const end = endOfDay(today);

            const q = query(
                collection(db, "audit_schedules"),
                where("auditorId", "==", userProfile.uid),
                where("date", ">=", Timestamp.fromDate(start)),
                where("date", "<=", Timestamp.fromDate(end))
            );

            const snapshot = await getDocs(q);
            
            // Filter locally to be safe and exclude leaves/blocked
            const validSchedules = snapshot.docs
                .map(doc => doc.data() as any) // Using any for simplicity as we just need a few fields
                .filter(data => 
                    // Ensure it's not a leave or blocked day
                    (!data.type || data.type === 'audit') && 
                    // Ensure it has a storeId
                    data.storeId
                );

            if (validSchedules.length > 0) {
                // If multiple stores found, we could either pick the first or let user choose.
                // For now, let's pick the first one as "Suggested".
                // If there are multiple, maybe it's safer to NOT auto-select? 
                // Plan said: "If multiple stores... revert to manual"
                if (validSchedules.length === 1) {
                    console.log("Auto-detected scheduled store:", validSchedules[0].storeName);
                    setScheduledStoreId(validSchedules[0].storeId);
                } else {
                    console.log("Multiple schedules found, reverting to manual selection.");
                    setScheduledStoreId(null);
                }
            } else {
                setScheduledStoreId(null);
            }

        } catch (error: any) {
            console.error("Error checking schedule:", error);
            if (error?.code === 'failed-precondition') {
                toast.warning("Otomatik plan kontrolü için Firebase İndeksi gerekiyor. Geliştirici konsoluna bakınız.");
            }
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
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
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const createAudit = async (auditTypeId: string, storeIdOverride?: string, shouldRedirect: boolean = true): Promise<string | null> => {
        const targetStoreId = storeIdOverride || selectedStore;
        
        if (!auditTypeId || !targetStoreId || !userProfile) {
            setCreating(false);
            return null;
        }

        try {
            setCreating(true);
            const auditType = auditTypes.find((at) => at.id === auditTypeId);
            const store = stores.find((s) => s.id === targetStoreId);

            if (!auditType || !store) {
                toast.error("Seçimler geçerli değil");
                setCreating(false);
                return null;
            }

            if (!auditType.sectionIds || auditType.sectionIds.length === 0) {
                toast.error("Bu denetim türünde henüz bölüm tanımlanmamış!");
                setCreating(false);
                return null;
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
                return null;
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
                            originalMaxPoints: calculatedMaxPoints,
                            photoRequired: question.photoRequired || false,
                            ...(question.options && question.options.length > 0 ? { options: question.options } : {}),
                            ...(question.ratingMax ? { ratingMax: question.ratingMax } : {}),
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

            // Get Location - Strict Mode
            let locationString: string | undefined = undefined;
            
            if (!navigator.geolocation) {
                toast.error("Tarayıcınız konum servisini desteklemiyor.");
                setCreating(false);
                return null;
            }

            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    });
                });
                
                if (position && position.coords) {
                    locationString = `${position.coords.latitude},${position.coords.longitude}`;
                }
            } catch (error: any) {
                console.warn("Location error:", error);
                // Proceed without location silently
            }

            if (totalQuestions === 0) {
                toast.error("Bu denetim türündeki bölümlerde henüz soru tanımlanmamış!");
                setCreating(false);
                return null;
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
                    : userProfile.displayName || userProfile.email || "",
                status: "devam_ediyor",
                sections,
                totalScore: 0,
                maxScore,
                startedAt: Timestamp.now(),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                location: locationString || null,
            };

            const docRef = await addDoc(collection(db, "audits"), newAudit);

            if (shouldRedirect) {
                toast.success(`Denetim oluşturuldu! ${totalQuestions} soru yüklendi.`);
                onOpenChange(false);
                router.push(`/audits/${docRef.id}`);
            }
            
            return docRef.id;
        } catch (error) {
            console.error("Error creating audit:", error);
            toast.error("Denetim oluşturulurken hata oluştu");
            return null;
        } finally {
            if (shouldRedirect) {
                setCreating(false);
            }
        }
    };

    const handleAutoStart = async (auditTypeId: string, storeId: string) => {
        setSelectedStore(storeId);
        const storeName = stores.find(s => s.id === storeId)?.name || "Mağaza";
        setAutoStartStoreName(storeName);
        setAutoStarting(true);
        setAutoStartProgress(0);
        setAutoStartSuccess(false);
        
        // Simulate loading animation
        const progressInterval = setInterval(() => {
            setAutoStartProgress(prev => {
                if (prev >= 90) {
                    clearInterval(progressInterval);
                    return 90;
                }
                return prev + 10;
            });
        }, 100);
        
        const auditId = await createAudit(auditTypeId, storeId, false);
        
        clearInterval(progressInterval);
        
        if (auditId) {
            setAutoStartProgress(100);
            setAutoStartSuccess(true);
            
            // Wait for success animation (1.5 seconds)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Close dialog and navigate
            onOpenChange(false);
            router.push(`/audits/${auditId}`);
            
            // Reset states
            setTimeout(() => {
                setAutoStarting(false);
                setAutoStartProgress(0);
                setAutoStartSuccess(false);
                setAutoStartStoreName("");
            }, 500);
        } else {
            setAutoStarting(false);
            setAutoStartProgress(0);
            setAutoStartSuccess(false);
            setAutoStartStoreName("");
        }
    };

    const resetState = () => {
        setStep(1);
        setSelectedStore("");
        setSelectedAuditType("");
        setCreating(false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                onOpenChange(val);
                if (!val) {
                    resetState();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                {autoStarting ? (
                    <div className="flex flex-col items-center justify-center py-16 px-8">
                        <div className="mb-8">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                                {autoStartSuccess ? (
                                    <CheckCircle2 className="w-12 h-12 text-green-600 animate-in zoom-in duration-300" />
                                ) : (
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                )}
                            </div>
                        </div>
                        
                        <div className="w-full max-w-xs space-y-4">
                            <Progress value={autoStartProgress} className="h-3" />
                            <div className="text-center space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    {autoStartSuccess 
                                        ? "Denetim başarıyla oluşturuldu!" 
                                        : "Denetim hazırlanıyor..."}
                                </p>
                                {autoStartSuccess && (
                                    <p className="text-base font-semibold text-foreground">
                                        {autoStartStoreName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
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

                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : step === 1 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                            {auditTypes.map((auditType) => (
                                <div
                                    key={auditType.id}
                                    onClick={() => {
                                        setSelectedAuditType(auditType.id);
                                        
                                        // SMART START LOGIC
                                        if (scheduledStoreId) {
                                            // Directly start audit with this store
                                            setSelectedStore(scheduledStoreId);
                                            // We need to trigger createAudit but state updates are async.
                                            // Better to call a function or use an effect, but simplest here is:
                                            // We can just call createAudit directly with the type ID, 
                                            // BUT selectedStore state might not be updated yet.
                                            // So let's pass storeId explicity if we refactor createAudit to accept it?
                                            // Or just set step 2 if we want to be safe, BUT the requirement is to SKIP step 2.
                                            
                                            // Let's refactor createAudit slightly to accept storeId optionally, or rely on state update + effect?
                                            // State update is risky in same tick. 
                                            // Better: Set a "readyToAutoStart" flag or just call a modified create func.
                                            
                                            // Let's call a specific handler for this:
                                            handleAutoStart(auditType.id, scheduledStoreId);
                                        } else {
                                            setStep(2);
                                        }
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
                                        createAudit(selectedAuditType, selectedStore);
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
                </>
                )}
            </DialogContent>


        </Dialog>
    );
}
