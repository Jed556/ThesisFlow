import type { UserRole } from './profile';

/**
 * Status of a slot increase request
 */
export type SlotRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Default maximum expert slots for new experts
 */
export const DEFAULT_MAX_EXPERT_SLOTS = 5;

/**
 * Firestore document describing a request from a expert to increase their slot limit.
 * Stored in year/{year}/slotRequests/{requestId}
 */
export interface SlotRequest {
    /** Unique identifier for the request */
    id: string;
    /** UID of the service requesting the slot increase */
    expertUid: string;
    /** Role of the expert (adviser, editor, statistician) */
    expertRole: UserRole;
    /** Current max slots the expert has */
    currentSlots: number;
    /** Total slots the expert wants (not additional) */
    requestedSlots: number;
    /** Optional reason/justification for the request */
    reason?: string;
    /** Status of the request */
    status: SlotRequestStatus;
    /** ISO timestamp when the request was created */
    createdAt: string;
    /** ISO timestamp when the request was last updated */
    updatedAt: string;
    /** ISO timestamp when the request was responded to */
    respondedAt?: string | null;
    /** UID of the admin who responded to the request */
    respondedBy?: string | null;
    /** Optional note from admin explaining approval/rejection */
    responseNote?: string | null;
    /** Department of the expert (for filtering) */
    department?: string;
}

/**
 * SlotRequest with document ID (for use in components)
 */
export type SlotRequestRecord = SlotRequest & { id: string };
