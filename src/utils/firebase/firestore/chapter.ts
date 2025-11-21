import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    collectionGroup,
    type DocumentData,
    type QuerySnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { ChapterTemplate, ThesisChapterConfig } from '../../../types/chapter';
import { normalizeChapterOrder } from '../../chapterUtils';

/** Base collection name for chapters tree structure */
const CHAPTERS_COLLECTION = 'chapters';

/**
 * Generate a sanitized ID for Firestore paths
 * @param value - String to sanitize
 * @returns Sanitized string safe for Firestore paths
 */
function sanitizeForFirestore(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get reference path for a chapter configuration document
 * Pattern: chapters/{department}/courses/{course}
 * @param department - Department name
 * @param course - Course name
 * @returns Firestore document reference
 */
function getChapterConfigRef(department: string, course: string) {
    const sanitizedDept = sanitizeForFirestore(department);
    const sanitizedCourse = sanitizeForFirestore(course);
    return doc(firebaseFirestore, CHAPTERS_COLLECTION, sanitizedDept, 'courses', sanitizedCourse);
}

function normalizeChaptersForWrite(chapters: ChapterTemplate[]): ChapterTemplate[] {
    return normalizeChapterOrder(chapters).map((chapter) => {
        const normalized: ChapterTemplate = {
            id: chapter.id,
            title: chapter.title.trim(),
        };

        const description = chapter.description?.trim();
        if (description) {
            normalized.description = description;
        }

        return normalized;
    });
}

/**
 * Generate a deterministic ID for a chapter configuration based on department and course.
 * @param department - Department name
 * @param course - Course name
 * @returns Document ID in the format: {department}_{course}
 */
export function generateChapterConfigId(department: string, course: string): string {
    const sanitizedDept = sanitizeForFirestore(department);
    const sanitizedCourse = sanitizeForFirestore(course);
    return `${sanitizedDept}_${sanitizedCourse}`;
}

/**
 * Get a chapter configuration by department and course
 * @param department - Department name
 * @param course - Course name
 * @returns Chapter configuration or null if not found
 */
export async function getChapterConfigByCourse(
    department: string,
    course: string
): Promise<ThesisChapterConfig | null> {
    const ref = getChapterConfigRef(department, course);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as Omit<ThesisChapterConfig, 'id'>;
    const id = generateChapterConfigId(department, course);
    return { id, ...data } as ThesisChapterConfig;
}

/**
 * Get all chapter configurations across all departments
 * @returns Array of all chapter configurations
 */
export async function getAllChapterConfigs(): Promise<ThesisChapterConfig[]> {
    const coursesQuery = collectionGroup(firebaseFirestore, 'courses');
    const snap = await getDocs(coursesQuery);

    return snap.docs.map((d) => {
        const data = d.data() as Omit<ThesisChapterConfig, 'id'>;
        const id = generateChapterConfigId(data.department, data.course);
        return { id, ...data } as ThesisChapterConfig;
    });
}

/**
 * Get chapter configurations filtered by department
 * @param department - Department name to filter by
 * @returns Array of chapter configurations for the specified department
 */
export async function getChapterConfigsByDepartment(department: string): Promise<ThesisChapterConfig[]> {
    const sanitizedDept = sanitizeForFirestore(department);
    const deptRef = collection(firebaseFirestore, CHAPTERS_COLLECTION, sanitizedDept, 'courses');
    const snap = await getDocs(deptRef);

    return snap.docs.map((d) => {
        const data = d.data() as Omit<ThesisChapterConfig, 'id'>;
        const id = generateChapterConfigId(department, data.course);
        return { id, ...data } as ThesisChapterConfig;
    });
}

/**
 * Create or update a chapter configuration
 * @param data - Chapter configuration data
 * @returns The saved configuration ID
 */
export async function setChapterConfig(data: Omit<ThesisChapterConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = getChapterConfigRef(data.department, data.course);

    // Check if document exists to determine if we're creating or updating
    const existing = await getDoc(ref);
    const now = new Date().toISOString();

    const payload: Omit<ThesisChapterConfig, 'id'> = {
        ...data,
        chapters: normalizeChaptersForWrite(data.chapters),
        createdAt: existing.exists() ? (existing.data() as ThesisChapterConfig).createdAt : now,
        updatedAt: now,
    };

    const cleanedData = cleanData(payload);
    await setDoc(ref, cleanedData);

    return generateChapterConfigId(data.department, data.course);
}

/**
 * Update an existing chapter configuration
 * @param department - Department name
 * @param course - Course name
 * @param updates - Partial updates to apply
 */
export async function updateChapterConfig(
    department: string,
    course: string,
    updates: Partial<Omit<ThesisChapterConfig, 'id' | 'createdAt' | 'updatedAt' | 'department' | 'course'>>
): Promise<void> {
    const ref = getChapterConfigRef(department, course);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
        throw new Error(`Chapter configuration for ${department} - ${course} not found`);
    }

    const payload = {
        ...updates,
        ...(updates.chapters ? { chapters: normalizeChaptersForWrite(updates.chapters) } : {}),
        updatedAt: new Date().toISOString(),
    };

    const cleanedData = cleanData(payload);
    await setDoc(ref, cleanedData, { merge: true });
}

