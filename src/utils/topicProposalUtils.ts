import type {
    TopicProposalEntry,
    TopicProposalEntryStatus,
    TopicProposalSet,
    TopicProposalSetRecord,
} from '../types/topicProposal';

export type ProposalStatusChipColor = 'default' | 'info' | 'success' | 'warning' | 'error';

export interface ProposalStatusChipConfig {
    label: string;
    color: ProposalStatusChipColor;
}

export type TopicProposalSetWorkflowState = 'draft' | 'under_review' | 'approved' | 'rejected';

export interface TopicProposalSetMeta {
    awaitingModerator: boolean;
    awaitingHead: boolean;
    hasApproved: boolean;
    allRejected: boolean;
    workflowState: TopicProposalSetWorkflowState;
}

/**
 * Returns a human-friendly label for a topic proposal entry status.
 */
export function formatProposalStatus(status: TopicProposalEntryStatus): string {
    switch (status) {
        case 'draft':
            return 'Draft';
        case 'submitted':
            return 'Awaiting Moderator';
        case 'head_review':
            return 'Awaiting Head';
        case 'moderator_rejected':
            return 'Rejected (Moderator)';
        case 'head_rejected':
            return 'Rejected (Head)';
        case 'head_approved':
            return 'Approved';
        default:
            return status;
    }
}

/**
 * Get MUI-compatible chip props for visualising proposal status.
 */
export function getStatusChipConfig(status: TopicProposalEntryStatus): ProposalStatusChipConfig {
    switch (status) {
        case 'draft':
            return { label: 'Draft', color: 'default' };
        case 'submitted':
            return { label: 'Awaiting Moderator', color: 'info' };
        case 'head_review':
            return { label: 'Awaiting Head', color: 'warning' };
        case 'head_approved':
            return { label: 'Approved', color: 'success' };
        case 'head_rejected':
            return { label: 'Rejected (Head)', color: 'error' };
        case 'moderator_rejected':
        default:
            return { label: 'Rejected (Moderator)', color: 'error' };
    }
}

/**
 * Determines if the current topic proposal set is still editable by students.
 */
export function canEditProposalSet(set: TopicProposalSet | null | undefined): boolean {
    if (!set) {
        return false;
    }

    return set.entries.every((entry) => entry.status === 'draft');
}

/**
 * Picks the most recent non-archived topic proposal set.
 */
export function pickActiveProposalSet(sets: TopicProposalSetRecord[]): TopicProposalSetRecord | null {
    if (sets.length === 0) {
        return null;
    }

    const sorted = [...sets].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sorted.find((set) => !isProposalSetArchived(set)) ?? sorted[0];
}

/**
 * Determines whether at least one proposal entry received head approval.
 */
export function hasApprovedProposal(set: TopicProposalSet | null | undefined): boolean {
    if (!set) {
        return false;
    }
    return set.entries.some((entry) => entry.status === 'head_approved');
}

/**
 * Determines whether every proposal entry has been rejected by moderators or heads.
 */
export function areAllProposalsRejected(entries: TopicProposalEntry[]): boolean {
    if (entries.length === 0) {
        return false;
    }

    return entries.every((entry) =>
        entry.status === 'moderator_rejected' || entry.status === 'head_rejected'
    );
}

/**
 * Aggregates entry-level statuses into a lightweight set meta summary.
 */
export function summarizeProposalEntries(entries: TopicProposalEntry[]): TopicProposalSetMeta {
    const awaitingModerator = entries.some((entry) => entry.status === 'submitted');
    const awaitingHead = entries.some((entry) => entry.status === 'head_review');
    const hasApproved = entries.some((entry) => entry.status === 'head_approved');
    const allRejected = areAllProposalsRejected(entries);

    let workflowState: TopicProposalSetWorkflowState = 'draft';
    if (hasApproved) {
        workflowState = 'approved';
    } else if (allRejected) {
        workflowState = 'rejected';
    } else if (awaitingModerator || awaitingHead) {
        workflowState = 'under_review';
    }

    return {
        awaitingModerator,
        awaitingHead,
        hasApproved,
        allRejected,
        workflowState,
    } satisfies TopicProposalSetMeta;
}

/**
 * Safely summarizes a full topic proposal set record.
 */
export function getProposalSetMeta(set: TopicProposalSet | null | undefined): TopicProposalSetMeta {
    return summarizeProposalEntries(set?.entries ?? []);
}

/**
 * Treats topic proposal sets that have already seeded a thesis as archived.
 */
export function isProposalSetArchived(set: TopicProposalSet | null | undefined): boolean {
    if (!set) {
        return false;
    }

    return Boolean(set.usedAsThesisAt || set.usedBy);
}
