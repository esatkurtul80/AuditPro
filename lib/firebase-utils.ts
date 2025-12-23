import {
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Audit, DashboardStats, DateRangeFilter } from "./types";

/**
 * Soft delete an audit (mark as deleted)
 */
export const softDeleteAudit = async (auditId: string): Promise<void> => {
    const auditRef = doc(db, "audits", auditId);
    await updateDoc(auditRef, {
        isDeleted: true,
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

/**
 * Restore a soft-deleted audit
 */
export const restoreAudit = async (auditId: string): Promise<void> => {
    const auditRef = doc(db, "audits", auditId);
    await updateDoc(auditRef, {
        isDeleted: false,
        deletedAt: null,
        updatedAt: Timestamp.now(),
    });
};

/**
 * Permanently delete an audit and all related data
 * - Deletes photos from Firebase Storage
 * - Deletes related actions
 * - Deletes the audit document
 */
export const permanentlyDeleteAudit = async (auditId: string): Promise<void> => {
    // Get audit data
    const auditRef = doc(db, "audits", auditId);
    const auditSnap = await getDoc(auditRef);

    if (!auditSnap.exists()) {
        // Audit already deleted, return successfully (idempotent operation)
        console.log(`Audit ${auditId} already deleted`);
        return;
    }

    const audit = { id: auditSnap.id, ...auditSnap.data() } as Audit;

    // Delete photos from Firebase Storage
    const { getStorage, ref: storageRef, deleteObject } = await import("firebase/storage");
    const storage = getStorage();

    if (audit.sections) {
        for (const section of audit.sections) {
            if (section.answers) {
                for (const answer of section.answers) {
                    if (answer.photos && answer.photos.length > 0) {
                        for (const photoUrl of answer.photos) {
                            try {
                                // Extract path from URL and delete
                                const photoRef = storageRef(storage, photoUrl);
                                await deleteObject(photoRef);
                            } catch (error) {
                                console.error(`Error deleting photo: ${photoUrl}`, error);
                                // Continue deleting other photos even if one fails
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete related actions
    const actionsQuery = query(
        collection(db, "actions"),
        where("auditId", "==", auditId)
    );
    const actionsSnapshot = await getDocs(actionsQuery);
    for (const actionDoc of actionsSnapshot.docs) {
        await deleteDoc(actionDoc.ref);
    }

    // Delete the audit document
    await deleteDoc(auditRef);
};

/**
 * Cancel an in-progress audit and delete all related data
 * - Clears offline storage (images, notes, answers)
 * - Deletes photos from Firebase Storage
 * - Deletes related actions
 * - Deletes the audit document
 */
export const cancelAudit = async (auditId: string): Promise<void> => {
    // First clear offline storage
    const { clearAllAuditData } = await import("@/lib/offline-storage");
    await clearAllAuditData(auditId);

    // Cancel the audit by updating status (don't delete)
    const auditRef = doc(db, "audits", auditId);
    await updateDoc(auditRef, {
        status: "iptal_edildi",
        cancelledAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

/**
 * Get dashboard statistics
 * @param userId User ID
 * @param dateRange Optional date range filter
 */
export const getDashboardStats = async (
    userId: string,
    dateRange?: DateRangeFilter
): Promise<DashboardStats> => {
    try {
        // Get total users count
        const usersSnapshot = await getDocs(collection(db, "users"));
        const totalUsers = usersSnapshot.size;

        // Get total stores count
        const storesSnapshot = await getDocs(collection(db, "stores"));
        const totalStores = storesSnapshot.size;

        // Build audits query
        let auditsQuery = query(
            collection(db, "audits"),
            where("auditorId", "==", userId),
            where("isDeleted", "!=", true)
        );

        // Note: Firestore doesn't support multiple inequality filters
        // We'll filter by date in memory if needed
        const auditsSnapshot = await getDocs(auditsQuery);
        let audits = auditsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Audit[];

        // Apply date range filter in memory
        if (dateRange?.from || dateRange?.to) {
            audits = audits.filter((audit) => {
                const auditDate = audit.createdAt.toDate();
                if (dateRange.from && auditDate < dateRange.from) return false;
                if (dateRange.to && auditDate > dateRange.to) return false;
                return true;
            });
        }

        const totalAudits = audits.length;
        const ongoingAudits = audits.filter((a) => a.status === "devam_ediyor").length;
        const completedAudits = audits.filter((a) => a.status === "tamamlandi").length;

        // TODO: Get actions count when actions collection is implemented
        // For now, return 0
        const pendingActions = 0;
        const completedActions = 0;

        return {
            totalUsers,
            totalStores,
            totalAudits,
            pendingActions,
            completedActions,
            ongoingAudits,
            completedAudits,
        };
    } catch (error) {
        console.error("Error getting dashboard stats:", error);
        throw error;
    }
};
