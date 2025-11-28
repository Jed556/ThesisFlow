
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
    /** Panel member to whom this sheet belongs (usually matches createdBy). */
    panelUid: string;
    /** ISO timestamp for the last time the entry itself was edited. */
    updatedAt?: string;
    /** Firebase uid who last edited the entry text/reference. */
    updatedBy?: string;
    /** Status of compliance recorded by the student. */
    studentStatus?: string;
    /** ISO timestamp for the latest student update. */
    studentUpdatedAt?: string;
    /** Firebase uid of the student who last updated page/status fields. */
    studentUpdatedBy?: string;
}

export interface PanelCommentTable {
    panelUid: string;
    stage: PanelCommentStage;
    comments: PanelCommentEntry[];
}

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
