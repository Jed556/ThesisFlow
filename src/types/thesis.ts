import type { FileAttachment } from './file';

/**
 * Thesis-specific role types - Based on thesis data context
 */
export type ThesisRole = 'leader' | 'member' | 'adviser' | 'editor' | 'statistician' | 'unknown';
export type MentorRole = Extract<ThesisRole, 'adviser' | 'editor' | 'statistician'>;
export type MentorApprovalState = Partial<Record<MentorRole, boolean>>;
export type ChapterSubmissionStatus = 'approved' | 'under_review' | 'revision_required';

export interface ChapterSubmissionEntry {
    id: string;
    status: ChapterSubmissionStatus;
    decidedAt?: string | null;
    decidedBy?: MentorRole | 'system';
}

/**
 * Thesis role display title
 */
export type ThesisRoleDisplay =
    | 'Student (Leader)'
    | 'Student (Member)'
    | 'Adviser'
    | 'Editor'
    | 'Statistician'
    | 'Unknown';

/**
 * Supported thesis progress stages
 */
export type ThesisStage = 'Pre-Proposal' | 'Post-Proposal' | 'Pre-Defense' | 'Post-Defense';

/**
 * Thesis comment/feedback
 */
export interface ThesisComment {
    id: string;
    author: string; // Firebase UID of author
    date: string;
    comment: string;
    isEdited?: boolean;
    attachments?: (string | FileAttachment)[]; // Supports legacy hashes and rich metadata
    version?: number; // Version index based on submission hash position in submissions array
}

/**
 * Thesis chapter details
 */
export interface ThesisChapter {
    id: number;
    title: string;
    status: 'approved' | 'under_review' | 'revision_required' | 'not_submitted';
    submissionDate: string | null;
    lastModified: string | null;
    submissions: (string | ChapterSubmissionEntry)[];
    comments: ThesisComment[];
    stage?: ThesisStage;
    mentorApprovals?: MentorApprovalState;
}

/**
 * Main thesis data
 */
export interface ThesisData {
    id?: string;
    title: string;
    groupId: string;
    leader?: string;
    members?: string[];
    adviser?: string;
    editor?: string;
    statistician?: string;
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
