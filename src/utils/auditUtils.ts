/**
 * Audit Utilities
 * Helper functions for integrating audit functionality into the application.
 * Provides convenient wrappers for common audit operations.
 */

import type {
    AuditEntry, AuditEntryFormData, AuditAction, AuditCategory,
    AuditDetails, AuditQueryOptions, AuditListenerOptions,
    UserAuditEntry, UserAuditEntryFormData, UserAuditQueryOptions,
    UserAuditListenerOptions, UserAuditContext, UserAuditLevel
} from '../types/audit';
import type { ThesisGroup, GroupStatus } from '../types/group';
import type { UserProfile } from '../types/profile';
import { createAuditEntry, type AuditContext } from './firebase/firestore/audits';
import {
    createUserAuditEntry, createUserAuditEntriesBatch
} from './firebase/firestore/userAudits';
import { getAcademicYear } from './dateUtils';

// Re-export Firestore functions for direct use (Group Audits)
export {
    createAuditEntry,
    getAuditEntry,
    getAuditEntries,
    getAllAuditEntries,
    deleteAuditEntry,
    listenAuditEntries,
    listenAllAuditEntries,
    type AuditContext
} from './firebase/firestore/audits';

// Re-export Firestore functions for direct use (User Audits)
export {
    createUserAuditEntry,
    createUserAuditEntriesBatch,
    getUserAuditEntry,
    getUserAuditEntries,
    getAllUserAuditEntries,
    getUnreadUserAuditCount,
    markUserAuditAsRead,
    markUserAuditsAsRead,
    markAllUserAuditsAsRead,
    deleteUserAuditEntry,
    deleteUserAuditEntries,
    deleteReadUserAudits,
    listenUserAuditEntries,
    listenAllUserAuditEntries,
} from './firebase/firestore/userAudits';

// Re-export types for convenience
export type {
    AuditEntry, AuditEntryFormData, AuditQueryOptions, AuditListenerOptions,
    UserAuditEntry, UserAuditEntryFormData, UserAuditQueryOptions,
    UserAuditListenerOptions, UserAuditContext, UserAuditLevel
};

// ============================================================================
// Context Builders
// ============================================================================

/**
 * Build audit context from group data
 * @param group - ThesisGroup object
 * @returns AuditContext for Firestore operations
 */
export function buildAuditContextFromGroup(group: ThesisGroup): AuditContext {
    return {
        year: group.year || getAcademicYear(),
        department: group.department || 'general',
        course: group.course || 'common',
        groupId: group.id,
    };
}

/**
 * Build audit context from individual parameters
 * @param groupId - Group ID
 * @param department - Department name
 * @param course - Course name
 * @param year - Academic year (defaults to current)
 * @returns AuditContext for Firestore operations
 */
export function buildAuditContext(
    groupId: string,
    department: string = 'general',
    course: string = 'common',
    year?: string
): AuditContext {
    return {
        year: year || getAcademicYear(),
        department,
        course,
        groupId,
    };
}

// ============================================================================
// User Audit Context Builders
// ============================================================================

/**
 * Build user audit context at year level
 * @param targetUserId - The user who will see this audit
 * @param year - Academic year (defaults to current)
 * @returns UserAuditContext for Firestore operations
 */
export function buildUserAuditContextYear(
    targetUserId: string,
    year?: string
): UserAuditContext {
    return {
        year: year || getAcademicYear(),
        targetUserId,
        level: 'year',
    };
}

/**
 * Build user audit context at department level
 * @param targetUserId - The user who will see this audit
 * @param department - Department name
 * @param year - Academic year (defaults to current)
 * @returns UserAuditContext for Firestore operations
 */
export function buildUserAuditContextDepartment(
    targetUserId: string,
    department: string,
    year?: string
): UserAuditContext {
    return {
        year: year || getAcademicYear(),
        targetUserId,
        level: 'department',
        department,
    };
}

/**
 * Build user audit context at course level
 * @param targetUserId - The user who will see this audit
 * @param department - Department name
 * @param course - Course name
 * @param year - Academic year (defaults to current)
 * @returns UserAuditContext for Firestore operations
 */
