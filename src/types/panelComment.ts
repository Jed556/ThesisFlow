/**
 * Supported stages for panel feedback workflows. These map to the major review events.
 */
export type PanelCommentStage = 'proposal' | 'defense';

/**
 * Base data structure stored for every panel comment entry.
 */
export interface PanelCommentEntry {
    /** Firestore document id. */
    id: string;
    /** Group id these comments belong to. */
    groupId: string;
    /** Stage that the comment is tied to. */
    stage: PanelCommentStage;
    /** Free-form comment or suggestion from the panelist. */
    comment: string;
    /** Optional reference pointing to a specific chapter or page. */
    reference?: string;
    /** Firebase uid of the panelist who authored the entry. */
    createdBy: string;
    /** ISO timestamp for when the entry was created. */
    createdAt: string;
    /** ISO timestamp for the last time the entry itself was edited. */
    updatedAt?: string;
    /** Firebase uid who last edited the entry text/reference. */
    updatedBy?: string;
    /** Page number or section recorded by the student. */
    studentPage?: string;
    /** Status of compliance recorded by the student. */
    studentStatus?: string;
    /** ISO timestamp for the latest student update. */
    studentUpdatedAt?: string;
    /** Firebase uid of the student who last updated page/status fields. */
    studentUpdatedBy?: string;
}

/**
 * Payload required when a panelist creates a new comment entry.
 */
export interface PanelCommentEntryInput {
    groupId: string;
    stage: PanelCommentStage;
    comment: string;
    reference?: string;
    createdBy: string;
}

/**
 * Payload for panelists editing their previously created entries.
 */
export interface PanelCommentEntryUpdate {
    comment?: string;
    reference?: string;
    updatedBy: string;
}

/**
 * Student-owned fields that can be edited independently from panel data.
 */
export interface PanelCommentStudentUpdate {
    studentPage?: string;
    studentStatus?: string;
    updatedBy: string;
}

/**
 * Release metadata describing whether a tab is visible to students.
 */
export interface PanelCommentReleaseState {
    sent: boolean;
    sentAt?: string;
    sentBy?: string;
}

/**
 * Lookup map for release state per stage.
 */
export type PanelCommentReleaseMap = Record<PanelCommentStage, PanelCommentReleaseState>;

/**
 * Utility helper for building default release maps.
 */
export function createDefaultPanelCommentReleaseMap(): PanelCommentReleaseMap {
    return {
        proposal: { sent: false },
        defense: { sent: false },
    };
}
