"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RegionalManagerHeader } from "@/components/regional-manager/regional-header";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Audit, AuditAnswer, Store } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, CheckCircle2, ArrowLeft, Circle, Plus, Save, WifiOff, Clock, Star, ChevronRight, AlertCircle, MoreHorizontal, ClipboardList, MessageSquare, UserCircle, Eye, FileText, Zap, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import Link from "next/link";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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
import ImageGallery from "@/components/image-gallery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuditSync } from "@/hooks/useAuditSync";
import { QuestionHistoryButton } from "@/components/question-history-button";
import { AuditSummary } from "@/components/audit-summary";
import { Checkbox } from "@/components/ui/checkbox";
import Logger from "@/lib/logger";
import { getStoreAuditHistory, QuestionHistory, QuestionHistoryEntry } from "@/lib/question-history";
import { PersonnelEvaluationSection } from "@/components/audits/personnel-evaluation-section";

const AuditPageLayout = ({ children, isRegionalManager }: { children: React.ReactNode; isRegionalManager: boolean }) => {
    if (isRegionalManager) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <RegionalManagerHeader />
                {children}
            </div>
        );
    }
    return <DashboardLayout>{children}</DashboardLayout>;
};

export default function AuditPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userProfile } = useAuth();
    const auditId = params.id as string;
    const mode = searchParams.get("mode"); // "edit" or "view" or null

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [currentSectionIndex, setCurrentSectionIndex] = useState<number | 'personnel' | 'general' | null>(null);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [showBackDialog, setShowBackDialog] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);
    const [originalScore, setOriginalScore] = useState<number>(0);
    const [originalAudit, setOriginalAudit] = useState<Audit | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ photos: string[], notes: string[] }>({ photos: [], notes: [] });
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [historyCache, setHistoryCache] = useState<Record<string, QuestionHistory>>({});
    const [personnelStatus, setPersonnelStatus] = useState<{ total: number, evaluated: number, initialized: boolean }>({ total: 0, evaluated: 0, initialized: false });

    // Reset Section State
    const [resetAlertOpen, setResetAlertOpen] = useState(false);
    const [sectionToReset, setSectionToReset] = useState<number | null>(null);
    const touchTimer = useRef<NodeJS.Timeout | null>(null);
    const sectionFeedbackRef = useRef<HTMLTextAreaElement>(null);
    const generalFeedbackRef = useRef<HTMLTextAreaElement>(null);
    const isWriting = useRef(false); // Prevents onSnapshot from overwriting local state mid-write
    const isEditing = useRef(false); // Prevents onSnapshot from overwriting while user is typing a note
    const lastLocalWriteTime = useRef<number>(0); // Timestamp of last write by THIS device
    const auditListenerUnsub = useRef<(() => void) | null>(null); // Real-time listener cleanup

    const isRegionalManager = userProfile?.role === 'bolge-muduru';

    const handleOpenPreview = async (e: React.MouseEvent) => {
        e.preventDefault();

        if (audit) {
            try {
                // Önizleme için en güncel personel değerlendirmelerini çek
                const pQuery = query(collection(db, "personnel_evaluations"), where("auditId", "==", audit.id));
                const pSnap = await getDocs(pQuery);
                const pEvals = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                setAudit(prev => {
                    if (!prev) return prev;
                    return { ...prev, personnelEvaluations: pEvals };
                });
            } catch (error) {
                console.error("Önizleme verileri yüklenirken hata:", error);
            }
        }
        setShowPreviewModal(true);
    };

    const canEdit = mode === "edit";

    const handleTouchStart = (index: number) => {
        if (!canEdit) return;
        touchTimer.current = setTimeout(() => {
            setSectionToReset(index);
            setResetAlertOpen(true);
        }, 3000); // 2sn long press
    };

    const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
    };

    const handleMouseDown = (index: number) => {
        if (!canEdit) return;
        touchTimer.current = setTimeout(() => {
            setSectionToReset(index);
            setResetAlertOpen(true);
        }, 3000);
    };

    const handleMouseUp = () => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
    };

    const confirmSectionReset = async () => {
        if (sectionToReset === null || !audit) return;

        // Create a deep copy of the audit
        const updatedAudit = { ...audit };
        const section = updatedAudit.sections[sectionToReset];

        // Reset all answers in the section
        section.answers = section.answers.map(answer => {
            const cleanAnswer = {
                ...answer,
                answer: "",
                selectedOptions: [],
                earnedPoints: 0,
                notes: [""], // Keep one empty note field
                photos: [],
            };
            // Remove actionData completely to avoid undefined error
            if (cleanAnswer.actionData) {
                delete cleanAnswer.actionData;
            }
            return cleanAnswer;
        });

        // Recalculate totalScore (same logic as updateAnswer)
        const sectionScores: number[] = [];
        updatedAudit.sections.forEach(sec => {
            let sectionEarned = 0;
            let sectionMax = 0;
            sec.answers.forEach(ans => {
                if (ans.answer && ans.answer.trim() !== "" && ans.answer !== "muaf") {
                    sectionEarned += ans.earnedPoints;
                    sectionMax += ans.maxPoints;
                }
            });
            if (sectionMax > 0) {
                sectionScores.push((sectionEarned / sectionMax) * 100);
            }
        });
        updatedAudit.totalScore = sectionScores.length > 0
            ? Math.round(sectionScores.reduce((sum, s) => sum + s, 0) / sectionScores.length)
            : 0;

        // Update local state
        setAudit(updatedAudit);
        setResetAlertOpen(false);
        setSectionToReset(null);

        // Update Firestore if in valid mode
        try {
            // Filter out local:// URLs before saving to Firestore
            const sectionsToSave = updatedAudit.sections.map(sec => ({
                ...sec,
                answers: sec.answers.map(answer => ({
                    ...answer,
                    photos: (answer.photos || []).filter(url => !url.startsWith('local://'))
                }))
            }));

            await updateDoc(doc(db, "audits", auditId), {
                sections: sectionsToSave,
                totalScore: updatedAudit.totalScore,
                updatedAt: Timestamp.now(),
            });
            toast.success("Bölüm başarıyla sıfırlandı");
        } catch (error) {
            console.error("Error resetting section:", error);
            toast.error("Bölüm sıfırlanırken hata oluştu");
        }
    };

    // Offline sync
    const isOnline = useOnlineStatus();
    const { syncing, syncProgress, hasPending, syncingImageUrls, uploadedImageUrls, urlReplacements } = useAuditSync(auditId);
    const reloadedAfterSync = useRef(false);

    // Time Tracking - Session Based
    const lastActionTime = useRef<number>(Date.now());

    // Reset timer when section changes to prevent large durations if user was idle between sections
    // However, user wants "time between questions". If they switch sections and immediately answer, it should count.
    // So we don't reset lastActionTime on section change, just let it run.

    // When sync completes and converts local:// → firebase URLs, patch audit state immediately
    // This prevents broken image thumbnails without requiring a full Firestore reload
    useEffect(() => {
        if (urlReplacements.size === 0 || !audit) return;
        setAudit(prev => {
            if (!prev) return prev;
            const imgs = prev.generalFeedback?.images;
            if (!imgs || imgs.length === 0) return prev;
            const patched = imgs.map(url => urlReplacements.get(url) ?? url);
            // Only update state if something actually changed
            if (patched.every((u, i) => u === imgs[i])) return prev;
            return { ...prev, generalFeedback: { ...prev.generalFeedback, images: patched } };
        });
    }, [urlReplacements]);

    // Reload audit when sync completes (only once)
    useEffect(() => {
        if (!syncing && !hasPending && uploadedImageUrls.length > 0 && !reloadedAfterSync.current) {
            // Sync just completed, reload audit to get Firebase URLs
            reloadedAfterSync.current = true;
            loadAudit();
            // Reset after 5 seconds so next sync can reload
            setTimeout(() => {
                reloadedAfterSync.current = false;
            }, 5000);
        }
    }, [syncing, hasPending, uploadedImageUrls.length]);

    useEffect(() => {
        if (!auditId) {
            setLoading(false);
            return;
        }
        // Start real-time listener
        const unsub = startAuditListener();
        return () => {
            if (unsub) unsub();
        };
    }, [auditId]);

    // Track when user is actively typing in any text field to pause onSnapshot sections sync
    useEffect(() => {
        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                isEditing.current = true;
            }
        };
        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                isEditing.current = false;
            }
        };
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);

    // Track personnel evaluation status
    useEffect(() => {
        if (!audit?.id || !audit?.storeId) return;

        let activePersonnelIds: string[] = [];
        let evaluatedPersonnelIds = new Set<string>();

        const updateStatus = () => {
            const evaluatedCount = activePersonnelIds.filter(id => evaluatedPersonnelIds.has(id)).length;
            setPersonnelStatus({ total: activePersonnelIds.length, evaluated: evaluatedCount, initialized: true });
        };

        const unsubPersonnel = onSnapshot(
            query(collection(db, "store_personnel"), where("storeId", "==", audit.storeId), where("status", "==", "active")),
            (snap) => {
                activePersonnelIds = snap.docs.map(doc => doc.id);
                updateStatus();
            }, (error) => {
                if (error.code !== 'permission-denied') console.error("unsubPersonnel error:", error);
            }
        );

        const unsubEvaluations = onSnapshot(
            query(collection(db, "personnel_evaluations"), where("auditId", "==", audit.id)),
            (snap) => {
                evaluatedPersonnelIds = new Set(snap.docs.map(doc => doc.data().personnelId));
                updateStatus();
            }, (error) => {
                if (error.code !== 'permission-denied') console.error("unsubEvaluations error:", error);
            }
        );

        return () => {
            unsubPersonnel();
            unsubEvaluations();
        };
    }, [audit?.id, audit?.storeId]);

    // Real-time listener: syncs audit state across devices
    const startAuditListener = () => {
        if (!auditId) return;
        const auditRef = doc(db, "audits", auditId);
        // includeMetadataChanges: true — we get notified for both local (pending) and server-confirmed writes
        const unsub = onSnapshot(auditRef, { includeMetadataChanges: true }, async (auditDoc) => {
            // hasPendingWrites: true means this snapshot is from THIS device's own local write (not yet server-confirmed).
            // Skip it to prevent our own write from overwriting the optimistic state we already set.
            if (auditDoc.metadata.hasPendingWrites) return;

            // Also skip if this device is mid-write (belt-and-suspenders)
            if (isWriting.current) return;

            if (!auditDoc.exists()) {
                toast.error("Denetim bulunamadı");
                router.push("/denetmen");
                return;
            }

            const auditData = { id: auditDoc.id, ...auditDoc.data() } as Audit;

            // Cross-device sync: if audit was completed on another device, redirect this device
            const currentMode = new URLSearchParams(window.location.search).get('mode');
            if (auditData.status === "tamamlandi" && currentMode !== "view" && currentMode !== "edit") {
                toast.info("Bu denetim başka bir cihazda tamamlandı.", { duration: 4000 });
                router.replace(`/audits/${auditId}?mode=view`);
                return;
            }

            // Suppress sections sync if:
            // 1. This device wrote to Firestore within the last 3 seconds (echo suppression), OR
            // 2. User currently has a text field focused (actively typing) — use BOTH the
            //    persistent isEditing ref (survives mobile keyboard close) AND activeElement check
            const isEchoFromOwnWrite = (Date.now() - lastLocalWriteTime.current) < 3000;
            const activeEl = document.activeElement;
            const userIsTyping = isEditing.current || !!(activeEl && (
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'INPUT' ||
                (activeEl as HTMLElement).contentEditable === 'true'
            ));
            const skipSectionsSync = isEchoFromOwnWrite || userIsTyping;

            // Sync full audit data (sections, generalFeedback, status, score) from Firestore.
            // isWriting guard (above) prevents overwriting while this device is actively saving.
            setAudit(prev => {
                if (!prev) {
                    // First load — full data
                    return auditData;
                }
                // If user is actively typing, skip sections sync to avoid erasing typed text.
                if (skipSectionsSync) {
                    return {
                        ...prev,
                        status: auditData.status,
                        totalScore: auditData.totalScore,
                        completedAt: auditData.completedAt,
                        updatedAt: auditData.updatedAt,
                    };
                }
                // Full sync: update sections and generalFeedback from other device's writes
                return {
                    ...prev,
                    sections: auditData.sections || prev.sections,
                    generalFeedback: auditData.generalFeedback || prev.generalFeedback,
                    status: auditData.status,
                    totalScore: auditData.totalScore,
                    completedAt: auditData.completedAt,
                    updatedAt: auditData.updatedAt,
                };
            });

            // First load: also fetch history and auditor name
            if (loading) {
                await processInitialAuditData(auditData);
            }
        }, (error) => {
            console.error("Audit listener error:", error);
            // Fallback to one-time fetch on listener error
            loadAudit();
        });
        return unsub;
    };

    const loadAudit = async () => {
        if (!auditId) return;
        try {
            const auditDoc = await getDoc(doc(db, "audits", auditId));

            if (!auditDoc.exists()) {
                toast.error("Denetim bulunamadı");
                router.push("/denetmen");
                return;
            }
            const auditData = { id: auditDoc.id, ...auditDoc.data() } as Audit;
            await processInitialAuditData(auditData);
        } catch (error) {
            console.error("Error loading audit:", error);
            toast.error("Denetim yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const processInitialAuditData = async (auditData: Audit) => {
        try {

            // NOW fetch history concurrently with other operations (like user details)
            // We do this BEFORE setting loading to false
            const historyPromise = getStoreAuditHistory(auditData.storeId, 12);

            // Denetmen ismini güncel veritabanından çek
            let auditorNamePromise = Promise.resolve();
            if (auditData.auditorId) {
                auditorNamePromise = getDoc(doc(db, "users", auditData.auditorId)).then(userDoc => {
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as any;
                        if (userData.firstName && userData.lastName &&
                            userData.firstName.trim().length > 1 &&
                            userData.lastName.trim().length > 1) {
                            auditData.auditorName = `${userData.firstName} ${userData.lastName}`;
                        } else if (userData.displayName) {
                            auditData.auditorName = userData.displayName;
                        }
                    }
                }).catch(e => console.error("Error fetching auditor name:", e));
            }

            // Wait for history and auditor name
            const [pastAudits, _] = await Promise.all([historyPromise, auditorNamePromise]);

            // Ensure each answer has at least one empty note
            auditData.sections.forEach(section => {
                section.answers.forEach(answer => {
                    if (!answer.notes || answer.notes.length === 0) {
                        answer.notes = [""];
                    }
                });
            });

            // PROCESS HISTORY DATA (Client-Side)
            // We calculate the history status for ALL questions right here, right now.
            const newHistoryCache: Record<string, QuestionHistory> = {};
            const relevantAudits = pastAudits.filter(a => a.id !== auditId); // Exclude current

            // Iterate over every question in the current audit to calculate its history
            auditData.sections.forEach(section => {
                section.answers.forEach(answer => {
                    const qId = answer.questionId;

                    // Simple "is incomplete" check logic replicated from library
                    const entries: QuestionHistoryEntry[] = [];
                    let consecutiveFailCount = 0;

                    for (const pastAudit of relevantAudits) {
                        // Find the same question in past audit
                        let foundPastAnswer: AuditAnswer | null = null;
                        for (const pastSection of pastAudit.sections) {
                            const found = pastSection.answers.find(a => a.questionId === qId);
                            if (found) {
                                foundPastAnswer = found;
                                break;
                            }
                        }

                        if (!foundPastAnswer) continue;

                        // Check failure
                        let isFail = false;
                        if (foundPastAnswer.questionType === 'yes_no' || !foundPastAnswer.questionType) {
                            isFail = foundPastAnswer.answer === 'hayir';
                        } else if (['rating', 'multiple_choice', 'checkbox'].includes(foundPastAnswer.questionType || '')) {
                            isFail = foundPastAnswer.earnedPoints < foundPastAnswer.maxPoints;
                        }

                        if (isFail) {
                            consecutiveFailCount++;
                            entries.push({
                                auditId: pastAudit.id,
                                auditorName: pastAudit.auditorName,
                                completedAt: pastAudit.completedAt!,
                                answer: foundPastAnswer.answer,
                                earnedPoints: foundPastAnswer.earnedPoints,
                                maxPoints: foundPastAnswer.maxPoints,
                                questionType: foundPastAnswer.questionType,
                                selectedOptions: foundPastAnswer.selectedOptions,
                                options: foundPastAnswer.options,
                                ratingMax: foundPastAnswer.ratingMax,
                                notes: foundPastAnswer.notes || [],
                                photos: foundPastAnswer.photos || [],
                            });
                        } else {
                            break; // Streak broken
                        }
                    }

                    if (consecutiveFailCount > 0) {
                        newHistoryCache[qId] = { consecutiveFailCount, entries };
                    }
                });
            });

            setHistoryCache(newHistoryCache);

            // Clean up stale local:// URLs that may have been saved to Firestore by the old buggy sync.
            // These can never be resolved on a fresh page load.
            if (auditData.generalFeedback?.images?.some((u: string) => u.startsWith('local://'))) {
                const cleanedImages = auditData.generalFeedback.images.filter((u: string) => !u.startsWith('local://'));
                auditData.generalFeedback = { ...auditData.generalFeedback, images: cleanedImages };
                // Write back to Firestore silently so this doesn't repeat on next load
                updateDoc(doc(db, "audits", auditId), {
                    "generalFeedback.images": cleanedImages,
                }).catch(() => { }); // best-effort
            }

            setAudit(auditData);

            // Store original score and full audit when entering edit mode
            if (mode === "edit") {
                setOriginalScore(auditData.totalScore || 0);
                setOriginalAudit(JSON.parse(JSON.stringify(auditData)));
            }
        } catch (error) {
            console.error("Error processing audit data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (currentSectionIndex !== null) {
            // Return to section list from section detail
            setCurrentSectionIndex(null);
        } else {
            // Determine back destination based on user role
            const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard'
                : userProfile?.role === 'magaza' ? '/magaza/panel'
                    : userProfile?.role === 'bolge-muduru' ? '/bolge-muduru'
                        : '/denetmen/tamamlanan';

            // If in view mode (just viewing completed audit), go directly back without dialog
            if (isViewMode) {
                router.push(backDestination);
                return;
            }

            // If in edit mode and no changes, go directly back
            if (isEditMode && !isDirty) {
                router.push(backDestination);
                return;
            }
            // Show exit confirmation dialog
            setShowBackDialog(true);
        }
    };

    const updateAnswer = async (
        sectionIndex: number,
        answerIndex: number,
        updates: Partial<AuditAnswer>
    ) => {
        if (!audit || !auditId) return;

        // Mark as dirty when editing in edit mode
        if (isEditMode && !isDirty) {
            setIsDirty(true);
        }

        const now = Date.now();
        const currentAnswer = audit.sections[sectionIndex].answers[answerIndex];

        // First answer logic check
        const isFirstAnswer = (!currentAnswer.answer || currentAnswer.answer === "") && (!currentAnswer.durationSeconds || currentAnswer.durationSeconds === 0);

        const updatedAudit = { ...audit };
        // Shallow copy answer then apply updates
        let newAnswer = {
            ...updatedAudit.sections[sectionIndex].answers[answerIndex],
            ...updates,
        };

        // If answer changed to "evet" or "muaf", OR if checkbox points are max (implicitly via updates), 
        // we should remove existing actionData to prevent stale "approved" status on next "saveAndNotify".

        // Helper to check if given ALL fields, action is needed
        const isActionNeeded = (ans: AuditAnswer) => {
            if (ans.answer === "hayir") return true;
            if (ans.questionType === "checkbox" && ans.earnedPoints < ans.maxPoints) return true;
            return false;
        };

        // Note: 'updates' might only have 'answer', so we merged it into newAnswer above.
        // We also need to apply point logic here before checking isActionNeeded because updates might be "evet" but points not set yet in 'updates'?
        // Wait, logic below "Puanı güncelle" sets earnedPoints. relying on that order is safer.

        // Let's re-order: Apply logic first, then check actionData cleanup.

        if (updates.answer) {
            if (updates.answer === "evet") {
                newAnswer.earnedPoints = newAnswer.maxPoints;
            } else if (updates.answer === "hayir") {
                newAnswer.earnedPoints = 0;
            } else if (updates.answer === "muaf") {
                newAnswer.earnedPoints = newAnswer.maxPoints;
            }
        }

        // NOW check action requirement
        if (!isActionNeeded(newAnswer)) {
            delete newAnswer.actionData;
        }

        updatedAudit.sections[sectionIndex].answers[answerIndex] = newAnswer;

        // Only update duration if it's the first time answering
        if (isFirstAnswer) {
            // Calculate seconds since last action
            const durationSinceLastAction = (now - lastActionTime.current) / 1000;
            // Round to integer as requested
            updatedAudit.sections[sectionIndex].answers[answerIndex].durationSeconds = Math.round(durationSinceLastAction);

        }

        // Always update lastActionTime on any interaction
        lastActionTime.current = now;

        // Note: Puanı güncelle logic was duplicated above to ensure newAnswer is consistent. Removed/Redundant below? 
        // We already updated newAnswer above. But we need to make sure logic flow is correct.
        // The previous code block updated points on `updatedAudit` directly later. 
        // We updated `newAnswer` and assigned it. So we can skip the manual update below or keep it?
        // Let's remove the redundant block below since we moved it up.

        // Section Score Calculation
        const sectionScores: number[] = [];

        updatedAudit.sections.forEach(section => {
            let sectionEarned = 0;
            let sectionMax = 0;

            section.answers.forEach(answer => {
                // Sadece cevaplanmış soruları hesaba kat
                if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                    sectionEarned += answer.earnedPoints;
                    sectionMax += answer.maxPoints;
                }
            });

            if (sectionMax > 0) {
                const sectionScore = (sectionEarned / sectionMax) * 100;
                sectionScores.push(sectionScore);
            }
        });

        // Tüm bölüm skorlarının ortalamasını al
        const finalScore = sectionScores.length > 0
            ? sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length
            : 0;

        updatedAudit.totalScore = Math.round(finalScore);
        updatedAudit.updatedAt = Timestamp.now();

        // OPTIMISTIC UPDATE: Set state immediately
        setAudit(updatedAudit);

        // If in edit mode, DON'T save to Firebase (only save when clicking "Kaydet")
        const currentMode = new URLSearchParams(window.location.search).get('mode');
        const isInEditMode = currentMode === 'edit' && audit.status === 'tamamlandi';

        if (isInEditMode) {
            return;
        }

        try {
            isWriting.current = true;
            lastLocalWriteTime.current = Date.now(); // suppress echo from own write
            // Filter out local:// URLs before saving to Firestore
            const sectionsToSave = updatedAudit.sections.map(section => ({
                ...section,
                answers: section.answers.map(answer => ({
                    ...answer,
                    photos: (answer.photos || []).filter(url => !url.startsWith('local://'))
                }))
            }));

            // Prepare generalFeedback: strip local:// images before saving
            const generalFeedbackToSave = updatedAudit.generalFeedback
                ? {
                    ...updatedAudit.generalFeedback,
                    images: (updatedAudit.generalFeedback.images || []).filter((url: string) => !url.startsWith('local://')),
                }
                : undefined;

            const firestorePayload: Record<string, unknown> = {
                sections: sectionsToSave,
                totalScore: updatedAudit.totalScore,
                updatedAt: updatedAudit.updatedAt,
            };
            if (generalFeedbackToSave) firestorePayload.generalFeedback = generalFeedbackToSave;

            await updateDoc(doc(db, "audits", auditId), firestorePayload);
        } catch (error) {
            console.error("Error updating answer:", error);
            toast.error("Cevap kaydedilirken hata oluştu");
            // Revert on error
            setAudit(audit);
        } finally {
            isWriting.current = false;
        }
    };

    // Saves generalFeedback (note + images) to Firestore immediately — same pattern as updateAnswer.
    // This ensures photos and notes persist after page reload / logout-login.
    const updateGeneralFeedback = async (patch: { note?: string; images?: string[]; type?: "important" | "note" | "suggestion" | null }) => {
        if (!audit || !auditId) return;
        if (isEditMode && !isDirty) setIsDirty(true);

        const newFeedback = { ...audit.generalFeedback, ...patch };
        const updatedAudit = { ...audit, generalFeedback: newFeedback };
        setAudit(updatedAudit);

        // In edit mode don't auto-save to Firestore (user must click Kaydet)
        const currentMode = new URLSearchParams(window.location.search).get('mode');
        if (currentMode === 'edit' && audit.status === 'tamamlandi') return;

        try {
            isWriting.current = true;
            lastLocalWriteTime.current = Date.now(); // suppress echo from own write
            const feedbackToSave = {
                ...newFeedback,
                // Strip local:// offline images — server can't display them
                images: (newFeedback.images || []).filter((url: string) => !url.startsWith('local://')),
            };
            await updateDoc(doc(db, "audits", auditId), {
                generalFeedback: feedbackToSave,
                updatedAt: Timestamp.now(),
            });
        } catch (error) {
            console.error("Error saving general feedback:", error);
        } finally {
            isWriting.current = false;
        }
    };

    const completeAudit = async () => {
        if (!audit || !auditId) return;

        // Bölüm tutarlılığı kontrolü
        const incompleteSections: string[] = [];

        audit.sections.forEach(section => {
            const answeredQuestions = section.answers.filter(
                answer => answer.answer && answer.answer.trim() !== ""
            );
            const totalQuestions = section.answers.length;

            // Eğer bölümde hiç cevap yoksa, o bölümü "muaf" veya "atlanan" olarak kabul et ve zorlama.
            // Ama eğer en az 1 cevap varsa, tüm sorular cevaplanmalı (kullanıcının isteği).
            if (answeredQuestions.length > 0 && answeredQuestions.length < totalQuestions) {
                incompleteSections.push(section.sectionName);
            }
        });

        if (incompleteSections.length > 0) {
            toast.error(
                `Lütfen şu bölümlerdeki tüm soruları cevaplayın: ${incompleteSections.join(", ")}`,
                { duration: 5000 }
            );
            return;
        }

        // Zorunlu fotoğraf kontrolü
        const missingPhotos: string[] = [];

        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                if (!answer.photoRequired) return;
                if (!answer.answer || answer.answer.trim() === "" || answer.answer === "muaf") return;
                // Fotoğraf zorunlu: "hayır" cevabı VEYA tam puan alınamamışsa
                const isPhotoNeeded =
                    answer.answer === "hayir" ||
                    (answer.earnedPoints < answer.maxPoints);
                if (isPhotoNeeded && (!answer.photos || answer.photos.length === 0)) {
                    missingPhotos.push(`${section.sectionName}: ${answer.questionText}`);
                }
            });
        });

        // "Hayır" cevapları için zorunlu not kontrolü
        const missingNotes: string[] = [];

        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                // "Hayır" cevabı verilmiş mi kontrol et
                if (answer.answer === "hayir") {
                    // Not var mı ve içeriği anlamlı mı kontrol et
                    const hasValidNote = answer.notes &&
                        answer.notes.length > 0 &&
                        answer.notes.some(note => note && note.trim() !== "");

                    if (!hasValidNote) {
                        missingNotes.push(`${section.sectionName}: ${answer.questionText}`);
                    }
                }
            });
        });

        // Eğer eksik fotoğraf veya not varsa modal göster
        if (missingPhotos.length > 0 || missingNotes.length > 0) {
            setValidationErrors({ photos: missingPhotos, notes: missingNotes });
            setShowValidationModal(true);
            return;
        }

        // 4. Personel Değerlendirme Zorunluluk Kontrolü
        try {
            const pQuery = query(collection(db, "store_personnel"), where("storeId", "==", audit.storeId), where("status", "==", "active"));
            const pSnap = await getDocs(pQuery);

            const eQuery = query(collection(db, "personnel_evaluations"), where("auditId", "==", auditId));
            const eSnap = await getDocs(eQuery);

            const evaluatedPersonnelIds = new Set(eSnap.docs.map(doc => doc.data().personnelId));
            const missingEvaluations = pSnap.docs.filter(doc => !evaluatedPersonnelIds.has(doc.id));

            if (missingEvaluations.length > 0) {
                toast.error("Personel değerlendirmesi zorunludur. Lütfen eksik personelleri değerlendirin veya durumlarını güncelleyin.", { duration: 6000 });
                return;
            }

            if (pSnap.docs.length === 0 && eSnap.docs.length === 0) {
                toast.error("Personel değerlendirmesi zorunludur. Lütfen Personel Değerlendirme bölümüne geçerek personelleri ekleyiniz.", { duration: 6000 });
                return;
            }
        } catch (error) {
            console.error("Personnel check error:", error);
        }

        setCompleting(true);

        try {
            // Calculate deadline (exact 3 days)
            const calculateActionDeadline = () => {
                let date = new Date();
                date.setDate(date.getDate() + 3);
                return Timestamp.fromDate(date);
            };

            const actionDeadline = calculateActionDeadline();
            const now = Timestamp.now();

            // Performans ölçümü başlat
            const timer = Logger.startTimer("audit", "Audit completed", {
                auditId: auditId,
                storeId: audit.storeId,
                score: audit.totalScore
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            // Fetch the LATEST sections from Firestore before completing.
            // This ensures answers from BOTH devices (tablet + phone) are preserved,
            // preventing one device's local state from overwriting the other's answers.
            let sectionsToComplete = audit.sections;
            let generalFeedbackToComplete = audit.generalFeedback;
            try {
                const freshDoc = await getDoc(doc(db, "audits", auditId));
                if (freshDoc.exists()) {
                    const freshData = freshDoc.data() as Audit;
                    sectionsToComplete = freshData.sections || audit.sections;
                    generalFeedbackToComplete = freshData.generalFeedback || audit.generalFeedback;
                }
            } catch (fetchErr) {
                console.warn("Could not fetch fresh audit data, using local state:", fetchErr);
            }

            // Prepare updated sections with actionData (using fresh Firestore data)
            const updatedSections = sectionsToComplete.map(section => ({
                ...section,
                answers: section.answers.map(answer => {
                    if (answer.answer === "hayir") {
                        return {
                            ...answer,
                            actionData: {
                                status: "pending_store" as const,
                            }
                        };
                    }
                    // For answers that are not "hayir", ensure actionData is removed if it exists
                    const { actionData, ...restOfAnswer } = answer;
                    return restOfAnswer;
                })
            }));

            await updateDoc(doc(db, "audits", auditId), {
                status: "tamamlandi",
                completedAt: now,
                updatedAt: now,
                actionDeadline: actionDeadline,
                sections: updatedSections,
                allActionsResolved: false, // Initially false if there are actions
                ...(generalFeedbackToComplete ? {
                    generalFeedback: {
                        ...generalFeedbackToComplete,
                        images: (generalFeedbackToComplete.images || []).filter((url: string) => !url.startsWith('local://')),
                    }
                } : {})
            });

            // Local state'i güncelle ki UI hemen güncellensin ve özet görünsün
            setAudit({
                ...audit,
                status: "tamamlandi",
                completedAt: now,
                updatedAt: now,
                actionDeadline: actionDeadline,
                sections: updatedSections,
                allActionsResolved: false
            });
            setJustCompleted(true);

            toast.success("Denetim tamamlandı!");

            // Log audit completion with duration
            timer.stop();

            // Send notification to Store Users
            try {
                if (audit.storeId) {
                    const storeUsersQuery = query(
                        collection(db, "users"),
                        where("storeId", "==", audit.storeId),
                        where("role", "==", "magaza")
                    );
                    const storeUsersSnapshot = await getDocs(storeUsersQuery);
                    // Filter out the current user (auditor) from the notification list
                    const currentUserId = userProfile?.uid;
                    const recordedAuditorId = audit.auditorId;

                    const storeUserIds = storeUsersSnapshot.docs
                        .map(doc => doc.id)
                        .filter(id => {
                            // Exclude current user
                            if (currentUserId && id === currentUserId) return false;
                            // Exclude the auditor of this audit
                            if (recordedAuditorId && id === recordedAuditorId) return false;
                            return true;
                        });

                    if (storeUserIds.length > 0) {
                        const score = audit.totalScore || 0;
                        const auditorName = userProfile?.firstName && userProfile?.lastName
                            ? `${userProfile.firstName} ${userProfile.lastName}`
                            : (userProfile?.displayName || "Bir Denetmen");

                        const notificationData = {
                            userId: "", // Will be set in loop
                            type: "audit_completed",
                            title: `${new Date().toLocaleDateString("tr-TR")} Tarihli Mağaza Denetimi`,
                            message: `${auditorName} tarafından yapılan denetim tamamlandı. Puan: ${score}`,
                            read: false,
                            relatedId: auditId,
                            senderName: auditorName,
                            createdAt: Timestamp.now(),
                        };

                        // 1. Create persistent notifications in Firestore
                        const notificationPromises = storeUserIds.map(userId =>
                            addDoc(collection(db, "notifications"), {
                                ...notificationData,
                                userId: userId
                            })
                        );
                        await Promise.all(notificationPromises);

                        // 2. Send Push Notification to Store Users
                        await fetch("/api/send-notification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                title: `${new Date().toLocaleDateString("tr-TR")} Tarihli Mağaza Denetimi`,
                                message: `${auditorName} tarafından yapılan denetim tamamlandı. Puan: ${score}`,
                                userIds: storeUserIds,
                                url: `/audits/${auditId}/summary`
                            })
                        });
                    }

                    // 3. Send Notification to Regional Manager
                    try {
                        const storeDoc = await getDoc(doc(db, "stores", audit.storeId));
                        if (storeDoc.exists()) {
                            const storeData = storeDoc.data() as Store;
                            if (storeData.regionalManagerId) {
                                const score = audit.totalScore || 0;
                                const auditorName = userProfile?.firstName && userProfile?.lastName
                                    ? `${userProfile.firstName} ${userProfile.lastName}`
                                    : (userProfile?.displayName || "Bir Denetmen");

                                // Regional Manager Notification
                                await fetch("/api/send-notification", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        title: "✅ Denetim Tamamlandı",
                                        message: `Sayın Bölge Müdürü, ${storeData.name} mağazasının denetimi tamamlanmıştır. Puan: ${score}. Raporu incelemek için tıklayınız.`,
                                        recipients: [{ type: "user", id: storeData.regionalManagerId }],
                                        url: `/audits/${auditId}/report`
                                    })
                                });
                            }
                        }
                    } catch (rmError) {
                        console.error("Failed to send RM notification:", rmError);
                    }

                    // 4. Send Notification to Rapor Yöneticisi users
                    try {
                        const score = audit.totalScore || 0;
                        const auditorName = userProfile?.firstName && userProfile?.lastName
                            ? `${userProfile.firstName} ${userProfile.lastName}`
                            : (userProfile?.displayName || "Bir Denetmen");

                        const storeName = audit.storeName || "Mağaza";

                        const rapYonQuery = query(
                            collection(db, "users"),
                            where("role", "==", "rapor-yoneticisi")
                        );
                        const rapYonSnapshot = await getDocs(rapYonQuery);
                        const rapYonIds = rapYonSnapshot.docs.map(d => d.id);

                        if (rapYonIds.length > 0) {
                            // Firestore notifications
                            const rapYonNotifData = {
                                type: "audit_completed",
                                title: "✅ Denetim Tamamlandı",
                                message: `${auditorName}, ${storeName} mağazasının denetimini tamamladı. Puan: ${score}. Raporu incelemek için tıklayınız.`,
                                read: false,
                                relatedId: auditId,
                                senderName: auditorName,
                                createdAt: Timestamp.now(),
                            };
                            await Promise.all(
                                rapYonIds.map(userId =>
                                    addDoc(collection(db, "notifications"), { ...rapYonNotifData, userId })
                                )
                            );

                            // Push notifications
                            await fetch("/api/send-notification", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    title: "✅ Denetim Tamamlandı",
                                    message: `${auditorName}, ${storeName} mağazasının denetimini tamamladı. Puan: ${score}.`,
                                    userIds: rapYonIds,
                                    url: `/audits/${auditId}/report`
                                })
                            });
                        }
                    } catch (rapYonError) {
                        console.error("Failed to send rapor-yoneticisi notification:", rapYonError);
                    }
                }
            } catch (notifyErr) {
                console.error("Failed to send store notification:", notifyErr);
                // Non-blocking error
            }
            // Yönlendirme yerine sayfayı view moduna al (özet ve rapor indirme için)
            router.replace(`/audits/${auditId}?mode=view`);
        } catch (error) {
            console.error("Error completing audit:", error);
            toast.error("Denetim tamamlanırken hata oluştu");
        } finally {
            setCompleting(false);
        }
    };

    const saveAndNotify = async () => {
        if (!audit || !auditId || !userProfile) return;

        // Same validation as completeAudit — edit mode must enforce same rules

        // 1. Section consistency check
        const incompleteSections: string[] = [];
        audit.sections.forEach(section => {
            const answeredQuestions = section.answers.filter(
                answer => answer.answer && answer.answer.trim() !== ""
            );
            const totalQuestions = section.answers.length;
            if (answeredQuestions.length > 0 && answeredQuestions.length < totalQuestions) {
                incompleteSections.push(section.sectionName);
            }
        });

        if (incompleteSections.length > 0) {
            toast.error(
                `Lütfen şu bölümlerdeki tüm soruları cevaplayın: ${incompleteSections.join(", ")}`,
                { duration: 5000 }
            );
            return;
        }

        // 2. Required photo check
        const missingPhotos: string[] = [];
        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                if (!answer.photoRequired) return;
                if (!answer.answer || answer.answer.trim() === "" || answer.answer === "muaf") return;
                // Fotoğraf zorunlu: "hayır" cevabı VEYA tam puan alınamamışsa
                const isPhotoNeeded =
                    answer.answer === "hayir" ||
                    (answer.earnedPoints < answer.maxPoints);
                if (isPhotoNeeded && (!answer.photos || answer.photos.length === 0)) {
                    missingPhotos.push(`${section.sectionName}: ${answer.questionText}`);
                }
            });
        });

        // 3. Required notes for "Hayır" answers
        const missingNotes: string[] = [];
        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                if (answer.answer === "hayir") {
                    const hasValidNote = answer.notes &&
                        answer.notes.length > 0 &&
                        answer.notes.some(note => note && note.trim() !== "");
                    if (!hasValidNote) {
                        missingNotes.push(`${section.sectionName}: ${answer.questionText}`);
                    }
                }
            });
        });

        if (missingPhotos.length > 0 || missingNotes.length > 0) {
            setValidationErrors({ photos: missingPhotos, notes: missingNotes });
            setShowValidationModal(true);
            return;
        }

        setSaving(true);

        try {
            const newScore = audit.totalScore || 0;
            const scoreChanged = newScore !== originalScore;

            // Calculate detailed changes
            const changes: Array<{
                sectionName: string;
                questionId: string;
                questionText: string;
                oldAnswer: string;
                newAnswer: string;
                oldScore: number;
                newScore: number;
            }> = [];

            // Prepare updated sections with proper actionData handling
            // We clone deep to avoid mutating the current state prematurely
            let updatedSections = JSON.parse(JSON.stringify(audit.sections));

            if (originalAudit) {
                updatedSections = updatedSections.map((section: any) => ({
                    ...section,
                    answers: section.answers.map((answer: any) => {
                        const originalSection = originalAudit.sections.find((s: any) => s.sectionId === section.sectionId || s.sectionName === section.sectionName);
                        // Fallback safely if original structure differs slightly
                        const originalAnswer = originalSection?.answers.find((a: any) => a.questionId === answer.questionId || a.questionText === answer.questionText);

                        const newAns = answer.answer || "";
                        const oldAns = originalAnswer?.answer || "";
                        const ansChanged = newAns !== oldAns;
                        const scoreChanged = answer.earnedPoints !== (originalAnswer?.earnedPoints ?? answer.earnedPoints);

                        // Track changes for notification
                        if (originalAnswer && (ansChanged || scoreChanged)) {
                            changes.push({
                                sectionName: section.sectionName,
                                questionId: answer.questionId,
                                questionText: answer.questionText,
                                oldAnswer: oldAns || "boş",
                                newAnswer: newAns || "boş",
                                oldScore: originalAnswer.earnedPoints,
                                newScore: answer.earnedPoints
                            });
                        }

                        // REACTIVATION LOGIC:
                        // Check if action is currently needed (Hayır OR Checkbox fail)
                        const isActionCurrentlyNeeded =
                            newAns === "hayir" ||
                            (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);

                        const wasActionNeededBefore = originalAnswer ? (
                            originalAnswer.answer === "hayir" ||
                            (originalAnswer.questionType === "checkbox" && originalAnswer.earnedPoints < originalAnswer.maxPoints)
                        ) : false;

                        if (isActionCurrentlyNeeded) {
                            const currentStatus = answer.actionData?.status;

                            // Initialize logic:
                            // 1. If it WASN'T needing action before, but now DOES -> NEW ACTION
                            // 2. If it DOES need action, but has NO status -> NEW ACTION (fix corrupted state)
                            // 3. Since updateAnswer now clears status on "evet", a toggle No->Yes->No results in missing status -> NEW ACTION.

                            const isNewAction = !wasActionNeededBefore || !currentStatus;

                            if (isNewAction) {
                                return {
                                    ...answer,
                                    actionData: {
                                        status: "pending_store" as const,
                                        // Reset notes/photos for a fresh action start
                                    }
                                };
                            }
                        }

                        // Cleanup logic: If action NOT needed anymore (e.g. fixed in edit), remove actionData
                        // This handles the case where updateAnswer might have missed it or logic differs.
                        if (!isActionCurrentlyNeeded && answer.actionData) {
                            const { actionData, ...rest } = answer;
                            return rest;
                        }

                        return answer;
                    })
                }));
            }

            // Recalculate allActionsResolved
            // An audit is fully resolved if every "Action Needed" answer has an "approved" status
            const allActionsResolved = updatedSections.every((section: any) =>
                section.answers.every((answer: any) => {
                    const isActionNeeded =
                        answer.answer === "hayir" ||
                        (answer.questionType === "checkbox" && answer.earnedPoints < answer.maxPoints);

                    if (!isActionNeeded) return true; // Not an action item, so it's "resolved"

                    // If action is needed, it MUST be approved to be resolved
                    return answer.actionData && answer.actionData.status === "approved";
                })
            );

            // Reconstruct Timestamps lost during JSON.parse(JSON.stringify)
            const restoreTimestamps = (obj: any): any => {
                if (obj === null || typeof obj !== 'object') return obj;

                // Check if it looks like a serialized Timestamp
                if ('seconds' in obj && 'nanoseconds' in obj && Object.keys(obj).length === 2) {
                    return new Timestamp(obj.seconds, obj.nanoseconds);
                }

                if (Array.isArray(obj)) {
                    return obj.map(v => restoreTimestamps(v));
                }

                return Object.entries(obj).reduce((acc, [key, value]) => {
                    acc[key] = restoreTimestamps(value);
                    return acc;
                }, {} as any);
            };

            const finalSections = restoreTimestamps(updatedSections);

            // Performans ölçümü başlat
            const saveTimer = Logger.startTimer("audit", "Audit updated (manual save)", {
                auditId: auditId,
                score: audit.totalScore,
                scoreChanged: scoreChanged
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            // Update audit in Firestore — include generalFeedback so Genel Değerlendirme changes persist
            const editSavePayload: Record<string, unknown> = {
                sections: finalSections,
                totalScore: audit.totalScore,
                updatedAt: Timestamp.now(),
                allActionsResolved: allActionsResolved,
            };
            // Always include generalFeedback in edit-mode save (even if empty, to clear old values)
            if (audit.generalFeedback !== undefined) {
                editSavePayload.generalFeedback = {
                    ...audit.generalFeedback,
                    images: (audit.generalFeedback.images || []).filter((url: string) => !url.startsWith('local://')),
                };
            }
            await updateDoc(doc(db, "audits", auditId), editSavePayload);

            setAudit(prev => prev ? {
                ...prev,
                sections: finalSections,
                allActionsResolved: allActionsResolved
            } : null);

            // Log with duration
            saveTimer.stop();

            // Create notification for all admins if score changed or answers changed
            if (scoreChanged || changes.length > 0) {
                const adminsQuery = query(
                    collection(db, "users"),
                    where("role", "==", "admin")
                );
                const adminsSnapshot = await getDocs(adminsQuery);

                const scoreDirection = newScore > originalScore ? "arttı" : "azaldı";
                let notificationMessage = `${userProfile.displayName || userProfile.email} ${audit.storeName} mağazasının denetimini düzeltti.`;

                if (scoreChanged) {
                    notificationMessage += ` Puan ${originalScore} iken ${newScore} oldu (${scoreDirection}).`;
                }

                if (changes.length > 0) {
                    notificationMessage += ` Toplam ${changes.length} soru değiştirildi.`;
                }

                // Create notifications for all admins
                const notificationPromises = adminsSnapshot.docs.map((adminDoc) =>
                    addDoc(collection(db, "notifications"), {
                        userId: adminDoc.id,
                        type: "audit_edited",
                        title: "Denetim Düzenlendi",
                        message: notificationMessage,
                        read: false,
                        relatedId: auditId,
                        changes: changes,
                        createdAt: Timestamp.now(),
                    })
                );

                await Promise.all(notificationPromises);
            }

            toast.success("Düzenleme kaydedildi");
            // Redirect based on user role
            const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard' : '/denetmen/tamamlanan';
            router.push(backDestination);
        } catch (error) {
            console.error("Error saving audit:", error);
            toast.error("Denetim kaydedilirken hata oluştu");
        } finally {
            setSaving(false);
        }
    };

    const updateSectionFeedback = async (
        sectionIndex: number,
        updates: Partial<{ note: string; images: string[]; type: "important" | "note" | "suggestion" | null }>
    ) => {
        if (!audit || !auditId) return;

        // Mark as dirty when editing in edit mode
        if (isEditMode && !isDirty) {
            setIsDirty(true);
        }

        const updatedAudit = { ...audit };
        const section = updatedAudit.sections[sectionIndex];

        // Initialize feedback if not exists
        if (!section.feedback) {
            section.feedback = { note: "", images: [] };
        }

        // Update feedback
        section.feedback = { ...section.feedback, ...updates };

        // Ensure images is always array
        if (!section.feedback.images) section.feedback.images = [];

        // Update state
        setAudit(updatedAudit);

        // If in edit mode, DON'T save to Firebase (only save when clicking "Kaydet")
        const currentMode = new URLSearchParams(window.location.search).get('mode');
        const isInEditMode = currentMode === 'edit' && audit.status === 'tamamlandi';

        if (isInEditMode) {
            return;
        }

        try {
            isWriting.current = true;
            lastLocalWriteTime.current = Date.now(); // suppress onSnapshot echo for 3s
            // Filter out local:// URLs before saving to Firestore
            const sectionsToSave = updatedAudit.sections.map(sec => ({
                ...sec,
                answers: sec.answers.map(ans => ({
                    ...ans,
                    photos: (ans.photos || []).filter(u => !u.startsWith('local://'))
                })),
                feedback: sec.feedback ? {
                    ...sec.feedback,
                    note: sec.feedback.note || "", // Ensure note is not undefined
                    images: (sec.feedback.images || []).filter(u => !u.startsWith('local://')),
                    type: sec.feedback.type || null
                } : null // Firestore doesn't support undefined in arrays, use null
            }));

            await updateDoc(doc(db, "audits", auditId), {
                sections: sectionsToSave,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Feedback update error", error);
            toast.error("Görüş kaydedilirken hata oluştu");
        } finally {
            isWriting.current = false;
        }
    };

    const getAnswerButtonClass = (selected: boolean) => {
        return selected
            ? "bg-black dark:bg-red-900 text-white hover:bg-black dark:hover:bg-red-900 hover:text-white"
            : "hover:bg-transparent hover:text-foreground hover:border-input";
    };


    if (loading) {
        return (
            <AuditPageLayout isRegionalManager={isRegionalManager}>
                <div className="flex min-h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AuditPageLayout>
        );
    }

    if (!audit) {
        return (
            <AuditPageLayout isRegionalManager={isRegionalManager}>
                <div className="flex min-h-screen items-center justify-center">
                    <p>Denetim bulunamadı.</p>
                </div>
            </AuditPageLayout>
        );
    }

    const isCompleted = audit.status === "tamamlandi";
    const isEditMode = mode === "edit" && isCompleted && !justCompleted;
    const isViewMode = mode === "view" || (!isEditMode && isCompleted);
    // canEdit is already defined above based on rules

    return (
        <AuditPageLayout isRegionalManager={isRegionalManager}>
            {/* Sticky Action Bar - OUTSIDE container so it can stretch full width and stick properly */}
            <div className="sticky top-[61px] z-40 mb-4 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b border-border/50 shadow-sm">
                <div className="flex flex-row items-center gap-1.5 sm:gap-3 w-full">
                    {currentSectionIndex !== null ? (() => {
                        let sectionName = "";
                        let sectionScoreText: string | number = "";

                        if (currentSectionIndex === 'personnel') {
                            sectionName = "Personel Değerlendirme";
                            sectionScoreText = "-";
                        } else if (currentSectionIndex === 'general') {
                            sectionName = "Genel Değerlendirme";
                            sectionScoreText = "-";
                        } else if (typeof currentSectionIndex === 'number') {
                            const section = audit.sections?.[currentSectionIndex];
                            sectionName = section?.sectionName || "";

                            let sectionEarned = 0;
                            let sectionMax = 0;

                            if (section?.answers) {
                                section.answers.forEach((answer: any) => {
                                    if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                        sectionEarned += answer.earnedPoints || 0;
                                        sectionMax += answer.maxPoints || 0;
                                    }
                                });
                            }

                            sectionScoreText = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;
                        }

                        return (
                            <div className="flex flex-row items-center w-full relative h-[48px]">
                                {/* Geri Dön butonu - Sabit Sol */}
                                <div className="absolute left-0">
                                    <Button
                                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md shadow-purple-500/20"
                                        onClick={handleBack}
                                    >
                                        <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                        <span className="truncate">Geri Dön</span>
                                    </Button>
                                </div>

                                {/* Bölüm Başlığı - Tam Orta */}
                                <div className="flex-1 flex justify-center px-[120px]">
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 hidden sm:block truncate text-center">
                                        {sectionName}
                                    </h2>
                                </div>

                                {/* Puan Dairesi - Sabit Sağ */}
                                <div className="absolute right-0 flex items-center justify-center w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-md border border-blue-100 dark:border-blue-800 shrink-0">
                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">
                                        {sectionScoreText}
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <Button
                            className="flex-1 px-1 sm:px-4 text-[11px] sm:text-sm h-9 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md shadow-purple-500/20"
                            onClick={() => {
                                const backDestination = userProfile?.role === 'admin' ? '/admin/dashboard'
                                    : userProfile?.role === 'magaza' ? '/magaza/panel'
                                        : '/denetmen/tamamlanan';
                                if (isViewMode) {
                                    // View mode: navigate directly without dialog
                                    window.location.href = backDestination;
                                } else if (isEditMode) {
                                    // Edit mode: show confirmation dialog
                                    setShowBackDialog(true);
                                } else {
                                    // Pending audit: show confirmation dialog
                                    setShowBackDialog(true);
                                }
                            }}
                        >
                            <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">Geri Dön</span>
                        </Button>
                    )}

                    {isEditMode && (
                        <Button
                            onClick={saveAndNotify}
                            disabled={saving}
                            className="flex-1 px-1 sm:px-4 text-[11px] sm:text-sm h-9 sm:h-10 bg-blue-600 hover:bg-blue-700 shadow-md"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin shrink-0" />
                                    <span className="truncate">Kaydediliyor...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                    <span className="truncate">Kaydet</span>
                                </>
                            )}
                        </Button>
                    )}

                    {!isCompleted && currentSectionIndex === null && (
                        <>
                            <Button
                                onClick={handleOpenPreview}
                                disabled={!audit}
                                variant="outline"
                                className="flex-1 px-1 sm:px-4 text-[11px] sm:text-sm h-9 sm:h-10 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50 shadow-sm"
                                title="Eksikleri ve mevcut durumu önizleyin"
                            >
                                <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">Önizleme</span>
                            </Button>
                            <Button
                                onClick={completeAudit}
                                disabled={completing || hasPending || !isOnline}
                                className="flex-1 px-1 sm:px-4 text-[11px] sm:text-sm h-9 sm:h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                                title={
                                    !isOnline
                                        ? "Denetimi tamamlamak için internet bağlantısı gerekli"
                                        : hasPending
                                            ? "Lütfen tüm verilerin senkronize olmasını bekleyin"
                                            : ""
                                }
                            >
                                {completing ? (
                                    <>
                                        <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin shrink-0" />
                                        <span className="truncate">Tamamlanıyor...</span>
                                    </>
                                ) : !isOnline ? (
                                    <>
                                        <WifiOff className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                        <span className="truncate">Offline</span>
                                    </>
                                ) : hasPending ? (
                                    <>
                                        <Clock className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                        <span className="truncate">Bekleniyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                        <span className="truncate">Tamamla</span>
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 pb-3">

                {currentSectionIndex === null && (
                    <div className="flex items-center justify-between mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold mb-2 text-blue-950 dark:text-blue-50">{audit.auditTypeName}</h2>
                            <div className="text-blue-800/80 dark:text-blue-200/80 text-lg">{audit.storeName} • {audit.auditorName}</div>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-lg border-4 border-blue-100 dark:border-blue-800">
                                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                    {audit.totalScore || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pb-8">

                    {isViewMode && (
                        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
                            <div className="flex items-center gap-2 text-green-700 font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                Bu denetim tamamlanmıştır
                            </div>
                        </div>
                    )}
                    {isEditMode && (
                        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                            <div className="flex items-center gap-2 text-blue-700 font-medium">
                                <Save className="h-5 w-5" />
                                Düzenleme Modu - Değişiklikleri kaydetmeyi unutmayın
                            </div>
                        </div>
                    )}



                    {currentSectionIndex === null ? (
                        // Section list view - hide in view mode, show only in edit mode or pending audits
                        !isViewMode ? (
                            <>
                                <div className="grid gap-2 md:gap-4 bg-background p-2 md:p-6 rounded-lg transition-all duration-500 ease-out animate-in fade-in zoom-in-95">
                                    {audit.sections.map((section, sectionIndex) => {
                                        const totalQuestions = section.answers.length;
                                        const answeredQuestions = section.answers.filter(
                                            (a) => a.answer && a.answer.trim() !== ""
                                        ).length;
                                        const isComplete = answeredQuestions === totalQuestions;
                                        const hasAny = answeredQuestions > 0;

                                        // Dynamic border colors
                                        const borderColors = [
                                            "border-blue-300 dark:border-blue-700",
                                            "border-green-300 dark:border-green-700",
                                            "border-orange-300 dark:border-orange-700",
                                            "border-purple-300 dark:border-purple-700",
                                            "border-pink-300 dark:border-pink-700",
                                            "border-teal-300 dark:border-teal-700",
                                            "border-indigo-300 dark:border-indigo-700",
                                            "border-cyan-300 dark:border-cyan-700"
                                        ];
                                        const borderColorClass = borderColors[sectionIndex % borderColors.length];

                                        // Calculate section score
                                        let sectionEarned = 0;
                                        let sectionMax = 0;
                                        section.answers.forEach(answer => {
                                            if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                                sectionEarned += answer.earnedPoints;
                                                sectionMax += answer.maxPoints;
                                            }
                                        });
                                        const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                                        return (
                                            <Card
                                                key={sectionIndex}
                                                className={`cursor-pointer hover:shadow-md transition-all border shadow-sm bg-blue-50/20 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${borderColorClass} group rounded-xl min-h-[5rem] md:min-h-[7rem] py-3 md:py-6 gap-3 md:gap-6 flex items-center justify-center select-none`}
                                                onClick={() => {
                                                    setCurrentSectionIndex(sectionIndex);
                                                    window.scrollTo({ top: 0, behavior: 'instant' });
                                                }}
                                                onTouchStart={() => handleTouchStart(sectionIndex)}
                                                onTouchEnd={handleTouchEnd}
                                                onMouseDown={() => handleMouseDown(sectionIndex)}
                                                onMouseUp={handleMouseUp}
                                                onMouseLeave={handleMouseUp}
                                                onContextMenu={(e) => e.preventDefault()}
                                            >
                                                <CardHeader className="p-0 px-3 md:p-6 w-full">
                                                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4 w-full">
                                                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-100/50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                                                            {(() => {
                                                                // Dynamic Icon Rendering
                                                                const IconComponent = (section.icon && (LucideIcons as any)[section.icon])
                                                                    ? (LucideIcons as any)[section.icon]
                                                                    : ClipboardList;
                                                                return <IconComponent className="w-5 h-5 md:w-6 md:h-6" />;
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <Circle
                                                                className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 ${isComplete ? 'fill-green-500 text-green-500' : hasAny ? 'fill-red-500 text-red-500' : 'text-gray-300'}`}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-bold text-base md:text-2xl mb-1 md:mb-2 truncate text-foreground group-hover:text-blue-700 transition-colors">{section.sectionName}</h3>
                                                                {section.description && (
                                                                    <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
                                                                        {section.description}
                                                                    </p>
                                                                )}
                                                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                                                    {answeredQuestions} / {totalQuestions} soru cevaplanmış
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-muted rounded-full shadow-inner">
                                                                <div className="text-base md:text-xl font-bold text-primary">
                                                                    {sectionScore}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                            </Card>
                                        );
                                    })}
                                    {/* Personnel Evaluation Card */}
                                    <Card
                                        className="cursor-pointer hover:shadow-lg transition-all border shadow-sm bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 hover:from-amber-100 hover:to-orange-200 dark:hover:from-amber-900/60 dark:hover:to-orange-900/60 border-amber-300 dark:border-amber-700/50 group rounded-xl min-h-[5rem] md:min-h-[7rem] py-3 md:py-6 gap-3 md:gap-6 flex items-center justify-center select-none"
                                        onClick={() => {
                                            setCurrentSectionIndex('personnel');
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    >
                                        <CardHeader className="p-0 px-3 md:p-6 w-full">
                                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4 w-full">
                                                <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-orange-200/50 dark:bg-orange-800/50 text-orange-600 dark:text-orange-400">
                                                    <UserCircle className="w-5 h-5 md:w-6 md:h-6" />
                                                </div>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Circle className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 fill-current ${!personnelStatus.initialized ? "text-gray-300 dark:text-gray-700" :
                                                        personnelStatus.total === 0 ? "text-gray-300 dark:text-gray-700" :
                                                            personnelStatus.evaluated >= personnelStatus.total ? "text-green-500" :
                                                                "text-red-500"
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-base md:text-2xl mb-1 md:mb-2 truncate text-amber-950 dark:text-amber-50 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">Personel Değerlendirme</h3>
                                                        <p className="text-sm text-amber-800/70 dark:text-amber-200/70 mt-1 truncate">
                                                            {personnelStatus.initialized
                                                                ? (personnelStatus.total === 0 ? "Kayıtlı aktif personel yok" : `${personnelStatus.evaluated} / ${personnelStatus.total} personel değerlendirildi`)
                                                                : "Zorunlu Puanlamadan bağımsız karar raporu"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <ChevronRight className="h-6 w-6 text-amber-700/50 dark:text-amber-300/50 group-hover:text-amber-600 transition-colors" />
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>

                                    {/* General Feedback Card */}
                                    <Card
                                        className="cursor-pointer hover:shadow-lg transition-all border shadow-sm bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900/60 dark:to-slate-800/60 hover:from-slate-100 hover:to-slate-300 dark:hover:from-slate-800/80 dark:hover:to-slate-700/80 border-slate-300 dark:border-slate-700 group rounded-xl min-h-[5rem] md:min-h-[7rem] py-3 md:py-6 gap-3 md:gap-6 flex items-center justify-center select-none"
                                        onClick={() => setCurrentSectionIndex('general')}
                                    >
                                        <CardHeader className="p-0 px-3 md:p-6 w-full">
                                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4 w-full">
                                                <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                                                    <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
                                                </div>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Circle className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 fill-current ${audit?.generalFeedback?.note || (audit?.generalFeedback?.images && audit.generalFeedback.images.length > 0)
                                                        ? "text-green-500"
                                                        : "text-gray-300 dark:text-gray-700"
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-base md:text-2xl mb-1 md:mb-2 truncate text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Genel Değerlendirme</h3>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 truncate">
                                                            Puanlamadan bağımsız genel görüş ve öneriler
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <ChevronRight className="h-6 w-6 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors" />
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </div>
                            </>
                        ) : null
                    ) : currentSectionIndex === 'personnel' ? (
                        <div className="animate-in slide-in-from-bottom-8 duration-500 fill-mode-both">
                            <PersonnelEvaluationSection
                                auditId={audit.id}
                                storeId={audit.storeId}
                                storeName={audit.storeName}
                                canEdit={canEdit}
                            />
                        </div>
                    ) : currentSectionIndex === 'general' ? (
                        <div className="animate-in slide-in-from-bottom-8 duration-500 fill-mode-both">
                            <Card className="p-4 md:p-6 border shadow-sm bg-slate-50/50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Genel Değerlendirme</h2>
                                        <Badge variant="outline" className="bg-slate-100 text-slate-800">Puana Etki Etmez</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Bu mağaza denetimi hakkında puanlamaya yansımayan ancak raporun sonunda yer alacak genel görüş, öneri veya notlarınızı buraya ekleyebilirsiniz.
                                    </p>

                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div>
                                            <Label className="mb-3 block">Hızlı Kategori Ekle (Yazının Başına)</Label>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-red-50 hover:text-red-600 border-slate-200 dark:border-slate-800"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        const el = generalFeedbackRef.current;
                                                        const currentNote = audit?.generalFeedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNEMLİ: " : "\nÖNEMLİ: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateGeneralFeedback({ note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Önemli
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-green-50 hover:text-green-600 border-slate-200 dark:border-slate-800"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        const el = generalFeedbackRef.current;
                                                        const currentNote = audit?.generalFeedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "NOT: " : "\nNOT: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateGeneralFeedback({ note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Not
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-blue-50 hover:text-blue-600 border-slate-200 dark:border-slate-800"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        const el = generalFeedbackRef.current;
                                                        const currentNote = audit?.generalFeedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNERİ: " : "\nÖNERİ: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateGeneralFeedback({ note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Öneri
                                                </Button>
                                            </div>

                                            <Label>Genel Görüş & Notlar</Label>
                                            <Textarea
                                                ref={generalFeedbackRef}
                                                value={audit?.generalFeedback?.note || ""}
                                                onChange={(e) => updateGeneralFeedback({ note: e.target.value })}
                                                placeholder="Genel görüşleriniz... (Örn: ÖNEMLİ: Temizliğe dikkat edilmemiş)"
                                                disabled={!canEdit}
                                                className="min-h-[120px] resize-none mt-2 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-slate-400"
                                            />
                                        </div>

                                        <div>
                                            <Label>Ek Görseller</Label>
                                            <div className="mt-2">
                                                <ImageGallery
                                                    images={audit?.generalFeedback?.images || []}
                                                    onImagesChange={(newImages) => updateGeneralFeedback({ images: newImages })}
                                                    auditId={auditId}
                                                    sectionIndex={-1}
                                                    answerIndex={-2}
                                                    questionText="Genel Değerlendirme"
                                                    disabled={!canEdit}
                                                    onUploadStart={() => setUploading(true)}
                                                    onUploadEnd={() => setUploading(false)}
                                                    syncingImages={syncingImageUrls}
                                                    uploadedImages={uploadedImageUrls}
                                                    auditorName={audit?.auditorName}
                                                    storeName={audit?.storeName}
                                                    sectionName="Genel Değerlendirme"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    ) : (
                        // SECTION DETAIL VIEW
                        <div className="space-y-6 transition-all duration-500 ease-out animate-in fade-in slide-in-from-bottom-8">
                            {audit.sections[currentSectionIndex].answers.map((answer, answerIndex) => (
                                <Card key={answerIndex} className="p-4 border shadow-sm hover:shadow-md transition-shadow bg-blue-50/30 dark:bg-blue-900/5 border-blue-200 dark:border-blue-800">
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-base">
                                                    {answer.questionText}
                                                </h4>
                                                {answer.photoRequired && (
                                                    <Badge className="bg-blue-500 mt-2">
                                                        Fotoğraf Zorunlu
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 items-end shrink-0">
                                                {answer.answer === "muaf" ? (
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold text-xs shadow-sm">
                                                        MUAF
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm">
                                                        <span className="font-bold text-base text-blue-700 dark:text-blue-400 leading-none">{answer.maxPoints}</span>
                                                        <span className="text-[9px] text-blue-600/70 dark:text-blue-400/70 uppercase leading-none mt-0.5 font-medium">Puan</span>
                                                    </div>
                                                )}
                                                <QuestionHistoryButton
                                                    storeId={audit.storeId}
                                                    auditTypeId={audit.auditTypeId}
                                                    questionId={answer.questionId}
                                                    currentAuditId={auditId}
                                                    historyData={historyCache[answer.questionId]}
                                                />
                                            </div>
                                        </div>

                                        {/* Cevap Alanı - Soru Tipine Göre Dinamik */}
                                        {answer.questionType === 'checkbox' && answer.options && answer.options.length > 0 ? (
                                            // CHECKBOX: Çoklu seçim
                                            <div className="space-y-2">
                                                {answer.options.map((option) => {
                                                    const selectedOptions = answer.selectedOptions || [];
                                                    const isChecked = selectedOptions.includes(option.id);

                                                    return (
                                                        <div key={option.id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent transition-colors">
                                                            <Checkbox
                                                                id={`${answer.questionId}-${option.id}`}
                                                                checked={isChecked}
                                                                disabled={!canEdit}
                                                                onCheckedChange={(checked) => {
                                                                    if (!canEdit) return;

                                                                    let newSelected: string[];
                                                                    if (checked) {
                                                                        newSelected = [...selectedOptions, option.id];
                                                                    } else {
                                                                        newSelected = selectedOptions.filter(id => id !== option.id);
                                                                    }

                                                                    // Toplam puan hesapla
                                                                    const totalPoints = answer.options
                                                                        ?.filter(opt => newSelected.includes(opt.id))
                                                                        .reduce((sum, opt) => sum + opt.points, 0) || 0;

                                                                    // Muaf'tan çıkıyorsa maxPoints'i geri yükle
                                                                    const originalMax = answer.originalMaxPoints || answer.maxPoints;

                                                                    updateAnswer(currentSectionIndex, answerIndex, {
                                                                        answer: newSelected.length > 0 ? newSelected.join(',') : '',
                                                                        selectedOptions: newSelected,
                                                                        earnedPoints: totalPoints,
                                                                        maxPoints: originalMax, // Muaf'tan geri yükle
                                                                    });
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`${answer.questionId}-${option.id}`}
                                                                className="flex-1 cursor-pointer"
                                                            >
                                                                {option.text}
                                                                <span className="ml-2 text-sm text-muted-foreground">
                                                                    ({option.points} puan)
                                                                </span>
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                                <div className="text-sm text-muted-foreground mt-2">
                                                    Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                </div>
                                                {/* Muaf ve Hiçbiri butonu */}
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant={answer.answer === "hicbiri" ? "destructive" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "hicbiri",
                                                                selectedOptions: [],
                                                                earnedPoints: 0, // Hiçbiri = 0 puan, soru cevaplanmış sayılır
                                                                maxPoints: answer.originalMaxPoints || answer.maxPoints,
                                                            });
                                                        }}
                                                    >
                                                        Hiçbiri
                                                    </Button>
                                                    <Button
                                                        variant={answer.answer === "muaf" ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            });
                                                        }}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : answer.questionType === 'multiple_choice' && answer.options && answer.options.length > 0 ? (
                                            // MULTIPLE CHOICE: Tek seçim
                                            <div className="space-y-2">
                                                {answer.options.map((option) => {
                                                    const isSelected = answer.answer === option.id;

                                                    return (
                                                        <Button
                                                            key={option.id}
                                                            variant={isSelected ? "default" : "outline"}
                                                            className="w-full justify-start"
                                                            disabled={!canEdit}
                                                            onClick={() => {
                                                                if (!canEdit) return;
                                                                updateAnswer(currentSectionIndex, answerIndex, {
                                                                    answer: option.id,
                                                                    earnedPoints: option.points,
                                                                    // maxPoints admin'de tanımlanan değer olarak kalır
                                                                });
                                                            }}
                                                        >
                                                            {option.text}
                                                            <span className="ml-2 text-sm opacity-70">
                                                                ({option.points} puan)
                                                            </span>
                                                        </Button>
                                                    );
                                                })}
                                                <div className="text-sm text-muted-foreground mt-2">
                                                    Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                </div>
                                                {/* Muaf butonu */}
                                                <Button
                                                    variant={answer.answer === "muaf" ? "default" : "outline"}
                                                    size="sm"
                                                    className="w-full"
                                                    disabled={!canEdit}
                                                    onClick={() => {
                                                        if (!canEdit) return;
                                                        updateAnswer(currentSectionIndex, answerIndex, {
                                                            answer: "muaf",
                                                            earnedPoints: 0, // Muaf = hesaba katılmaz
                                                            maxPoints: 0, // Muaf = hesaba katılmaz
                                                        });
                                                    }}
                                                >
                                                    Muaf
                                                </Button>
                                            </div>
                                        ) : answer.questionType === 'rating' && answer.ratingMax ? (
                                            // RATING: Derece (1-5 veya 1-10)
                                            <div className="space-y-3">
                                                <div className="flex gap-1 sm:gap-2 w-full">
                                                    {Array.from({ length: answer.ratingMax }, (_, i) => i + 1).map((rating) => {
                                                        const isSelected = answer.answer === rating.toString();

                                                        return (
                                                            <button
                                                                key={rating}
                                                                type="button"
                                                                disabled={!canEdit}
                                                                onClick={() => {
                                                                    if (!canEdit) return;
                                                                    // Restore originalMaxPoints if coming from muaf
                                                                    const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                                    // Calculate proportional points based on rating
                                                                    const ratingMax = answer.ratingMax || 5;
                                                                    const earnedPoints = Math.round((rating / ratingMax) * originalMax);
                                                                    updateAnswer(currentSectionIndex, answerIndex, {
                                                                        answer: rating.toString(),
                                                                        earnedPoints: earnedPoints,
                                                                        maxPoints: originalMax, // Restore maxPoints
                                                                    });
                                                                }}
                                                                className={`flex-1 flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg border-2 transition-all ${isSelected
                                                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600'
                                                                    } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                            >
                                                                <Star
                                                                    className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected
                                                                        ? 'fill-yellow-500 text-yellow-500'
                                                                        : 'text-gray-400 dark:text-gray-500'
                                                                        }`}
                                                                />
                                                                <span className={`text-xs sm:text-sm font-medium ${isSelected
                                                                    ? 'text-yellow-700 dark:text-yellow-400'
                                                                    : 'text-gray-600 dark:text-gray-400'
                                                                    }`}>
                                                                    {rating}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Kazanılan: {answer.earnedPoints} / {answer.maxPoints} puan
                                                </div>
                                                {/* Muaf ve Hiçbiri butonu */}
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant={answer.answer === "hicbiri" ? "destructive" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "hicbiri",
                                                                earnedPoints: 0, // Hiçbiri = 0 puan, soru cevaplanmış sayılır
                                                                maxPoints: answer.originalMaxPoints || answer.maxPoints,
                                                            });
                                                        }}
                                                    >
                                                        Hiçbiri
                                                    </Button>
                                                    <Button
                                                        variant={answer.answer === "muaf" ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={!canEdit}
                                                        onClick={() => {
                                                            if (!canEdit) return;
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                answer: "muaf",
                                                                earnedPoints: 0, // Muaf = hesaba katılmaz
                                                                maxPoints: 0, // Muaf = hesaba katılmaz
                                                            });
                                                        }}
                                                    >
                                                        Muaf
                                                    </Button>
                                                </div>

                                            </div>
                                        ) : (
                                            // YES_NO (varsayılan): Evet/Hayır/Muaf
                                            <div className="flex flex-col gap-2 sm:gap-3 w-full">
                                                {/* Evet */}
                                                <button
                                                    disabled={!canEdit}
                                                    onClick={(e) => {
                                                        // Ripple
                                                        const btn = e.currentTarget;
                                                        const circle = document.createElement("span");
                                                        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                                                        const rect = btn.getBoundingClientRect();
                                                        circle.style.cssText = `width:${diameter}px;height:${diameter}px;left:${e.clientX - rect.left - diameter / 2}px;top:${e.clientY - rect.top - diameter / 2}px;position:absolute;border-radius:50%;background:rgba(255,255,255,0.20);transform:scale(0);animation:ripple 320ms linear;pointer-events:none;`;
                                                        btn.appendChild(circle);
                                                        setTimeout(() => circle.remove(), 350);
                                                        // Logic
                                                        const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                        canEdit && updateAnswer(currentSectionIndex, answerIndex, {
                                                            answer: "evet",
                                                            earnedPoints: originalMax,
                                                            maxPoints: originalMax,
                                                        });
                                                    }}
                                                    className={`relative overflow-hidden h-11 sm:h-12 rounded-full w-full flex items-center justify-center text-sm sm:text-base font-semibold border transition-colors duration-150 ${answer.answer === "evet"
                                                        ? "bg-[#5faf24] text-white border-[#5faf24] hover:bg-[#4d8f1d]"
                                                        : "bg-transparent text-foreground border-input hover:bg-[#5faf24]/10 hover:text-[#5faf24] hover:border-[#5faf24]/30"
                                                        } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    Evet
                                                </button>
                                                {/* Hayır */}
                                                <button
                                                    disabled={!canEdit}
                                                    onClick={(e) => {
                                                        const btn = e.currentTarget;
                                                        const circle = document.createElement("span");
                                                        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                                                        const rect = btn.getBoundingClientRect();
                                                        circle.style.cssText = `width:${diameter}px;height:${diameter}px;left:${e.clientX - rect.left - diameter / 2}px;top:${e.clientY - rect.top - diameter / 2}px;position:absolute;border-radius:50%;background:rgba(255,255,255,0.20);transform:scale(0);animation:ripple 320ms linear;pointer-events:none;`;
                                                        btn.appendChild(circle);
                                                        setTimeout(() => circle.remove(), 350);
                                                        const originalMax = answer.originalMaxPoints || answer.maxPoints;
                                                        canEdit && updateAnswer(currentSectionIndex, answerIndex, {
                                                            answer: "hayir",
                                                            earnedPoints: 0,
                                                            maxPoints: originalMax,
                                                        });
                                                    }}
                                                    className={`relative overflow-hidden h-11 sm:h-12 rounded-full w-full flex items-center justify-center text-sm sm:text-base font-semibold border transition-colors duration-150 ${answer.answer === "hayir"
                                                        ? "bg-[#d83f30] text-white border-[#d83f30] hover:bg-[#b03225]"
                                                        : "bg-transparent text-foreground border-input hover:bg-[#d83f30]/10 hover:text-[#d83f30] hover:border-[#d83f30]/30"
                                                        } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    Hayır
                                                </button>
                                                {/* Muaf */}
                                                <button
                                                    disabled={!canEdit}
                                                    onClick={(e) => {
                                                        const btn = e.currentTarget;
                                                        const circle = document.createElement("span");
                                                        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                                                        const rect = btn.getBoundingClientRect();
                                                        circle.style.cssText = `width:${diameter}px;height:${diameter}px;left:${e.clientX - rect.left - diameter / 2}px;top:${e.clientY - rect.top - diameter / 2}px;position:absolute;border-radius:50%;background:rgba(255,255,255,0.20);transform:scale(0);animation:ripple 320ms linear;pointer-events:none;`;
                                                        btn.appendChild(circle);
                                                        setTimeout(() => circle.remove(), 350);
                                                        canEdit && updateAnswer(currentSectionIndex, answerIndex, {
                                                            answer: "muaf",
                                                            earnedPoints: 0,
                                                            maxPoints: 0,
                                                        });
                                                    }}
                                                    className={`relative overflow-hidden h-11 sm:h-12 rounded-full w-full flex items-center justify-center text-sm sm:text-base font-semibold border transition-colors duration-150 ${answer.answer === "muaf"
                                                        ? "bg-[#daa127] text-white border-[#daa127] hover:bg-[#b58620]"
                                                        : "bg-transparent text-foreground border-input hover:bg-[#daa127]/10 hover:text-[#daa127] hover:border-[#daa127]/30"
                                                        } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    Muaf
                                                </button>
                                            </div>
                                        )}

                                        {/* Notes and Photos - Action Bar */}
                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                                            {/* Display existing notes summary (Moved Above) */}
                                            {(answer.notes && answer.notes.length > 0 && answer.notes.some(n => n.trim() !== "")) && (
                                                <div className="space-y-2 mb-4">
                                                    {answer.notes.map((note, idx) => note.trim() && (
                                                        <div key={idx} className="bg-muted p-3 rounded-lg text-sm text-foreground/80 relative pr-8">
                                                            {note}
                                                            {canEdit && (
                                                                <button
                                                                    className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors"
                                                                    onClick={() => {
                                                                        const newNotes = [...(answer.notes || [])];
                                                                        newNotes[idx] = "";
                                                                        updateAnswer(currentSectionIndex, answerIndex, { notes: newNotes.filter(n => n.trim() !== "") });
                                                                    }}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Action Bar */}
                                            <div className="flex flex-nowrap items-center justify-between text-slate-500 dark:text-slate-400 gap-1 w-full mb-3">
                                                <div className="flex-1">
                                                    <Sheet>
                                                        <SheetTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="w-full gap-1.5 sm:gap-2 h-9 px-1 sm:px-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" disabled={!canEdit}>
                                                                <FileText className="h-4 w-4 shrink-0" />
                                                                <span className="text-[11px] sm:text-sm font-medium whitespace-nowrap">Not Ekle</span>
                                                            </Button>
                                                        </SheetTrigger>
                                                        <SheetContent side="bottom" className="h-[75vh] sm:h-[400px] rounded-t-2xl px-4 py-6">
                                                            <SheetHeader className="mb-4">
                                                                <SheetTitle>Not Ekleyin</SheetTitle>
                                                                <SheetDescription>Bu soruyla ilgili detaylı notlarınızı aşağıya yazabilirsiniz.</SheetDescription>
                                                            </SheetHeader>
                                                            <div className="flex flex-col h-[calc(100%-4rem)] pb-12 sm:pb-8">
                                                                <Textarea
                                                                    value={answer.notes ? answer.notes.join("\n\n") : ""}
                                                                    onChange={(e) => {
                                                                        if (!canEdit) return;
                                                                        updateAnswer(currentSectionIndex, answerIndex, {
                                                                            notes: [e.target.value],
                                                                        });
                                                                    }}
                                                                    placeholder="Notunuzu buraya yazın..."
                                                                    className="flex-1 resize-none border focus-visible:ring-1 p-4 text-base rounded-xl"
                                                                />
                                                            </div>
                                                        </SheetContent>
                                                    </Sheet>
                                                </div>

                                                <div className="flex-1">
                                                    <Button variant="ghost" size="sm" className="w-full gap-1.5 sm:gap-2 h-9 px-1 sm:px-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" disabled>
                                                        <Zap className="h-4 w-4 shrink-0" />
                                                        <span className="text-[11px] sm:text-sm font-medium whitespace-nowrap">Bildirim</span>
                                                    </Button>
                                                </div>

                                                <div className="flex-1">
                                                    <ImageGallery
                                                        images={answer.photos || []}
                                                        onImagesChange={(newImages) => {
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                photos: newImages,
                                                            });
                                                        }}
                                                        auditId={auditId}
                                                        sectionIndex={currentSectionIndex}
                                                        answerIndex={answerIndex}
                                                        questionText={answer.questionText || ""}
                                                        disabled={!canEdit}
                                                        onUploadStart={() => setUploading(true)}
                                                        onUploadEnd={() => setUploading(false)}
                                                        syncingImages={syncingImageUrls}
                                                        uploadedImages={uploadedImageUrls}
                                                        auditorName={audit?.auditorName}
                                                        storeName={audit?.storeName}
                                                        sectionName={audit.sections[currentSectionIndex]?.sectionName}
                                                        hideThumbnails={true}
                                                        renderTrigger={(onClick, uploading, uploadProgress) => (
                                                            <button
                                                                type="button"
                                                                onClick={onClick}
                                                                className={`flex w-full items-center justify-center gap-1.5 sm:gap-2 h-9 px-1 sm:px-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-[11px] sm:text-sm font-medium whitespace-nowrap ${!canEdit || uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                                                                disabled={!canEdit || uploading}
                                                            >
                                                                {uploading ? (
                                                                    <>
                                                                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                                                        <span>{uploadProgress}%</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <ImageIcon className="h-4 w-4 shrink-0" />
                                                                        <span>Medya</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            {/* Display existing thumbnails */}
                                            {(answer.photos && answer.photos.length > 0) && (
                                                <div className="mt-2">
                                                    <ImageGallery
                                                        images={answer.photos || []}
                                                        onImagesChange={(newImages) => {
                                                            updateAnswer(currentSectionIndex, answerIndex, {
                                                                photos: newImages,
                                                            });
                                                        }}
                                                        auditId={auditId}
                                                        sectionIndex={currentSectionIndex}
                                                        answerIndex={answerIndex}
                                                        questionText={answer.questionText || ""}
                                                        disabled={!canEdit}
                                                        onUploadStart={() => setUploading(true)}
                                                        onUploadEnd={() => setUploading(false)}
                                                        syncingImages={syncingImageUrls}
                                                        uploadedImages={uploadedImageUrls}
                                                        auditorName={audit?.auditorName}
                                                        storeName={audit?.storeName}
                                                        sectionName={audit.sections[currentSectionIndex]?.sectionName}
                                                        hideAddButton={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {/* Section Feedback Area */}
                            <Card className="mt-6 p-4 border shadow-sm bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-lg flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5" />
                                            Bölüm Görüş ve Önerileri
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            Bu bölümle ilgili genel görüş, öneri veya notlarınızı buraya ekleyebilirsiniz.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label className="mb-3 block">Hızlı Kategori Ekle (Yazının Başına)</Label>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-red-50 hover:text-red-600 border-slate-200 dark:border-slate-800"
                                                    onClick={() => {
                                                        const el = sectionFeedbackRef.current;
                                                        const currentNote = audit.sections[currentSectionIndex].feedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNEMLİ: " : "\nÖNEMLİ: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateSectionFeedback(currentSectionIndex, { note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Önemli
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-green-50 hover:text-green-600 border-slate-200 dark:border-slate-800"
                                                    onClick={() => {
                                                        const el = sectionFeedbackRef.current;
                                                        const currentNote = audit.sections[currentSectionIndex].feedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "NOT: " : "\nNOT: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateSectionFeedback(currentSectionIndex, { note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Not
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="hover:bg-blue-50 hover:text-blue-600 border-slate-200 dark:border-slate-800"
                                                    onClick={() => {
                                                        const el = sectionFeedbackRef.current;
                                                        const currentNote = audit.sections[currentSectionIndex].feedback?.note || "";
                                                        const cursorStart = el?.selectionStart ?? currentNote.length;
                                                        const cursorEnd = el?.selectionEnd ?? currentNote.length;

                                                        const textToInsert = currentNote.length === 0 || cursorStart === 0 ? "ÖNERİ: " : "\nÖNERİ: ";
                                                        const newNote = currentNote.slice(0, cursorStart) + textToInsert + currentNote.slice(cursorEnd);

                                                        updateSectionFeedback(currentSectionIndex, { note: newNote });

                                                        setTimeout(() => {
                                                            if (el) {
                                                                el.focus();
                                                                el.setSelectionRange(cursorStart + textToInsert.length, cursorStart + textToInsert.length);
                                                            }
                                                        }, 50);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    Öneri
                                                </Button>
                                            </div>

                                            <Label>Notlar</Label>
                                            <Textarea
                                                ref={sectionFeedbackRef}
                                                value={audit.sections[currentSectionIndex].feedback?.note || ""}
                                                onChange={(e) => updateSectionFeedback(currentSectionIndex, { note: e.target.value })}
                                                placeholder="Bölüm hakkındaki görüşleriniz..."
                                                disabled={!canEdit}
                                                className="min-h-[80px] resize-none mt-1.5 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-slate-400"
                                            />
                                        </div>

                                        <div>
                                            <Label>Fotoğraflar</Label>
                                            <div className="mt-2">
                                                <ImageGallery
                                                    images={audit.sections[currentSectionIndex].feedback?.images || []}
                                                    onImagesChange={(newImages) => updateSectionFeedback(currentSectionIndex, { images: newImages })}
                                                    auditId={auditId}
                                                    sectionIndex={currentSectionIndex}
                                                    answerIndex={-1} // Special index for section feedback
                                                    questionText={`${audit.sections[currentSectionIndex].sectionName} - Görüş ve Öneriler`}
                                                    disabled={!canEdit}
                                                    onUploadStart={() => setUploading(true)}
                                                    onUploadEnd={() => setUploading(false)}
                                                    syncingImages={syncingImageUrls}
                                                    uploadedImages={uploadedImageUrls}
                                                    auditorName={audit?.auditorName}
                                                    storeName={audit?.storeName}
                                                    sectionName={audit.sections[currentSectionIndex]?.sectionName}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Audit Summary - Show only in view mode, not in edit mode */}
                    {isCompleted && currentSectionIndex === null && isViewMode && (
                        <AuditSummary audit={audit} />
                    )}

                    {/* Reset Section Confirmation Dialog */}
                    <AlertDialog open={resetAlertOpen} onOpenChange={setResetAlertOpen}>
                        <AlertDialogContent className="w-[90%] max-w-md rounded-lg mx-auto">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Bölümü Sıfırla?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-base text-foreground font-medium">
                                    &quot;{sectionToReset !== null ? audit.sections[sectionToReset]?.sectionName : ""}&quot; bölümünü sıfırlamak istediğinize emin misiniz?
                                </AlertDialogDescription>
                                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm rounded-md border border-red-200 dark:border-red-900 font-semibold">
                                    Dikkat: Bu bölümdeki tüm cevaplar, notlar ve fotoğraflar kalıcı olarak silinecektir.
                                </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setResetAlertOpen(false)}>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={confirmSectionReset}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Evet, Sıfırla
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Exit Confirmation Dialog */}
                    <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Denetimden Çıkılsın mı?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Denetimden çıkmak istediğinize emin misiniz? Denetim bekleyen denetimler listesinde kalacaktır.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => router.push('/denetmen/bekleyen')}>
                                    Çıkış Yap
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Back Confirmation Dialog */}
                    <AlertDialog open={showBackDialog} onOpenChange={setShowBackDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{isEditMode ? "Düzenlemeler İptal Edilsin mi?" : "Denetimden Çıkılsın mı?"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {isEditMode
                                        ? "Düzenlemeler iptal edilecektir. Yine de geri dönmek istiyor musunuz?"
                                        : isViewMode
                                            ? "Görüntülemeden çıkmak istediğinize emin misiniz?"
                                            : "Denetimden çıkmak istediğinize emin misiniz? Denetim bekleyen denetimler listesinde kalacaktır."
                                    }
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => {
                                    const isAdmin = userProfile?.role === 'admin';
                                    if (isEditMode || isViewMode) {
                                        // For completed audits (edit or view mode)
                                        window.location.href = isAdmin ? '/admin/dashboard' : '/denetmen/tamamlanan';
                                    } else {
                                        // For pending audits
                                        const backDestination = isAdmin ? '/admin/dashboard' : '/denetmen/bekleyen';
                                        router.push(backDestination);
                                    }
                                }}>
                                    {isEditMode ? "Evet, Geri Dön" : "Çıkış Yap"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Validation Errors Modal */}
                    <AlertDialog open={showValidationModal} onOpenChange={setShowValidationModal}>
                        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl">Denetim Tamamlanamıyor</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Lütfen aşağıdaki eksiklikleri tamamlayın:
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="space-y-6 py-4">
                                {validationErrors.photos.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-red-700 flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5" />
                                            Fotoğraf Eklemeniz Gereken Sorular ({validationErrors.photos.length})
                                        </h4>
                                        <ul className="space-y-2">
                                            {validationErrors.photos.map((item, index) => (
                                                <li key={index} className="flex gap-2 text-sm">
                                                    <span className="text-red-500 font-bold shrink-0">•</span>
                                                    <span className="leading-relaxed">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {validationErrors.notes.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-orange-700 flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5" />
                                            Not Eklemeniz Gereken Sorular ({validationErrors.notes.length})
                                        </h4>
                                        <div className="bg-orange-50 p-3 rounded-lg mb-2">
                                            <p className="text-sm text-orange-800">
                                                💡 "Hayır" cevabı verilen sorular için açıklayıcı not eklemeniz gerekmektedir.
                                            </p>
                                        </div>
                                        <ul className="space-y-2">
                                            {validationErrors.notes.map((item, index) => (
                                                <li key={index} className="flex gap-2 text-sm">
                                                    <span className="text-orange-500 font-bold shrink-0">•</span>
                                                    <span className="leading-relaxed">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <AlertDialogFooter>
                                <AlertDialogAction
                                    onClick={() => setShowValidationModal(false)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Anladım
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Preview Modal */}
                    <AlertDialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
                        <AlertDialogContent className="w-[95vw] max-w-5xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                            <AlertDialogHeader className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 flex flex-row items-center justify-between">
                                <div>
                                    <AlertDialogTitle className="text-xl flex items-center gap-2">
                                        <Eye className="h-5 w-5 text-blue-600" />
                                        Denetim Önizleme
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="mt-1">
                                        Tamamlamadan önce mevcut durumun özetini inceleyin. Değişiklik yapmak için kapatın.
                                    </AlertDialogDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowPreviewModal(false)}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </AlertDialogHeader>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50">
                                {audit && <AuditSummary audit={audit} isPreview={true} showRestrictedFeedback={true} />}
                            </div>

                            <AlertDialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 sm:justify-end">
                                <AlertDialogAction
                                    onClick={() => setShowPreviewModal(false)}
                                    className="bg-slate-800 hover:bg-slate-900 text-white w-full sm:w-auto"
                                >
                                    Kapat ve Forma Dön
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                </div>{/* pb-8 */}
            </div>{/* container */}

        </AuditPageLayout >

    );

}