export function buildUserAuditContextCourse(
    targetUserId: string,
    department: string,
    course: string,
    year?: string
): UserAuditContext {
    return {
        year: year || getAcademicYear(),
        targetUserId,
        level: 'course',
        department,
        course,
    };
}

/**
 * Build user audit context from user profile
 * Uses the most specific level available based on user's profile
 * @param user - User profile
 * @param year - Academic year (defaults to current)
 * @returns UserAuditContext for Firestore operations
 */
export function buildUserAuditContextFromProfile(
    user: UserProfile,
    year?: string
): UserAuditContext {
    const baseYear = year || getAcademicYear();

    // Use course level if available
    if (user.department && user.course) {
        return {
            year: baseYear,
            targetUserId: user.uid,
            level: 'course',
            department: user.department,
            course: user.course,
        };
    }

    // Use department level if available
    if (user.department) {
        return {
            year: baseYear,
            targetUserId: user.uid,
            level: 'department',
            department: user.department,
        };
    }

    // Fall back to year level
    return {
        year: baseYear,
        targetUserId: user.uid,
        level: 'year',
    };
}

// ============================================================================
// Audit Helper Functions - Group Operations
// ============================================================================
// TODO: These audit helper functions are designed for integration into group
// workflows but are not yet actively used. Integrate them when implementing
// comprehensive audit logging throughout the application.

/**
 * Log group creation
 */
export async function auditGroupCreated(
    ctx: AuditContext,
    userId: string,
    groupName: string,
    details?: AuditDetails
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Created',
        description: `Group "${groupName}" was created`,
        userId,
        category: 'group',
        action: 'group_created',
        details,
    });
}

/**
 * Log group update
 */
export async function auditGroupUpdated(
    ctx: AuditContext,
    userId: string,
    groupName: string,
    details?: AuditDetails
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Updated',
        description: `Group "${groupName}" was updated`,
        userId,
        category: 'group',
        action: 'group_updated',
        details,
    });
}

/**
 * Log group status change
 */
export async function auditGroupStatusChanged(
    ctx: AuditContext,
    userId: string,
    groupName: string,
    previousStatus: GroupStatus,
    newStatus: GroupStatus
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Status Changed',
        description: `Group "${groupName}" status changed from "${previousStatus}" to "${newStatus}"`,
        userId,
        category: 'group',
        action: 'group_status_changed',
        details: {
            previousValue: previousStatus,
            newValue: newStatus,
        },
    });
}

/**
 * Log group submitted for review
 */
export async function auditGroupSubmittedForReview(
    ctx: AuditContext,
    userId: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Submitted for Review',
        description: `Group "${groupName}" was submitted for review`,
        userId,
        category: 'group',
        action: 'group_submitted_for_review',
    });
}

/**
 * Log group approval
 */
export async function auditGroupApproved(
    ctx: AuditContext,
    userId: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Approved',
        description: `Group "${groupName}" was approved`,
        userId,
        category: 'group',
        action: 'group_approved',
    });
}

/**
 * Log group rejection
 */
export async function auditGroupRejected(
    ctx: AuditContext,
    userId: string,
    groupName: string,
    reason?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Group Rejected',
        description: `Group "${groupName}" was rejected${reason ? `: ${reason}` : ''}`,
        userId,
        category: 'group',
        action: 'group_rejected',
        details: reason ? { reason } : undefined,
    });
}

// ============================================================================
// Audit Helper Functions - Member Operations
// ============================================================================

/**
 * Log member joined
 */
export async function auditMemberJoined(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Member Joined',
        description: `${memberName} joined group "${groupName}"`,
        userId,
        category: 'member',
        action: 'member_joined',
    });
}

/**
 * Log member invited
 */
export async function auditMemberInvited(
    ctx: AuditContext,
    userId: string,
    invitedMemberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Member Invited',
        description: `${invitedMemberName} was invited to group "${groupName}"`,
        userId,
        category: 'member',
        action: 'member_invited',
    });
}

/**
 * Log member removed
 */
export async function auditMemberRemoved(
    ctx: AuditContext,
    userId: string,
    removedMemberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Member Removed',
        description: `${removedMemberName} was removed from group "${groupName}"`,
        userId,
        category: 'member',
        action: 'member_removed',
    });
}

/**
 * Log member left
 */
