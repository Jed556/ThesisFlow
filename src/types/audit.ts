/**
 * Audit entry types for tracking activities at different hierarchy levels
 * 
 * Stored at multiple levels:
 * - Group audits: year/{year}/departments/{dept}/courses/{course}/groups/{groupId}/audits/{auditId}
 * - User audits (year level): year/{year}/users/{userId}/audits/{auditId}
 * - User audits (department level): year/{year}/departments/{dept}/users/{userId}/audits/{auditId}
 * - User audits (course level): year/{year}/departments/{dept}/courses/{course}/users/{userId}/audits/{auditId}
 * 
 * Group audits are visible to group members, admins, and departmental roles.
 * User audits are visible only to the user themselves (personal notifications).
 */

/**
 * Audit storage location type
 */
export type AuditLocationType = 'group' | 'user';

/**
 * User audit hierarchy level
 */
export type UserAuditLevel = 'year' | 'department' | 'course';

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
    | 'template'
    | 'account'
    | 'notification'
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
    | 'proposal_submitted'
    | 'proposal_approved'
    | 'proposal_rejected'
    // Comment actions
    | 'comment_added'
    | 'comment_updated'
    | 'comment_deleted'
    | 'panel_comment_added'
    | 'panel_comment_released'
    | 'panel_comments_ready'
    // File actions
    | 'file_uploaded'
    | 'file_deleted'
    | 'file_downloaded'
    // Terminal requirement actions
    | 'terminal_submitted'
    | 'terminal_approved'
    | 'terminal_rejected'
    // Account actions (for user-level audits)
    | 'account_created'
    | 'account_updated'
    | 'account_role_changed'
    | 'account_password_changed'
    | 'account_preferences_updated'
    | 'account_theme_changed'
    | 'account_avatar_changed'
    | 'account_banner_changed'
    | 'account_login'
    | 'account_logout'
    // Notification actions (for user-level audits)
    | 'notification_received'
    | 'notification_read'
    | 'notification_cleared'
    // Expert request actions (for user-level audits)
    | 'expert_request_received'
    | 'expert_request_accepted'
    | 'expert_request_rejected'
    // Template actions (for admin-level audits)
    | 'skill_template_created'
    | 'skill_template_updated'
    | 'skill_template_deleted'
    | 'skill_template_reset'
    | 'chapter_template_created'
    | 'chapter_template_updated'
    | 'chapter_template_deleted'
    | 'chapter_template_reset'
    | 'agenda_template_updated'
    | 'agenda_template_reset'
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
 * Base audit entry stored in Firestore (common fields)
 */
export interface BaseAuditEntry {
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
    /** Whether this audit should show as a snackbar notification */
    showSnackbar?: boolean;
    /** Whether the snackbar has already been shown to the user (persisted in Firestore) */
    snackbarShown?: boolean;
    /** Whether the audit entry has been read (for user audits) */
    read?: boolean;
}

/**
 * Group audit entry stored in Firestore
 * Path: year/{year}/departments/{dept}/courses/{course}/groups/{groupId}/audits/{auditId}
 */
export interface AuditEntry extends BaseAuditEntry {
    /** Audit location type - always 'group' for group audits */
    locationType: 'group';
    /** Group ID this audit belongs to */
    groupId: string;
}

/**
 * User audit entry stored in Firestore
 * Path varies by level:
 * - year/{year}/users/{userId}/audits/{auditId}
 * - year/{year}/departments/{dept}/users/{userId}/audits/{auditId}
 * - year/{year}/departments/{dept}/courses/{course}/users/{userId}/audits/{auditId}
 */
export interface UserAuditEntry extends BaseAuditEntry {
    /** Audit location type - always 'user' for user audits */
    locationType: 'user';
    /** The user ID this audit belongs to */
    targetUserId: string;
    /** The hierarchy level where this audit is stored */
    level: UserAuditLevel;
    /** Department (for department or course level audits) */
    department?: string;
    /** Course (for course level audits) */
    course?: string;
    /** Related group ID (optional, for reference) */
    relatedGroupId?: string;
}

/**
 * Combined audit entry type for unified handling
 */
export type AnyAuditEntry = AuditEntry | UserAuditEntry;

/**
 * Form data for creating group audit entries (without auto-generated fields)
 */
export interface AuditEntryFormData {
    name: string;
    description: string;
    userId: string;
    category: AuditCategory;
    action: AuditAction;
    details?: AuditDetails;
    showSnackbar?: boolean;
}

/**
 * Form data for creating user audit entries
 */
export interface UserAuditEntryFormData extends AuditEntryFormData {
    /** Target user who will see this audit */
    targetUserId: string;
    /** Related group ID (optional) */
    relatedGroupId?: string;
}

/**
 * Options for querying audit entries
 */
export interface AuditQueryOptions {
    /** Filter by category */
    category?: AuditCategory;
    /** Filter by action */
    action?: AuditAction;
    /** Filter by user ID (who performed the action) */
    userId?: string;
    /** Start date for time range filter (ISO string) */
    startDate?: string;
    /** End date for time range filter (ISO string) */
    endDate?: string;
    /** Maximum number of entries to return */
    limit?: number;
    /** Order direction */
    orderDirection?: 'asc' | 'desc';
    /** Filter by read status (for user audits) */
    read?: boolean;
}

/**
 * Options for querying user audit entries
 */
export interface UserAuditQueryOptions extends AuditQueryOptions {
    /** The hierarchy level to query */
    level?: UserAuditLevel;
    /** Department filter (for department/course level) */
    department?: string;
    /** Course filter (for course level) */
    course?: string;
}

/**
 * Listener options for real-time audit updates
 */
export interface AuditListenerOptions {
    onData: (audits: AuditEntry[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listener options for real-time user audit updates
 */
export interface UserAuditListenerOptions {
    onData: (audits: UserAuditEntry[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Context for creating user audits
 */
export interface UserAuditContext {
    year: string;
    targetUserId: string;
    level: UserAuditLevel;
    department?: string;
    course?: string;
}
