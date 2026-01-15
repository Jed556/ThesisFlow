/**
 * Unified Audit and Notification Utilities
 * 
 * This module provides a unified approach to auditing and notifications.
 * When an audit is created, it can automatically trigger notifications to relevant users.
 * 
 * Key concepts:
 * - Group audits: Stored under the group, visible to group members
 * - User audits: Personal notifications stored under the user, visible only to them
 * - When a group audit is created, user notifications can be sent to relevant stakeholders
 */

import type {
    AuditAction, AuditCategory, AuditDetails, UserAuditEntryFormData, UserAuditContext, UserAuditLevel
} from '../types/audit';
import type { ThesisGroup, ThesisGroupMembers } from '../types/group';
import type { UserProfile, UserRole } from '../types/profile';
import { createAuditEntry, buildAuditContextFromGroup } from './auditUtils';
import { createUserAuditEntriesBatch } from './firebase/firestore/userAudits';
import { findUsersByIds, getPathLevelForRole } from './firebase/firestore/user';
import { getAcademicYear } from './dateUtils';
import { getNavigationPathForCategory, getAllowedRolesForCategory } from './navigationMappingUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification severity for snackbar display
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Target recipients for notifications
 */
export interface NotificationTargets {
    /** Notify all group members (leader + members) */
    groupMembers?: boolean;
    /** Notify the group leader specifically */
    leader?: boolean;
    /** Notify the group adviser */
    adviser?: boolean;
    /** Notify the group editor */
    editor?: boolean;
    /** Notify the group statistician */
    statistician?: boolean;
    /** Notify all panel members */
    panels?: boolean;
    /** Notify specific user IDs */
    userIds?: string[];
    /** Notify all moderators in the course */
    moderators?: boolean;
    /** Notify all admins */
    admins?: boolean;
    /** Exclude specific user ID (usually the action performer) */
    excludeUserId?: string;
}

/**
 * Options for the unified audit-notification function
 */
export interface AuditAndNotifyOptions {
    /** Group context for the audit */
    group: ThesisGroup;
    /** User ID who performed the action */
    userId: string;
    /** Audit name/title */
    name: string;
    /** Audit description */
    description: string;
    /** Audit category */
    category: AuditCategory;
    /** Audit action type */
    action: AuditAction;
    /** Additional details */
    details?: AuditDetails;
    /** Notification targets */
    targets: NotificationTargets;
    /** Whether to create a group audit (default: true) */
    createGroupAudit?: boolean;
    /** Whether to show snackbar for notifications (default: true) */
    showSnackbar?: boolean;
    /** Custom notification message (if different from description) */
    notificationMessage?: string;
    /** List of admin user IDs to notify (for admin notifications) */
    adminUserIds?: string[];
    /** List of moderator user IDs to notify (for moderator notifications) */
    moderatorUserIds?: string[];
    /** Whether to send email notifications to target users (default: false) */
    sendEmail?: boolean;
    /** Optional action URL for email notifications (e.g., link to view details) */
    emailActionUrl?: string;
    /** Optional action button text for email notifications */
    emailActionText?: string;
}

/**
 * Result of the audit-and-notify operation
 */
