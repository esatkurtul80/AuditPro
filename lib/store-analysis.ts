import { collection, query, where, getDocs, orderBy, limit, Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Audit, AuditAnswer, Store } from "@/lib/types";
import { differenceInDays } from "date-fns";

export interface RecurringIssueHistoryItem {
    auditId: string;
    auditDate: Date | null;
    auditorName: string;
    answer: string;
    notes: string[];
    photos: string[];
    // Store Action Data
    actionStatus?: string;
    storeNote?: string;
    storeImages?: string[];
    adminNote?: string;
}

export interface RecurringIssue {
    questionId: string;
    questionText: string;
    failCount: number;
    sectionName?: string;
    history: RecurringIssueHistoryItem[];
}

export interface StoreAnalysisData {
    store: Store | null;
    regionalManagerName?: string | null;
    lastAuditDate: Date | null;
    daysSinceLastAudit: number | null;
    lastScore: number | null;
    auditHistory: Audit[];
    recurringIssues: RecurringIssue[];
}

/**
 * Checks if an answer is considered a failure (incomplete points or "Hayır")
 */
function isFailure(answer: AuditAnswer): boolean {
    if (answer.questionType === 'yes_no' || !answer.questionType) {
        return answer.answer === 'hayir';
    }
    return answer.earnedPoints < answer.maxPoints;
}

/**
 * Identify recurring issues from a list of audits.
 * A recurring issue is defined as a question that has been failed in the 
 * latest audit AND the one before it (consecutive failures).
 */
function identifyRecurringIssues(audits: Audit[]): RecurringIssue[] {
    if (audits.length < 2) return [];

    const latestAudit = audits[0];
    const recurringIssues: RecurringIssue[] = [];

    // Map all answers in the latest audit
    latestAudit.sections.forEach(section => {
        section.answers.forEach(answer => {
            if (isFailure(answer)) {
                // Check previous audits for consecutive failures
                const history: RecurringIssueHistoryItem[] = [];
                
                // Add current (latest) audit to history
                history.push({
                    auditId: latestAudit.id,
                    auditDate: latestAudit.completedAt ? latestAudit.completedAt.toDate() : null,
                    auditorName: latestAudit.auditorName,
                    answer: answer.answer,
                    notes: answer.notes || [],
                    photos: answer.photos || [],
                    actionStatus: answer.actionData?.status,
                    storeNote: answer.actionData?.storeNote,
                    storeImages: answer.actionData?.storeImages,
                    adminNote: answer.actionData?.adminNote
                });

                let consecutiveCount = 1;
                
                // Look back at previous audits
                for (let i = 1; i < audits.length; i++) {
                    const prevAudit = audits[i];
                    let foundChoice = false;
                    
                    // Find the same question in previous audit
                    for (const prevSection of prevAudit.sections) {
                        const prevAnswer = prevSection.answers.find(a => a.questionId === answer.questionId);
                        if (prevAnswer) {
                            foundChoice = true;
                            if (isFailure(prevAnswer)) {
                                consecutiveCount++;
                                // Add historical failure to history list
                                history.push({
                                    auditId: prevAudit.id,
                                    auditDate: prevAudit.completedAt ? prevAudit.completedAt.toDate() : null,
                                    auditorName: prevAudit.auditorName,
                                    answer: prevAnswer.answer,
                                    notes: prevAnswer.notes || [],
                                    photos: prevAnswer.photos || [],
                                    actionStatus: prevAnswer.actionData?.status,
                                    storeNote: prevAnswer.actionData?.storeNote,
                                    storeImages: prevAnswer.actionData?.storeImages,
                                    adminNote: prevAnswer.actionData?.adminNote
                                });
                            } else {
                                // Broken streak
                                foundChoice = false; 
                            }
                            break;
                        }
                    }
                    
                    if (!foundChoice || !consecutiveCount || consecutiveCount <= i) {
                        break; 
                    }
                }

                if (consecutiveCount >= 2) {
                    recurringIssues.push({
                        questionId: answer.questionId,
                        questionText: answer.questionText,
                        failCount: consecutiveCount,
                        sectionName: section.sectionName,
                        history: history
                    });
                }
            }
        });
    });

    return recurringIssues;
}

export async function getStoreAnalysis(storeId: string): Promise<StoreAnalysisData> {
    try {
        // 1. Fetch Store Details
        const storeDoc = await getDoc(doc(db, "stores", storeId));
        const store = storeDoc.exists() ? { id: storeDoc.id, ...storeDoc.data() } as Store : null;

        // 1.5 Fetch Regional Manager Name if exists
        let regionalManagerName = null;
        if (store?.regionalManagerId) {
            const userDoc = await getDoc(doc(db, "users", store.regionalManagerId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                regionalManagerName = fullName || userData.displayName || "-";
            }
        }

        // 2. Fetch Audit History (Last 10 Completed)
        const historyQuery = query(
            collection(db, "audits"),
            where("storeId", "==", storeId),
            where("status", "==", "tamamlandi"),
            orderBy("completedAt", "desc"),
            limit(10)
        );
        
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as Audit));

        // 3. Calculate Stats
        let lastAuditDate: Date | null = null;
        let daysSinceLastAudit: number | null = null;
        let lastScore: number | null = null;

        if (history.length > 0) {
            const lastAudit = history[0];
            if (lastAudit.completedAt) {
                lastAuditDate = lastAudit.completedAt.toDate();
                daysSinceLastAudit = differenceInDays(new Date(), lastAuditDate);
            }
            lastScore = lastAudit.totalScore;
        }

        // 4. Identify Recurring Issues
        const recurringIssues = identifyRecurringIssues(history);

        return {
            store,
            regionalManagerName, // Add this
            lastAuditDate,
            daysSinceLastAudit,
            lastScore,
            auditHistory: history,
            recurringIssues
        };

    } catch (error) {
        console.error("Error fetching store analysis:", error);
        return {
            store: null,
            regionalManagerName: null,
            lastAuditDate: null,
            daysSinceLastAudit: null,
            lastScore: null,
            auditHistory: [],
            recurringIssues: []
        };
    }
}
