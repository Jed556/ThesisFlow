import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    collectionGroup,
    query,
    where,
    writeBatch,
    type DocumentData,
    type QuerySnapshot,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { ChapterTemplate, ThesisChapterConfig } from '../../../types/chapter';
import { DEFAULT_CHAPTER_STAGE, normalizeChapterOrder } from '../../chapterUtils';
import { templatesToThesisChapters } from '../../thesisChapterTemplates';
import { getGroupsInDepartmentCourse } from './groups';
import { THESES_COLLECTION } from './constants';

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
            stage: chapter.stage ?? DEFAULT_CHAPTER_STAGE,
        };

        const description = chapter.description?.trim();
        if (description) {
            normalized.description = description;
        }

        return normalized;
    });
}

const FIRESTORE_IN_QUERY_LIMIT = 10;
const FIRESTORE_BATCH_WRITE_LIMIT = 400;

function chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0 || items.length === 0) {
        return items.length ? [items] : [];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

async function fetchThesisSnapshotsForGroups(
    groupIds: string[]
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    const uniqueIds = Array.from(
        new Set(
            groupIds
                .map((id) => id?.trim())
                .filter((id): id is string => Boolean(id))
        )
    );

    if (uniqueIds.length === 0) {
        return [];
    }

    const thesisCollection = collection(firebaseFirestore, THESES_COLLECTION);
    const thesisSnapshots: QueryDocumentSnapshot<DocumentData>[] = [];
    const chunks = chunkArray(uniqueIds, FIRESTORE_IN_QUERY_LIMIT);

    for (const chunk of chunks) {
        if (chunk.length === 0) {
            continue;
        }
        const thesisQuery = query(thesisCollection, where('groupId', 'in', chunk));
        const snapshot = await getDocs(thesisQuery);
        thesisSnapshots.push(...snapshot.docs);
    }

    return thesisSnapshots;
}

export interface ChapterCascadeResult {
    groupCount: number;
    thesisCount: number;
}

async function cascadeChaptersToTheses(
    department: string,
    course: string,
    normalizedChapters: ChapterTemplate[]
): Promise<ChapterCascadeResult> {
    const trimmedDepartment = department.trim();
    const trimmedCourse = course.trim();
    const groups = await getGroupsInDepartmentCourse(trimmedDepartment, trimmedCourse);

    if (groups.length === 0) {
        return { groupCount: 0, thesisCount: 0 };
    }

    const thesisSnapshots = await fetchThesisSnapshotsForGroups(groups.map((group) => group.id));
    if (thesisSnapshots.length === 0) {
        return { groupCount: groups.length, thesisCount: 0 };
    }

    const timestamp = new Date().toISOString();
    const nextChapters = normalizedChapters.length > 0
        ? templatesToThesisChapters(normalizedChapters)
        : [];

    const snapshotChunks = chunkArray(thesisSnapshots, FIRESTORE_BATCH_WRITE_LIMIT);
    for (const chunk of snapshotChunks) {
        if (chunk.length === 0) {
            continue;
        }
        const batch = writeBatch(firebaseFirestore);
        chunk.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                chapters: nextChapters,
                lastUpdated: timestamp,
            });
        });
        await batch.commit();
    }

    return {
        groupCount: groups.length,
        thesisCount: thesisSnapshots.length,
    };
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
 * Update the chapter templates for an existing configuration and propagate the changes to all theses
 * belonging to the same department/course pair.
 */
export async function updateChapterTemplatesWithCascade(
    department: string,
    course: string,
    chapters: ChapterTemplate[]
): Promise<ChapterCascadeResult> {
    const trimmedDepartment = department.trim();
    const trimmedCourse = course.trim();
    const normalizedChapters = normalizeChaptersForWrite(chapters);

    await updateChapterConfig(trimmedDepartment, trimmedCourse, { chapters: normalizedChapters });
    return cascadeChaptersToTheses(trimmedDepartment, trimmedCourse, normalizedChapters);
}

/**
 * Delete a chapter configuration and remove chapter data from all theses in the associated department/course.
 */
export async function deleteChapterConfigWithCascade(
    department: string,
    course: string
): Promise<ChapterCascadeResult> {
    const trimmedDepartment = department.trim();
    const trimmedCourse = course.trim();

    // Cascade chapters to theses (removes chapter data from all theses)
    const cascadeResult = await cascadeChaptersToTheses(trimmedDepartment, trimmedCourse, []);

    // Delete all file attachments in Firestore and Storage for affected theses
    const groups = await getGroupsInDepartmentCourse(trimmedDepartment, trimmedCourse);
    if (groups.length > 0) {
        const thesisSnapshots = await fetchThesisSnapshotsForGroups(groups.map((group) => group.id));
        for (const thesisSnap of thesisSnapshots) {
            const thesisId = thesisSnap.id;
            // Get all files for this thesis
            const allFiles = await import('../firestore/file').then(m => m.getFilesByThesis(thesisId));
            for (const file of allFiles) {
                // Delete from Storage and Firestore
                await import('../storage/thesis').then(m => m.deleteThesisFile(file.url, thesisId, file.id ?? ''));
            }
        }
    }

    await deleteChapterConfig(trimmedDepartment, trimmedCourse);
    return cascadeResult;
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
