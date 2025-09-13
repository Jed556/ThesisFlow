import type { FileAttachment, FileRegistryEntry, MediaMetadata } from './file';

// User role types - System-wide roles
export type SystemUserRole = 'student' | 'editor' | 'adviser' | 'admin';

// Thesis-specific role types - Based on thesis data context  
export type ThesisRole = 'leader' | 'member' | 'adviser' | 'editor' | 'unknown';
export type ThesisRoleDisplay = 'Student (Leader)' | 'Student (Member)' | 'Adviser' | 'Editor' | 'Unknown';

// Comment/feedback interface
export interface ThesisComment {
    author: string;
    date: string;
    comment: string;
    attachments: string[]; // Array of file hashes referencing mockFileRegistry
    version?: number; // Version index based on submission hash position in submissions array
}

// Chapter interface
export interface ThesisChapter {
    id: number;
    title: string;
    status: 'approved' | 'under_review' | 'revision_required' | 'not_submitted';
    submissionDate: string | null;
    lastModified: string | null;
    submissions: string[]; // Array of file hashes for submitted documents
    comments: ThesisComment[];
}

// Main thesis data interface
export interface ThesisData {
    title: string;
    leader: string;
    members: string[];
    adviser: string;
    editor: string;
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

// Status color mapping type
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