export interface AuditAndNotifyResult {
    /** ID of the created group audit (if created) */
    groupAuditId?: string;
    /** IDs of created user notifications */
    notificationIds: string[];
    /** Number of users notified */
    notifiedCount: number;
    /** Number of emails sent successfully */
    emailsSentCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all member UIDs from a group (excluding a specific user)
 */
function getGroupMemberUids(members: ThesisGroupMembers, excludeUserId?: string): string[] {
    const uids = new Set<string>();

    // Add leader
    if (members.leader) uids.add(members.leader);

    // Add members
    members.members?.forEach((uid) => uids.add(uid));

    // Remove excluded user
    if (excludeUserId) uids.delete(excludeUserId);

    return Array.from(uids);
}

/**
 * Get expert UIDs from a group based on targets
 */
function getExpertUids(
    members: ThesisGroupMembers,
    targets: NotificationTargets,
    excludeUserId?: string
): string[] {
    const uids = new Set<string>();

    if (targets.adviser && members.adviser) {
        uids.add(members.adviser);
    }
    if (targets.editor && members.editor) {
        uids.add(members.editor);
    }
    if (targets.statistician && members.statistician) {
        uids.add(members.statistician);
    }
    if (targets.panels && members.panels) {
        members.panels.forEach((uid) => uids.add(uid));
    }
    if (targets.leader && members.leader) {
        uids.add(members.leader);
    }

    // Remove excluded user
    if (excludeUserId) uids.delete(excludeUserId);

    return Array.from(uids);
}

/**
 * Get all target user IDs based on notification targets
 */
function resolveTargetUserIds(
    members: ThesisGroupMembers,
    targets: NotificationTargets,
    adminUserIds?: string[],
    moderatorUserIds?: string[]
): string[] {
    const uids = new Set<string>();
    const excludeUserId = targets.excludeUserId;

    // Group members
    if (targets.groupMembers) {
        getGroupMemberUids(members, excludeUserId).forEach((uid) => uids.add(uid));
    }

    // Specific experts
    getExpertUids(members, targets, excludeUserId).forEach((uid) => uids.add(uid));

    // Specific user IDs
    if (targets.userIds) {
        targets.userIds.forEach((uid) => {
            if (uid !== excludeUserId) uids.add(uid);
        });
    }

    // Admins
    if (targets.admins && adminUserIds) {
        adminUserIds.forEach((uid) => {
            if (uid !== excludeUserId) uids.add(uid);
        });
    }

    // Moderators
    if (targets.moderators && moderatorUserIds) {
        moderatorUserIds.forEach((uid) => {
            if (uid !== excludeUserId) uids.add(uid);
        });
    }

    return Array.from(uids);
}

// Email notification functions imported from emailUtils.ts
import { sendBulkAuditEmails } from './emailUtils';

/**
 * Determine notification severity based on action
 */
export function getNotificationSeverity(action: AuditAction): NotificationSeverity {
    const successActions: AuditAction[] = [
        'group_approved',
        'submission_approved',
        'proposal_approved',
        'terminal_approved',
        'invite_accepted',
        'join_request_accepted',
        'expert_request_accepted',
        'chapter_status_changed', // When approved
    ];

    const errorActions: AuditAction[] = [
        'group_rejected',
        'submission_rejected',
        'proposal_rejected',
        'terminal_rejected',
        'invite_rejected',
        'join_request_rejected',
        'expert_request_rejected',
        'member_removed',
    ];

    const warningActions: AuditAction[] = [
        'submission_revision_requested',
        'group_status_changed',
        'thesis_stage_changed',
    ];

    if (successActions.includes(action)) return 'success';
    if (errorActions.includes(action)) return 'error';
    if (warningActions.includes(action)) return 'warning';
    return 'info';
}

/**
 * Navigation path information with role requirements
 */
export interface AuditNavigationInfo {
    /** The navigation path */
    path: string;
    /** Roles that have access to this path (empty means all roles) */
    allowedRoles: string[];
}

/**
 * Build navigation path for an audit entry based on its category and details.
 * Returns both the path and the roles that have access to it.
 * Used to create "View Details" action buttons in notifications.
 * 
 * NOTE: This function uses CATEGORY_NAVIGATION_CONFIG from navigationMappingUtils
 * as the single source of truth for category → path mappings.
 * 
 * @param category - The audit category
 * @param action - The audit action (currently unused but kept for future specificity)
 * @param details - Optional audit details (currently unused but kept for future specificity)
 * @param userRole - Optional user role for role-specific path resolution
 */
export function getAuditNavigationInfo(
    category: AuditCategory,
    _action: AuditAction,
    _details?: AuditDetails,
    userRole?: UserRole
): AuditNavigationInfo | null {

    const path = getNavigationPathForCategory(category, userRole);
    const allowedRoles = getAllowedRolesForCategory(category);

    return { path, allowedRoles };
}

/**
 * Build navigation path for an audit entry based on its category and details
 * Used to create "View Details" action buttons in notifications
 * @deprecated Use getAuditNavigationInfo instead for role-aware navigation
 */
export function buildAuditNavigationPath(
    category: AuditCategory,
    action: AuditAction,
    details?: AuditDetails
): string | null {
    const info = getAuditNavigationInfo(category, action, details);
    return info?.path ?? null;
}

// ============================================================================
// Main Unified Function
// ============================================================================

/**
 * Create an audit entry and send notifications to relevant users.
 * This is the main unified function that handles both auditing and notifications.
 * 
 * @example
 * // Notify group members when a submission is approved
 * await auditAndNotify({
 *     group,
 *     userId: currentUser.uid,
 *     name: 'Submission Approved',
 *     description: `Chapter "${chapterName}" submission was approved by adviser`,
 *     category: 'submission',
 *     action: 'submission_approved',
 *     targets: {
 *         groupMembers: true,
 *         excludeUserId: currentUser.uid,
 *     },
 * });
 * 
 * @example
 * // Sequential approval: Statistician approved, notify adviser next
 * await auditAndNotify({
 *     group,
 *     userId: statisticianId,
 *     name: 'Statistician Approved',
 *     description: 'Statistical analysis has been approved. Awaiting adviser review.',
 *     category: 'submission',
 *     action: 'submission_approved',
 *     targets: {
 *         groupMembers: true,
 *         adviser: true,
 *         excludeUserId: statisticianId,
 *     },
 *     details: { nextApprover: 'adviser', previousApprover: 'statistician' },
 * });
 */
export async function auditAndNotify(
    options: AuditAndNotifyOptions
): Promise<AuditAndNotifyResult> {
    const {
        group,
        userId,
        name,
        description,
        category,
        action,
        details,
        targets,
        createGroupAudit = true,
        showSnackbar = true,
        notificationMessage,
        adminUserIds,
        moderatorUserIds,
        sendEmail = false,
        emailActionUrl,
        emailActionText,
    } = options;

    const result: AuditAndNotifyResult = {
        notificationIds: [],
        notifiedCount: 0,
        emailsSentCount: 0,
    };

    // Build group audit context
    const groupCtx = buildAuditContextFromGroup(group);

    // Create group audit if requested
    if (createGroupAudit) {
        try {
            result.groupAuditId = await createAuditEntry(groupCtx, {
                name,
                description,
                userId,
                category,
                action,
                details,
                showSnackbar: false, // Group audits don't directly show snackbars
            });
        } catch (error) {
            console.error('Failed to create group audit:', error);
        }
    }

    // Resolve target user IDs
    const targetUserIds = resolveTargetUserIds(
        group.members,
        targets,
        adminUserIds,
        moderatorUserIds
    );

    if (targetUserIds.length === 0) {
        return result;
    }

    // Fetch target user profiles to determine their correct audit path level
    const targetProfiles = await findUsersByIds(targetUserIds);
    const profileMap = new Map<string, UserProfile>(
        targetProfiles.map(p => [p.uid, p])
    );

    // Helper to build the correct context based on user's profile
    const buildUserContext = (targetUserId: string): UserAuditContext => {
        const profile = profileMap.get(targetUserId);
        const baseYear = group.year || getAcademicYear();

        if (profile) {
            // Determine the user's path level based on their role
            const pathLevel = getPathLevelForRole(profile.role);

            switch (pathLevel) {
                case 'year':
                    // Year-level users (admin, developer) - no department/course needed
                    return {
                        year: baseYear,
                        targetUserId,
                        level: 'year' as UserAuditLevel,
                    };
                case 'department':
                    // Department-level users (adviser, panel, editor, etc.)
                    return {
                        year: baseYear,
                        targetUserId,
                        level: 'department' as UserAuditLevel,
                        department: profile.department || group.department,
                    };
                case 'course':
                default:
                    // Course-level users (students)
                    return {
                        year: baseYear,
                        targetUserId,
                        level: 'course' as UserAuditLevel,
                        department: profile.department || group.department,
                        course: profile.course || group.course,
                    };
            }
        }

        // Fallback: use group's context if profile not found
        return {
            year: baseYear,
            targetUserId,
            level: group.department && group.course ? 'course' :
                group.department ? 'department' : 'year',
            department: group.department,
            course: group.course,
        };
    };

    // Create user notifications with correct path for each user
    const notificationEntries = targetUserIds.map((targetUserId) => {
        const ctx = buildUserContext(targetUserId);

        const data: UserAuditEntryFormData = {
            name,
            description: notificationMessage || description,
            userId,
            targetUserId,
            category,
            action,
            details: {
                ...details,
                groupId: group.id,
                groupName: group.name,
            },
            showSnackbar,
            relatedGroupId: group.id,
        };

        return { ctx, data };
    });

    try {
        result.notificationIds = await createUserAuditEntriesBatch(notificationEntries);
        result.notifiedCount = result.notificationIds.length;
    } catch (error) {
        console.error('Failed to create user notifications:', error);
    }

    // Send email notifications if enabled
    if (sendEmail && targetProfiles.length > 0) {
        try {
            result.emailsSentCount = await sendBulkAuditEmails(
                targetProfiles,
                name,
                notificationMessage || description,
                action,
                emailActionUrl,
                emailActionText
            );
        } catch (error) {
            console.error('Failed to send email notifications:', error);
        }
    }

    return result;
}

// ============================================================================
// Sequential Approval Workflow Helpers
// ============================================================================

/**
 * Approval chain order for sequential approvals
 */
export type ApprovalRole = 'statistician' | 'adviser' | 'editor' | 'panel';

/**
 * Get the next approver in the chain
 * Chain: Statistician -> Adviser -> Editor (for statistical submissions)
 * Chain: Panel -> Adviser -> Editor (for defense submissions)
 */
export function getNextApprover(
    currentRole: ApprovalRole,
    chain: 'statistical' | 'defense'
): ApprovalRole | null {
    const statisticalChain: ApprovalRole[] = ['statistician', 'adviser', 'editor'];
    const defenseChain: ApprovalRole[] = ['panel', 'adviser', 'editor'];

    const chainOrder = chain === 'statistical' ? statisticalChain : defenseChain;
    const currentIndex = chainOrder.indexOf(currentRole);

    if (currentIndex === -1 || currentIndex >= chainOrder.length - 1) {
        return null;
    }

    return chainOrder[currentIndex + 1];
}

/**
 * Notify the next approver in a sequential approval chain
 */
export async function notifyNextApprover(options: {
    group: ThesisGroup;
    currentApproverId: string;
    currentRole: ApprovalRole;
    chain: 'statistical' | 'defense';
    itemName: string;
    itemType: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult | null> {
    const { group, currentApproverId, currentRole, chain, itemName, itemType, details } = options;

    const nextRole = getNextApprover(currentRole, chain);
    if (!nextRole) return null;

    // Get the next approver's user ID
    let nextApproverId: string | undefined;
    const targets: NotificationTargets = { excludeUserId: currentApproverId };

    switch (nextRole) {
        case 'adviser':
            nextApproverId = group.members.adviser;
            targets.adviser = true;
            break;
        case 'editor':
            nextApproverId = group.members.editor;
            targets.editor = true;
            break;
        case 'statistician':
            nextApproverId = group.members.statistician;
            targets.statistician = true;
            break;
        case 'panel':
            // For panel, notify all panel members
            targets.panels = true;
            break;
    }

    if (!nextApproverId && nextRole !== 'panel') {
        console.warn(`No ${nextRole} assigned to group ${group.id}`);
        return null;
    }

    const roleLabel = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
    const nextRoleLabel = nextRole.charAt(0).toUpperCase() + nextRole.slice(1);

    return auditAndNotify({
        group,
        userId: currentApproverId,
        name: `${roleLabel} Approved - ${nextRoleLabel} Review Required`,
        description: `${itemType} "${itemName}" was approved by ${roleLabel}. Awaiting ${nextRoleLabel} review.`,
        category: 'submission',
        action: 'submission_approved',
        targets,
        details: {
            ...details,
            previousApprover: currentRole,
            nextApprover: nextRole,
            itemName,
            itemType,
        },
        sendEmail: true,
    });
}

// ============================================================================
// Specialized Notification Functions
// ============================================================================

/**
 * Notify when terminal requirements are complete
 * Notifies group members and admins
 */
export async function notifyTerminalRequirementsComplete(options: {
    group: ThesisGroup;
    userId: string;
    stageName: string;
    adminUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, stageName, adminUserIds, details } = options;

    return auditAndNotify({
        group,
        userId,
        name: 'Terminal Requirements Complete',
        description: `All terminal requirements for ${stageName} have been completed.`,
        category: 'terminal',
        action: 'terminal_approved',
        targets: {
            groupMembers: true,
            adviser: true,
            admins: true,
            excludeUserId: userId,
        },
        adminUserIds,
        details: {
            ...details,
            stageName,
            completedAt: new Date().toISOString(),
        },
        sendEmail: true,
    });
}

/**
 * Notify group members about a new submission
 */
export async function notifyNewSubmission(options: {
    group: ThesisGroup;
    userId: string;
    chapterName: string;
    stageName?: string;
    submissionVersion: number;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, chapterName, stageName, submissionVersion, details } = options;

    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;

    return auditAndNotify({
        group,
        userId,
        name: 'New Submission',
        description: `New submission (v${submissionVersion}) uploaded for chapter "${chapterDisplay}".`,
        category: 'submission',
        action: 'submission_created',
        targets: {
            groupMembers: true,
            adviser: true,
            editor: true,
            excludeUserId: userId,
        },
        details: {
            ...details,
            stageName,
            chapterName,
            submissionVersion,
        },
        sendEmail: true,
    });
}

/**
 * Notify about submission approval (handles sequential workflow)
 */
export async function notifySubmissionApproval(options: {
    group: ThesisGroup;
    approverId: string;
    approverRole: ApprovalRole;
    chapterName: string;
    stageName?: string;
    isSequential: boolean;
    chain?: 'statistical' | 'defense';
    isFinalApproval?: boolean;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const {
        group, approverId, approverRole, chapterName, stageName,
        isSequential, chain = 'statistical', isFinalApproval, details
    } = options;

    const roleLabel = approverRole.charAt(0).toUpperCase() + approverRole.slice(1);
    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;

    // If it's a sequential approval and not the final one, notify the next approver
    // The notifyNextApprover already creates an audit entry, so we don't need another
    if (isSequential && !isFinalApproval) {
        const result = await notifyNextApprover({
            group,
            currentApproverId: approverId,
            currentRole: approverRole,
            chain,
            itemName: chapterDisplay,
            itemType: 'Chapter',
            details: { ...details, stageName },
        });

        if (result) {
            return result;
        }
    }

    // Final approval or non-sequential
    return auditAndNotify({
        group,
        userId: approverId,
        name: isFinalApproval ? 'Submission Fully Approved' : `${roleLabel} Approved`,
        description: isFinalApproval
            ? `Chapter "${chapterDisplay}" has been fully approved by all reviewers.`
            : `Chapter "${chapterDisplay}" was approved by ${roleLabel}.`,
        category: 'submission',
        action: 'submission_approved',
        targets: {
            groupMembers: true,
            adviser: true,
            editor: true,
            excludeUserId: approverId,
        },
        details: {
            ...details,
            stageName,
            approverRole,
            isFinalApproval,
        },
        sendEmail: true,
    });
}

/**
 * Notify about submission rejection
 */
export async function notifySubmissionRejection(options: {
    group: ThesisGroup;
    rejectorId: string;
    rejectorRole: ApprovalRole;
    chapterName: string;
    stageName?: string;
    reason?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, rejectorId, rejectorRole, chapterName, stageName, reason, details } = options;

    const roleLabel = rejectorRole.charAt(0).toUpperCase() + rejectorRole.slice(1);
    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;

    return auditAndNotify({
        group,
        userId: rejectorId,
        name: 'Submission Rejected',
        description: `Chapter "${chapterDisplay}" was rejected by ${roleLabel}.${reason ? ` Reason: ${reason}` : ''}`,
        category: 'submission',
        action: 'submission_rejected',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: rejectorId,
        },
        details: {
            ...details,
            stageName,
            rejectorRole,
            reason,
        },
        sendEmail: true,
    });
}

/**
 * Notify about revision request
 */
export async function notifyRevisionRequested(options: {
    group: ThesisGroup;
    requesterId: string;
    requesterRole: ApprovalRole;
    chapterName: string;
    stageName?: string;
    comments?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, requesterId, requesterRole, chapterName, stageName, comments, details } = options;

    const roleLabel = requesterRole.charAt(0).toUpperCase() + requesterRole.slice(1);
    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;

    return auditAndNotify({
        group,
        userId: requesterId,
        name: 'Revision Requested',
        description: `${roleLabel} requested revisions for chapter "${chapterDisplay}".`,
        category: 'submission',
        action: 'submission_revision_requested',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: requesterId,
        },
        details: {
            ...details,
            stageName,
            requesterRole,
            comments,
        },
        sendEmail: true,
    });
}

/**
 * Notify moderators about department-wide events
 */
export async function notifyModerators(options: {
    group: ThesisGroup;
    userId: string;
    name: string;
    description: string;
    category: AuditCategory;
    action: AuditAction;
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const {
        group, userId, name, description, category, action,
        moderatorUserIds, details
    } = options;

    return auditAndNotify({
        group,
        userId,
        name,
        description,
        category,
        action,
        targets: {
            moderators: true,
            excludeUserId: userId,
        },
        moderatorUserIds,
        details,
        sendEmail: true,
    });
}

/**
 * Notify about expert assignment (adviser, editor, statistician)
 */
export async function notifyExpertAssignment(options: {
    group: ThesisGroup;
    assignerId: string;
    expertId: string;
    expertRole: 'adviser' | 'editor' | 'statistician' | 'panel';
    expertName?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, assignerId, expertId, expertRole, expertName, details } = options;

    const roleLabel = expertRole.charAt(0).toUpperCase() + expertRole.slice(1);
    const actionMap: Record<string, AuditAction> = {
        adviser: 'adviser_assigned',
        editor: 'editor_assigned',
        statistician: 'statistician_assigned',
        panel: 'panel_assigned',
    };

    return auditAndNotify({
        group,
        userId: assignerId,
        name: `${roleLabel} Assigned`,
        description: expertName
            ? `${expertName} has been assigned as ${roleLabel} for group "${group.name}".`
            : `A ${roleLabel} has been assigned to group "${group.name}".`,
        category: 'expert',
        action: actionMap[expertRole],
        targets: {
            groupMembers: true,
            userIds: [expertId],
            excludeUserId: assignerId,
        },
        details: {
            ...details,
            expertId,
            expertRole,
            expertName,
        },
        sendEmail: true,
    });
}

/**
 * Notify about stage change
 */
export async function notifyStageChange(options: {
    group: ThesisGroup;
    userId: string;
    previousStage: string;
    newStage: string;
    adminUserIds?: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, previousStage, newStage, adminUserIds, details } = options;

    return auditAndNotify({
        group,
        userId,
        name: 'Stage Changed',
        description: `Group "${group.name}" has advanced from ${previousStage} to ${newStage}.`,
        category: 'stage',
        action: 'thesis_stage_changed',
        targets: {
            groupMembers: true,
            adviser: true,
            editor: true,
            admins: !!adminUserIds,
            excludeUserId: userId,
        },
        adminUserIds,
        details: {
            ...details,
            previousStage,
            newStage,
        },
        sendEmail: true,
    });
}

/**
 * Audit only for panel comment creation.
 * Creates an audit entry but does not send notifications or emails.
 */
export async function auditPanelCommentCreated(options: {
    group: ThesisGroup;
    panelId: string;
    stageName: string;
    commentPreview?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, panelId, stageName, commentPreview, details } = options;

    return auditAndNotify({
        group,
        userId: panelId,
        name: 'Panel Comment Added',
        description: `A panel comment was added for ${stageName} stage.`,
        category: 'panel',
        action: 'panel_comment_added',
        targets: {
            // No notification targets - audit only
            excludeUserId: panelId,
        },
        details: {
            ...details,
            stageName,
            commentPreview,
        },
        // No email, no snackbar - just audit
        sendEmail: false,
    });
}

/**
 * Notify admins when panel marks their comment sheet as ready for release.
 * Includes email notification to admins. Shows department, course, and group info.
 */
export async function notifyPanelCommentsReadyForRelease(options: {
    group: ThesisGroup;
    panelId: string;
    panelName?: string;
    stageName: string;
    commentCount: number;
    adminUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, panelId, panelName, stageName, commentCount, adminUserIds, details } = options;

    const department = group.department || 'Unknown Department';
    const course = group.course || 'Unknown Course';
    const panelDisplay = panelName || 'A panel member';

    return auditAndNotify({
        group,
        userId: panelId,
        name: 'Panel Comments Ready for Release',
        description: `${panelDisplay}'s comments (${commentCount}) for ${stageName} stage ` +
            `are ready to be released. Group: ${group.name} | ${department} - ${course}.`,
        category: 'panel',
        action: 'panel_comments_ready',
        targets: {
            admins: true,
            userIds: adminUserIds,
            excludeUserId: panelId,
        },
        adminUserIds,
        details: {
            ...details,
            stageName,
            commentCount,
            panelId,
            panelName,
            department,
            course,
        },
        sendEmail: true,
        emailActionText: 'Review Comments',
    });
}

/**
 * Notify students when panel comments are released by admin.
 * Sends email to students (group members). Includes comment count.
 */
export async function notifyPanelCommentsReleasedToStudents(options: {
    group: ThesisGroup;
    releaserId: string;
    panelistName: string;
    stageName: string;
    commentCount?: number;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, releaserId, panelistName, stageName, commentCount, details } = options;

    const countInfo = commentCount
        ? ` (${commentCount} comment${commentCount > 1 ? 's' : ''})`
        : '';

    return auditAndNotify({
        group,
        userId: releaserId,
        name: 'Panel Comments Released',
        description: `Panel comments${countInfo} for ${stageName} stage from ${panelistName} have been released. ` +
            'Please review and address the feedback.',
        category: 'panel',
        action: 'panel_comment_released',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: releaserId,
        },
        details: {
            ...details,
            stageName,
            panelistName,
            commentCount,
        },
        sendEmail: true,
        emailActionText: 'View Comments',
    });
}

/**
 * @deprecated Use notifyPanelCommentsReleasedToStudents instead
 * Notify about panel comment release
 */
export async function notifyPanelCommentsReleased(options: {
    group: ThesisGroup;
    releaserId: string;
    commentCount: number;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, releaserId, commentCount, details } = options;

    return auditAndNotify({
        group,
        userId: releaserId,
        name: 'Panel Comments Released',
        description: `${commentCount} panel comment${commentCount > 1 ? 's have' : ' has'} been released for group "${group.name}".`,
        category: 'panel',
        action: 'panel_comment_released',
        targets: {
            groupMembers: true,
            adviser: true,
            excludeUserId: releaserId,
        },
        details: {
            ...details,
            commentCount,
        },
        sendEmail: true,
    });
}

// ============================================================================
// Chat / Comment Notification Functions
// ============================================================================

/**
 * Notify group members about a new chat message in the thesis workspace.
 * Notifies all relevant stakeholders based on the commenter's role.
 */
export async function notifyNewChatMessage(options: {
    group: ThesisGroup;
    senderId: string;
    senderRole: 'student' | 'adviser' | 'editor' | 'statistician' | 'moderator' | 'chair';
    chapterName: string;
    stageName?: string;
    hasAttachments?: boolean;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, senderId, senderRole, chapterName, stageName, hasAttachments, details } = options;

    const roleLabel = senderRole.charAt(0).toUpperCase() + senderRole.slice(1);
    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;
    const attachmentNote = hasAttachments ? ' (with attachments)' : '';

    // Determine notification targets based on sender role
    const targets: NotificationTargets = {
        groupMembers: true,
        excludeUserId: senderId,
    };

    // If sender is an expert, also notify other relevant experts
    if (senderRole !== 'student') {
        targets.adviser = senderRole !== 'adviser';
        targets.editor = senderRole !== 'editor';
        targets.statistician = senderRole !== 'statistician';
    } else {
        // Student sent the message - notify all assigned experts
        targets.adviser = true;
        targets.editor = true;
        targets.statistician = true;
    }

    return auditAndNotify({
        group,
        userId: senderId,
        name: 'New Feedback Message',
        description: `${roleLabel} posted a new message on "${chapterDisplay}"${attachmentNote}.`,
        category: 'comment',
        action: 'comment_added',
        targets,
        details: {
            ...details,
            chapterName,
            stageName,
            senderRole,
            hasAttachments,
        },
        sendEmail: true,
    });
}

// ============================================================================
// Draft Management Notification Functions
// ============================================================================

/**
 * Notify about draft submission deletion.
 * Notifies group members about the deletion (mostly informational).
 */
export async function notifyDraftDeleted(options: {
    group: ThesisGroup;
    userId: string;
    chapterName: string;
    stageName?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, chapterName, stageName, details } = options;

    const chapterDisplay = stageName ? `${stageName}: ${chapterName}` : chapterName;

    return auditAndNotify({
        group,
        userId,
        name: 'Draft Submission Deleted',
        description: `Draft for "${chapterDisplay}" was deleted.`,
        category: 'submission',
        action: 'submission_deleted',
        targets: {
            groupMembers: true,
            excludeUserId: userId,
        },
        details: {
            ...details,
            chapterName,
            stageName,
        },
        // Don't send email for draft deletion - it's a minor action
        sendEmail: false,
    });
}

// ============================================================================
// Topic Proposal Notification Functions
// ============================================================================

/**
 * Notify chair that a topic proposal requires their decision after moderator approval.
 * Also notifies group members about the moderator approval.
 */
export async function notifyModeratorApprovedTopicForChair(options: {
    group: ThesisGroup;
    moderatorId: string;
    proposalTitle: string;
    chairUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, moderatorId, proposalTitle, chairUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: moderatorId,
        name: 'Topic Awaiting Program Chair Decision',
        description: `Topic "${proposalTitle}" has been approved by the moderator and now requires Program Chair decision.`,
        category: 'proposal',
        action: 'proposal_approved',
        targets: {
            groupMembers: true,
            userIds: chairUserIds,
            excludeUserId: moderatorId,
        },
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'moderator',
            nextReviewerRole: 'chair',
            awaitingChairDecision: true,
        },
        sendEmail: true,
        emailActionText: 'Review Proposal',
    });
}

