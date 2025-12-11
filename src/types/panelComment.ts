
/**
 * Supported stages for panel feedback workflows. These map to the major review events.
 */
export type PanelCommentStage = 'proposal' | 'defense';

/**
 * Approval status for panel comment entries.
 * - 'pending': Initial state, awaiting panelist review
 * - 'approved': Panelist approved the student's compliance
 * - 'revision_required': Panelist requested revisions
 * - 'review_requested': Student requested re-review after making revisions
 */
export type PanelCommentApprovalStatus = 'pending' | 'approved' | 'revision_required' | 'review_requested';

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
    /** Panel member to whom this sheet belongs (usually matches createdBy). */
    panelUid: string;
    /** ISO timestamp for the last time the entry itself was edited. */
    updatedAt?: string;
    /** Firebase uid who last edited the entry text/reference. */
    updatedBy?: string;
    /** Status of compliance recorded by the student. */
    studentStatus?: string;
    /** Page number recorded by the student for compliance tracking. */
    studentPage?: string;
    /** ISO timestamp for the latest student update. */
    studentUpdatedAt?: string;
    /** Firebase uid of the student who last updated page/status fields. */
    studentUpdatedBy?: string;
    /** Approval status set by the panelist after reviewing student response. */
    approvalStatus?: PanelCommentApprovalStatus;
    /** ISO timestamp for when approval status was last updated. */
    approvalUpdatedAt?: string;
    /** Firebase uid who last updated the approval status. */
    approvalUpdatedBy?: string;
}

export interface PanelCommentTable {
    panelUid: string;
    stage: PanelCommentStage;
    comments: PanelCommentEntry[];
}

/**
 * Release status for a single panelist's comment table for a stage.
 */
export interface PanelCommentTableReleaseStatus {
    /** Whether this panelist's comments for this stage have been released to students. */
    sent: boolean;
    /** ISO timestamp for when the comments were released. */
    sentAt?: string;
    /** Firebase uid of the admin who released the comments. */
    sentBy?: string;
    /** Whether the panelist has marked their comments as ready for admin review/release. */
    readyForReview?: boolean;
    /** ISO timestamp for when the panelist marked comments as ready. */
    readyAt?: string;
    /** Firebase uid of the panelist who marked comments as ready. */
    readyBy?: string;
}

/**
 * Map of release status by panelist UID for a single stage.
 */
export type PanelCommentTableReleaseMap = Record<string, PanelCommentTableReleaseStatus>;

// TODO: Check if this can be simplified

/**
 * Release status for a single panel comment stage.
 */
export interface PanelCommentReleaseStatus {
    /** Whether comments for this stage have been released to students. */
    sent: boolean;
    /** ISO timestamp for when the comments were released. */
    sentAt?: string;
    /** Firebase uid of the admin who released the comments. */
    sentBy?: string;
    /** Per-panelist release status. When set, overrides the stage-level release. */
    tables?: PanelCommentTableReleaseMap;
}

/**
 * Map of release status by stage.
 */
export type PanelCommentReleaseMap = Record<PanelCommentStage, PanelCommentReleaseStatus>;

/**
 * Creates a default release map with all stages unreleased.
 */
export function createDefaultPanelCommentReleaseMap(): PanelCommentReleaseMap {
    return {
        proposal: { sent: false },
        defense: { sent: false },
    };
}

/**
 * Input payload for creating a new panel comment entry.
 */
export interface PanelCommentEntryInput {
    groupId: string;
    stage: PanelCommentStage;
    comment: string;
    reference?: string;
    createdBy: string;
    panelUid: string;
}

/**
 * Payload for updating an existing panel comment entry.
 */
export interface PanelCommentEntryUpdate {
    comment?: string;
    reference?: string;
    updatedBy: string;
}

/**
 * Payload for student updates to a panel comment entry.
 */
export interface PanelCommentStudentUpdate {
    studentPage?: string;
    studentStatus?: string;
    studentUpdatedBy: string;
}

// ============================================================================
// Panel Comment Manuscript Types
// ============================================================================

/**
 * Manuscript attachment uploaded by student for panel review.
 */
export interface PanelCommentManuscript {
    /** Unique ID for the manuscript */
    id: string;
    /** Group ID this manuscript belongs to */
    groupId: string;
    /** Stage that the manuscript is tied to */
    stage: PanelCommentStage;
    /** Original file name */
    fileName: string;
    /** File size in bytes */
    fileSize: number;
    /** MIME type of the file */
    mimeType: string;
    /** Download URL for the file */
    url: string;
    /** Storage path for the file */
    storagePath: string;
    /** Firebase UID of the uploader */
    uploadedBy: string;
    /** ISO timestamp for when the manuscript was uploaded */
    uploadedAt: string;
    /** Whether review has been requested */
    reviewRequested: boolean;
    /** ISO timestamp for when review was requested */
    reviewRequestedAt?: string;
    /** Firebase UID who requested the review */
    reviewRequestedBy?: string;
}

/**
 * Input payload for uploading a new manuscript.
 */
export interface PanelCommentManuscriptInput {
    groupId: string;
    stage: PanelCommentStage;
    file: File;
    uploadedBy: string;
}
