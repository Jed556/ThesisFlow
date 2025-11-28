import type { ESG, ThesisStatus } from './thesis';

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
 * Represents a single topic proposal contributed by a student.
 */
export interface TopicProposalEntry {
    id: string;
    title: string;
    description: string;
    agenda?: {
        mainTheme: string;
        subTheme: string;
    }
    ESG?: ESG;

    proposedBy: string;
    createdAt: Date;
    updatedAt: Date;
    status?: {
        moderator: ThesisStatus;
        head: ThesisStatus;
    }
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
export interface TopicProposalSet {
    id: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    entries: TopicProposalEntry[];
    submittedBy?: Date;
    submittedAt?: Date;
    usedAsThesisAt?: string;
    audits: TopicProposalReviewEvent[];
}
