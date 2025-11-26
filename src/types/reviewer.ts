/**
 * Roles that participate in thesis review workflows.
 */
export type ReviewerRole = 'adviser' | 'editor' | 'statistician';

/**
 * Assignment metadata for theses handled by advisers or editors.
 */
export interface ReviewerAssignment {
    /** Unique identifier for referencing the assignment. */
    id: string;
    /** Slugified thesis identifier used to join with workspace data. */
    thesisId: string;
    /** Display title of the thesis project. */
    thesisTitle: string;
    /** Role associated with the assignment. */
    role: ReviewerRole;
    /** Current workflow stage for the thesis. */
    stage: string;
    /** Completion progress represented as a 0-1 ratio. */
    progress: number;
    /** Optional due date for the next milestone or decision. */
    dueDate?: string;
    /** Email addresses assigned to the review slot. */
    assignedTo: string[];
    /** Priority indicator helping reviewers triage. */
    priority?: 'low' | 'medium' | 'high';
    /** Last activity timestamp displayed inside dashboards. */
    lastUpdated: string;
    /** List of student emails participating in the thesis. */
    studentEmails: string[];
}

import type { ChatMessage } from './chat';

/**
 * Aggregated workspace state for a reviewer focusing on a single thesis.
 */
export interface ReviewerWorkspace {
    /** Slugified thesis identifier. */
    thesisId: string;
    /** Narrative summary shown in overview panels. */
    summary: string;
    /** Highlighted chapter identifiers needing attention. */
    focusChapters: number[];
    /** File hashes for the most recently exchanged documents. */
    recentFileHashes: string[];
    /** Chat transcript scoped to this thesis. */
    chatMessages: ChatMessage[];
}
