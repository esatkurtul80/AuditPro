// IndexedDB wrapper for offline storage
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PendingImage {
    id: string;
    auditId: string;
    sectionIndex: number;
    answerIndex: number;
    questionText: string;
    blob: Blob;
    fileName: string;
    timestamp: number;
    uploaded: boolean;
    firebaseUrl?: string;
}

interface PendingNote {
    id: string;
    auditId: string;
    sectionIndex: number;
    answerIndex: number;
    noteIndex: number;
    questionText: string;
    noteText: string;
    timestamp: number;
    synced: boolean;
}

interface PendingAnswer {
    id: string;
    auditId: string;
    sectionIndex: number;
    answerIndex: number;
    questionText: string;
    answer: string; // "evet", "hayir", "muaf"
    timestamp: number;
    synced: boolean;
}

export interface PendingPersonnelEval {
    id: string; // Evaluation ID or generated UUID
    auditId: string;
    personnelId: string;
    personnelName: string;
    storeId: string;
    storeName: string;
    auditorId: string;
    auditorName: string;
    score: number;
    comment: string;
    status: string; // The selected status (active, resigned, transferred)
    targetStoreId?: string; // If transferred
    timestamp: number;
    synced: boolean;
}

interface OfflineDB extends DBSchema {
    pendingImages: {
        key: string;
        value: PendingImage;
        indexes: { 'by-audit': string };
    };
    pendingNotes: {
        key: string;
        value: PendingNote;
        indexes: { 'by-audit': string };
    };
    pendingAnswers: {
        key: string;
        value: PendingAnswer;
        indexes: { 'by-audit': string };
    };
    pendingPersonnelEvals: {
        key: string;
        value: PendingPersonnelEval;
        indexes: { 'by-audit': string };
    };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

async function getDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<OfflineDB>('audit-offline-storage', 2, {
        upgrade(db) {
            // Images store
            if (!db.objectStoreNames.contains('pendingImages')) {
                const imageStore = db.createObjectStore('pendingImages', { keyPath: 'id' });
                imageStore.createIndex('by-audit', 'auditId');
            }

            // Notes store
            if (!db.objectStoreNames.contains('pendingNotes')) {
                const noteStore = db.createObjectStore('pendingNotes', { keyPath: 'id' });
                noteStore.createIndex('by-audit', 'auditId');
            }

            // Answers store
            if (!db.objectStoreNames.contains('pendingAnswers')) {
                const answerStore = db.createObjectStore('pendingAnswers', { keyPath: 'id' });
                answerStore.createIndex('by-audit', 'auditId');
            }

            // Personnel Evals store
            if (!db.objectStoreNames.contains('pendingPersonnelEvals')) {
                const personnelEvalsStore = db.createObjectStore('pendingPersonnelEvals', { keyPath: 'id' });
                personnelEvalsStore.createIndex('by-audit', 'auditId');
            }
        },
    });

    return dbInstance;
}

// Image operations
export async function savePendingImage(image: PendingImage) {
    const db = await getDB();
    await db.put('pendingImages', image);
}

export async function getPendingImages(auditId: string): Promise<PendingImage[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingImages', 'by-audit', auditId);
}

export async function markImageAsUploaded(id: string, firebaseUrl: string) {
    const db = await getDB();
    const image = await db.get('pendingImages', id);
    if (image) {
        image.uploaded = true;
        image.firebaseUrl = firebaseUrl;
        await db.put('pendingImages', image);
    }
}

export async function deletePendingImage(id: string) {
    const db = await getDB();
    await db.delete('pendingImages', id);
}

// Note operations
export async function savePendingNote(note: PendingNote) {
    const db = await getDB();
    await db.put('pendingNotes', note);
}

export async function getPendingNotes(auditId: string): Promise<PendingNote[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingNotes', 'by-audit', auditId);
}

export async function markNoteAsSynced(id: string) {
    const db = await getDB();
    const note = await db.get('pendingNotes', id);
    if (note) {
        note.synced = true;
        await db.put('pendingNotes', note);
    }
}

export async function deletePendingNote(id: string) {
    const db = await getDB();
    await db.delete('pendingNotes', id);
}

