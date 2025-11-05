
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
    title: string;
    leader: string; // Firebase UID
    members: string[]; // Firebase UIDs
    adviser: string; // Firebase UID
    editor: string; // Firebase UID
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