export async function auditMemberLeft(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Member Left',
        description: `${memberName} left group "${groupName}"`,
        userId,
        category: 'member',
        action: 'member_left',
    });
}

/**
 * Log invite accepted
 */
export async function auditInviteAccepted(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Invite Accepted',
        description: `${memberName} accepted invite to group "${groupName}"`,
        userId,
        category: 'member',
        action: 'invite_accepted',
    });
}

/**
 * Log join request sent
 */
export async function auditJoinRequestSent(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Join Request Sent',
        description: `${memberName} requested to join group "${groupName}"`,
        userId,
        category: 'member',
        action: 'join_request_sent',
    });
}

/**
 * Log join request accepted
 */
export async function auditJoinRequestAccepted(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Join Request Accepted',
        description: `${memberName}'s join request to group "${groupName}" was accepted`,
        userId,
        category: 'member',
        action: 'join_request_accepted',
    });
}

/**
 * Log join request rejected
 */
export async function auditJoinRequestRejected(
    ctx: AuditContext,
    userId: string,
    memberName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Join Request Rejected',
        description: `${memberName}'s join request to group "${groupName}" was rejected`,
        userId,
        category: 'member',
        action: 'join_request_rejected',
    });
}

// ============================================================================
// Audit Helper Functions - Expert Operations
// ============================================================================

/**
 * Log adviser assigned
 */
export async function auditAdviserAssigned(
    ctx: AuditContext,
    userId: string,
    adviserName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Adviser Assigned',
        description: `${adviserName} was assigned as adviser to group "${groupName}"`,
        userId,
        category: 'expert',
        action: 'adviser_assigned',
    });
}

/**
 * Log adviser removed
 */
export async function auditAdviserRemoved(
    ctx: AuditContext,
    userId: string,
    adviserName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Adviser Removed',
        description: `${adviserName} was removed as adviser from group "${groupName}"`,
        userId,
        category: 'expert',
        action: 'adviser_removed',
    });
}

/**
 * Log editor assigned
 */
export async function auditEditorAssigned(
    ctx: AuditContext,
    userId: string,
    editorName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Editor Assigned',
        description: `${editorName} was assigned as editor to group "${groupName}"`,
        userId,
        category: 'expert',
        action: 'editor_assigned',
    });
}

/**
 * Log editor removed
 */
export async function auditEditorRemoved(
    ctx: AuditContext,
    userId: string,
    editorName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Editor Removed',
        description: `${editorName} was removed as editor from group "${groupName}"`,
        userId,
        category: 'expert',
        action: 'editor_removed',
    });
}

/**
 * Log panel assigned
 */
export async function auditPanelAssigned(
    ctx: AuditContext,
    userId: string,
    panelName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Panel Member Assigned',
        description: `${panelName} was assigned as panel member to group "${groupName}"`,
        userId,
        category: 'panel',
        action: 'panel_assigned',
    });
}

/**
 * Log panel removed
 */
export async function auditPanelRemoved(
    ctx: AuditContext,
    userId: string,
    panelName: string,
    groupName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Panel Member Removed',
        description: `${panelName} was removed as panel member from group "${groupName}"`,
        userId,
        category: 'panel',
        action: 'panel_removed',
    });
}

// ============================================================================
// Audit Helper Functions - Thesis Operations
// ============================================================================

/**
 * Log thesis created
 */
export async function auditThesisCreated(
    ctx: AuditContext,
    userId: string,
    thesisTitle: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Thesis Created',
        description: `Thesis "${thesisTitle}" was created`,
        userId,
        category: 'thesis',
        action: 'thesis_created',
    });
}

/**
 * Log thesis updated
 */
export async function auditThesisUpdated(
    ctx: AuditContext,
    userId: string,
    thesisTitle: string,
    details?: AuditDetails
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Thesis Updated',
        description: `Thesis "${thesisTitle}" was updated`,
        userId,
        category: 'thesis',
        action: 'thesis_updated',
        details,
    });
}

/**
 * Log thesis title changed
 */
export async function auditThesisTitleChanged(
    ctx: AuditContext,
    userId: string,
    previousTitle: string,
    newTitle: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Thesis Title Changed',
        description: `Thesis title changed from "${previousTitle}" to "${newTitle}"`,
        userId,
        category: 'thesis',
        action: 'thesis_title_changed',
        details: {
            previousValue: previousTitle,
            newValue: newTitle,
        },
    });
}