// Answer operations
export async function savePendingAnswer(answer: PendingAnswer) {
    const db = await getDB();
    await db.put('pendingAnswers', answer);
}

export async function getPendingAnswers(auditId: string): Promise<PendingAnswer[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingAnswers', 'by-audit', auditId);
}

export async function markAnswerAsSynced(id: string) {
    const db = await getDB();
    const answer = await db.get('pendingAnswers', id);
    if (answer) {
        answer.synced = true;
        await db.put('pendingAnswers', answer);
    }
}

export async function deletePendingAnswer(id: string) {
    const db = await getDB();
    await db.delete('pendingAnswers', id);
}

// Personnel Eval operations
export async function savePendingPersonnelEval(evalData: PendingPersonnelEval) {
    const db = await getDB();
    await db.put('pendingPersonnelEvals', evalData);
}

export async function getPendingPersonnelEvals(auditId: string): Promise<PendingPersonnelEval[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingPersonnelEvals', 'by-audit', auditId);
}

export async function markPersonnelEvalAsSynced(id: string) {
    const db = await getDB();
    const evalData = await db.get('pendingPersonnelEvals', id);
    if (evalData) {
        evalData.synced = true;
        await db.put('pendingPersonnelEvals', evalData);
    }
}

export async function deletePendingPersonnelEval(id: string) {
    const db = await getDB();
    await db.delete('pendingPersonnelEvals', id);
}

// Unified operations
export async function getPendingData(auditId: string) {
    const [images, notes, answers, personnelEvals] = await Promise.all([
        getPendingImages(auditId),
        getPendingNotes(auditId),
        getPendingAnswers(auditId),
        getPendingPersonnelEvals(auditId),
    ]);

    return {
        images: images.filter(img => !img.uploaded),
        notes: notes.filter(note => !note.synced),
        answers: answers.filter(ans => !ans.synced),
        personnelEvals: personnelEvals.filter(ev => !ev.synced),
    };
}

export async function getPendingCount(auditId: string) {
    const pending = await getPendingData(auditId);
    return {
        images: pending.images.length,
        notes: pending.notes.length,
        answers: pending.answers.length,
        personnelEvals: pending.personnelEvals.length,
        total: pending.images.length + pending.notes.length + pending.answers.length + pending.personnelEvals.length,
    };
}

export async function clearSyncedData(auditId: string) {
    const db = await getDB();

    // Get all synced items
    const [images, notes, answers, personnelEvals] = await Promise.all([
        getPendingImages(auditId),
        getPendingNotes(auditId),
        getPendingAnswers(auditId),
        getPendingPersonnelEvals(auditId),
    ]);

    // Delete synced items
    const deletePromises = [
        ...images.filter(img => img.uploaded).map(img => db.delete('pendingImages', img.id)),
        ...notes.filter(note => note.synced).map(note => db.delete('pendingNotes', note.id)),
        ...answers.filter(ans => ans.synced).map(ans => db.delete('pendingAnswers', ans.id)),
        ...personnelEvals.filter(ev => ev.synced).map(ev => db.delete('pendingPersonnelEvals', ev.id)),
    ];

    await Promise.all(deletePromises);
}

/**
 * Clear ALL audit data from offline storage (used when canceling an audit)
 * This deletes all images, notes, and answers regardless of sync status
 */
export async function clearAllAuditData(auditId: string) {
    const db = await getDB();

    // Get all items for this audit
    const [images, notes, answers, personnelEvals] = await Promise.all([
        getPendingImages(auditId),
        getPendingNotes(auditId),
        getPendingAnswers(auditId),
        getPendingPersonnelEvals(auditId),
    ]);

    // Delete ALL items (synced or not)
    const deletePromises = [
        ...images.map(img => db.delete('pendingImages', img.id)),
        ...notes.map(note => db.delete('pendingNotes', note.id)),
        ...answers.map(ans => db.delete('pendingAnswers', ans.id)),
        ...personnelEvals.map(ev => db.delete('pendingPersonnelEvals', ev.id)),
    ];

    await Promise.all(deletePromises);
}

// Utility
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export type { PendingImage, PendingNote, PendingAnswer };
