/**
 * Audit entry types for tracking group activities
 * Stored under: groups/{groupId}/audits/{auditId}
 */

/**
 * Audit action categories for organizing different types of audited events
 */
export type AuditCategory =
    | 'group'
    | 'thesis'
    | 'submission'
    | 'chapter'
    | 'panel'
    | 'proposal'
    | 'member'
    | 'expert'
    | 'comment'
    | 'file'
    | 'stage'
    | 'terminal'
    | 'other';

/**
 * Specific audit action types for detailed tracking
 */
export type AuditAction =
    // Group actions
    | 'group_created'
    | 'group_updated'
    | 'group_deleted'
    | 'group_status_changed'
    | 'group_submitted_for_review'
    | 'group_approved'
    | 'group_rejected'
    // Member actions
    | 'member_joined'
    | 'member_invited'
    | 'member_removed'
    | 'member_left'
    | 'member_role_changed'
    | 'invite_accepted'
    | 'invite_rejected'
    | 'join_request_sent'
    | 'join_request_accepted'
    | 'join_request_rejected'
    // Expert actions
    | 'adviser_assigned'
    | 'adviser_removed'
    | 'editor_assigned'
    | 'editor_removed'
    | 'statistician_assigned'
    | 'statistician_removed'
    | 'panel_assigned'
    | 'panel_removed'
    // Thesis actions
    | 'thesis_created'
    | 'thesis_updated'
    | 'thesis_title_changed'
    | 'thesis_stage_changed'
    // Chapter actions
    | 'chapter_created'
    | 'chapter_updated'
    | 'chapter_deleted'
    | 'chapter_status_changed'
    // Submission actions
    | 'submission_created'
    | 'submission_updated'
    | 'submission_deleted'
    | 'submission_approved'
    | 'submission_rejected'
    | 'submission_revision_requested'
    // Proposal actions
    | 'proposal_created'
    | 'proposal_updated'
    | 'proposal_deleted'
    | 'proposal_approved'
    | 'proposal_rejected'
    // Comment actions
    | 'comment_added'
    | 'comment_updated'
    | 'comment_deleted'
    | 'panel_comment_added'
    | 'panel_comment_released'
    // File actions
    | 'file_uploaded'
    | 'file_deleted'
    | 'file_downloaded'
    // Terminal requirement actions
    | 'terminal_submitted'
    | 'terminal_approved'
    | 'terminal_rejected'
    // Other
    | 'custom';

/**
 * Additional details for audit entries
 * Can contain any relevant metadata about the action
 */
export interface AuditDetails {
    /** Previous value (for update operations) */
    previousValue?: unknown;
    /** New value (for update operations) */
    newValue?: unknown;
    /** Target entity ID (e.g., chapter ID, submission ID) */
    targetId?: string;
    /** Target entity type */
    targetType?: string;
    /** Additional context-specific data */
    [key: string]: unknown;
}

/**
 * Audit entry stored in Firestore
 */
export interface AuditEntry {
    /** Unique identifier for the audit entry */
    id: string;
    /** Name/title of the audit entry for quick identification */
    name: string;
    /** Detailed description of what happened */
    description: string;
    /** Firebase UID of the user who performed the action */
    userId: string;
    /** Category of the action for filtering */
    category: AuditCategory;
    /** Specific action type */
    action: AuditAction;
    /** ISO timestamp when the action occurred */
    timestamp: string;
    /** Optional additional details about the action */
    details?: AuditDetails;
    /** Group ID this audit belongs to */
    groupId: string;
}

/**
 * Form data for creating audit entries (without auto-generated fields)
 */
export interface AuditEntryFormData {
    name: string;
    description: string;
    userId: string;
    category: AuditCategory;
    action: AuditAction;
    details?: AuditDetails;
}

/**
 * Options for querying audit entries
 */
export interface AuditQueryOptions {
    /** Filter by category */
    category?: AuditCategory;
    /** Filter by action */
    action?: AuditAction;
    /** Filter by user ID */
    userId?: string;
    /** Start date for time range filter (ISO string) */
    startDate?: string;
    /** End date for time range filter (ISO string) */
    endDate?: string;
    /** Maximum number of entries to return */
    limit?: number;
    /** Order direction */
    orderDirection?: 'asc' | 'desc';
}

/**
 * Listener options for real-time audit updates
 */
export interface AuditListenerOptions {
    onData: (audits: AuditEntry[]) => void;
    onError?: (error: Error) => void;
}
