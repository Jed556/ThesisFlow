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
import type { UserProfile } from '../types/profile';
import { createAuditEntry, buildAuditContextFromGroup } from './auditUtils';
import { createUserAuditEntriesBatch } from './firebase/firestore/userAudits';
import { findUsersByIds, getPathLevelForRole } from './firebase/firestore/user';
import { getAcademicYear } from './dateUtils';

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
 * Build navigation path for an audit entry based on its category and details
 * Used to create "View Details" action buttons in notifications
 */
export function buildAuditNavigationPath(
    category: AuditCategory,
    action: AuditAction,
    details?: AuditDetails
): string | null {
    // Map category/action to navigation paths
    switch (category) {
        case 'group':
            if (action.includes('approved') || action.includes('rejected')) {
                return '/group';
            }
            return '/group';

        case 'submission':
            // Navigate to thesis workspace
            return '/student-thesis-workspace';

        case 'proposal':
            // Navigate to topic proposals
            return '/proposals';

        case 'terminal':
            // Navigate to terminal requirements
            return '/terminal-requirements';

        case 'panel':
            // Navigate to panel comments
            return '/panel-feedback';

        case 'expert':
            // Navigate to expert requests
            if (details?.requestType === 'adviser') {
                return '/expert-requests';
            }
            return '/expert-requests';

        case 'notification':
            // Navigate to audits/notifications page
            return '/audits';

        default:
            // Default to audits page
            return '/audits';
    }
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