/**
 * Notify head that a topic proposal requires their decision after moderator approval.
 * Also notifies group members about the moderator approval.
 * NOTE: With the new flow, moderator -> chair -> head, this now sends to chair first.
 * @deprecated Use notifyModeratorApprovedTopicForChair instead
 */
export async function notifyModeratorApprovedTopicForHead(options: {
    group: ThesisGroup;
    moderatorId: string;
    proposalTitle: string;
    headUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, moderatorId, proposalTitle, headUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: moderatorId,
        name: 'Topic Awaiting Program Chair Decision',
        description: `Topic "${proposalTitle}" has been approved by the moderator and now requires Program Chair decision.`,
        category: 'proposal',
        action: 'proposal_approved',
        targets: {
            groupMembers: true,
            userIds: headUserIds,
            excludeUserId: moderatorId,
        },
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'moderator',
            nextReviewerRole: 'chair',
            awaitingChairDecision: true,
        },
        sendEmail: true,
        emailActionText: 'Review Proposal',
    });
}

/**
 * Notify moderator and head when a topic proposal is submitted for review.
 * Also notifies group members.
 */
export async function notifyTopicProposalSubmitted(options: {
    group: ThesisGroup;
    submitterId: string;
    batchNumber: number;
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, submitterId, batchNumber, moderatorUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: submitterId,
        name: 'Topic Proposals Submitted',
        description: `Topic proposals (Batch ${batchNumber}) have been submitted for moderator review.`,
        category: 'proposal',
        action: 'proposal_submitted',
        targets: {
            groupMembers: true,
            moderators: true,
            excludeUserId: submitterId,
        },
        moderatorUserIds,
        details: {
            ...details,
            batchNumber,
            awaitingModeratorReview: true,
        },
        sendEmail: true,
        emailActionText: 'Review Proposals',
    });
}

