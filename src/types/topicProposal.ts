/**
 * Possible workflow states for an individual topic proposal entry.
 */
export const TOPIC_PROPOSAL_ENTRY_STATUSES = [
    'draft',
    'submitted',
    'head_review',
    'head_approved',
    'head_rejected',
    'moderator_rejected',
] as const;
export type TopicProposalEntryStatus = typeof TOPIC_PROPOSAL_ENTRY_STATUSES[number];

/**
 * Decision payload recorded whenever a reviewer completes an action.
 */
export interface TopicProposalReviewerDecision {
    reviewerUid: string;
    decision: 'approved' | 'rejected';
    decidedAt: string;
    notes?: string;
}

/**
 * Represents a single topic proposal contributed by a student.
 */
export interface TopicProposalEntry {
    id: string;
    title: string;
    abstract: string;
    problemStatement?: string;
    expectedOutcome?: string;
    keywords?: string[];
    proposedBy: string; // Firebase UID of the student who proposed this topic
    createdAt: string;
    updatedAt: string;
    status: TopicProposalEntryStatus;
    moderatorDecision?: TopicProposalReviewerDecision;
    headDecision?: TopicProposalReviewerDecision;
}

/**
 * Historical review events for auditing the topic proposal lifecycle.
 */
export interface TopicProposalReviewEvent {
    stage: 'moderator' | 'head';
    decision: 'approved' | 'rejected';
    reviewerUid: string;
    proposalId: string;
    notes?: string;
    reviewedAt: string;
}

/**
 * Represents a submission cycle for up to three topic proposals.
 */
export interface TopicProposalSet {
    groupId: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    set: number;
    entries: TopicProposalEntry[];
    awaitingModerator: boolean;
    awaitingHead: boolean;
    submittedBy?: string;
    submittedAt?: string;
    usedBy?: string;
    usedAsThesisAt?: string;
    reviewHistory: TopicProposalReviewEvent[];
}

/**
 * Topic proposal set document enriched with its Firestore identifier.
 */
export type TopicProposalSetRecord = TopicProposalSet & { id: string };
