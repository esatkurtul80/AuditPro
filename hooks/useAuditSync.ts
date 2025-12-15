"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import {
    getPendingData,
    markImageAsUploaded,
    markNoteAsSynced,
    markAnswerAsSynced,
    clearSyncedData,
    PendingImage,
    PendingNote,
    PendingAnswer,
} from "@/lib/offline-storage";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc, Timestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { toast } from "sonner";

interface SyncProgress {
    totalImages: number;
    completedImages: number;
    totalNotes: number;
    completedNotes: number;
    totalAnswers: number;
    completedAnswers: number;
}

export function useAuditSync(auditId: string) {
    const isOnline = useOnlineStatus();
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({
        totalImages: 0,
        completedImages: 0,
        totalNotes: 0,
        completedNotes: 0,
        totalAnswers: 0,
        completedAnswers: 0,
    });
    const [hasPending, setHasPending] = useState(false);
    const [syncingImageUrls, setSyncingImageUrls] = useState<string[]>([]);
    const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
    const syncAttempted = useRef(false);
    const syncToastId = useRef<string | number | null>(null);

    // Check for pending data once on mount
    useEffect(() => {
        const checkPending = async () => {
            if (!auditId) return;

            const pendingData = await getPendingData(auditId);
            const pendingCount = pendingData.images.length + pendingData.notes.length + pendingData.answers.length;
            setHasPending(pendingCount > 0);

            if (pendingCount > 0) {
                setSyncProgress({
                    totalImages: pendingData.images.length,
                    completedImages: 0,
                    totalNotes: pendingData.notes.length,
                    completedNotes: 0,
                    totalAnswers: pendingData.answers.length,
                    completedAnswers: 0,
                });
            }
        };

        checkPending();
    }, [auditId]);

    // Sync answer to Firestore
    const syncAnswer = async (answer: PendingAnswer) => {
        try {
            const auditRef = doc(db, "audits", auditId);
            const auditSnap = await getDoc(auditRef);

            if (!auditSnap.exists()) {
                console.error("Audit not found:", auditId);
                return;
            }

            const auditData = auditSnap.data();
            const sections = auditData.sections || [];

            if (sections[answer.sectionIndex] && sections[answer.sectionIndex].answers[answer.answerIndex]) {
                sections[answer.sectionIndex].answers[answer.answerIndex].answer = answer.answer;

                await updateDoc(auditRef, {
                    sections,
                    updatedAt: Timestamp.now(),
                });

                await markAnswerAsSynced(answer.id);
            }
        } catch (error) {
            console.error("Error syncing answer:", error);
            throw error;
        }
    };

    // Sync note to Firestore
    const syncNote = async (note: PendingNote) => {
        try {
            const auditRef = doc(db, "audits", auditId);
            const auditSnap = await getDoc(auditRef);

            if (!auditSnap.exists()) {
                console.error("Audit not found:", auditId);
                return;
            }

            const auditData = auditSnap.data();
            const sections = auditData.sections || [];

            if (sections[note.sectionIndex] && sections[note.sectionIndex].answers[note.answerIndex]) {
                const answer = sections[note.sectionIndex].answers[note.answerIndex];
                answer.notes = answer.notes || [];

                // Update or add note
                if (note.noteIndex < answer.notes.length) {
                    answer.notes[note.noteIndex] = note.noteText;
                } else {
                    answer.notes.push(note.noteText);
                }

                await updateDoc(auditRef, {
                    sections,
                    updatedAt: Timestamp.now(),
                });

                await markNoteAsSynced(note.id);
            }
        } catch (error) {
            console.error("Error syncing note:", error);
            throw error;
        }
    };

    // Upload image to Firebase Storage
    const uploadImage = async (image: PendingImage): Promise<string> => {
        return new Promise((resolve, reject) => {
            const filename = `audits/${auditId}/${Date.now()}_${image.fileName}`;
            const storageRef = ref(storage, filename);
            const uploadTask = uploadBytesResumable(storageRef, image.blob);

            uploadTask.on(
                'state_changed',
                null,
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                }
            );
        });
    };

    // Sync image: upload to storage and update Firestore
    const syncImage = async (image: PendingImage) => {
        try {
            // Mark as syncing
            const localUrl = `local://${image.id}`;
            setSyncingImageUrls(prev => [...prev, localUrl]);

            // Upload to storage
            const firebaseUrl = await uploadImage(image);

            // Update Firestore
            const auditRef = doc(db, "audits", auditId);
            const auditSnap = await getDoc(auditRef);

            if (!auditSnap.exists()) {
                console.error("Audit not found:", auditId);
                return;
            }

            const auditData = auditSnap.data();
            const sections = auditData.sections || [];

            if (sections[image.sectionIndex] && sections[image.sectionIndex].answers[image.answerIndex]) {
                const answer = sections[image.sectionIndex].answers[image.answerIndex];
                answer.photos = answer.photos || [];
                answer.photos.push(firebaseUrl);

                await updateDoc(auditRef, {
                    sections,
                    updatedAt: Timestamp.now(),
                });

                await markImageAsUploaded(image.id, firebaseUrl);
            }

            // Mark as uploaded
            setSyncingImageUrls(prev => prev.filter(url => url !== localUrl));
            setUploadedImageUrls(prev => [...prev, firebaseUrl]);
        } catch (error) {
            console.error("Error syncing image:", error);
            throw error;
        }
    };

    // Main sync function
    const syncPendingData = useCallback(async () => {
        if (!auditId || syncing) return;

        setSyncing(true);
        syncAttempted.current = true;

        try {
            const pendingData = await getPendingData(auditId);

            if (pendingData.answers.length === 0 && pendingData.notes.length === 0 && pendingData.images.length === 0) {
                setSyncing(false);
                setHasPending(false);
                return;
            }

            const total = pendingData.images.length + pendingData.notes.length + pendingData.answers.length;

            // Show sync progress toast
            syncToastId.current = toast.loading(
                `Senkronize ediliyor... (0/${total})`,
                {
                    description: `${pendingData.images.length} fotoğraf, ${pendingData.notes.length} not, ${pendingData.answers.length} cevap`,
                }
            );

            setSyncProgress({
                totalImages: pendingData.images.length,
                completedImages: 0,
                totalNotes: pendingData.notes.length,
                completedNotes: 0,
                totalAnswers: pendingData.answers.length,
                completedAnswers: 0,
            });

            let completed = 0;

            // 1. Sync answers first
            for (const answer of pendingData.answers) {
                await syncAnswer(answer);
                completed++;
                setSyncProgress(prev => ({ ...prev, completedAnswers: prev.completedAnswers + 1 }));

                // Update toast progress
                if (syncToastId.current) {
                    toast.loading(
                        `Senkronize ediliyor... (${completed}/${total})`,
                        { id: syncToastId.current, description: `${pendingData.images.length} fotoğraf, ${pendingData.notes.length} not, ${pendingData.answers.length} cevap` }
                    );
                }
            }

            // 2. Sync notes
            for (const note of pendingData.notes) {
                await syncNote(note);
                completed++;
                setSyncProgress(prev => ({ ...prev, completedNotes: prev.completedNotes + 1 }));

                if (syncToastId.current) {
                    toast.loading(
                        `Senkronize ediliyor... (${completed}/${total})`,
                        { id: syncToastId.current, description: `${pendingData.images.length} fotoğraf, ${pendingData.notes.length} not, ${pendingData.answers.length} cevap` }
                    );
                }
            }

            // 3. Sync images (takes longer)
            for (const image of pendingData.images) {
                await syncImage(image);
                completed++;
                setSyncProgress(prev => ({ ...prev, completedImages: prev.completedImages + 1 }));

                if (syncToastId.current) {
                    toast.loading(
                        `Senkronize ediliyor... (${completed}/${total})`,
                        { id: syncToastId.current, description: `${pendingData.images.length} fotoğraf, ${pendingData.notes.length} not, ${pendingData.answers.length} cevap` }
                    );
                }
            }

            // Clean up synced data
            await clearSyncedData(auditId);

            // Clear uploaded badges after 2 seconds
            setTimeout(() => {
                setUploadedImageUrls([]);
            }, 2000);

            setHasPending(false);

            // Show success toast
            if (syncToastId.current) {
                toast.success(
                    "Senkronize tamamlandı",
                    {
                        id: syncToastId.current,
                        description: `${pendingData.images.length} fotoğraf, ${pendingData.notes.length} not, ${pendingData.answers.length} cevap başarıyla yüklendi`
                    }
                );
                syncToastId.current = null;
            }
        } catch (error) {
            console.error("Sync error:", error);

            if (syncToastId.current) {
                toast.error("Senkronizasyon hatası", { id: syncToastId.current });
                syncToastId.current = null;
            } else {
                toast.error("Senkronizasyon hatası. Tekrar deneyin.");
            }
        } finally {
            setSyncing(false);
        }
    }, [auditId, syncing]);

    // Auto-sync when online - check immediately when comes online
    useEffect(() => {
        if (isOnline) {
            // Re-check pending every time we go online
            const recheckAndSync = async () => {
                // Guard against concurrent sync attempts
                if (syncing) {
                    console.log('[useAuditSync] Sync already in progress, skipping');
                    return;
                }

                const pendingData = await getPendingData(auditId);
                const count = pendingData.images.length + pendingData.notes.length + pendingData.answers.length;

                if (count > 0) {
                    setHasPending(true);
                    syncPendingData();
                } else {
                    setHasPending(false);
                }
            };

            recheckAndSync();
        }
    }, [isOnline, syncPendingData, auditId]); // Removed syncing from deps

    return {
        syncing,
        syncProgress,
        hasPending,
        syncNow: syncPendingData,
        syncingImageUrls,
        uploadedImageUrls,
    };
}