/**
 * Notify head and moderator when a topic is used as the thesis topic.
 * Also notifies group members.
 */
export async function notifyTopicUsedAsThesis(options: {
    group: ThesisGroup;
    userId: string;
    topicTitle: string;
    headUserIds: string[];
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, topicTitle, headUserIds, moderatorUserIds, details } = options;

    // Combine head and moderator IDs, removing duplicates
    const allReviewerIds = [...new Set([...headUserIds, ...moderatorUserIds])];

    return auditAndNotify({
        group,
        userId,
        name: 'Thesis Topic Selected',
        description: `Topic "${topicTitle}" has been selected as the thesis topic for group "${group.name}".`,
        category: 'thesis',
        action: 'thesis_created',
        targets: {
            groupMembers: true,
            adviser: true,
            editor: true,
            userIds: allReviewerIds,
            excludeUserId: userId,
        },
        details: {
            ...details,
            topicTitle,
            thesisCreatedFrom: 'topic_proposal',
        },
        sendEmail: true,
        emailActionText: 'View Thesis',
    });
}

/**
 * Notify when head approves a topic proposal.
 * Notifies group members, moderators, and relevant experts.
 */
export async function notifyHeadApprovedTopic(options: {
    group: ThesisGroup;
    headId: string;
    proposalTitle: string;
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, headId, proposalTitle, moderatorUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: headId,
        name: 'Topic Approved by Head',
        description: `Topic "${proposalTitle}" has been approved by the Research Head. ` +
            'The group can now proceed with the thesis.',
        category: 'proposal',
        action: 'proposal_approved',
        targets: {
            groupMembers: true,
            adviser: true,
            editor: true,
            moderators: true,
            excludeUserId: headId,
        },
        moderatorUserIds,
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'head',
            approvedForThesis: true,
        },
        sendEmail: true,
        emailActionText: 'View Topic',
    });
}

