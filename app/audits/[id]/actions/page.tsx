"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RegionalManagerHeader } from "@/components/regional-manager/regional-header";
import { ProtectedRoute } from "@/components/protected-route";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    updateDoc,
    Timestamp,
    arrayUnion,
    deleteField,
    onSnapshot,
    addDoc,
    query,
    where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from "browser-image-compression";
import { Audit, AuditAnswer, ActionDataStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Logger from "@/lib/logger";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogoLoader } from "@/components/logo-loader";
import { Loader2, ArrowLeft, Upload, CheckCircle2, AlertCircle, Clock, XCircle, Image as ImageIcon, Camera, Send, X, Download } from "lucide-react";
import {
    savePendingNote,
    savePendingImage,
    getPendingData,
    deletePendingImage,
    deletePendingNote,
    PendingImage,
    PendingNote,
    generateId
} from "@/lib/offline-storage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { invalidateStoreDataCache } from "@/hooks/use-store-data";

const SECTION_COLORS = [
    "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
    "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
    "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
    "bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
];
import { toast } from "sonner";
import ImageGallery from "@/components/image-gallery";
import { cn } from "@/lib/utils";

// Helper to safely parse dates
const parseDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    // Handle serialized Timestamp { seconds: number, nanoseconds: number }
    if (typeof date === 'object' && 'seconds' in date) {
        return new Date(date.seconds * 1000);
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const ActionPageLayout = ({ children, role }: { children: React.ReactNode, role?: string }) => {
    if (role === 'bolge-muduru') {
        return (
            <div className="min-h-screen bg-background pb-20">
                <RegionalManagerHeader />
                {children}
            </div>
        );
    }
    return <DashboardLayout>{children}</DashboardLayout>;
};

export default function AuditActionsPage() {
    const params = useParams();
    const router = useRouter();
    const { userProfile } = useAuth();
    const auditId = params.id as string;
    const isOnline = useOnlineStatus();

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null); // keeping track of which action is uploading
    const [submitting, setSubmitting] = useState(false);

    // Admin Rejection State
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [revertRejectionDialogOpen, setRevertRejectionDialogOpen] = useState(false);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [revertApprovalDialogOpen, setRevertApprovalDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<{ sectionIndex: number, answerIndex: number } | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | string | null>(null);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    const [isDownloading, setIsDownloading] = useState(false);
    const [robotoFont, setRobotoFont] = useState<string | null>(null);

    // Check store permission - only allow stores to view their own audits
    useEffect(() => {
        if (!audit || !userProfile || userProfile.role !== "magaza") return;

        const hasPermission =
            (userProfile.storeId && audit.storeId && userProfile.storeId === audit.storeId) ||
            (userProfile.storeName && audit.storeName && userProfile.storeName === audit.storeName);

        if (!hasPermission) {
            toast.error("Bu denetimi görüntüleme yetkiniz yok");
            router.push("/magaza/panel");
        }
    }, [audit, userProfile, router]);

    // Font Loading Effect
    useEffect(() => {
        const loadFont = async () => {
            try {
                const response = await fetch('/fonts/Roboto-Regular.ttf');
                const fontBlob = await response.blob();
                const reader = new FileReader();

                reader.onload = function (e) {
                    const fontBase64 = (e.target?.result as string)?.split(',')[1];
                    if (fontBase64) {
                        setRobotoFont(fontBase64);
                    }
                };
                reader.readAsDataURL(fontBlob);
            } catch (error) {
                console.error('Font yükleme hatası:', error);
            }
        };
        loadFont();
    }, []);

    // Store Submission State
    // Store Submission State - now supporting mixed File | string for images
    const [submissionData, setSubmissionData] = useState<Record<string, { note: string, images: (File | string)[] }>>({});

    const STORE_NOTE_PREFIX = "store-draft-note-";
    const STORE_IMAGE_PREFIX = "store-draft-img-";

    const getStoreNoteId = (auditId: string, sIndex: number, aIndex: number) =>
        `${STORE_NOTE_PREFIX}${auditId}-${sIndex}-${aIndex}`;

    // Initial load handling is now done via onSnapshot effect
    // We can keep a simplified version or rely on the onSnapshot effect above.
    // The onSnapshot starts on mount because of the dependency array [auditId].

    // Listen to audit changes for real-time sync
    useEffect(() => {
        if (!auditId) return;

        const unsubscribe = onSnapshot(doc(db, "audits", auditId),
            async (docSnap) => {
                if (docSnap.exists()) {
                    const auditData = { id: docSnap.id, ...docSnap.data() } as Audit;

                    // Retrieve auditor name if needed
                    if (auditData.auditorId && !auditData.auditorName) {
                        try {
                            const userDoc = await getDoc(doc(db, "users", auditData.auditorId));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                const fullName = (userData.firstName && userData.lastName)
                                    ? `${userData.firstName} ${userData.lastName}`
                                    : userData.displayName;
                                if (fullName) auditData.auditorName = fullName;
                            }
                        } catch (e) { console.error("Error fetching auditor name", e); }
                    }

                    // Check if any answers are missing photoRequired or actionPhotoRequired
                    // If so, fetch from question templates and update
                    const needsUpdate = auditData.sections.some(section =>
                        section.answers.some(answer =>
                            answer.photoRequired === undefined || answer.actionPhotoRequired === undefined
                        )
                    );

                    if (needsUpdate) {
                        try {
                            // Fetch all question templates
                            const questionsSnapshot = await getDocs(collection(db, "questions"));
                            const questionsMap = new Map();
                            questionsSnapshot.forEach(doc => {
                                questionsMap.set(doc.id, doc.data());
                            });

                            // Update sections with missing fields
                            const updatedSections = auditData.sections.map(section => ({
                                ...section,
                                answers: section.answers.map(answer => {
                                    const questionTemplate = questionsMap.get(answer.questionId);
                                    if (questionTemplate && (answer.photoRequired === undefined || answer.actionPhotoRequired === undefined)) {
                                        return {
                                            ...answer,
                                            photoRequired: questionTemplate.photoRequired || false,
                                            actionPhotoRequired: questionTemplate.actionPhotoRequired || false,
                                        };
                                    }
                                    return answer;
                                })
                            }));

                            // Update Firestore with the fixed data
                            await updateDoc(doc(db, "audits", auditId), {
                                sections: updatedSections,
                                updatedAt: Timestamp.now()
                            });

                            auditData.sections = updatedSections;
                        } catch (error) {
                            console.error("Error updating missing photo fields:", error);
                        }
                    }

                    setAudit(auditData);
                    setLoading(false);
                } else {
                    toast.error("Denetim bulunamadı");
                    router.push("/");
                }
            },
            (error) => {
                console.error("Error listening to audit:", error);
                toast.error("Veri güncellemeleri alınamıyor");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [auditId]);

    const [auditorDisplayName, setAuditorDisplayName] = useState<string>("");

    useEffect(() => {
        const fetchAuditorName = async () => {
            // Priority 1: Try audit.auditorId
            if (audit?.auditorId) {
                try {
                    const userDoc = await getDoc(doc(db, "users", audit.auditorId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.firstName && userData.lastName) {
                            setAuditorDisplayName(`${userData.firstName} ${userData.lastName}`);
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Error fetching auditor name by ID:", error);
                }
            }

            // Priority 2: Try audit.createdBy (if exists, common in some schemas)
            const createdBy = (audit as any).createdBy;
            if (createdBy && typeof createdBy === 'string') {
                try {
                    const userDoc = await getDoc(doc(db, "users", createdBy));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.firstName && userData.lastName) {
                            setAuditorDisplayName(`${userData.firstName} ${userData.lastName}`);
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Error fetching auditor name by createdBy:", error);
                }
            }

            // Fallback
            setAuditorDisplayName(audit?.auditorName || "");
        };

        if (audit) {
            fetchAuditorName();
        }
    }, [audit?.auditorId]);

    // Populate submissionData from server drafts when audit loads/updates
    useEffect(() => {
        if (!audit) return;

        const serverDrafts: Record<string, { note: string, images: (File | string)[] }> = {};

        audit.sections.forEach((section, sIndex) => {
            section.answers.forEach((answer, aIndex) => {
                const actionData = answer.actionData;
                // Check if we have drafted data on server
                // We load it even if logic suggests action might not be needed, to prevent data loss.
                if (actionData && (actionData.status === "pending_store" || actionData.status === "rejected")) {
                    const key = `${sIndex}-${aIndex}`;

                    // Only overwrite if we don't have local unsaved changes? 
                    // For now, simpler: Server is truth. But this might wipe active typing if latency is high.
                    // Better approach: merge, or only set if empty.
                    // Given this is cross-device, we assume one active user.
                    // Let's seed initial state. 

                    // However, this effect runs every time 'audit' updates (which happens on autosave).
                    // We must NOT overwrite local state if it's "fresher" or identical.
                    // But 'submissionData' IS the local state.
                    // If we blindly setSubmissionData here, we might cause loops or cursor jumps.

                    // Strategy: Only initialize if key missing from submissionData?
                    // But what if another device updated it? We want to see it.
                    // Since we will debounce autosave, local is ahead of server.
                    // Server update comes back.
                    // If we only update if server differs significantly?

                    // Let's do this: 
                    // We will NOT automatically update submissionData from audit AFTER initial load
                    // UNLESS we detect it's a "fresh" load (e.g. first mount).
                    // But 'audit' updates onSnapshot...

                    // Actually, for "draft persistence", we mainly care about INITIAL load.
                    // Real-time typing sync is hard without OT.
                    // Let's stick to "Load from server on mount/snapshot if not present locally".

                    // But if I switch devices, I want to see changes.
                    // Let's populate 'serverDrafts' and merge.

                    if (actionData.storeNote || (actionData.storeImages && actionData.storeImages.length > 0)) {
                        serverDrafts[key] = {
                            note: actionData.storeNote || "",
                            images: actionData.storeImages || []
                        };
                    }
                }
            });
        });

        if (Object.keys(serverDrafts).length > 0) {
            setSubmissionData(prev => {
                const next = { ...prev };
                let hasChanges = false;

                Object.entries(serverDrafts).forEach(([key, draft]) => {
                    // If local has no entry, take server.
                    if (!next[key]) {
                        next[key] = draft;
                        hasChanges = true;
                    } else {
                        // If local entry exists, we merge server images that are missing locally.
                        // Ideally we'd remove images that are gone from server too, but "draft vs committed" logic is fuzzy.
                        // Since we delete from server immediately on "Remove", server state is authoritative for deletions too.
                        // But local might have pending uploads (Files).

                        const localItem = next[key];
                        const localImages = localItem.images || [];
                        const serverImages = draft.images; // These are strings (URLs)

                        // 1. Find new server string-images not in local
                        // Compare by URL string value.
                        // NOTE: localImages can contain Files. We only compare strings.
                        const newServerImages = serverImages.filter(sImg =>
                            !localImages.includes(sImg)
                        );

                        // 2. Find server images that are GONE (deleted on another device)
                        // If a string URL is in local but NOT in server, it means another device deleted it.
                        // We should remove it.
                        // But wait, what if we just uploaded it and server hasn't updated yet?
                        // Autosave is fast. 
                        // If we have a URL in local, it MUST be from server originally or from a recent upload response.
                        // If server list doesn't have it, it's deleted.

                        const currentLocalUrls = localImages.filter(i => typeof i === 'string') as string[];
                        const deletedUrls = currentLocalUrls.filter(lUrl =>
                            !serverImages.includes(lUrl as string)
                        );

                        // If we have additions or deletions:
                        if (newServerImages.length > 0 || deletedUrls.length > 0) {
                            // Construct new image list:
                            // Start with local Files (keep them, they are pending uploads or not synced yet)
                            const localFiles = localImages.filter(i => typeof i !== 'string');

                            // Add all CURRENT server images
                            // This effectively applies "Server State" for URLs, while keeping "Local State" for Files.
                            // This handles both additions (new server img) and deletions (server img gone).

                            next[key] = {
                                ...localItem,
                                images: [...localFiles, ...serverImages]
                            };
                            hasChanges = true;
                        }

                        // Note sync? 
                        // If local note is empty and server has note?
                        if ((!localItem.note || localItem.note.trim() === "") && (draft.note && draft.note.trim() !== "")) {
                            next[key] = {
                                ...next[key],
                                note: draft.note
                            };
                            hasChanges = true;
                        }
                    }
                });

                return hasChanges ? next : prev;
            });
        }
    }, [audit]); // Dependency on audit ensures we catch initial load

    // We remove the old loadAudit and loadDrafts calls from the main useEffect
    // The previous useEffect calling them is deleted/replaced.

    // Handle hash scrolling after audit loads
    useEffect(() => {
        if (!loading && audit && typeof window !== 'undefined') {
            const hash = window.location.hash;
            if (hash) {
                // Determine ID from hash (remove #)
                const id = hash.substring(1);
                // Wait slightly for rendering
                setTimeout(() => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);
            }
        }
    }, [loading, audit]);




    const noteSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const updateActionData = async (sectionIndex: number, answerIndex: number, updates: Partial<any>) => {
        if (!audit) return;
        const updatedSections = [...audit.sections];
        const currentData = updatedSections[sectionIndex].answers[answerIndex].actionData || { status: 'pending_store' };

        // Merge updates
        updatedSections[sectionIndex].answers[answerIndex].actionData = {
            ...currentData,
            ...updates,
            // Ensure status is at least pending_store if not set or if rejected (we keep rejected until submitted)
            status: currentData.status || 'pending_store'
        };

        try {
            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Autosave failed", error);
        }
    };

    const handleFileSelect = async (sectionIndex: number, answerIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const key = `${sectionIndex}-${answerIndex}`;
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files!);

            // 1. Immediately update UI with Files (will show previews)
            // We invoke setSubmissionData with functional update to get latest state
            setSubmissionData(prev => {
                const currentImages = prev[key]?.images || [];
                return {
                    ...prev,
                    [key]: {
                        ...prev[key],
                        images: [...currentImages, ...newFiles]
                    }
                };
            });

            // 2. If Online: Upload and Autosave
            if (isOnline) {
                const uploadedUrls: string[] = [];

                setUploading(key);

                try {
                    for (const file of newFiles) {
                        // Compression logic
                        let fileToUpload = file;
                        const fileSizeMB = file.size / 1024 / 1024;
                        if (fileSizeMB > 0.5) {
                            try {
                                const options = {
                                    maxSizeMB: 0.5,
                                    maxWidthOrHeight: 1920,
                                    useWebWorker: true,
                                    initialQuality: 0.85,
                                };
                                const compressedFile = await imageCompression(file, options);
                                // Ensure type is preserved or default to jpeg/png
                                fileToUpload = new File([compressedFile], file.name, {
                                    type: compressedFile.type || file.type,
                                    lastModified: Date.now()
                                });
                            } catch (error) {
                                console.error("Compression error, uploading original", error);
                            }
                        }

                        const uniqueName = `store_action_${auditId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
                        const storageRef = ref(storage, `actions/${auditId}/${uniqueName}`);
                        const uploadResult = await uploadBytes(storageRef, fileToUpload);
                        const url = await getDownloadURL(uploadResult.ref);
                        uploadedUrls.push(url);
                    }

                    // Now update submissionData to replace the specific Files with URLs?
                    // Easier: Get current submissionData, filter out the *specific* File objects we added, and add the URLs.
                    // But File object reference comparison might fail if React re-rendered? No, closure captures 'newFiles'.

                    setSubmissionData(prev => {
                        const currentData = prev[key] || { note: "", images: [] };
                        const currentImages = currentData.images;

                        // Filter out the files we just uploaded
                        const remainingImages = currentImages.filter(img => !newFiles.includes(img as File));

                        return {
                            ...prev,
                            [key]: {
                                ...currentData,
                                images: [...remainingImages, ...uploadedUrls]
                            }
                        };
                    });

                    // Update Firestore
                    // We need the *complete* list of images (existing valid ones + new URLs)
                    // We can't rely on arrayUnion inside updateActionData because it rewrites the whole sections array.
                    // We must calculate the final array of strings.

                    const currentActionData = audit?.sections[sectionIndex].answers[answerIndex].actionData;
                    const existingUrls = currentActionData?.storeImages || [];

                    await updateActionData(sectionIndex, answerIndex, {
                        storeImages: [...existingUrls, ...uploadedUrls],
                        photoUploadedAt: Timestamp.now()
                    });

                } catch (e) {
                    console.error("Upload error", e);
                    toast.error("Fotoğraf yüklenemedi");
                } finally {
                    setUploading(null);
                }

            } else {
                // Offline fallback (IndexedDB)
                newFiles.forEach(async (file) => {
                    // Compression logic for offline
                    let fileToSave = file;
                    const fileSizeMB = file.size / 1024 / 1024;
                    if (fileSizeMB > 0.5) {
                        try {
                            const options = {
                                maxSizeMB: 0.5,
                                maxWidthOrHeight: 1920,
                                useWebWorker: true,
                                initialQuality: 0.85,
                            };
                            const compressedFile = await imageCompression(file, options);
                            fileToSave = new File([compressedFile], file.name, {
                                type: compressedFile.type || file.type,
                                lastModified: Date.now()
                            });
                        } catch (error) {
                            console.error("Compression error, saving original", error);
                        }
                    }

                    const id = generateId();
                    (fileToSave as any).offlineId = id;
                    const arrayBuffer = await fileToSave.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: fileToSave.type });

                    await savePendingImage({
                        id,
                        auditId,
                        sectionIndex,
                        answerIndex,
                        questionText: "",
                        blob,
                        fileName: fileToSave.name,
                        timestamp: Date.now(),
                        uploaded: false
                    });
                });
            }
        }
    };

    const handleRemoveFile = async (sectionIndex: number, answerIndex: number, fileIndex: number) => {
        const key = `${sectionIndex}-${answerIndex}`;
        const fileToRemove = submissionData[key]?.images[fileIndex];

        if (!fileToRemove) return;

        // 1. Update UI immediately
        setSubmissionData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                images: prev[key].images.filter((_, i) => i !== fileIndex)
            }
        }));

        // 2. Persistent Delete
        if (typeof fileToRemove === 'string') {
            // It's a URL - remove from Firestore
            if (isOnline) {
                // 1. Delete from Firebase Storage
                try {
                    const url = new URL(fileToRemove);
                    const pathMatch = url.pathname.match(/\/o\/(.+)/);
                    if (pathMatch && pathMatch[1]) {
                        const filePath = decodeURIComponent(pathMatch[1]);
                        const storageRef = ref(storage, filePath);
                        await deleteObject(storageRef);

                    }
                } catch (e) {
                    console.error("Storage delete error", e);
                    // Continue to remove from Firestore even if storage delete fails
                }


                // 2. Remove from Firestore
                // We need to write the new list.
                // We read current valid list from 'audit' state (most reliable for server state) and filter.
                // If we rely on 'submissionData', it's reactive.

                const currentActionData = audit?.sections[sectionIndex].answers[answerIndex].actionData;
                const currentServerImages = currentActionData?.storeImages || [];
                const newServerImages = currentServerImages.filter(url => url !== fileToRemove);

                await updateActionData(sectionIndex, answerIndex, {
                    storeImages: newServerImages
                });
            }
        } else {
            // It's a File (offline or uploading).
            // Remove from offline storage
            const offlineId = (fileToRemove as any).offlineId;
            if (offlineId) {
                await deletePendingImage(offlineId);
            }
        }
    };

    const handleNoteChange = async (sectionIndex: number, answerIndex: number, note: string) => {
        const key = `${sectionIndex}-${answerIndex}`;

        // Only update UI state - don't save to Firestore
        // storeNote will be saved when user clicks "Submit All"
        setSubmissionData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                note
            }
        }));

        // Save to offline storage for persistence
        if (!isOnline) {
            const id = getStoreNoteId(auditId, sectionIndex, answerIndex);
            if (note.trim()) {
                await savePendingNote({
                    id,
                    auditId,
                    sectionIndex,
                    answerIndex,
                    noteIndex: 0,
                    questionText: "",
                    noteText: note,
                    timestamp: Date.now(),
                    synced: false
                });
            } else {
                await deletePendingNote(id);
            }
        }

        // Online Auto-Save with Debounce
        if (isOnline) {
            // Clear existing timer
            if (noteSaveTimerRef.current) {
                clearTimeout(noteSaveTimerRef.current);
            }

            // Set new timer
            noteSaveTimerRef.current = setTimeout(async () => {
                try {
                    // Update Firestore with the note as a draft
                    // We use the same updateActionData function but it's safe because it merges
                    await updateActionData(sectionIndex, answerIndex, {
                        storeNote: note
                    });
                    // Optional: Show saving indicator or just silent save
                } catch (err) {
                    console.error("Auto-save failed", err);
                }
            }, 2000); // 2 seconds debounce
        }
    };



    const handleSubmitAll = async (skipConfirm = false) => {
        if (!audit) return;

        if (!isOnline) {
            toast.warning("Çevrimdışı moddasınız. Veriler cihazınıza güvenle kaydedildi.", {
                description: "İnternet bağlantısı sağlandığında otomatik olarak gönderilecektir.",
                duration: 5000
            });
            return;
        }

        // Find all pending actions for the store
        const pendingItems = audit.sections.flatMap((section, sIndex) =>
            section.answers
                .map((answer, aIndex) => ({ answer, section, sIndex, aIndex }))
                .filter(item =>
                    item.answer.answer &&
                    item.answer.answer.trim() !== "" &&
                    item.answer.answer !== "muaf" &&
                    (item.answer.earnedPoints || 0) < (item.answer.maxPoints || 0)
                )
        ).filter(item => {
            const status = item.answer.actionData?.status || "pending_store";
            return status === "pending_store" || status === "rejected";
        });

        if (pendingItems.length === 0) {
            toast.info("Gönderilecek aksiyon bulunmamaktadır");
            return;
        }

        // Validate all pending items
        for (const item of pendingItems) {
            const key = `${item.sIndex}-${item.aIndex}`;
            const data = submissionData[key];

            // Check note requirement
            if (!data?.note || !data.note.trim()) {
                toast.error(`"${item.answer.questionText}" maddesi için açıklama girmelisiniz`, { duration: 4000 });
                return;
            }

            // Check photo requirement
            // Fotoğraf zorunlu: "hayır" cevabı VEYA tam puan alınamamışsa (muaf hariç)
            if (item.answer.actionPhotoRequired) {
                const isPhotoNeeded =
                    item.answer.answer === "hayir" ||
                    ((item.answer.earnedPoints || 0) < (item.answer.maxPoints || 0));
                if (isPhotoNeeded && (!data.images || data.images.length === 0)) {
                    toast.error(`"${item.answer.questionText}" maddesi için fotoğraf yüklemelisiniz (Zorunlu)`, { duration: 4000 });
                    return;
                }
            }
        }

        if (!skipConfirm) {
            setPendingCount(pendingItems.length);
            setSubmitConfirmOpen(true);
            return;
        }

        setSubmitting(true);

        try {
            const updatedSections = [...audit.sections];

            // Process each item
            for (const item of pendingItems) {
                const key = `${item.sIndex}-${item.aIndex}`;
                const data = submissionData[key];

                const imageUrls: string[] = [];

                if (data.images && data.images.length > 0) {
                    for (const fileOrUrl of data.images) {
                        // If it's already a string URL (server draft), keep it.
                        if (typeof fileOrUrl === 'string') {
                            imageUrls.push(fileOrUrl);
                        } else {
                            // If it's a File, upload it (though we plan to upload on select, legacy submit logic is here for safety or mixed mode)
                            // Ideally we shouldn't have Files here if we uploaded them on select, but during migration or mixed usage we might.
                            // However, we are moving to "Upload Immediately".
                            // For now, let's keep upload logic for Files.

                            const file = fileOrUrl;
                            // Generate unique filename
                            const uniqueName = `store_action_${auditId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
                            const storageRef = ref(storage, `actions/${auditId}/${uniqueName}`);
                            const uploadResult = await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(uploadResult.ref);
                            imageUrls.push(url);
                        }
                    }
                }

                updatedSections[item.sIndex].answers[item.aIndex].actionData = {
                    ...updatedSections[item.sIndex].answers[item.aIndex].actionData!,
                    status: "pending_admin" as const,
                    submittedAt: Timestamp.now(),
                    // Update note timestamp if note changed or never set
                    ...(data.note ? { noteUpdatedAt: Timestamp.now() } : {}),
                    storeImages: imageUrls,
                    storeNote: data.note || ""
                };
            }

            const submitTimer = Logger.startTimer("action", "Store submitted action response", {
                auditId: auditId,
                actionCount: pendingItems.length
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now()
            });

            // Log successful submission with duration
            submitTimer.stop();

            toast.success("Aksiyon planı başarıyla kaydedildi.");
            setAudit({ ...audit, sections: updatedSections });
            setSubmissionData({}); // Clear form data

            // Clear offline storage drafts for these items
            for (const item of pendingItems) {
                // Clear note
                const noteId = getStoreNoteId(auditId, item.sIndex, item.aIndex);
                await deletePendingNote(noteId);

                // Clear images
                // We need to fetch images from storage to know IDs or we can just try to delete all draft images for this audit
                // Simplest is to iterate the submitted files and delete their offline counterparts
                const key = `${item.sIndex}-${item.aIndex}`;
                const data = submissionData[key];
                if (data.images) {
                    for (const file of data.images) {
                        const offlineId = (file as any).offlineId;
                        if (offlineId) {
                            await deletePendingImage(offlineId);
                        }
                    }
                }
            }

            toast.success("Tüm dönüşler başarıyla iletildi");

            // Invalidate store data cache so the store panel shows updated status
            invalidateStoreDataCache();

            window.scrollTo(0, 0);

        } catch (error) {
            console.error("Error submitting actions:", error);
            toast.error("Gönderim sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdminReject = async () => {
        if (!selectedAction || !rejectionReason.trim() || !audit) return;

        setSubmitting(true);
        try {
            const { sectionIndex, answerIndex } = selectedAction;
            const updatedSections = [...audit.sections];
            const actionData = updatedSections[sectionIndex].answers[answerIndex].actionData!;

            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...actionData,
                status: "rejected" as const,
                adminNote: rejectionReason,
                rejectedAt: Timestamp.now(),
                // Keep store note/images so they can see what they sent
            };

            // Check if there are any unresolved actions - if we're rejecting an approved action, set allActionsResolved to false
            let hasUnresolvedActions = false;
            updatedSections.forEach(section => {
                section.answers.forEach(a => {
                    const isActionNeeded = a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints);
                    if (isActionNeeded) {
                        const status = a.actionData?.status || "pending_store";
                        if (status !== "approved") {
                            hasUnresolvedActions = true;
                        }
                    }
                });
            });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now(),
                ...(hasUnresolvedActions ? { allActionsResolved: false } : {})
            });

            setAudit({
                ...audit,
                sections: updatedSections,
                ...(hasUnresolvedActions ? { allActionsResolved: false } : {})
            });
            // Send Notification to Store Users
            try {
                if (audit.storeId) {
                    const usersRef = collection(db, "users");
                    const q = query(usersRef, where("storeId", "==", audit.storeId));
                    const snapshot = await getDocs(q);
                    const targetUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                    if (targetUsers.length > 0) {
                        const notificationsRef = collection(db, "notifications");
                        const questionText = ((updatedSections[sectionIndex].answers[answerIndex] as any).questionText || "").substring(0, 50) + "...";
                        const notifTitle = "Aksiyon Reddedildi - Düzeltme Gerekli";

                        // Format date for clarity
                        const auditDate = audit.startedAt ? formatDate(audit.startedAt) : "";
                        const auditInfo = audit.storeName ? `${audit.storeName} - ${auditDate}` : auditDate;

                        const notifMessage = `${auditInfo} denetimindeki "${questionText}" sorusuna verdiğiniz yanıt reddedildi.\n\nRed Nedeni: ${rejectionReason}\n\nLütfen düzeltici aksiyonunuzu güncelleyiniz.`;

                        const senderName = userProfile
                            ? (userProfile.firstName && userProfile.lastName
                                ? `${userProfile.firstName} ${userProfile.lastName}`
                                : userProfile.displayName)
                            : "Admin";

                        const batchPromises = targetUsers.map(user => {
                            return addDoc(notificationsRef, {
                                userId: user.id,
                                type: "rejected_action", // Specific type for styling/logic if needed
                                title: notifTitle,
                                message: notifMessage,
                                senderName: senderName,
                                read: false,
                                createdAt: Timestamp.now(),
                                auditId: auditId,
                                link: `/audits/${auditId}/actions#action-${sectionIndex}-${answerIndex}`
                            });
                        });

                        await Promise.all(batchPromises);

                        // Trigger Push API
                        // We don't await this to keep UI responsive, or we await safely
                        fetch("/api/send-notification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                title: notifTitle,
                                message: notifMessage,
                                userIds: targetUsers.map(u => u.id),
                                url: `/audits/${auditId}/actions#action-${sectionIndex}-${answerIndex}`
                            })
                        }).catch(err => console.error("Push API Error:", err));
                    }
                }
            } catch (notifError) {
                console.error("Notification trigger failed:", notifError);
            }

            // Log rejection
            Logger.warn("admin", "Admin rejected action", {
                auditId: auditId,
                section: selectedAction.sectionIndex,
                answer: selectedAction.answerIndex,
                reason: rejectionReason
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            toast.success("Aksiyon reddedildi ve mağazaya bildirim gönderildi");
            setRejectDialogOpen(false);
            setRejectionReason("");
            setSelectedAction(null);

        } catch (error) {
            console.error("Error rejecting action:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevertRejection = async () => {
        if (!audit || !selectedAction) return;

        setSubmitting(true);
        try {
            const { sectionIndex, answerIndex } = selectedAction;
            const updatedSections = [...audit.sections];
            const currentActionData = updatedSections[sectionIndex].answers[answerIndex].actionData!;

            // Remove adminNote and rejectedAt by reconstructing object
            const { adminNote, rejectedAt, ...rest } = currentActionData;
            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...rest,
                status: "pending_admin" as const,
            };

            // Calculate allActionsResolved
            const allResolved = updatedSections.every(section =>
                section.answers.every(a => {
                    const isActionNeeded = a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints);
                    if (!isActionNeeded) return true;
                    return a.actionData?.status === "approved";
                })
            );

            const revertTimer = Logger.startTimer("admin", "Admin reverted action rejection", {
                auditId: auditId,
                section: selectedAction.sectionIndex,
                answer: selectedAction.answerIndex
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now(),
                allActionsResolved: allResolved
            });

            setAudit({
                ...audit,
                sections: updatedSections,
                allActionsResolved: allResolved
            });

            // Log revert rejection with duration
            revertTimer.stop();

            toast.success("Reddetme geri alındı");
            setRevertRejectionDialogOpen(false);
            setSelectedAction(null);

        } catch (error) {
            console.error("Error reverting rejection:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevertApproval = async () => {
        if (!audit || !selectedAction) return;

        setSubmitting(true);
        try {
            const { sectionIndex, answerIndex } = selectedAction;
            const updatedSections = [...audit.sections];
            const currentActionData = updatedSections[sectionIndex].answers[answerIndex].actionData!;

            // Ensure we preserve store data when reverting
            // Only reset status and remove admin approval/rejection metadata
            const { adminNote, approvedAt, rejectedAt, resolvedAt, status, ...rest } = currentActionData;

            updatedSections[sectionIndex].answers[answerIndex].actionData = {
                ...rest,
                status: "pending_admin" as const, // Reset to pending_admin (store already submitted)
            };

            // Calculate allActionsResolved
            const allResolved = updatedSections.every(section =>
                section.answers.every(a => {
                    const isActionNeeded = a.answer === "hayir" || (a.questionType === "checkbox" && a.earnedPoints < a.maxPoints);
                    if (!isActionNeeded) return true;
                    return a.actionData?.status === "approved";
                })
            );

            const revertApprovalTimer = Logger.startTimer("admin", "Admin reverted action approval", {
                auditId: auditId,
                section: selectedAction.sectionIndex,
                answer: selectedAction.answerIndex
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now(),
                allActionsResolved: allResolved
            });

            setAudit({
                ...audit,
                sections: updatedSections,
                allActionsResolved: allResolved
            });

            // Log revert approval with duration
            revertApprovalTimer.stop();

            toast.success("Onay geri alındı - Aksiyon tekrar onay bekliyor");
            setRevertApprovalDialogOpen(false);
            setSelectedAction(null);

        } catch (error) {
            console.error("Error reverting approval:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdminApprove = async (sIndex?: number, aIndex?: number) => {
        // Use args if provided, otherwise fall back to selectedAction state
        const targetSectionIndex = sIndex ?? selectedAction?.sectionIndex;
        const targetAnswerIndex = aIndex ?? selectedAction?.answerIndex;

        if (!audit || targetSectionIndex === undefined || targetAnswerIndex === undefined) return;

        setSubmitting(true);
        try {
            const updatedSections = [...audit.sections];
            updatedSections[targetSectionIndex].answers[targetAnswerIndex].actionData = {
                ...updatedSections[targetSectionIndex].answers[targetAnswerIndex].actionData!,
                status: "approved" as const,
                approvedAt: Timestamp.now(),
                resolvedAt: Timestamp.now(),
            };

            // Check if all actions are resolved
            const allResolved = updatedSections.every(section =>
                section.answers.every(a => {
                    const isActionNeeded = a.answer && a.answer.trim() !== "" && a.answer !== "muaf" && (a.earnedPoints || 0) < (a.maxPoints || 0);
                    if (!isActionNeeded) return true;
                    return a.actionData?.status === "approved";
                })
            );

            const approveTimer = Logger.startTimer("admin", "Admin approved action", {
                auditId: auditId,
                section: targetSectionIndex,
                answer: targetAnswerIndex
            }, { uid: userProfile?.uid || "unknown", role: userProfile?.role });

            await updateDoc(doc(db, "audits", auditId), {
                sections: updatedSections,
                updatedAt: Timestamp.now(),
                allActionsResolved: allResolved
            });

            setAudit({
                ...audit,
                sections: updatedSections,
                allActionsResolved: allResolved
            });

            // Log approval with duration
            approveTimer.stop();

            // toast.success("Aksiyon onaylandı"); // Removed per user request to reduce noise
            setApproveDialogOpen(false);
            setSelectedAction(null);

        } catch (error) {
            console.error("Error approving action:", error);
            toast.error("İşlem sırasında hata oluştu");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: ActionDataStatus) => {
        switch (status) {
            case "pending_store":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Mağaza Cevabı Bekleniyor</Badge>;
            case "pending_admin":
                return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Yönetici Onayı Bekleniyor</Badge>;
            case "approved":
                return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Onaylandı</Badge>;
            case "rejected":
                return <Badge variant="destructive">Reddedildi - Tekrar gönderim gerekli</Badge>;
            default:
                return null;
        }
    };

    const handleDownloadPDF = async () => {
        if (!audit) return;
        setIsDownloading(true);
        try {
            const fontBase64 = await ensureRoboto(robotoFont).catch(() => null);

            // Filter data logic (all questions)
            const filteredData = audit.sections.map(section => {
                const answers = section.answers.filter(a => {
                    return a.answer && a.answer.trim() !== "" && a.answer !== "muaf";
                });
                return { ...section, answers };
            }).filter(section => section.answers.length > 0);

            // Preload photos
            const photoMap: Record<string, string> = {};
            const allPhotos: string[] = [];
            filteredData.forEach(section => {
                section.answers.forEach(a => {
                    if (a.photos && a.photos.length > 0) {
                        a.photos.forEach(p => {
                            if (p && !allPhotos.includes(p)) {
                                allPhotos.push(p);
                            }
                        });
                    }
                });
            });



            const photoPromises = allPhotos.map(async (url) => {
                try {
                    const b64 = await getBase64FromUrl(url);
                    if (b64) {
                        photoMap[url] = b64;
                    }
                } catch (err) {
                    // Ignore failures
                }
            });

            await Promise.all(photoPromises);

            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF('p', 'mm', 'a4');

            if (fontBase64) {
                doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
                (doc as any).addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');
                (doc as any).addFont('Roboto-Regular.ttf', 'Roboto', 'bold', 'Identity-H');
                doc.setFont('Roboto', 'normal');
            }

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPos = 20;

            // Store Name
            doc.setFontSize(16);
            const storeName = (audit.storeName || 'MAĞAZA').toLocaleUpperCase('tr-TR');
            doc.text(storeName, 14, yPos);
            yPos += 15;

            // Info Table
            const weekNum = audit.startedAt ? getWeekNumber(parseDate(audit.startedAt) || new Date()) : '-';

            autoTable(doc, {
                startY: yPos,
                body: [
                    ['MAĞAZA ADI', (audit.storeName || '-').toLocaleUpperCase('tr-TR'), 'DENETMEN', (auditorDisplayName || '-').toLocaleUpperCase('tr-TR')],
                    ['İLGİLİ HAFTA', weekNum !== '-' ? `${weekNum}.HAFTA` : '-', 'PUANI', `${audit.totalScore}`],
                    ['DENETİM TARİHİ', formatDate(audit.startedAt), 'BAŞLANGIÇ VE BİTİŞ SAATİ', `${formatTime(audit.startedAt)} - ${formatTime(audit.completedAt)}`]
                ],
                theme: 'grid',
                styles: {
                    font: fontBase64 ? 'Roboto' : 'helvetica',
                    fontSize: 9,
                    cellPadding: 3,
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { cellWidth: 35, fontStyle: 'bold', fillColor: [243, 244, 246], textColor: [0, 0, 0] },
                    1: { cellWidth: 45, textColor: [0, 0, 0] },
                    2: { cellWidth: 50, fontStyle: 'bold', fillColor: [243, 244, 246], textColor: [0, 0, 0] },
                    3: { cellWidth: 52, textColor: [0, 0, 0] }
                },
                margin: { left: 14, right: 14 }
            });

            yPos = (doc as any).lastAutoTable.finalY + 5;

            // Sections
            for (const section of filteredData) {
                let sectionEarned = 0, sectionMax = 0;
                section.answers.forEach(a => {
                    sectionEarned += a.earnedPoints;
                    sectionMax += a.maxPoints;
                });
                const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                if (yPos > pageHeight - 40) {
                    doc.addPage();
                    yPos = 20;
                }

                // Section Header
                const sectionBoxHeight = 12;
                doc.setFillColor(243, 244, 246);
                doc.setDrawColor(180, 180, 180);
                doc.rect(14, yPos, pageWidth - 28, sectionBoxHeight, 'FD');

                doc.setFontSize(13);
                if (fontBase64) doc.setFont('Roboto', 'bold');
                const sectionNameWidth = doc.getTextWidth(section.sectionName);
                const centerX = 14 + (pageWidth - 28) / 2;
                doc.text(section.sectionName, centerX - sectionNameWidth / 2, yPos + (sectionBoxHeight / 2) + 2);

                doc.setFontSize(16);
                const scoreText = `${sectionScore}`;
                const scoreWidth = doc.getTextWidth(scoreText);
                doc.text(scoreText, pageWidth - 16 - scoreWidth, yPos + (sectionBoxHeight / 2) + 2);

                if (fontBase64) doc.setFont('Roboto', 'normal');
                yPos += sectionBoxHeight;

                const tableBody: any[] = [];

                section.answers.forEach(answer => {
                    let answerCell: any = '';

                    if (answer.questionType === 'yes_no' || !answer.questionType) {
                        answerCell = answer.answer === 'evet' ? 'Evet' : answer.answer === 'hayir' ? 'Hayır' : 'Muaf';
                    } else if (answer.questionType === 'rating') {
                        answerCell = {
                            content: '',
                            styles: { minCellHeight: 10, halign: 'center', valign: 'middle' },
                            raw: { type: 'rating', value: parseInt(answer.answer) || 0 }
                        };
                    } else if (answer.questionType === 'multiple_choice' && answer.options) {
                        const selectedOption = answer.options.find(opt => opt.id === answer.answer);
                        answerCell = selectedOption ? selectedOption.text : '-';
                    } else if (answer.questionType === 'checkbox' && answer.options) {
                        const selectedIds = answer.selectedOptions || [];
                        const uncheckedOpts = answer.options.filter(opt => !selectedIds.includes(opt.id));
                        if (uncheckedOpts.length > 0) {
                            answerCell = 'Eksikler: ' + uncheckedOpts.map(opt => opt.text).join(', ');
                        } else {
                            answerCell = 'Tam Puan';
                        }
                    } else {
                        answerCell = answer.answer || '-';
                    }

                    const notesText = answer.notes && answer.notes.length > 0 && answer.notes.some(n => n.trim())
                        ? answer.notes?.filter(n => n.trim()).map(note => `• ${note}`).join('\n') || '-'
                        : '-';

                    tableBody.push([
                        answer.questionText,
                        answerCell,
                        `${answer.earnedPoints} / ${answer.maxPoints}`,
                        notesText
                    ]);

                    // Photos Row
                    if (answer.photos && answer.photos.length > 0) {
                        const loadedPhotos = answer.photos.filter(p => photoMap[p]);
                        if (loadedPhotos.length > 0) {
                            tableBody.push([{
                                content: `FOTO_ROW:${loadedPhotos.join('|')}`,
                                colSpan: 4,
                                styles: { minCellHeight: 22, fillColor: [255, 255, 255], cellPadding: 0, rowPageBreak: 'avoid' },
                                rowSpan: 1
                            }]);
                        }
                    }
                });

                autoTable(doc, {
                    startY: yPos,
                    head: [['Soru', 'Cevap', 'Puan', 'Notlar']],
                    showHead: 'firstPage',
                    body: tableBody,
                    theme: 'grid',
                    styles: { font: fontBase64 ? 'Roboto' : 'helvetica', fontStyle: 'normal', fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.5 },
                    headStyles: { font: fontBase64 ? 'Roboto' : 'helvetica', fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle', lineColor: [180, 180, 180], lineWidth: 0.5 },
                    bodyStyles: { font: fontBase64 ? 'Roboto' : 'helvetica', fontSize: 8, cellPadding: 3, minCellHeight: 10, valign: 'top', lineColor: [180, 180, 180], lineWidth: 0.5 },
                    columnStyles: {
                        0: { cellWidth: 70, halign: 'left' },
                        1: { cellWidth: 35, halign: 'left' },
                        2: { cellWidth: 25, halign: 'center' },
                        3: { cellWidth: 52, halign: 'left' }
                    },
                    didParseCell: function (data) {
                        if (data.section === 'body' && data.column.index === 0) {
                            const text = data.cell.text[0] || '';
                            if (text.startsWith('FOTO_ROW:')) {
                                data.cell.text = [''];
                                data.cell.styles.fillColor = [255, 255, 255];
                                data.cell.styles.minCellHeight = 22;
                            }
                        }
                        if (data.section === 'body' && data.column.index === 1) {
                            const raw = data.cell.raw as any;
                            if (raw && raw.raw && raw.raw.type === 'rating') {
                                data.cell.text = [''];
                            }
                            const text = data.cell.text[0] || '';
                            if (text === 'Evet' || text === 'Hayır' || text === 'Muaf') {
                                data.cell.styles.halign = 'center';
                                data.cell.styles.valign = 'middle';
                            }
                        }
                        if (data.section === 'body' && data.column.index === 2) {
                            data.cell.styles.valign = 'middle';
                            const text = data.cell.text[0] || '';
                            const [earned, max] = text.split('/').map(s => parseInt(s.trim()));
                            if (!isNaN(earned) && !isNaN(max)) {
                                if (earned < max) {
                                    data.cell.styles.fillColor = [254, 242, 242];
                                    data.cell.styles.textColor = [220, 38, 38];
                                    data.cell.styles.fontStyle = 'bold';
                                } else {
                                    data.cell.styles.fillColor = [240, 253, 244];
                                    data.cell.styles.textColor = [22, 163, 74];
                                    data.cell.styles.fontStyle = 'bold';
                                }
                            }
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.section === 'body' && data.column.index === 1) {
                            const raw = data.cell.raw as any;
                            if (raw && raw.raw && raw.raw.type === 'rating') {
                                const rating = raw.raw.value;
                                const maxRating = 5;
                                const starSize = 3;
                                const totalWidth = (maxRating * starSize) + ((maxRating - 1) * 1);
                                let startX = data.cell.x + (data.cell.width - totalWidth) / 2;
                                const startY = data.cell.y + (data.cell.height - starSize) / 2;

                                for (let i = 0; i < maxRating; i++) {
                                    if (i < rating) {
                                        doc.setFillColor(250, 204, 21);
                                        doc.setDrawColor(250, 204, 21);
                                    } else {
                                        doc.setFillColor(209, 213, 219);
                                        doc.setDrawColor(209, 213, 219);
                                    }
                                    doc.circle(startX + (starSize / 2), startY + (starSize / 2), starSize / 2, 'F');
                                    startX += starSize + 1;
                                }
                            }
                        }

                        if (data.section === 'body' && data.column.index === 0) {
                            const rawText = (data.cell.raw as string);
                            if (typeof rawText === 'string' && rawText.startsWith('FOTO_ROW:')) {
                                const urls = rawText.substring(9).split('|');
                                const cellHeight = data.cell.height;
                                const cellWidth = data.cell.width;
                                const photoSize = 20;
                                const gap = 2;
                                let x = data.cell.x + 2;
                                const y = data.cell.y + (cellHeight - photoSize) / 2;

                                urls.forEach(url => {
                                    const imgData = photoMap[url];
                                    if (imgData && x + photoSize < data.cell.x + cellWidth) {
                                        try {
                                            doc.addImage(imgData, 'JPEG', x, y, photoSize, photoSize);
                                            doc.setDrawColor(200, 200, 200);
                                            doc.setLineWidth(0.1);
                                            doc.rect(x, y, photoSize, photoSize);
                                            x += photoSize + gap;
                                        } catch (e) {
                                            // ignore
                                        }
                                    }
                                });
                            }
                        }
                    }
                });

                yPos = (doc as any).lastAutoTable.finalY + 5;
            }

            const fileName = `${audit.storeName || 'Magaza'} - ${formatDate(audit.startedAt)} Denetim Raporu.pdf`;
            doc.save(fileName);
            toast.success("PDF başarıyla indirildi");

        } catch (error) {
            console.error("PDF download error:", error);
            toast.error("PDF oluşturulurken bir hata oluştu");
        } finally {
            setIsDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <LogoLoader />
            </div>
        );
    }

    if (!audit) {
        return null;
    }

    // Check store permission - only allow stores to view their own audits
    // If we are checking permission (and likely about to redirect), don't render content
    if (userProfile?.role === "magaza") {
        const hasPermission =
            (userProfile.storeId && audit?.storeId && userProfile.storeId === audit.storeId) ||
            (userProfile.storeName && audit?.storeName && userProfile.storeName === audit.storeName);

        if (!hasPermission) return null;
    }



    const isAdmin = userProfile?.role === "admin";
    const isStore = userProfile?.role === "magaza";

    // Flatten actions for easy rendering
    const actions = audit.sections.flatMap((section, sIndex) =>
        section.answers
            .map((answer, aIndex) => ({ answer, section, sIndex, aIndex }))
            .filter(item =>
                // Any point loss is an action (unless exempt)
                item.answer.answer &&
                item.answer.answer.trim() !== "" &&
                item.answer.answer !== "muaf" &&
                (item.answer.earnedPoints || 0) < (item.answer.maxPoints || 0)
            )
    );

    const isRegionalManager = userProfile?.role === 'bolge-muduru';



    return (
        <ProtectedRoute allowedRoles={["admin", "magaza", "bolge-muduru"]}>
            <ActionPageLayout role={userProfile?.role}>
                <div className="container mx-auto py-3 px-4 md:px-6">
                    <div className="mb-6">
                        <div className="flex justify-between items-start mb-4">
                            <Button
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md shadow-purple-500/20"
                                onClick={() => router.back()}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Geri Dön
                            </Button>


                        </div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Mağaza Dönüşü</h1>
                                <p className="text-muted-foreground mt-1">
                                    {audit.storeName} - {audit.auditTypeName}
                                </p>
                                <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                                    <p>
                                        <span className="font-medium text-foreground">Denetim Tarihi:</span>{" "}
                                        {audit.completedAt
                                            ? audit.completedAt.toDate().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                                            : "-"}
                                    </p>
                                    {(auditorDisplayName || audit.auditorName) && (
                                        <p>
                                            <span className="font-medium text-foreground">Denetmen:</span> {auditorDisplayName || audit.auditorName}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* Deadline Info */}
                            {audit.actionDeadline && (
                                <div className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg border",
                                    (audit.allActionsResolved || Timestamp.now().toMillis() < audit.actionDeadline.toMillis())
                                        ? "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                        : "bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                                )}>
                                    <Clock className="h-5 w-5" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold uppercase opacity-70">Son İşlem Tarihi</span>
                                        <span className="font-medium">
                                            {audit.actionDeadline.toDate().toLocaleDateString("tr-TR", {
                                                day: 'numeric', month: 'long', weekday: 'long'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isStore && actions.filter(a => a.answer.actionData?.status === "rejected").length > 0 && (
                        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            <div className="ml-2">
                                <AlertTitle className="text-red-800 font-bold">Dikkat</AlertTitle>
                                <AlertDescription className="text-red-700">
                                    {(() => {
                                        const rejectedAction = actions.find(a => a.answer.actionData?.status === "rejected");
                                        const date = rejectedAction ? parseDate(rejectedAction.answer.actionData?.submittedAt) : null;
                                        return date ? date.toLocaleDateString("tr-TR") : "Son";
                                    })()} tarihli dönüşte <span className="font-bold">{actions.filter(a => a.answer.actionData?.status === "rejected").length} adet</span> soru dönüşü iptal edildi tekrar dönüş gerekiyor
                                </AlertDescription>
                            </div>
                        </Alert>
                    )}
                    <div className="space-y-6">
                        {actions.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold">Aksiyon Gerektiren Durum Yok</h3>
                                    <p className="text-muted-foreground mt-2">Bu denetimde düzeltici faaliyet gerektiren bir madde bulunmamaktadır.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            actions.map(({ answer, section, sIndex, aIndex }) => {
                                const actionData = answer.actionData;
                                const status = actionData?.status || "pending_store";
                                const isPendingStore = status === "pending_store" || status === "rejected";
                                const isPendingAdmin = status === "pending_admin";
                                const isApproved = status === "approved";

                                const submissionKey = `${sIndex}-${aIndex}`;
                                const currentSubmission = submissionData[submissionKey];

                                return (
                                    <Card
                                        key={submissionKey}
                                        id={`action-${submissionKey}`}
                                        className={cn(
                                            "border-l-4",
                                            isApproved ? "border-l-green-500 bg-green-50/30 dark:bg-green-900/10" :
                                                status === "rejected" ? "border-l-red-500" :
                                                    "border-l-yellow-500"
                                        )}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <div className="flex flex-col items-start gap-2 mb-2">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn("font-bold border px-3 py-1", SECTION_COLORS[sIndex % SECTION_COLORS.length])}
                                                        >
                                                            {section.sectionName}
                                                        </Badge>
                                                        {status === "rejected" ? (
                                                            <Badge variant="destructive" className="whitespace-normal text-left h-auto py-1 px-2 leading-tight">
                                                                Reddedildi - Tekrar gönderim gerekli
                                                            </Badge>
                                                        ) : isApproved ? (
                                                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                Onaylandı
                                                            </Badge>
                                                        ) : (
                                                            status !== "pending_store" && getStatusBadge(status)
                                                        )}
                                                    </div>
                                                    <CardTitle className="text-lg leading-snug">
                                                        {answer.questionText}
                                                    </CardTitle>
                                                    {/* Checkbox soruları için eksik (işaretlenmemiş) maddeleri göster */}
                                                    {answer.questionType === 'checkbox' && answer.options && answer.selectedOptions && (
                                                        <div className="mt-3 text-sm">
                                                            <div className="font-semibold text-red-600 mb-1 flex items-center">
                                                                <XCircle className="h-4 w-4 mr-1" />
                                                                Eksik Maddeler:
                                                            </div>
                                                            <ul className="grid grid-cols-1 gap-2">
                                                                {answer.options
                                                                    .filter(opt => !answer.selectedOptions?.includes(opt.id))
                                                                    .map(opt => (
                                                                        <li key={opt.id} className="flex items-start text-muted-foreground bg-slate-50 p-2 rounded border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 mr-2 shrink-0" />
                                                                            {opt.text}
                                                                        </li>
                                                                    ))
                                                                }
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Original Issue */}
                                            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                                                <h4 className="flex items-center gap-2 font-medium text-sm text-foreground/80">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Denetmen Notları
                                                </h4>
                                                {answer.notes && answer.notes.length > 0 && answer.notes[0] && (
                                                    <p className="text-sm italic">"{answer.notes[0]}"</p>
                                                )}
                                                {answer.photos && answer.photos.length > 0 && (
                                                    <div className="flex gap-2 mt-2">
                                                        <ImageGallery
                                                            images={answer.photos}
                                                            auditId={auditId}
                                                            sectionIndex={sIndex}
                                                            answerIndex={aIndex}
                                                            questionText={answer.questionText}
                                                            onImagesChange={() => { }}
                                                            disabled={true}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Admin Rejection Note */}
                                            {status === "rejected" && actionData?.adminNote && (
                                                <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                                                    <h4 className="flex items-center gap-2 font-medium text-red-800 text-sm mb-1">
                                                        <XCircle className="h-4 w-4" />
                                                        Red Nedeni
                                                    </h4>
                                                    <p className="text-sm text-red-700">{actionData.adminNote}</p>
                                                </div>
                                            )}

                                            {/* Store Submission Form */}
                                            {isStore && isPendingStore && (
                                                <div className="space-y-4 border-t pt-4">
                                                    <h4 className="font-medium">Düzeltici Aksiyon Gönder</h4>

                                                    <div className="space-y-2">
                                                        <Label>Açıklama</Label>
                                                        <Textarea
                                                            placeholder="Yapılan düzeltmeleri detaylıca açıklayınız..."
                                                            value={currentSubmission?.note || ""}
                                                            onChange={(e) => handleNoteChange(sIndex, aIndex, e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Conditionally show photo upload only if actionPhotoRequired */}
                                                    {answer.actionPhotoRequired && (
                                                        <div className="space-y-2">
                                                            <Label>
                                                                Fotoğraf Kanıtı
                                                                <Badge variant="destructive" className="ml-2 text-xs">
                                                                    Zorunlu
                                                                </Badge>
                                                            </Label>
                                                            <div className="flex items-center gap-4">
                                                                <Input
                                                                    id={`file-${submissionKey}`}
                                                                    type="file"
                                                                    accept="image/*"
                                                                    multiple
                                                                    className="hidden"
                                                                    onChange={(e) => handleFileSelect(sIndex, aIndex, e)}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="w-full h-32 border-dashed border-2 flex flex-col gap-3 hover:bg-muted/50 transition-colors"
                                                                    onClick={() => document.getElementById(`file-${submissionKey}`)?.click()}
                                                                >
                                                                    <div className="p-4 bg-background rounded-full shadow-sm">
                                                                        <Camera className="h-6 w-6 text-primary" />
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className="text-sm font-semibold">Fotoğraf Ekle</span>
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            veya sürükleyip bırakın
                                                                        </p>
                                                                    </div>
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {currentSubmission?.images?.map((file, i) => (
                                                                    <Thumbnail
                                                                        key={i}
                                                                        file={file}
                                                                        onRemove={() => handleRemoveFile(sIndex, aIndex, i)}
                                                                        onClick={() => setSelectedImage(file)}
                                                                        isUploading={uploading === submissionKey}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                </div>
                                            )}

                                            {/* Submitted Content (View for Admin or Store waiting) */}
                                            {/* Only show if store has actually submitted (not just typed but not submitted) */}
                                            {actionData && status !== "pending_store" && status !== "rejected" && (
                                                <div className="space-y-4 border-t pt-4">
                                                    <h4 className="font-medium flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                                        Mağaza Cevabı
                                                    </h4>
                                                    <div className="bg-gray-50/80 border p-4 rounded-lg">
                                                        <p className="text-sm whitespace-pre-wrap">{actionData.storeNote}</p>
                                                        {actionData.storeImages && actionData.storeImages.length > 0 && (
                                                            <div className="mt-4">
                                                                <Label className="text-xs text-muted-foreground mb-2 block">Kanıt Fotoğrafları</Label>
                                                                <ImageGallery
                                                                    images={actionData.storeImages}
                                                                    auditId={auditId}
                                                                    sectionIndex={sIndex}
                                                                    answerIndex={aIndex}
                                                                    questionText={answer.questionText}
                                                                    onImagesChange={() => { }}
                                                                    disabled={true}
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="mt-2 text-xs text-muted-foreground text-right">
                                                            {(() => {
                                                                const { photoUploadedAt, noteUpdatedAt, submittedAt, approvedAt, rejectedAt } = actionData || {};

                                                                let dateToUse: any = null;
                                                                let label = "Gönderim";

                                                                // Logic: Specific action dates first, then submission, then general status dates
                                                                if (photoUploadedAt) {
                                                                    dateToUse = photoUploadedAt;
                                                                    label = "Gönderim";
                                                                } else if (noteUpdatedAt) {
                                                                    dateToUse = noteUpdatedAt;
                                                                    label = "Gönderim";
                                                                } else if (submittedAt) {
                                                                    dateToUse = submittedAt;
                                                                    label = "Gönderim";
                                                                } else if (approvedAt && status === "approved") {
                                                                    dateToUse = approvedAt;
                                                                    label = "Onaylanma";
                                                                } else if (rejectedAt && (status as string) === "rejected") {
                                                                    dateToUse = rejectedAt;
                                                                    label = "Reddedilme";
                                                                }

                                                                const finalDate = parseDate(dateToUse);

                                                                if (!finalDate) return "Tarih bilgisi yok";

                                                                return `${label}: ${finalDate.toLocaleString("tr-TR")}`;
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Admin Actions - Only show when store has responded */}
                                            {isAdmin && status !== "pending_store" && (
                                                <div className="flex gap-3 justify-end pt-2 border-t mt-4">
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            status === "rejected"
                                                                ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                : "text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        )}
                                                        onClick={() => {
                                                            if (status === "rejected") {
                                                                setSelectedAction({ sectionIndex: sIndex, answerIndex: aIndex });
                                                                setRevertRejectionDialogOpen(true);
                                                            } else {
                                                                setSelectedAction({ sectionIndex: sIndex, answerIndex: aIndex });
                                                                setRejectDialogOpen(true);
                                                            }
                                                        }}
                                                        disabled={submitting}
                                                    >
                                                        {status === "rejected" ? (
                                                            <>
                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                Reddetmeyi Geri Al
                                                            </>
                                                        ) : (
                                                            "Reddet"
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            status === "approved"
                                                                ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                        )}
                                                        onClick={() => {
                                                            if (status === "approved") {
                                                                setSelectedAction({ sectionIndex: sIndex, answerIndex: aIndex });
                                                                setRevertApprovalDialogOpen(true);
                                                            } else {
                                                                handleAdminApprove(sIndex, aIndex);
                                                            }
                                                        }}
                                                        disabled={submitting || status === "rejected"}
                                                    >
                                                        {status === "approved" ? (
                                                            <>
                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                Onayı Geri Al
                                                            </>
                                                        ) : (
                                                            "Onayla"
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                        {/* Bulk Submit Button */}
                        {isStore && actions.some(a => ["pending_store", "rejected"].includes(a.answer.actionData?.status || "pending_store")) && (
                            <div className="flex justify-end pt-8 border-t mt-4">
                                <Button
                                    size="lg"
                                    onClick={() => handleSubmitAll()}
                                    disabled={submitting || !isOnline}
                                    className="w-full md:w-auto text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl transition-all disabled:from-gray-400 disabled:to-gray-500"
                                >
                                    {submitting ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : !isOnline ? (
                                        <XCircle className="mr-2 h-5 w-5" />
                                    ) : (
                                        <Send className="mr-2 h-5 w-5" />
                                    )}
                                    {!isOnline ? "Offline - Tamamlanamaz" : "Tüm Dönüşleri Onaya Gönder"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rejection Dialog */}
                <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Aksiyonu Reddet</DialogTitle>
                            <DialogDescription>
                                Lütfen ret nedenini belirtiniz. Bu not mağazaya iletilecektir.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <Label>Ret Nedeni</Label>
                            <Textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Örn: Fotoğraflar net değil, onarım tam görünmüyor..."
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>İptal</Button>
                            <Button
                                variant="destructive"
                                onClick={handleAdminReject}
                                disabled={!rejectionReason.trim() || submitting}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reddet ve Gönder"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Approve AlertDialog (Reserved for bulk or revert scenarios if needed, currently direct approve used) */}
                <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Aksiyonu Onayla</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu aksiyonu onaylamak istediğinize emin misiniz?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleAdminApprove()}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Onayla
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Revert Rejection AlertDialog */}
                <AlertDialog open={revertRejectionDialogOpen} onOpenChange={setRevertRejectionDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reddetmeyi Geri Al</AlertDialogTitle>
                            <AlertDialogDescription>
                                Reddetmeyi geri almak istediğinize emin misiniz? Aksiyon tekrar onay bekliyor durumuna geçecek.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRevertRejection}
                                disabled={submitting}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Geri Al
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Revert Approval AlertDialog */}
                <AlertDialog open={revertApprovalDialogOpen} onOpenChange={setRevertApprovalDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Onayı Geri Al</AlertDialogTitle>
                            <AlertDialogDescription>
                                Onayı geri almak istediğinize emin misiniz? Aksiyon mağazaya geri gönderilecek ve tekrar düzeltme yapabilecekler.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRevertApproval}
                                disabled={submitting}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Onayı Geri Al
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Store Submit All Confirmation Dialog */}
                <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tümünü Gönder</AlertDialogTitle>
                            <AlertDialogDescription>
                                {pendingCount} adet aksiyon dönüşü onaya gönderilecek. Emin misiniz?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleSubmitAll(true)}
                                disabled={submitting}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Evet, Gönder
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>


                {/* Lightbox for Store Uploads */}
                {selectedImage && (
                    <Lightbox
                        file={selectedImage}
                        onClose={() => setSelectedImage(null)}
                    />
                )}
            </ActionPageLayout>

        </ProtectedRoute >
    );
}

function Thumbnail({ file, onRemove, onClick, isUploading }: { file: File | string, onRemove: () => void, onClick: () => void, isUploading?: boolean }) {
    const [preview, setPreview] = useState<string>("");

    useEffect(() => {
        if (typeof file === 'string') {
            setPreview(file);
        } else {
            const url = URL.createObjectURL(file);
            setPreview(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    if (!preview) return <div className="h-24 w-24 flex items-center justify-center border rounded-lg bg-muted text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;

    const isUploaded = typeof file === 'string';
    const isFileUploading = typeof file !== 'string' && isUploading;

    return (
        <div className="relative group h-24 w-24 shrink-0 overflow-hidden rounded-lg">
            <img
                src={preview}
                alt={typeof file === 'string' ? "Görüntü" : file.name}
                className="h-full w-full object-cover border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={onClick}
            />
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-20"
            >
                <X className="h-3 w-3" />
            </button>

            {/* Status Badges */}
            {isUploaded && (
                <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 py-1 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-white leading-none">YÜKLENDİ</span>
                </div>
            )}

            {isFileUploading && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <Loader2 className="h-5 w-5 text-white animate-spin mb-1" />
                    <span className="text-[10px] font-bold text-white">YÜKLENİYOR</span>
                </div>
            )}

            {!isUploaded && !isFileUploading && (
                <div className="absolute bottom-0 left-0 right-0 bg-gray-500/90 py-1 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-white leading-none">SIRADA</span>
                </div>
            )}
        </div>
    );
}

function Lightbox({ file, onClose }: { file: File | string, onClose: () => void }) {
    const [preview, setPreview] = useState<string>("");

    useEffect(() => {
        if (typeof file === 'string') {
            setPreview(file);
        } else {
            const url = URL.createObjectURL(file);
            setPreview(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    if (!preview) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
            >
                <X className="h-6 w-6" />
            </button>
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center p-4">
                <img
                    src={preview}
                    alt="Lightbox Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>
    );
}

// Helper functions for PDF Generation
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatTime(timestamp: any): string {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp or Date object
    const date = timestamp && typeof timestamp.toDate === 'function'
        ? timestamp.toDate()
        : (timestamp instanceof Date ? timestamp : new Date(timestamp));

    // Check if valid date
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp or Date object
    const date = timestamp && typeof timestamp.toDate === 'function'
        ? timestamp.toDate()
        : (timestamp instanceof Date ? timestamp : new Date(timestamp));

    // Check if valid date
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('tr-TR');
}

const ensureRoboto = async (existingFont: string | null) => {
    if (existingFont) return existingFont;
    try {
        const res = await fetch('/fonts/Roboto-Regular.ttf');
        const blob = await res.blob();
        const reader = new FileReader();
        return await new Promise<string>((resolve, reject) => {
            reader.onload = e => {
                const b64 = (e.target?.result as string)?.split(',')[1];
                b64 ? resolve(b64) : reject('font load fail');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
};

const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.includes('firebasestorage.googleapis.com')) {
        try {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) return '';
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result && result.startsWith('data:image') ? result : '');
                };
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
            });
        } catch {
            return '';
        }
    }

    try {
        const response = await fetch(url, { mode: 'cors', cache: 'no-cache', credentials: 'omit' });
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result && result.startsWith('data:image') ? result : '');
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    } catch {
        return '';
    }
};