/**
 * Log thesis stage changed
 */
export async function auditThesisStageChanged(
    ctx: AuditContext,
    userId: string,
    thesisTitle: string,
    previousStage: string,
    newStage: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Thesis Stage Changed',
        description: `Thesis "${thesisTitle}" stage changed from "${previousStage}" to "${newStage}"`,
        userId,
        category: 'stage',
        action: 'thesis_stage_changed',
        details: {
            previousValue: previousStage,
            newValue: newStage,
        },
    });
}

// ============================================================================
// Audit Helper Functions - Submission Operations
// ============================================================================

/**
 * Log submission created
 */
export async function auditSubmissionCreated(
    ctx: AuditContext,
    userId: string,
    chapterName: string,
    submissionVersion?: number
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Submission Created',
        description: `New submission${submissionVersion ? ` (v${submissionVersion})` : ''} for chapter "${chapterName}"`,
        userId,
        category: 'submission',
        action: 'submission_created',
        details: submissionVersion ? { version: submissionVersion } : undefined,
    });
}

/**
 * Log submission updated
 */
export async function auditSubmissionUpdated(
    ctx: AuditContext,
    userId: string,
    chapterName: string,
    details?: AuditDetails
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Submission Updated',
        description: `Submission for chapter "${chapterName}" was updated`,
        userId,
        category: 'submission',
        action: 'submission_updated',
        details,
    });
}

/**
 * Log submission approved
 */
export async function auditSubmissionApproved(
    ctx: AuditContext,
    userId: string,
    chapterName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Submission Approved',
        description: `Submission for chapter "${chapterName}" was approved`,
        userId,
        category: 'submission',
        action: 'submission_approved',
    });
}

/**
 * Log submission rejected
 */
export async function auditSubmissionRejected(
    ctx: AuditContext,
    userId: string,
    chapterName: string,
    reason?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Submission Rejected',
        description: `Submission for chapter "${chapterName}" was rejected${reason ? `: ${reason}` : ''}`,
        userId,
        category: 'submission',
        action: 'submission_rejected',
        details: reason ? { reason } : undefined,
    });
}

/**
 * Log submission revision requested
 */
export async function auditSubmissionRevisionRequested(
    ctx: AuditContext,
    userId: string,
    chapterName: string,
    feedback?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Revision Requested',
        description: `Revision requested for chapter "${chapterName}"${feedback ? `: ${feedback}` : ''}`,
        userId,
        category: 'submission',
        action: 'submission_revision_requested',
        details: feedback ? { feedback } : undefined,
    });
}

// ============================================================================
// Audit Helper Functions - Proposal Operations
// ============================================================================

/**
 * Log proposal created
 */
export async function auditProposalCreated(
    ctx: AuditContext,
    userId: string,
    proposalTitle: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Proposal Created',
        description: `Proposal "${proposalTitle}" was created`,
        userId,
        category: 'proposal',
        action: 'proposal_created',
    });
}

/**
 * Log proposal approved
 */
export async function auditProposalApproved(
    ctx: AuditContext,
    userId: string,
    proposalTitle: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Proposal Approved',
        description: `Proposal "${proposalTitle}" was approved`,
        userId,
        category: 'proposal',
        action: 'proposal_approved',
    });
}

/**
 * Log proposal rejected
 */
export async function auditProposalRejected(
    ctx: AuditContext,
    userId: string,
    proposalTitle: string,
    reason?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Proposal Rejected',
        description: `Proposal "${proposalTitle}" was rejected${reason ? `: ${reason}` : ''}`,
        userId,
        category: 'proposal',
        action: 'proposal_rejected',
        details: reason ? { reason } : undefined,
    });
}

// ============================================================================
// Audit Helper Functions - Comment Operations
// ============================================================================

/**
 * Log comment added
 */
export async function auditCommentAdded(
    ctx: AuditContext,
    userId: string,
    targetType: string,
    targetName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Comment Added',
        description: `Comment added to ${targetType} "${targetName}"`,
        userId,
        category: 'comment',
        action: 'comment_added',
        details: { targetType },
    });
}