/**
 * Notify when head rejects a topic proposal.
 * Notifies group members and moderators.
 */
export async function notifyHeadRejectedTopic(options: {
    group: ThesisGroup;
    headId: string;
    proposalTitle: string;
    reason?: string;
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, headId, proposalTitle, reason, moderatorUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: headId,
        name: 'Topic Rejected by Head',
        description: `Topic "${proposalTitle}" has been rejected by the Research Head.` +
            `${reason ? ` Reason: ${reason}` : ''}`,
        category: 'proposal',
        action: 'proposal_rejected',
        targets: {
            groupMembers: true,
            moderators: true,
            excludeUserId: headId,
        },
        moderatorUserIds,
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'head',
            reason,
        },
        sendEmail: true,
        emailActionText: 'View Feedback',
    });
}

// ============================================================================
// Program Chair (Chair) Notification Functions
// ============================================================================

/**
 * Notify head that a topic proposal requires their decision after chair approval.
 * Also notifies group members and moderators about the chair approval.
 */
export async function notifyChairApprovedTopicForHead(options: {
    group: ThesisGroup;
    chairId: string;
    proposalTitle: string;
    headUserIds: string[];
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, chairId, proposalTitle, headUserIds, moderatorUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: chairId,
        name: 'Topic Awaiting Head Decision',
        description: `Topic "${proposalTitle}" has been approved by the Program Chair and now requires Research Head decision.`,
        category: 'proposal',
        action: 'proposal_approved',
        targets: {
            groupMembers: true,
            moderators: true,
            userIds: headUserIds,
            excludeUserId: chairId,
        },
        moderatorUserIds,
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'chair',
            nextReviewerRole: 'head',
            awaitingHeadDecision: true,
        },
        sendEmail: true,
        emailActionText: 'Review Proposal',
    });
}