/**
 * Delete a chapter configuration
 * @param department - Department name
 * @param course - Course name
 */
export async function deleteChapterConfig(department: string, course: string): Promise<void> {
    const ref = getChapterConfigRef(department, course);
    await deleteDoc(ref);
}

/**
 * Listener options for chapter configuration real-time updates
 */
export interface ChapterConfigListenerOptions {
    /** Callback when data changes */
    onData: (configs: ThesisChapterConfig[]) => void;
    /** Optional error handler */
    onError?: (error: unknown) => void;
}

/**
 * Listen to real-time updates for chapter configurations
 * @param department - Optional department filter
 * @param options - Listener callbacks
 * @returns Unsubscribe function
 */
export function listenChapterConfigs(
    department: string | undefined,
    options: ChapterConfigListenerOptions
): () => void {
    let queryRef;

    if (department) {
        // Listen to a specific department's courses
        const sanitizedDept = sanitizeForFirestore(department);
        queryRef = collection(firebaseFirestore, CHAPTERS_COLLECTION, sanitizedDept, 'courses');
    } else {
        // Listen to all courses across all departments using collectionGroup
        queryRef = collectionGroup(firebaseFirestore, 'courses');
    }

    const unsubscribe = onSnapshot(
        queryRef,
        (snap: QuerySnapshot<DocumentData>) => {
            const configs = snap.docs.map((d) => {
                const data = d.data() as Omit<ThesisChapterConfig, 'id'>;
                const id = generateChapterConfigId(data.department, data.course);
                return { id, ...data } as ThesisChapterConfig;
            });
            options.onData(configs);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('ChapterConfig listener error:', error);
            }
        }
    );

    return unsubscribe;
}

/**
 * Listen to a specific chapter configuration by department and course
 * @param department - Department name
 * @param course - Course name
 * @param onData - Callback when data changes
 * @param onError - Optional error handler
 * @returns Unsubscribe function
 */
export function listenChapterConfig(
    department: string,
    course: string,
    onData: (config: ThesisChapterConfig | null) => void,
    onError?: (error: unknown) => void
): () => void {
    const ref = getChapterConfigRef(department, course);

    const unsubscribe = onSnapshot(
        ref,
        (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Omit<ThesisChapterConfig, 'id'>;
                const id = generateChapterConfigId(department, course);
                onData({ id, ...data } as ThesisChapterConfig);
            } else {
                onData(null);
            }
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('ChapterConfig listener error:', error);
            }
        }
    );

    return unsubscribe;
}
