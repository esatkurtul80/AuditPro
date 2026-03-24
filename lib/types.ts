import { Timestamp } from "firebase/firestore";

// User types
export type UserRole = "admin" | "denetmen" | "magaza" | "bolge-muduru" | "rapor-yoneticisi" | "pending";

export interface UserProfile {
    uid: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    storeId?: string; // Sadece magaza rolü için
    storeName?: string; // Mağaza adı (magaza users için)
    createdAt: Timestamp;
    updatedAt: Timestamp;
    appVersion?: string;
    notificationToken?: string; // Legacy single token
    fcmTokens?: string[]; // Multiple device tokens support
    isOnline?: boolean; // Real-time presence
    lastActive?: Timestamp; // Last activity timestamp
    homeLat?: number; // Auditor home latitude
    homeLng?: number; // Auditor home longitude
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
    actionPhotoRequired?: boolean; // New field for action management

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
    icon?: string;
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
    actionPhotoRequired: boolean;
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

    // Action Management
    actionData?: ActionData;

    // Duration Tracking
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    durationSeconds?: number;
}

export type ActionDataStatus = "pending_store" | "pending_admin" | "approved" | "rejected";

export interface ActionData {
    status: ActionDataStatus;
    storeNote?: string;
    storeImages?: string[];
    submittedAt?: Timestamp;
    photoUploadedAt?: Timestamp;
    noteUpdatedAt?: Timestamp;
    adminNote?: string;
    rejectedAt?: Timestamp;
    approvedAt?: Timestamp;
    resolvedAt?: Timestamp; // When finally approved
}

export interface AuditSection {
    sectionId: string;
    sectionName: string;
    description?: string;
    icon?: string;
    order: number;
    answers: AuditAnswer[];

    // Duration Tracking
    startedAt?: Timestamp;
    completedAt?: Timestamp;

    // Special Report Feedback
    feedback?: {
        note: string;
        images: string[];
        type?: "important" | "note" | "suggestion" | null;
    };
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
    location?: string | null; // "lat,lng" format

    // Action Management
    actionDeadline?: Timestamp;
    allActionsResolved?: boolean;

    // Store Panel specific
    hasActions?: boolean;
    actionStats?: ActionStats;
    score?: number;
    lastSubmittedAt?: Date | any; // Using any to be safe with mixed implementations

    // New Feature: Optional general feedback independent of score
    generalFeedback?: {
        note?: string;
        images?: string[];
        type?: "important" | "note" | "suggestion" | null;
    };

    // Personnel evaluations linked to this audit
    personnelEvaluations?: PersonnelEvaluation[];
}

export interface ActionStats {
    pending_store: number;
    pending_admin: number;
    rejected: number;
    approved: number;
    total: number;
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
export type NotificationType = "action_rejected" | "action_approved" | "new_audit" | "action_correction" | "audit_edited" | "pending_user" | "admin_message" | "rejected_action" | "audit_completed";

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    relatedId?: string; // audit ID, action ID, etc.
    senderName?: string;
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

export interface LeaveType {
    id: string;
    name: string;
    color: string;
    isDefault?: boolean;
    order?: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AccommodationType {
    id: string;
    name: string;
    icon: string;
    order?: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    senderId: string;
    senderName: string;
    recipients: any[]; // RecipientOption[]
    targetType: "all" | "group" | "specific";
    createdAt: Timestamp;
    stats?: { total: number; sent: number };
    read?: boolean; // Client-side prop

    // Server-side read tracking
    readBy?: Array<{
        userId: string;
        userName: string;
        readAt: Timestamp;
    }>;

    labels?: string[];
    isArchived?: boolean;
    isDeleted?: boolean;
}

// Store Personnel Evaluation
export type PersonnelStatus = "active" | "resigned" | "transferred";

export interface StorePersonnel {
    id: string;
    storeId: string;
    name: string;
    status: PersonnelStatus;
    targetStoreId?: string; // If transferred, where did they go?
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface PersonnelEvaluation {
    id: string;
    personnelId: string;
    personnelName: string; // denormalize for easier reporting
    auditId?: string;
    storeId: string;
    storeName: string; // denormalize for easier reporting
    auditorId: string;
    auditorName: string; // denormalize
    score: number; // 0-100
    comment?: string;
    createdAt: Timestamp;
}
