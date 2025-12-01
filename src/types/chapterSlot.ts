/**
 * Chapter slot reservation and scheduling types.
 * Used by admins to approve and adjust stage presentation slots for thesis chapters.
 */

import type { ThesisStageName } from './thesis';

/**
 * Workflow statuses for chapter slot reservations.
 */
export type ChapterSlotStatus = 'pending' | 'scheduled' | 'approved' | 'completed' | 'cancelled';

/**
 * Audit entry describing a schedule adjustment made by an approver.
 */
export interface ChapterSlotAdjustment {
    id: string;
    adjustedBy: string;
    adjustedAt: string;
    note?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    venue?: string;
}

/**
 * Core chapter slot reservation document stored per academic year.
 */
export interface ChapterSlotRequest {
    id: string;
    year: string;
    department?: string;
    course?: string;
    groupId: string;
    groupName?: string;
    thesisId?: string;
    stage: ThesisStageName;
    requestedBy: string;
    requestedByName?: string;
    requestedAt: string;
    preferredStart?: string;
    preferredEnd?: string;
    notes?: string;
    status: ChapterSlotStatus;
    scheduledStart?: string;
    scheduledEnd?: string;
    venue?: string;
    panelistUids?: string[];
    panelistNames?: string[];
    approverUid?: string;
    approvedAt?: string;
    lastUpdatedAt?: string;
    adjustments?: ChapterSlotAdjustment[];
}

/**
 * Convenience alias when working with Firestore records.
 */
export type ChapterSlotRecord = ChapterSlotRequest;

/**
 * Payload for updating a chapter slot's confirmed schedule.
 */
export interface ChapterSlotScheduleUpdate {
    scheduledStart?: string;
    scheduledEnd?: string;
    venue?: string;
    panelistUids?: string[];
    note?: string;
}
