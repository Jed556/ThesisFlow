import type { ExpertApprovalState, ExpertRole, ThesisChapter } from '../types/thesis';
import type { ThesisWithGroupContext } from './firebase/firestore/thesis';

/** Approval flow order: Statistician (if exists) → Adviser → Editor */
export const EXPERT_APPROVAL_ORDER: ExpertRole[] = ['statistician', 'adviser', 'editor'];

/** Legacy order for UI display */
export const EXPERT_ROLE_ORDER: ExpertRole[] = ['adviser', 'editor', 'statistician'];

export const expertRoleLabels: Record<ExpertRole, string> = {
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

/**
 * Get assigned expert roles from a thesis with group context
 * Expert assignments are stored on the group, not the thesis itself
 */
export const getAssignedExpertRoles = (thesis?: ThesisWithGroupContext | null): ExpertRole[] => {
    if (!thesis) {
        return [];
    }
    // Use approval order for consistency
    return EXPERT_APPROVAL_ORDER.filter((role) => Boolean(thesis[role]));
};

/**
 * Check if a role has approved in the expertApprovals array
 */
export const hasRoleApproved = (
    approvals: ExpertApprovalState | undefined,
    role: ExpertRole
): boolean => {
    if (!approvals || !Array.isArray(approvals)) return false;
    return approvals.some((approval) => approval.role === role);
};

/**
 * Get all approved roles from expertApprovals
 */
export const getApprovedRoles = (approvals: ExpertApprovalState | undefined): ExpertRole[] => {
    if (!approvals || !Array.isArray(approvals)) return [];
    return approvals.map((approval) => approval.role);
};

/**
 * Check if all required roles have approved
 */
export const areAllRolesApproved = (
    approvals: ExpertApprovalState | undefined,
    requiredRoles: ExpertRole[]
): boolean => {
    return requiredRoles.every((role) => hasRoleApproved(approvals, role));
};

export const resolveChapterExpertApprovals = (
    chapter: Pick<ThesisChapter, 'submissions'>,
    _thesis?: ThesisWithGroupContext | null,
): ExpertApprovalState | undefined => {
    // Note: expertApprovals are now stored per-file (FileAttachment.expertApprovals)
    // Return empty array as base state
    void chapter; // Mark as used
    return [];
};
