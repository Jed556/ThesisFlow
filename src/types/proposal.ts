import type { ESG, SDG, ThesisAgenda, ThesisStatus } from './thesis';

/**
 * Decision payload recorded whenever a reviewer completes an action.
 */
export interface TopicProposalReviewerDecision {
    reviewer: string;
    decision: ThesisStatus;
    decidedAt: Date;
    notes?: string;
}

/**
 * Topic proposal entry status - workflow states
 */
export type TopicProposalEntryStatus =
    | 'draft'
    | 'submitted'
    | 'moderator_rejected'
    | 'head_review'
    | 'head_approved'
    | 'head_rejected';

/**
 * Array of all valid topic proposal entry statuses
 */
export const TOPIC_PROPOSAL_ENTRY_STATUSES: TopicProposalEntryStatus[] = [
    'draft',
    'submitted',
    'moderator_rejected',
    'head_review',
    'head_approved',
    'head_rejected',
];

/**
 * Represents a single topic proposal contributed by a student.
 */
export interface TopicProposalEntry {
    id: string;
    title: string;
    description: string;
    agenda?: ThesisAgenda;
    ESG?: ESG;
    /** Sustainable Development Goal covered by this topic */
    SDG?: SDG;
    /** Problem statement for the topic */
    problemStatement?: string;
    /** Expected outcome of the research */
    expectedOutcome?: string;
    /** Keywords for the topic */
    keywords?: string[];
    proposedBy: string;
    createdAt: Date;
    updatedAt: Date;
    /** Entry status - single string workflow state */
    status?: TopicProposalEntryStatus;
    /** Whether this entry has been used as the thesis topic */
    usedAsThesis?: boolean;
}

/**
 * Historical review events for auditing the topic proposal lifecycle.
 */
export interface TopicProposalReviewEvent {
    stage: 'moderator' | 'head';
    status: 'approved' | 'rejected';
    reviewerUid: string;
    proposalId: string;
    notes?: string;
    reviewedAt: Date;
}

/**
 * Represents a submission cycle for up to three topic proposals.
 */
export interface TopicProposalBatch {
    id: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    entries: TopicProposalEntry[];
    submittedBy?: Date;
    submittedAt?: Date;
    usedAsThesisAt?: string;
    audits: TopicProposalReviewEvent[];
    /** Set number for ordering multiple proposal sets */
    batch?: number;
    /** Whether any entry is awaiting head review */
    awaitingHead?: boolean;
    /** Whether any entry is awaiting moderator review */
    awaitingModerator?: boolean;
    /** Group ID this proposal set belongs to (extracted from path) */
    groupId?: string;
    /** UID of user who marked this as used for thesis */
    usedBy?: string;
    /** Historical review events */
    reviewHistory?: TopicProposalReviewEvent[];
}

/**
 * TopicProposalSet with ID guaranteed
 */
export type TopicProposalSetRecord = TopicProposalBatch & { id: string };