/**
 * Log panel comment added
 */
export async function auditPanelCommentAdded(
    ctx: AuditContext,
    userId: string,
    chapterName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Panel Comment Added',
        description: `Panel comment added to chapter "${chapterName}"`,
        userId,
        category: 'comment',
        action: 'panel_comment_added',
    });
}

/**
 * Log panel comments released
 */
export async function auditPanelCommentsReleased(
    ctx: AuditContext,
    userId: string,
    chapterName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Panel Comments Released',
        description: `Panel comments for chapter "${chapterName}" were released to the group`,
        userId,
        category: 'comment',
        action: 'panel_comment_released',
    });
}

// ============================================================================
// Audit Helper Functions - File Operations
// ============================================================================

/**
 * Log file uploaded
 */
export async function auditFileUploaded(
    ctx: AuditContext,
    userId: string,
    fileName: string,
    targetType?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'File Uploaded',
        description: `File "${fileName}" was uploaded${targetType ? ` to ${targetType}` : ''}`,
        userId,
        category: 'file',
        action: 'file_uploaded',
        details: { fileName, targetType },
    });
}

/**
 * Log file deleted
 */
export async function auditFileDeleted(
    ctx: AuditContext,
    userId: string,
    fileName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'File Deleted',
        description: `File "${fileName}" was deleted`,
        userId,
        category: 'file',
        action: 'file_deleted',
        details: { fileName },
    });
}

// ============================================================================
// Audit Helper Functions - Terminal Requirement Operations
// ============================================================================

/**
 * Log terminal requirement submitted
 */
export async function auditTerminalSubmitted(
    ctx: AuditContext,
    userId: string,
    requirementName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Terminal Requirement Submitted',
        description: `Terminal requirement "${requirementName}" was submitted`,
        userId,
        category: 'terminal',
        action: 'terminal_submitted',
    });
}

/**
 * Log terminal requirement approved
 */
export async function auditTerminalApproved(
    ctx: AuditContext,
    userId: string,
    requirementName: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Terminal Requirement Approved',
        description: `Terminal requirement "${requirementName}" was approved`,
        userId,
        category: 'terminal',
        action: 'terminal_approved',
    });
}

/**
 * Log terminal requirement rejected
 */
export async function auditTerminalRejected(
    ctx: AuditContext,
    userId: string,
    requirementName: string,
    reason?: string
): Promise<string> {
    return createAuditEntry(ctx, {
        name: 'Terminal Requirement Rejected',
        description: `Terminal requirement "${requirementName}" was rejected${reason ? `: ${reason}` : ''}`,
        userId,
        category: 'terminal',
        action: 'terminal_rejected',
        details: reason ? { reason } : undefined,
    });
}

// ============================================================================
// Generic Audit Function
// ============================================================================

/**
 * Create a custom audit entry
 */