/**
 * Notify when chair rejects a topic proposal.
 * Notifies group members and moderators.
 */
export async function notifyChairRejectedTopic(options: {
    group: ThesisGroup;
    chairId: string;
    proposalTitle: string;
    reason?: string;
    moderatorUserIds: string[];
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, chairId, proposalTitle, reason, moderatorUserIds, details } = options;

    return auditAndNotify({
        group,
        userId: chairId,
        name: 'Topic Rejected by Program Chair',
        description: `Topic "${proposalTitle}" has been rejected by the Program Chair.` +
            `${reason ? ` Reason: ${reason}` : ''}`,
        category: 'proposal',
        action: 'proposal_rejected',
        targets: {
            groupMembers: true,
            moderators: true,
            excludeUserId: chairId,
        },
        moderatorUserIds,
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'chair',
            reason,
        },
        sendEmail: true,
        emailActionText: 'View Feedback',
    });
}

// ============================================================================
// Terminal Requirement Notification Functions
// ============================================================================

/**
 * Terminal requirement approval role type
 */
export type TerminalApprovalRole = 'panel' | 'adviser' | 'editor' | 'statistician';

/**
 * Notify when a terminal requirement draft file is uploaded.
 * Notifies group members about the file upload (minor notification, no email).
 */
export async function notifyTerminalDraftUploaded(options: {
    group: ThesisGroup;
    userId: string;
    stageName: string;
    requirementTitle: string;
    fileName?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, stageName, requirementTitle, fileName, details } = options;

    const fileNote = fileName ? ` (${fileName})` : '';

    return auditAndNotify({
        group,
        userId,
        name: 'Terminal Requirement File Uploaded',
        description: `A file${fileNote} was uploaded for "${requirementTitle}" in ${stageName}.`,
        category: 'terminal',
        action: 'file_uploaded',
        targets: {
            groupMembers: true,
            excludeUserId: userId,
        },
        details: {
            ...details,
            stageName,
            requirementTitle,
            fileName,
        },
        // Don't send email for draft uploads - it's a minor action
        sendEmail: false,
    });
}

/**
 * Notify when terminal requirements are submitted for checking.
 * Notifies group members, experts (adviser, editor, statistician), and panels.
 */
export async function notifyTerminalSubmittedForChecking(options: {
    group: ThesisGroup;
    userId: string;
    stageName: string;
    requirementCount: number;
    isPreStage: boolean;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, userId, stageName, requirementCount, isPreStage, details } = options;

    // Build targets based on stage type
    const targets: NotificationTargets = {
        groupMembers: true,
        adviser: true,
        editor: true,
        statistician: true,
        excludeUserId: userId,
    };

    // Panel approval is only required for "Post" stages, not "Pre" stages
    if (!isPreStage) {
        targets.panels = true;
    }

    return auditAndNotify({
        group,
        userId,
        name: 'Terminal Requirements Submitted',
        description: `${requirementCount} terminal requirement${requirementCount > 1 ? 's' : ''} for ${stageName} ` +
            `${requirementCount > 1 ? 'have' : 'has'} been submitted for review.`,
        category: 'terminal',
        action: 'terminal_submitted',
        targets,
        details: {
            ...details,
            stageName,
            requirementCount,
            isPreStage,
        },
        sendEmail: true,
        emailActionText: 'Review Requirements',
    });
}

/**
 * Notify when a terminal requirement stage is approved by an expert/panel.
 * Handles both individual approval and full approval notifications.
 */
export async function notifyTerminalApproval(options: {
    group: ThesisGroup;
    approverId: string;
    approverRole: TerminalApprovalRole;
    stageName: string;
    isFinalApproval: boolean;
    nextApproverRole?: TerminalApprovalRole | null;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const {
        group, approverId, approverRole, stageName,
        isFinalApproval, nextApproverRole, details
    } = options;

    const roleLabel = approverRole.charAt(0).toUpperCase() + approverRole.slice(1);

    // Build notification targets
    const targets: NotificationTargets = {
        groupMembers: true,
        excludeUserId: approverId,
    };

    if (isFinalApproval) {
        // Final approval - notify all stakeholders
        targets.adviser = true;
        targets.editor = true;
        targets.statistician = true;
        targets.panels = true;

        return auditAndNotify({
            group,
            userId: approverId,
            name: `${stageName}: Terminal Requirements Fully Approved`,
            description: `All terminal requirements for ${stageName} have been fully approved. ` +
                'The group can now proceed to the next stage.',
            category: 'terminal',
            action: 'terminal_approved',
            targets,
            details: {
                ...details,
                stageName,
                approverRole,
                isFinalApproval: true,
                completedAt: new Date().toISOString(),
            },
            sendEmail: true,
            emailActionText: 'View Requirements',
        });
    }

    // Individual approval - notify next approver if applicable
    if (nextApproverRole) {
        const nextRoleLabel = nextApproverRole.charAt(0).toUpperCase() + nextApproverRole.slice(1);

        // Add next approver to targets
        switch (nextApproverRole) {
            case 'adviser':
                targets.adviser = true;
                break;
            case 'editor':
                targets.editor = true;
                break;
            case 'statistician':
                targets.statistician = true;
                break;
            case 'panel':
                targets.panels = true;
                break;
        }

        return auditAndNotify({
            group,
            userId: approverId,
            name: `${stageName}: Approved by ${roleLabel}`,
            description: `${stageName} terminal requirements have been approved by ${roleLabel}. ` +
                `Awaiting ${nextRoleLabel} review.`,
            category: 'terminal',
            action: 'terminal_approved',
            targets,
            details: {
                ...details,
                stageName,
                approverRole,
                nextApproverRole,
                isFinalApproval: false,
            },
            sendEmail: true,
            emailActionText: 'Review Requirements',
        });
    }

    // Simple approval notification (no next approver specified)
    return auditAndNotify({
        group,
        userId: approverId,
        name: `${stageName}: Approved by ${roleLabel}`,
        description: `${stageName} terminal requirements have been approved by ${roleLabel}.`,
        category: 'terminal',
        action: 'terminal_approved',
        targets: {
            groupMembers: true,
            adviser: true,
            excludeUserId: approverId,
        },
        details: {
            ...details,
            stageName,
            approverRole,
        },
        sendEmail: true,
    });
}

/**
 * Notify when terminal requirements are returned by an expert/panel.
 * Notifies group members and the leader specifically.
 */
export async function notifyTerminalReturned(options: {
    group: ThesisGroup;
    returnerId: string;
    returnerRole: TerminalApprovalRole;
    stageName: string;
    note?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, returnerId, returnerRole, stageName, note, details } = options;

    const roleLabel = returnerRole.charAt(0).toUpperCase() + returnerRole.slice(1);

    return auditAndNotify({
        group,
        userId: returnerId,
        name: `${stageName}: Returned by ${roleLabel}`,
        description: `${stageName} terminal requirements have been returned by ${roleLabel}.` +
            `${note ? ` Note: ${note}` : ' Please review and resubmit.'}`,
        category: 'terminal',
        action: 'terminal_rejected',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: returnerId,
        },
        details: {
            ...details,
            stageName,
            returnerRole,
            note,
        },
        sendEmail: true,
        emailActionText: 'View Feedback',
    });
}

