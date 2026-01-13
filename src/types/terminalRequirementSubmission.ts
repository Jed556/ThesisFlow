import type { ThesisStageName } from './thesis';

export type TerminalRequirementApprovalRole = 'panel' | 'adviser' | 'editor' | 'statistician';
export type TerminalRequirementApprovalStatus = 'pending' | 'approved' | 'returned';
export type TerminalRequirementSubmissionStatus = 'draft' | 'in_review' | 'returned' | 'approved';

/**
 * Individual member approval entry for roles that require multiple approvers (e.g., panel).
 */
export interface TerminalRequirementMemberApproval {
    uid: string;
    status: TerminalRequirementApprovalStatus;
    decidedAt?: string;
    note?: string;
}

export interface TerminalRequirementApprovalState {
    role: TerminalRequirementApprovalRole;
    status: TerminalRequirementApprovalStatus;
    decidedAt?: string;
    decidedBy?: string;
    note?: string;
    /**
     * For roles with multiple assigned approvers (e.g., panel), tracks individual approval status.
     * The overall `status` is 'approved' only when ALL members have approved.
     * Key is the approver's UID.
     */
    memberApprovals?: Record<string, TerminalRequirementMemberApproval>;
}

export interface TerminalRequirementSubmissionHistoryEntry {
    id: string;
    timestamp: string;
    actorUid: string;
    actorRole: TerminalRequirementApprovalRole | 'student' | 'system';
    action: 'submitted' | 'approved' | 'returned';
    message?: string;
}

export interface TerminalRequirementSubmissionRecord {
    id: string;
    thesisId: string;
    groupId: string;
    stage: ThesisStageName;
    stageKey: string;
    requirementIds: string[];
    status: TerminalRequirementSubmissionStatus;
    submittedAt?: string;
    submittedBy?: string;
    locked: boolean;
    approvals: Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>;
    assignedApprovers?: Partial<Record<TerminalRequirementApprovalRole, string[]>>;
    currentRole?: TerminalRequirementApprovalRole | null;
    returnNote?: string;
    returnedAt?: string;
    returnedBy?: TerminalRequirementApprovalRole;
    resubmissionCount?: number;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
    history?: TerminalRequirementSubmissionHistoryEntry[];
}

export type TerminalRequirementApproverAssignments = Partial<Record<TerminalRequirementApprovalRole, string[]>>;

/**
 * Link submission entry for terminal requirements (link submission mode)
 * Stored per requirement for persistence across page refreshes.
 */
export interface TerminalRequirementLinkEntry {
    /** Requirement ID this link is for */
    requirementId: string;
    /** The submitted link URL */
    linkUrl: string;
    /** Whether the link has been marked as submitted */
    submitted: boolean;
    /** When the link was submitted */
    submittedAt?: string;
    /** Who submitted the link (user UID) */
    submittedBy?: string;
}
