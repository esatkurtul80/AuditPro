import { Timestamp } from "firebase/firestore";

// User types
export type UserRole = "admin" | "denetmen" | "magaza" | "bolge-muduru" | "pending";

export interface UserProfile {
    uid: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    storeId?: string; // Sadece magaza rolü için
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Store type
export interface Store {
    id: string;
    name: string;
    location: string;
    manager?: string;
    regionalManagerId?: string; // Bölge müdürü user ID
    city?: string;
    type?: "ŞUBE" | "AVM" | "MİGROS";
    address?: string;
    openingDate?: string; // ISO date string or similar
    ipAddress?: string;
    shipmentDay?: string;
    shipmentTime?: string;
    email?: string;
    phone?: string;
    phoneShortCode?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Question types
export type QuestionType =
    | "yes_no"           // Evet/Hayır/Muaf
    | "multiple_choice"  // Çoktan seçmeli (radio)
    | "checkbox"         // Çoklu seçim
    | "rating"           // Derece (1-5 stars)
    | "number"           // Sayı (bilgi amaçlı)
    | "date"             // Tarih (bilgi amaçlı)
    | "short_text";      // Kısa metin (bilgi amaçlı)

export interface QuestionOption {
    id: string;
    text: string;
    points: number;  // Points for this option
}

// Yeni hiyerarşik yapı
export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    maxPoints: number;           // Auto-calculated for some types
    photoRequired: boolean;

    // Type-specific fields
    options?: QuestionOption[];  // For multiple_choice, checkbox
    ratingMax?: number;          // For rating (e.g., 5 for 5 stars)

    order: number;
}

// Section pool stores references to question IDs
export interface Section {
    id: string;
    name: string;
    description: string;
    order: number;
    questionIds: string[]; // many-to-many relationship
}

// AuditType (form) pool stores references to section IDs
export interface AuditType {
    id: string;
    name: string;
    description: string;
    isScored: boolean;    // If true, questions are scored; if false, informational only
    sectionIds: string[]; // many-to-many relationship
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Audit execution types
export type AnswerStatus = "evet" | "hayir" | "muaf";

export interface AuditAnswer {
    questionId: string;
    questionText: string;
    questionType: QuestionType;
    maxPoints: number;
    originalMaxPoints?: number; // Muaf seçildiğinde orijinal değeri saklamak için
    photoRequired: boolean;
    options?: QuestionOption[];  // For checkbox and multiple_choice questions
    ratingMax?: number;          // For rating questions (e.g., 5 for 1-5 rating)

    // Answer based on type
    // For yes_no: "evet"|"hayir"|"muaf"
    // For multiple_choice: option ID
    // For checkbox: not used (see selectedOptions)
    // For rating: "1"|"2"|"3"|"4"|"5"
    // For number/date/short_text: user input value
    answer: string;
    selectedOptions?: string[];  // For checkbox type

    earnedPoints: number;
    notes: string[];  // Multiple notes can be added for any answer
    photos: string[];
}

export interface AuditSection {
    sectionId: string;
    sectionName: string;
    order: number;
    answers: AuditAnswer[];
}

export type AuditStatus = "devam_ediyor" | "tamamlandi" | "iptal_edildi";

export interface Audit {
    id: string;
    auditTypeId: string;
    auditTypeName: string;
    storeId: string;
    storeName: string;
    auditorId: string;
    auditorName: string;
    status: AuditStatus;
    sections: AuditSection[];
    totalScore: number;
    maxScore: number;
    startedAt: Timestamp;
    completedAt?: Timestamp;
    cancelledAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    isDeleted?: boolean;
    deletedAt?: Timestamp;
}

// Action tracking
export type ActionStatus =
    | "aksiyon_bekleniyor"
    | "onay_bekleniyor"
    | "tamamlandi"
    | "reddedildi";

export interface ActionItem {
    questionId: string;
    questionText: string;
    originalNotes: string;
    originalPhotos: string[];
    correctionNotes?: string;
    correctionPhotos?: string[];
    status: ActionStatus;
    submittedAt?: Timestamp;
    reviewedAt?: Timestamp;
    reviewedBy?: string;
    rejectionReason?: string;
}

// Notification type
export type NotificationType = "action_rejected" | "action_approved" | "new_audit" | "audit_edited" | "pending_user";

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    relatedId?: string; // audit ID, action ID, etc.
    changes?: Array<{
        sectionName: string;
        questionId: string;
        questionText: string;
        oldAnswer: string;
        newAnswer: string;
        oldScore: number;
        newScore: number;
    }>;
    createdAt: Timestamp;
}

// AI Report type
export interface AIReport {
    id: string;
    storeId: string;
    storeName: string;
    startDate: Timestamp;
    endDate: Timestamp;
    report: string;
    createdAt: Timestamp;
}

// Dashboard statistics
export interface DashboardStats {
    totalUsers: number;
    totalStores: number;
    totalAudits: number;
    pendingActions: number;
    completedActions: number;
    ongoingAudits: number;
    completedAudits: number;
}

export interface DateRangeFilter {
    from: Date | undefined;
    to: Date | undefined;
}