/**
 * Notify when moderator rejects a topic proposal.
 * Notifies group members.
 */
export async function notifyModeratorRejectedTopic(options: {
    group: ThesisGroup;
    moderatorId: string;
    proposalTitle: string;
    reason?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, moderatorId, proposalTitle, reason, details } = options;

    return auditAndNotify({
        group,
        userId: moderatorId,
        name: 'Topic Rejected by Moderator',
        description: `Topic "${proposalTitle}" has been rejected by the moderator.` +
            `${reason ? ` Reason: ${reason}` : ''}`,
        category: 'proposal',
        action: 'proposal_rejected',
        targets: {
            groupMembers: true,
            excludeUserId: moderatorId,
        },
        details: {
            ...details,
            proposalTitle,
            reviewerRole: 'moderator',
            reason,
        },
        sendEmail: true,
        emailActionText: 'View Feedback',
    });
}
// ============================================================================
// Admin Template Audit Functions
// ============================================================================

import { findUsersByFilter } from './firebase/firestore/user';

/**
 * Result of admin template audit operations
 */
export interface AdminTemplateAuditResult {
    /** Number of users notified */
    notifiedCount: number;
    /** Number of emails sent successfully */
    emailsSentCount: number;
    /** IDs of created user audit entries */
    auditIds: string[];
}

/**
 * Send audit notifications for skill template changes
 * Notifies heads in the department with email
 * @param options - Skill template audit options
 */
export async function auditSkillTemplateChange(options: {
    userId: string;
    department: string;
    action: 'skill_template_created' | 'skill_template_updated' | 'skill_template_deleted' | 'skill_template_reset';
    skillName?: string;
    details?: AuditDetails;
}): Promise<AdminTemplateAuditResult> {
    const { userId, department, action, skillName, details } = options;
    const year = getAcademicYear();

    // Find heads in the department
    const heads = await findUsersByFilter({ role: 'head', department });
    const targetUserIds = heads.map((h) => h.uid).filter((uid) => uid !== userId);

    if (targetUserIds.length === 0) {
        return { notifiedCount: 0, emailsSentCount: 0, auditIds: [] };
    }

    // Build name and description based on action
    let name: string;
    let description: string;
    switch (action) {
        case 'skill_template_created':
            name = `Skill Template Created: ${skillName || 'Unknown'}`;
            description = `A new skill template "${skillName || 'Unknown'}" was added for ${department}.`;
            break;
        case 'skill_template_updated':
            name = `Skill Template Updated: ${skillName || 'Unknown'}`;
            description = `Skill template "${skillName || 'Unknown'}" was updated for ${department}.`;
            break;
        case 'skill_template_deleted':
            name = `Skill Template Deleted: ${skillName || 'Unknown'}`;
            description = `Skill template "${skillName || 'Unknown'}" was removed from ${department}.`;
            break;
        case 'skill_template_reset':
            name = 'Skills Templates Reset';
            description = `All skill templates were reset to defaults for ${department}.`;
            break;
    }

    // Create user audit entries for each head
    const entries: { ctx: UserAuditContext; data: UserAuditEntryFormData }[] = targetUserIds.map((targetUserId) => ({
        ctx: {
            year,
            targetUserId,
            level: 'department' as UserAuditLevel,
            department,
        },
        data: {
            name,
            description,
            userId,
            targetUserId,
            category: 'template' as AuditCategory,
            action,
            showSnackbar: true,
            details: {
                ...details,
                templateType: 'skill',
                department,
                skillName,
            },
        },
    }));

    const auditIds = await createUserAuditEntriesBatch(entries);

    // Send email notifications
    let emailsSentCount = 0;
    if (targetUserIds.length > 0) {
        const profiles = await findUsersByIds(targetUserIds);
        emailsSentCount = await sendBulkAuditEmails(
            profiles,
            name,
            description,
            action,
            '/admin/skills-management',
            'View Skills'
        );
    }

    return {
        notifiedCount: targetUserIds.length,
        emailsSentCount,
        auditIds,
    };
}

/**
 * Send audit notifications for agenda template changes
 * Notifies heads in the department (or all heads for institutional agenda) with email
 * @param options - Agenda template audit options
 */
export async function auditAgendaTemplateChange(options: {
    userId: string;
    agendaType: 'institutional' | 'departmental';
    department?: string;
    action: 'agenda_template_updated' | 'agenda_template_reset';
    details?: AuditDetails;
}): Promise<AdminTemplateAuditResult> {
    const { userId, agendaType, department, action, details } = options;
    const year = getAcademicYear();

    // Find heads - either all heads (institutional) or department heads (departmental)
    let heads: UserProfile[];
    if (agendaType === 'institutional') {
        heads = await findUsersByFilter({ role: 'head' });
    } else {
        if (!department) {
            return { notifiedCount: 0, emailsSentCount: 0, auditIds: [] };
        }
        heads = await findUsersByFilter({ role: 'head', department });
    }

    const targetUserIds = heads.map((h) => h.uid).filter((uid) => uid !== userId);

    if (targetUserIds.length === 0) {
        return { notifiedCount: 0, emailsSentCount: 0, auditIds: [] };
    }

    // Build name and description based on action
    let name: string;
    let description: string;
    const agendaLabel = agendaType === 'institutional' ? 'Institutional Agenda' : `${department} Agenda`;

    switch (action) {
        case 'agenda_template_updated':
            name = `${agendaLabel} Updated`;
            description = `The ${agendaLabel.toLowerCase()} template has been updated.`;
            break;
        case 'agenda_template_reset':
            name = `${agendaLabel} Reset`;
            description = `The ${agendaLabel.toLowerCase()} template has been reset to defaults.`;
            break;
    }

    // Create user audit entries for each head
    const entries: { ctx: UserAuditContext; data: UserAuditEntryFormData }[] = targetUserIds.map((targetUserId) => {
        // For institutional, use year-level; for departmental, use department-level
        const ctx: UserAuditContext = agendaType === 'institutional'
            ? { year, targetUserId, level: 'year' as UserAuditLevel }
            : { year, targetUserId, level: 'department' as UserAuditLevel, department };

        return {
            ctx,
            data: {
                name,
                description,
                userId,
                targetUserId,
                category: 'template' as AuditCategory,
                action,
                showSnackbar: true,
                details: {
                    ...details,
                    templateType: 'agenda',
                    agendaType,
                    department,
                },
            },
        };
    });

    const auditIds = await createUserAuditEntriesBatch(entries);

    // Send email notifications
    let emailsSentCount = 0;
    if (targetUserIds.length > 0) {
        const profiles = await findUsersByIds(targetUserIds);
        emailsSentCount = await sendBulkAuditEmails(
            profiles,
            name,
            description,
            action,
            '/admin/agenda-management',
            'View Agenda'
        );
    }

    return {
        notifiedCount: targetUserIds.length,
        emailsSentCount,
        auditIds,
    };
}

/**
 * Send audit notifications for chapter template changes
 * Notifies moderators in the course with email
 * @param options - Chapter template audit options
 */
