
/**
 * Thesis-specific role types - Based on thesis data context
 */
export type ThesisRole = 'leader' | 'member' | 'adviser' | 'editor' | 'unknown';

/**
 * Thesis role display title
 */
export type ThesisRoleDisplay = 'Student (Leader)' | 'Student (Member)' | 'Adviser' | 'Editor' | 'Unknown';

/**
 * Thesis comment/feedback
 */
export interface ThesisComment {
    id: string;
    author: string; // Firebase UID of author
    date: string;
    comment: string;
    attachments: string[]; // Array of file hashes referencing mockFileRegistry
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
    submissions: string[]; // Array of file hashes for submitted documents
    comments: ThesisComment[];
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
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
