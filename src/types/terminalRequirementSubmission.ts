import type { ThesisStage } from './thesis';

export type TerminalRequirementApprovalRole = 'panel' | 'adviser' | 'editor' | 'statistician';
export type TerminalRequirementApprovalStatus = 'pending' | 'approved' | 'returned';
export type TerminalRequirementSubmissionStatus = 'draft' | 'in_review' | 'returned' | 'approved';

export interface TerminalRequirementApprovalState {
    role: TerminalRequirementApprovalRole;
    status: TerminalRequirementApprovalStatus;
    decidedAt?: string;
    decidedBy?: string;
    note?: string;
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
    stage: ThesisStage;
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
