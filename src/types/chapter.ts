import type { FileAttachment } from './file';

/**
 * Ordered list of supported thesis chapter stages.
 */
export const CHAPTER_STAGE_OPTIONS = [
    'Pre-Proposal',
    'Post-Proposal',
    'Pre Defense',
    'Post Defense',
] as const;

export type ChapterStage = (typeof CHAPTER_STAGE_OPTIONS)[number];
export type ChapterStageKey = ChapterStage;

/**
 * Chapter template definition for a course
 */
export interface ChapterTemplate {
    /** Chapter number/order */
    id: number;
    /** Chapter title */
    title: string;
    /** Chapter description or requirements */
    description?: string;

    /** Stage tabs where the chapter should appear */
    stages?: ChapterStage[];

    /** Optional files associated with this chapter template (e.g., sample files, resources) */
    files?: FileAttachment[];

    /** Comments or notes related to this chapter template */
    comments?: ChapterComment[];
}

/**
 * Thesis chapter configuration for a specific course
 */
export interface ThesisChapterConfig {
    /** Firestore document ID (usually in format: {department}_{course}) */
    id: string;
    /** Department name */
    department: string;
    /** Course name */
    course: string;
    /** Array of chapter templates for this course */
    chapters: ChapterTemplate[];
    /** When this configuration was created */
    createdAt: string;
    /** When this configuration was last updated */
    updatedAt: string;
}

/**
 * Form data for creating/editing chapter configurations
 */
export interface ChapterConfigFormData {
    id?: string;
    department: string;
    course: string;
    chapters: ChapterTemplate[];
}

/**
 * Simple, reusable comment type for chapters/forms
 */
export interface ChapterComment {
    id?: string;
    author: string; // user id or email
    date: string; // ISO string
    message: string;
    attachments?: FileAttachment[]; // file refs or objects
    resolved?: boolean;
    replies?: ChapterComment[];
}

/**
 * Supported validation error keys for the chapter configuration form.
 */
export type ChapterFormErrorKey = keyof ChapterConfigFormData | 'general';

/**
 * Tuple of identifiers required to locate a chapter configuration document in Firestore.
 */
export interface ChapterConfigIdentifier {
    department: string;
    course: string;
}


export interface GroupChapter {
    id?: string;
    department: string;
    course: string;
    chapters: ChapterTemplate[];
}