export async function auditChapterTemplateChange(options: {
    userId: string;
    department: string;
    course: string;
    action: 'chapter_template_created' | 'chapter_template_updated' | 'chapter_template_deleted' | 'chapter_template_reset';
    stageName?: string;
    chapterName?: string;
    details?: AuditDetails;
}): Promise<AdminTemplateAuditResult> {
    const { userId, department, course, action, stageName, chapterName, details } = options;
    const year = getAcademicYear();

    // Find moderators in the course
    const moderators = await findUsersByFilter({ role: 'moderator', course });
    const targetUserIds = moderators.map((m) => m.uid).filter((uid) => uid !== userId);

    if (targetUserIds.length === 0) {
        return { notifiedCount: 0, emailsSentCount: 0, auditIds: [] };
    }

    // Build name and description based on action
    let name: string;
    let description: string;
    const stageLabel = stageName ? `${stageName} stage` : 'templates';
    const chapterLabel = chapterName ? `"${chapterName}"` : '';
    const stageInfo = stageName ? ` (${stageName})` : '';

    switch (action) {
        case 'chapter_template_created':
            name = `Chapter Template Created${chapterLabel ? `: ${chapterLabel}` : ''}`;
            description = `A new chapter template${chapterLabel ? ` ${chapterLabel}` : ''} ` +
                `was added for ${course}${stageInfo}.`;
            break;
        case 'chapter_template_updated':
            name = `Chapter Templates Updated for ${course}`;
            description = `Chapter templates for ${course} (${stageLabel}) have been updated.`;
            break;
        case 'chapter_template_deleted':
            name = `Chapter Template Deleted${chapterLabel ? `: ${chapterLabel}` : ''}`;
            description = `A chapter template${chapterLabel ? ` ${chapterLabel}` : ''} ` +
                `was removed from ${course}${stageInfo}.`;
            break;
        case 'chapter_template_reset':
            name = `Chapter Templates Reset for ${course}`;
            description = `All chapter templates for ${course} have been reset to defaults.`;
            break;
    }

    // Create user audit entries for each moderator
    const entries: { ctx: UserAuditContext; data: UserAuditEntryFormData }[] = targetUserIds.map((targetUserId) => ({
        ctx: {
            year,
            targetUserId,
            level: 'course' as UserAuditLevel,
            department,
            course,
        },
        data: {
            name,
            description,
            userId,
            targetUserId,
            category: 'template' as AuditCategory,
            action,
            showSnackbar: true,
            details: {
                ...details,
                templateType: 'chapter',
                department,
                course,
                stageName,
                chapterName,
            },
        },
    }));

    const auditIds = await createUserAuditEntriesBatch(entries);

    // Send email notifications
    let emailsSentCount = 0;
    if (targetUserIds.length > 0) {
        const profiles = await findUsersByIds(targetUserIds);
        emailsSentCount = await sendBulkAuditEmails(
            profiles,
            name,
            description,
            action,
            '/admin/chapter-management',
            'View Chapters'
        );
    }

    return {
        notifiedCount: targetUserIds.length,
        emailsSentCount,
        auditIds,
    };
}
// ============================================================================
// Panel Assignment Notification Functions
// ============================================================================

/**
 * Notify panel members and group students when admin assigns a panel to a group.
 * Sends email to the assigned panel member and notifies students.
 */
export async function notifyPanelAssignedByAdmin(options: {
    group: ThesisGroup;
    adminId: string;
    panelId: string;
    panelName: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, adminId, panelId, panelName, details } = options;

    // Notify the panel member they've been assigned
    const panelResult = await auditAndNotify({
        group,
        userId: adminId,
        name: 'You Have Been Assigned as Panel',
        description: `You have been assigned as a panel member to group "${group.name}" ` +
            `(${group.course || 'Course not specified'}).`,
        category: 'expert',
        action: 'panel_assigned',
        targets: {
            userIds: [panelId],
        },
        details: {
            ...details,
            panelId,
            panelName,
            course: group.course,
        },
        sendEmail: true,
        emailActionText: 'View Assignment',
    });

    // Notify group members that a panel has been assigned
    await auditAndNotify({
        group,
        userId: adminId,
        name: 'Panel Member Assigned',
        description: `${panelName} has been assigned as a panel member to your group.`,
        category: 'expert',
        action: 'panel_assigned',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: adminId,
        },
        details: {
            ...details,
            panelId,
            panelName,
        },
        sendEmail: true,
        emailActionText: 'View Group',
    });

    return panelResult;
}

/**
 * Notify panels when students request manuscript review.
 * Sends email and notification to all panel members.
 */
export async function notifyPanelReviewRequested(options: {
    group: ThesisGroup;
    studentId: string;
    stageName: string;
    fileName?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, studentId, stageName, fileName, details } = options;

    const panelUids = group.members?.panels ?? [];

    return auditAndNotify({
        group,
        userId: studentId,
        name: 'Panel Review Requested',
        description: `A manuscript for ${stageName} stage is ready for your review. ` +
            `Group: ${group.name} (${group.course || 'Course not specified'}).`,
        category: 'panel',
        action: 'panel_review_requested',
        targets: {
            userIds: panelUids,
            excludeUserId: studentId,
        },
        details: {
            ...details,
            stageName,
            fileName,
            course: group.course,
        },
        sendEmail: true,
        emailActionText: 'Review Manuscript',
    });
}

/**
 * Notify student when a panel approves their comment.
 * Creates audit entry and sends notification toast.
 */
export async function notifyPanelCommentApproved(options: {
    group: ThesisGroup;
    panelId: string;
    stageName: string;
    commentNumber?: number;
    commentPreview?: string;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, panelId, stageName, commentNumber, commentPreview, details } = options;

    // Truncate comment preview to 50 chars
    const truncatedPreview = commentPreview && commentPreview.length > 50
        ? `${commentPreview.substring(0, 50)}...`
        : commentPreview;

    const commentInfo = commentNumber
        ? `Comment #${commentNumber}${truncatedPreview ? `: "${truncatedPreview}"` : ''}`
        : 'A comment';

    return auditAndNotify({
        group,
        userId: panelId,
        name: 'Panel Comment Approved',
        description: `${commentInfo} for ${stageName} stage has been approved.`,
        category: 'panel',
        action: 'panel_comment_approved',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: panelId,
        },
        details: {
            ...details,
            stageName,
            commentNumber,
            commentPreview: truncatedPreview,
        },
        sendEmail: false, // Email already sent by existing logic
    });
}

/**
 * Notify student when all comments from a panel are approved.
 */
export async function notifyAllPanelCommentsApproved(options: {
    group: ThesisGroup;
    panelId: string;
    panelName: string;
    stageName: string;
    totalComments: number;
    details?: AuditDetails;
}): Promise<AuditAndNotifyResult> {
    const { group, panelId, panelName, stageName, totalComments, details } = options;

    return auditAndNotify({
        group,
        userId: panelId,
        name: 'All Panel Comments Approved',
        description: `All ${totalComments} comment${totalComments > 1 ? 's' : ''} from ${panelName} ` +
            `for ${stageName} stage have been approved!`,
        category: 'panel',
        action: 'all_panel_comments_approved',
        targets: {
            groupMembers: true,
            leader: true,
            excludeUserId: panelId,
        },
        details: {
            ...details,
            stageName,
            panelName,
            totalComments,
        },
        sendEmail: true,
        emailActionText: 'View Comments',
    });
}