export async function auditCustomAction(
    ctx: AuditContext,
    userId: string,
    name: string,
    description: string,
    category: AuditCategory = 'other',
    action: AuditAction = 'custom',
    details?: AuditDetails
): Promise<string> {
    return createAuditEntry(ctx, {
        name,
        description,
        userId,
        category,
        action,
        details,
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable label for audit category
 */
export function getAuditCategoryLabel(category: AuditCategory): string {
    const labels: Record<AuditCategory, string> = {
        group: 'Group',
        thesis: 'Thesis',
        submission: 'Submission',
        chapter: 'Chapter',
        panel: 'Panel',
        proposal: 'Proposal',
        member: 'Member',
        expert: 'Expert',
        comment: 'Comment',
        file: 'File',
        stage: 'Stage',
        terminal: 'Terminal Requirement',
        account: 'Account',
        notification: 'Notification',
        other: 'Other',
    };
    return labels[category] || 'Unknown';
}

/**
 * Get human-readable label for audit action
 */
export function getAuditActionLabel(action: AuditAction): string {
    const labels: Record<AuditAction, string> = {
        // Group actions
        group_created: 'Created',
        group_updated: 'Updated',
        group_deleted: 'Deleted',
        group_status_changed: 'Status Changed',
        group_submitted_for_review: 'Submitted for Review',
        group_approved: 'Approved',
        group_rejected: 'Rejected',
        // Member actions
        member_joined: 'Joined',
        member_invited: 'Invited',
        member_removed: 'Removed',
        member_left: 'Left',
        member_role_changed: 'Role Changed',
        invite_accepted: 'Invite Accepted',
        invite_rejected: 'Invite Rejected',
        join_request_sent: 'Join Request Sent',
        join_request_accepted: 'Join Request Accepted',
        join_request_rejected: 'Join Request Rejected',
        // Expert actions
        adviser_assigned: 'Assigned',
        adviser_removed: 'Removed',
        editor_assigned: 'Assigned',
        editor_removed: 'Removed',
        statistician_assigned: 'Assigned',
        statistician_removed: 'Removed',
        panel_assigned: 'Assigned',
        panel_removed: 'Removed',
        // Thesis actions
        thesis_created: 'Created',
        thesis_updated: 'Updated',
        thesis_title_changed: 'Title Changed',
        thesis_stage_changed: 'Stage Changed',
        // Chapter actions
        chapter_created: 'Created',
        chapter_updated: 'Updated',
        chapter_deleted: 'Deleted',
        chapter_status_changed: 'Status Changed',
        // Submission actions
        submission_created: 'Created',
        submission_updated: 'Updated',
        submission_deleted: 'Deleted',
        submission_approved: 'Approved',
        submission_rejected: 'Rejected',
        submission_revision_requested: 'Revision Requested',
        // Proposal actions
        proposal_created: 'Created',
        proposal_updated: 'Updated',
        proposal_deleted: 'Deleted',
        proposal_submitted: 'Submitted',
        proposal_approved: 'Approved',
        proposal_rejected: 'Rejected',
        // Comment actions
        comment_added: 'Added',
        comment_updated: 'Updated',
        comment_deleted: 'Deleted',
        panel_comment_added: 'Added',
        panel_comment_released: 'Released',
        // File actions
        file_uploaded: 'Uploaded',
        file_deleted: 'Deleted',
        file_downloaded: 'Downloaded',
        // Terminal requirement actions
        terminal_submitted: 'Submitted',
        terminal_approved: 'Approved',
        terminal_rejected: 'Rejected',
        // Account actions
        account_created: 'Account Created',
        account_updated: 'Account Updated',
        account_role_changed: 'Role Changed',
        account_login: 'Logged In',
        account_logout: 'Logged Out',
        // Notification actions
        notification_received: 'Received',
        notification_read: 'Read',
        notification_cleared: 'Cleared',
        // Expert request actions
        expert_request_received: 'Request Received',
        expert_request_accepted: 'Request Accepted',
        expert_request_rejected: 'Request Rejected',
        // Other
        custom: 'Custom Action',
    };
    return labels[action] || 'Unknown';
}

/**
 * Get color for audit category (for UI display)
 */
export function getAuditCategoryColor(
    category: AuditCategory
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
    const colors: Record<AuditCategory, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
        group: 'primary',
        thesis: 'secondary',
        submission: 'success',
        chapter: 'info',
        panel: 'warning',
        proposal: 'secondary',
        member: 'info',
        expert: 'primary',
        comment: 'default',
        file: 'default',
        stage: 'warning',
        terminal: 'success',
        account: 'primary',
        notification: 'info',
        other: 'default',
    };
    return colors[category] || 'default';
}

// ============================================================================
// User Audit Helper Functions
// ============================================================================

/**
 * Send a personal notification to a user
 * @param targetUserId - The user to notify
 * @param name - Notification title
 * @param description - Notification description
 * @param action - Action type
 * @param category - Category for filtering
 * @param userId - User who triggered the action (can be same as target)
 * @param options - Additional options
 */
export async function notifyUser(
    targetUserId: string,
    name: string,
    description: string,
    action: AuditAction,
    category: AuditCategory,
    userId: string,
    options?: {
        year?: string;
        department?: string;
        course?: string;
        relatedGroupId?: string;
        details?: AuditDetails;
        showSnackbar?: boolean;
    }
): Promise<string> {
    // Determine the appropriate level based on provided context
    let level: UserAuditLevel = 'year';
    if (options?.department && options?.course) {
        level = 'course';
    } else if (options?.department) {
        level = 'department';
    }

    const ctx: UserAuditContext = {
        year: options?.year || getAcademicYear(),
        targetUserId,
        level,
        department: options?.department,
        course: options?.course,
    };

    return createUserAuditEntry(ctx, {
        name,
        description,
        userId,
        category,
        action,
        targetUserId,
        relatedGroupId: options?.relatedGroupId,
        details: options?.details,
        showSnackbar: options?.showSnackbar ?? true,
    });
}

/**
 * Notify multiple users about an event
 * @param targetUserIds - Array of user IDs to notify
 * @param name - Notification title
 * @param description - Notification description
 * @param action - Action type
 * @param category - Category for filtering
 * @param userId - User who triggered the action
 * @param options - Additional options (applied to all notifications)
 */
export async function notifyUsers(
    targetUserIds: string[],
    name: string,
    description: string,
    action: AuditAction,
    category: AuditCategory,
    userId: string,
    options?: {
        year?: string;
        department?: string;
        course?: string;
        relatedGroupId?: string;
        details?: AuditDetails;
        showSnackbar?: boolean;
    }
): Promise<string[]> {
    // Determine the appropriate level based on provided context
    let level: UserAuditLevel = 'year';
    if (options?.department && options?.course) {
        level = 'course';
    } else if (options?.department) {
        level = 'department';
    }

    const entries = targetUserIds.map((targetUserId) => ({
        ctx: {
            year: options?.year || getAcademicYear(),
            targetUserId,
            level,
            department: options?.department,
            course: options?.course,
        } as UserAuditContext,
        data: {
            name,
            description,
            userId,
            category,
            action,
            targetUserId,
            relatedGroupId: options?.relatedGroupId,
            details: options?.details,
            showSnackbar: options?.showSnackbar ?? true,
        } as UserAuditEntryFormData,
    }));

    return createUserAuditEntriesBatch(entries);
}

/**
 * Notify user about an expert request
 */
export async function notifyExpertRequest(
    targetUserId: string,
    groupName: string,
    requestType: 'adviser' | 'editor' | 'statistician' | 'panel',
    userId: string,
    options?: {
        year?: string;
        department?: string;
        course?: string;
        groupId?: string;
    }
): Promise<string> {
    const requestTypeLabel =
        requestType.charAt(0).toUpperCase() + requestType.slice(1);

    return notifyUser(
        targetUserId,
        `${requestTypeLabel} Request`,
        `You have received a request to be a ${requestType} for group "${groupName}"`,
        'expert_request_received',
        'expert',
        userId,
        {
            ...options,
            relatedGroupId: options?.groupId,
            showSnackbar: true,
        }
    );
}

/**
 * Notify user about group invitation
 */
export async function notifyGroupInvitation(
    targetUserId: string,
    groupName: string,
    invitedByUserId: string,
    options?: {
        year?: string;
        department?: string;
        course?: string;
        groupId?: string;
    }
): Promise<string> {
    return notifyUser(
        targetUserId,
        'Group Invitation',
        `You have been invited to join group "${groupName}"`,
        'member_invited',
        'member',
        invitedByUserId,
        {
            ...options,
            relatedGroupId: options?.groupId,
            showSnackbar: true,
        }
    );
}

/**
 * Notify group members about an event
 * @param memberIds - Array of group member user IDs
 * @param excludeUserId - User ID to exclude (usually the action performer)
 * @param name - Notification title
 * @param description - Notification description
 * @param action - Action type
 * @param category - Category for filtering
 * @param userId - User who triggered the action
 * @param options - Additional options
 */
export async function notifyGroupMembers(
    memberIds: string[],
    excludeUserId: string | null,
    name: string,
    description: string,
    action: AuditAction,
    category: AuditCategory,
    userId: string,
    options?: {
        year?: string;
        department?: string;
        course?: string;
        relatedGroupId?: string;
        details?: AuditDetails;
        showSnackbar?: boolean;
    }
): Promise<string[]> {
    const targetUserIds = excludeUserId
        ? memberIds.filter((id) => id !== excludeUserId)
        : memberIds;

    if (targetUserIds.length === 0) return [];

    return notifyUsers(
        targetUserIds,
        name,
        description,
        action,
        category,
        userId,
        options
    );
}
