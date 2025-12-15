import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, AuditAnswer } from "@/lib/types";

export interface QuestionHistoryEntry {
    auditId: string;
    auditorName: string;
    completedAt: Timestamp;
    answer: string;
    earnedPoints: number;
    maxPoints: number;
    questionType?: string;
    selectedOptions?: string[];         // For checkbox questions
    options?: Array<{ id: string; text: string; points: number }>;  // For radio/checkbox
    ratingMax?: number;                 // For rating questions
    notes: string[];
    photos: string[];
}

export interface QuestionHistory {
    consecutiveFailCount: number;
    entries: QuestionHistoryEntry[];
}

/**
 * Check if an answer is incomplete (did not receive full points)
 * @param answer - The audit answer to check
 * @returns true if answer is incomplete, false otherwise
 */
function isIncompleteAnswer(answer: AuditAnswer): boolean {
    // 1. Yes/No/Muaf questions: "hayir" is incomplete
    if (answer.questionType === 'yes_no' || !answer.questionType) {
        return answer.answer === 'hayir';
    }

    // 2. Rating questions: incomplete if earnedPoints < maxPoints
    if (answer.questionType === 'rating') {
        return answer.earnedPoints < answer.maxPoints;
    }

    // 3. Multiple choice (radio buttons): incomplete if earnedPoints < maxPoints
    if (answer.questionType === 'multiple_choice') {
        return answer.earnedPoints < answer.maxPoints;
    }

    // 4. Checkbox: incomplete if earnedPoints < maxPoints
    if (answer.questionType === 'checkbox') {
        return answer.earnedPoints < answer.maxPoints;
    }

    // Default: consider as complete
    return false;
}

/**
 * Get previous completed audits for the same store and audit type
 * @param storeId - Store ID
 * @param auditTypeId - Audit Type ID
 * @param currentAuditId - Current audit ID to exclude
 * @returns Array of previous audits, sorted by completion date (newest first)
 */
export async function getPreviousAudits(
    storeId: string,
    auditTypeId: string,
    currentAuditId: string
): Promise<Audit[]> {
    try {
        const auditsQuery = query(
            collection(db, "audits"),
            where("storeId", "==", storeId),
            where("auditTypeId", "==", auditTypeId),
            where("status", "==", "tamamlandi"),
            orderBy("completedAt", "desc"),
            limit(10) // Get last 10 audits for performance
        );

        const auditsSnapshot = await getDocs(auditsQuery);
        const audits = auditsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Audit))
            .filter(audit => audit.id !== currentAuditId); // Exclude current audit

        return audits;
    } catch (error) {
        console.error("Error getting previous audits:", error);
        return [];
    }
}

/**
 * Get history of a specific question across previous audits
 * Only returns consecutive "hayir" answers from the most recent audits
 * @param storeId - Store ID
 * @param auditTypeId - Audit Type ID
 * @param questionId - Question ID to track
 * @param currentAuditId - Current audit ID
 * @returns Question history with consecutive fail count
 */
export async function getQuestionHistory(
    storeId: string,
    auditTypeId: string,
    questionId: string,
    currentAuditId: string
): Promise<QuestionHistory> {
    const previousAudits = await getPreviousAudits(storeId, auditTypeId, currentAuditId);

    const entries: QuestionHistoryEntry[] = [];
    let consecutiveFailCount = 0;

    // Iterate through audits from newest to oldest
    for (const audit of previousAudits) {
        let foundAnswer: AuditAnswer | null = null;

        // Search for the question in all sections
        for (const section of audit.sections) {
            const answer = section.answers.find(a => a.questionId === questionId);
            if (answer) {
                foundAnswer = answer;
                break;
            }
        }

        if (!foundAnswer) {
            // Question not found in this audit, skip
            continue;
        }

        // Check if answer is incomplete (any question type)
        if (isIncompleteAnswer(foundAnswer)) {
            consecutiveFailCount++;
            entries.push({
                auditId: audit.id,
                auditorName: audit.auditorName,
                completedAt: audit.completedAt!,
                answer: foundAnswer.answer,
                earnedPoints: foundAnswer.earnedPoints,
                maxPoints: foundAnswer.maxPoints,
                questionType: foundAnswer.questionType,
                selectedOptions: foundAnswer.selectedOptions,
                options: foundAnswer.options,
                ratingMax: foundAnswer.ratingMax,
                notes: foundAnswer.notes || [],
                photos: foundAnswer.photos || [],
            });
        } else {
            // Found complete answer, stop counting consecutive failures
            break;
        }
    }

    return {
        consecutiveFailCount,
        entries,
    };
}
