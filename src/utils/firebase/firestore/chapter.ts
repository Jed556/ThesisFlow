import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, collectionGroup,
    query, where, writeBatch, type DocumentData, type QuerySnapshot, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { ChapterTemplate, ThesisChapterConfig } from '../../../types/chapter';
import type { ThesisGroup } from '../../../types/group';
import { DEFAULT_CHAPTER_STAGE, normalizeChapterOrder } from '../../chapterUtils';
import { templatesToThesisChapters } from '../../thesisChapterTemplates';
import { getGroupsInCourse } from './groups';
import {
    FIRESTORE_IN_QUERY_LIMIT, FIRESTORE_BATCH_WRITE_LIMIT, CONFIGURATION_ROOT,
    COURSES_SUBCOLLECTION, CHAPTERS_SUBCOLLECTION, THESIS_SUBCOLLECTION, DEFAULT_YEAR
} from '../../../config/firestore';
import { buildConfigDepartmentPath, buildConfigCoursePath, buildChapterConfigsPath } from './paths';

/**
 * Generate a sanitized ID for Firestore paths
 * @param value - String to sanitize
 * @returns Sanitized string safe for Firestore paths
 */
function sanitizeForFirestore(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get reference to a department document in configuration
 * Path: configuration/{department}
 * @param department - Department name
 * @returns Firestore document reference
 */
function getDepartmentRef(department: string) {
    const sanitizedDept = sanitizeForFirestore(department);
    return doc(firebaseFirestore, buildConfigDepartmentPath(sanitizedDept));
}

/**
 * Get reference to a course document under a department
 * Path: configuration/{department}/courses/{course}
 * @param department - Department name
 * @param course - Course name
 * @returns Firestore document reference
 */
function getCourseRef(department: string, course: string) {
    const sanitizedDept = sanitizeForFirestore(department);
    const sanitizedCourse = sanitizeForFirestore(course);
    return doc(firebaseFirestore, buildConfigCoursePath(sanitizedDept, sanitizedCourse));
}

/**
 * Get reference to chapter config collection for a course
 * Path: configuration/{department}/courses/{course}/chapters
 * @param department - Department name
 * @param course - Course name
 * @returns Firestore collection reference
 */
function getChapterConfigCollectionRef(department: string, course: string) {
    const sanitizedDept = sanitizeForFirestore(department);
    const sanitizedCourse = sanitizeForFirestore(course);
    return collection(firebaseFirestore, buildChapterConfigsPath(sanitizedDept, sanitizedCourse));
}

/**
 * Get reference to a specific chapter config document
 * Path: configuration/{department}/courses/{course}/chapters/{configId}
 * @param department - Department name
 * @param course - Course name
 * @param configId - Config document ID (default: 'default')
 * @returns Firestore document reference
 */
function getChapterConfigRef(department: string, course: string, configId = 'default') {
    const sanitizedDept = sanitizeForFirestore(department);
    const sanitizedCourse = sanitizeForFirestore(course);
    return doc(firebaseFirestore, buildChapterConfigsPath(sanitizedDept, sanitizedCourse), configId);
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

/**
 * Fetch thesis document snapshots for specified group IDs using hierarchical structure.
 * Uses collectionGroup query on THESIS_SUBCOLLECTION to find theses matching groupIds.
 * @param groupIds - Array of group IDs to fetch theses for
 * @returns Array of Firestore document snapshots for matching theses
 */
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

    const thesisCollectionGroup = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const thesisSnapshots: QueryDocumentSnapshot<DocumentData>[] = [];
    const chunks = chunkArray(uniqueIds, FIRESTORE_IN_QUERY_LIMIT);

    for (const chunk of chunks) {
        if (chunk.length === 0) {
            continue;
        }
        const thesisQuery = query(thesisCollectionGroup, where('groupId', 'in', chunk));
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
    normalizedChapters: ChapterTemplate[],
    year: string = DEFAULT_YEAR
): Promise<ChapterCascadeResult> {
    const trimmedDepartment = department.trim();
    const trimmedCourse = course.trim();
    const groups = await getGroupsInCourse(year, trimmedDepartment, trimmedCourse);

    if (groups.length === 0) {
        return { groupCount: 0, thesisCount: 0 };
    }

    const thesisSnapshots = await fetchThesisSnapshotsForGroups(groups.map((group: ThesisGroup) => group.id));
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
 * Uses collection group query on 'chapters' subcollection
 * @returns Array of all chapter configurations
 */
export async function getAllChapterConfigs(): Promise<ThesisChapterConfig[]> {
    const chaptersQuery = collectionGroup(firebaseFirestore, CHAPTERS_SUBCOLLECTION);
    const snap = await getDocs(chaptersQuery);

    return snap.docs.map((d) => {
        const data = d.data() as Omit<ThesisChapterConfig, 'id'>;
        const id = generateChapterConfigId(data.department, data.course);
        return { id, ...data } as ThesisChapterConfig;
    });
}

/**
 * Get chapter configurations filtered by department
 * Queries all courses under the department and gets their chapter configs
 * @param department - Department name to filter by
 * @returns Array of chapter configurations for the specified department
 */
export async function getChapterConfigsByDepartment(department: string): Promise<ThesisChapterConfig[]> {
    const sanitizedDept = sanitizeForFirestore(department);
    // Get all courses under this department
    const coursesRef = collection(
        firebaseFirestore,
        CONFIGURATION_ROOT,
        sanitizedDept,
        COURSES_SUBCOLLECTION
    );
    const coursesSnap = await getDocs(coursesRef);

    // For each course, get its chapter configs
    const configs: ThesisChapterConfig[] = [];
    for (const courseDoc of coursesSnap.docs) {
        const courseData = courseDoc.data();
        const courseName = courseData.name ?? courseDoc.id;
        const chaptersRef = getChapterConfigCollectionRef(department, courseName);
        const chaptersSnap = await getDocs(chaptersRef);

        chaptersSnap.docs.forEach((d) => {
            const data = d.data() as Omit<ThesisChapterConfig, 'id'>;
            const id = generateChapterConfigId(department, data.course ?? courseName);
            configs.push({ id, ...data } as ThesisChapterConfig);
        });
    }

    return configs;
}

/**
 * Create or update a chapter configuration
 * Also ensures department and course documents exist with name fields
 * @param data - Chapter configuration data
 * @returns The saved configuration ID
 */
export async function setChapterConfig(data: Omit<ThesisChapterConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();

    // Ensure department document exists with name field
    const deptRef = getDepartmentRef(data.department);
    const deptSnap = await getDoc(deptRef);
    if (!deptSnap.exists()) {
        await setDoc(deptRef, {
            name: data.department,
            createdAt: now,
            updatedAt: now,
        });
    }

    // Ensure course document exists with name field
    const courseRef = getCourseRef(data.department, data.course);
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists()) {
        await setDoc(courseRef, {
            name: data.course,
            createdAt: now,
            updatedAt: now,
        });
    }

    // Now create/update the chapter config
    const ref = getChapterConfigRef(data.department, data.course);
    const existing = await getDoc(ref);

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

    // Note: File cleanup for cascade operations requires iterating through each chapter's submissions
    // using the hierarchical path structure. This is intentionally not automated to avoid
    // accidental data loss. Use deleteThesisFile for individual file cleanup.
    console.warn('Chapter cascade completed. File cleanup for submissions requires manual review.');

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
        // Listen to a specific department's chapter configs using collection group with filter
        queryRef = query(
            collectionGroup(firebaseFirestore, CHAPTERS_SUBCOLLECTION),
            where('department', '==', department)
        );
    } else {
        // Listen to all chapter configs across all departments using collectionGroup
        queryRef = collectionGroup(firebaseFirestore, CHAPTERS_SUBCOLLECTION);
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
