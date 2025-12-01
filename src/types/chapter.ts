import type { ThesisStageName } from './thesis';

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
    /** Thesis stage(s) when the chapter is expected */
    stage?: ThesisStageName | ThesisStageName[];
}

/**
 * Thesis chapter configuration for a specific course
 */
export interface ThesisChapterConfig {
    /** Firestore document ID (usually in format: {department}_{course}) */
    id: string;
    /** Academic year segment */
    year: string;
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
    year?: string;
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
