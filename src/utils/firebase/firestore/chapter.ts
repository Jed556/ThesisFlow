import {
    doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, collectionGroup,
    query, where, writeBatch, type DocumentData, type QuerySnapshot, type QueryDocumentSnapshot,
    type DocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { ChapterTemplate, ThesisChapterConfig } from '../../../types/chapter';
import type { ThesisGroup } from '../../../types/group';
import { DEFAULT_CHAPTER_STAGE, normalizeChapterOrder } from '../../chapterUtils';
import { templatesToThesisChapters } from '../../thesisChapterTemplates';
import { getGroupsInCourse } from './groups';
import {
    FIRESTORE_IN_QUERY_LIMIT, FIRESTORE_BATCH_WRITE_LIMIT, DEFAULT_YEAR, DEFAULT_DEPARTMENT_SEGMENT,
    DEFAULT_COURSE_SEGMENT, COURSE_TEMPLATES_SUBCOLLECTION, THESIS_SUBCOLLECTION, CHAPTER_TEMPLATES_KEY,
} from '../../../config/firestore';
import {
    buildCourseChapterTemplateDocPath,
    sanitizePathSegment,
} from './paths';
import {
    ensureCourseHierarchyExists,
    normalizeCourseTemplateContext,
    type NormalizedCourseTemplateContext,
} from './courseTemplateHelpers';

function getChapterTemplateDocRef(context: NormalizedCourseTemplateContext) {
    return doc(
        firebaseFirestore,
        buildCourseChapterTemplateDocPath(context.year, context.department, context.course)
    );
}

interface ChapterTemplateDocument extends Omit<ThesisChapterConfig, 'id'> {
    templateType: typeof CHAPTER_TEMPLATES_KEY;
    /** Sanitized department key for collection group queries */
    departmentKey?: string;
    /** Sanitized course key for collection group queries */
    courseKey?: string;
}

function mapChapterSnapshot(
    snapshot: DocumentSnapshot,
    fallback?: NormalizedCourseTemplateContext,
): ThesisChapterConfig | null {
    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data() as Partial<ChapterTemplateDocument>;
    const fallbackTimestamp = new Date().toISOString();

    const year = data.year || fallback?.year || DEFAULT_YEAR;
    const department = data.department || fallback?.department || '';
    const course = data.course || fallback?.course || '';

    if (!department || !course) {
        return null;
    }

    return {
        id: generateChapterConfigId(year, department, course),
        year,
        department,
        course,
        chapters: data.chapters ?? [],
        createdAt: data.createdAt ?? fallbackTimestamp,
        updatedAt: data.updatedAt ?? fallbackTimestamp,
    };
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

export interface SaveChapterConfigPayload {
    year?: string;
    department: string;
    course: string;
    chapters: ChapterTemplate[];
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
export function generateChapterConfigId(year: string, department: string, course: string): string {
    const yearKey = sanitizePathSegment(year, DEFAULT_YEAR);
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
    return `${yearKey}_${deptKey}_${courseKey}`;
}

/**
 * Get a chapter configuration by department and course
 * @param department - Department name
 * @param course - Course name
 * @returns Chapter configuration or null if not found
 */
export async function getChapterConfigByCourse(
    department: string,
    course: string,
    year?: string,
): Promise<ThesisChapterConfig | null> {
    const context = normalizeCourseTemplateContext({ department, course, year });
    const ref = getChapterTemplateDocRef(context);
    const snap = await getDoc(ref);
    return mapChapterSnapshot(snap, context);
}

/**
 * Get all chapter configurations across all departments
 * Uses collection group query on 'chapters' subcollection
 * @returns Array of all chapter configurations
 */
export async function getAllChapterConfigs(year: string = DEFAULT_YEAR): Promise<ThesisChapterConfig[]> {
    const templatesQuery = query(
        collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION),
        where('templateType', '==', CHAPTER_TEMPLATES_KEY),
        where('year', '==', year)
    );
    const snap = await getDocs(templatesQuery);

    return snap.docs
        .map((docSnap) => mapChapterSnapshot(docSnap))
        .filter((config): config is ThesisChapterConfig => config !== null);
}

/**
 * Get chapter configurations filtered by department
 * Queries all courses under the department and gets their chapter configs
 * @param department - Department name to filter by
 * @returns Array of chapter configurations for the specified department
 */
export async function getChapterConfigsByDepartment(
    department: string,
    year: string = DEFAULT_YEAR,
): Promise<ThesisChapterConfig[]> {
    const trimmed = department.trim();
    if (!trimmed) {
        return [];
    }

    // First try querying by departmentKey (new format)
    const departmentKey = sanitizePathSegment(trimmed, DEFAULT_DEPARTMENT_SEGMENT);
    let templatesQuery = query(
        collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION),
        where('templateType', '==', CHAPTER_TEMPLATES_KEY),
        where('year', '==', year),
        where('departmentKey', '==', departmentKey)
    );
    let snap = await getDocs(templatesQuery);

    // If no results, try querying by department name (legacy format)
    if (snap.empty) {
        templatesQuery = query(
            collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION),
            where('templateType', '==', CHAPTER_TEMPLATES_KEY),
            where('year', '==', year),
            where('department', '==', trimmed)
        );
        snap = await getDocs(templatesQuery);
    }

    return snap.docs
        .map((docSnap) => mapChapterSnapshot(docSnap))
        .filter((config): config is ThesisChapterConfig => config !== null);
}

/**
 * Create or update a chapter configuration
 * Also ensures department and course documents exist with name fields
 * @param data - Chapter configuration data
 * @returns The saved configuration ID
 */
export async function setChapterConfig(data: SaveChapterConfigPayload): Promise<string> {
    const context = normalizeCourseTemplateContext(data);
    const now = new Date().toISOString();
    await ensureCourseHierarchyExists(context, now);

    const ref = getChapterTemplateDocRef(context);
    const existing = await getDoc(ref);
    const previous = existing.exists() ? (existing.data() as ChapterTemplateDocument) : null;

    const payload: ChapterTemplateDocument = {
        templateType: CHAPTER_TEMPLATES_KEY,
        year: context.year,
        department: context.department,
        course: context.course,
        // Include sanitized keys for collection group queries
        departmentKey: sanitizePathSegment(context.department, DEFAULT_DEPARTMENT_SEGMENT),
        courseKey: sanitizePathSegment(context.course, DEFAULT_COURSE_SEGMENT),
        chapters: normalizeChaptersForWrite(data.chapters),
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
    };

    await setDoc(ref, cleanData(payload, previous ? 'update' : 'create'));
    return generateChapterConfigId(context.year, context.department, context.course);
}

/**
 * Update the chapter templates for an existing configuration and propagate the changes to all theses
 * belonging to the same department/course pair.
 */
export async function updateChapterTemplatesWithCascade(
    department: string,
    course: string,
    chapters: ChapterTemplate[],
    year?: string,
): Promise<ChapterCascadeResult> {
    const context = normalizeCourseTemplateContext({ year, department, course });
    const normalizedChapters = normalizeChaptersForWrite(chapters);

    await setChapterConfig({
        year: context.year,
        department: context.department,
        course: context.course,
        chapters: normalizedChapters,
    });
    return cascadeChaptersToTheses(context.department, context.course, normalizedChapters, context.year);
}

/**
 * Delete a chapter configuration and remove chapter data from all theses in the associated department/course.
 */
export async function deleteChapterConfigWithCascade(
    department: string,
    course: string,
    year?: string,
): Promise<ChapterCascadeResult> {
    const context = normalizeCourseTemplateContext({ year, department, course });

    // Cascade chapters to theses (removes chapter data from all theses)
    const cascadeResult = await cascadeChaptersToTheses(context.department, context.course, [], context.year);

    // Note: File cleanup for cascade operations requires iterating through each chapter's submissions
    // using the hierarchical path structure. This is intentionally not automated to avoid
    // accidental data loss. Use deleteThesisFile for individual file cleanup.
    console.warn('Chapter cascade completed. File cleanup for submissions requires manual review.');

    await deleteChapterConfig(context.department, context.course, context.year);
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
    updates: Partial<Omit<ThesisChapterConfig, 'id' | 'createdAt' | 'updatedAt' | 'department' | 'course'>>,
    year?: string,
): Promise<void> {
    const context = normalizeCourseTemplateContext({ department, course, year });
    const ref = getChapterTemplateDocRef(context);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
        throw new Error(`Chapter configuration for ${department} - ${course} not found`);
    }

    const payload: Partial<ChapterTemplateDocument> = {
        updatedAt: new Date().toISOString(),
    };

    if (updates.chapters) {
        payload.chapters = normalizeChaptersForWrite(updates.chapters);
    }

    await setDoc(ref, cleanData(payload, 'update'), { merge: true });
}

/**
 * Delete a chapter configuration
 * @param department - Department name
 * @param course - Course name
 */
export async function deleteChapterConfig(
    department: string,
    course: string,
    year?: string,
): Promise<void> {
    const context = normalizeCourseTemplateContext({ department, course, year });
    const ref = getChapterTemplateDocRef(context);
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
    options: ChapterConfigListenerOptions,
    year: string = DEFAULT_YEAR,
): () => void {
    const constraints = [
        where('templateType', '==', CHAPTER_TEMPLATES_KEY),
        where('year', '==', year),
    ];

    if (department?.trim()) {
        constraints.push(
            where('departmentKey', '==', sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT))
        );
    }

    const queryRef = query(
        collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION),
        ...constraints
    );

    return onSnapshot(
        queryRef,
        (snap: QuerySnapshot<DocumentData>) => {
            const configs = snap.docs
                .map((docSnap) => mapChapterSnapshot(docSnap))
                .filter((config): config is ThesisChapterConfig => config !== null);
            options.onData(configs);
        },
        (error: unknown) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('ChapterConfig listener error:', error);
            }
        }
    );
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
    onError?: (error: unknown) => void,
    year?: string,
): () => void {
    const context = normalizeCourseTemplateContext({ department, course, year });
    const ref = getChapterTemplateDocRef(context);

    return onSnapshot(
        ref,
        (snap) => {
            onData(mapChapterSnapshot(snap, context));
        },
        (error: unknown) => {
            if (onError) {
                onError(error);
            } else {
                console.error('ChapterConfig listener error:', error);
            }
        }
    );
}

// ============================================================================
// Full Chapter Templates Data Types (for Import/Export)
// ============================================================================

/**
 * Course-level chapter template configuration
 */
export interface CourseChapterTemplate {
    course: string;
    chapters: ChapterTemplate[];
}

/**
 * Department-level chapter templates containing multiple courses
 */
export interface DepartmentChapterTemplates {
    department: string;
    courses: CourseChapterTemplate[];
}

/**
 * Full chapter templates data structure for import/export
 */
export interface FullChapterTemplatesData {
    /** Default chapters for courses without specific templates */
    defaultChapters: ChapterTemplate[];
    /** Department-specific chapter templates */
    departmentTemplates: DepartmentChapterTemplates[];
    /** Last update timestamp */
    updatedAt?: Date;
}

// ============================================================================
// Full Chapter Templates Operations
// ============================================================================

/**
 * Check if any chapter templates exist in Firestore
 * @param year - Academic year (defaults to current)
 * @returns True if at least one chapter template exists
 */
export async function hasChapterTemplates(year: string = DEFAULT_YEAR): Promise<boolean> {
    const templatesQuery = query(
        collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION),
        where('templateType', '==', CHAPTER_TEMPLATES_KEY),
        where('year', '==', year)
    );
    const snap = await getDocs(templatesQuery);
    return !snap.empty;
}

/**
 * Get all chapter templates grouped by department and course
 * @param year - Academic year (defaults to current)
 * @returns Full chapter templates data structure
 */
export async function getFullChapterTemplatesData(
    year: string = DEFAULT_YEAR
): Promise<FullChapterTemplatesData | null> {
    try {
        const allConfigs = await getAllChapterConfigs(year);

        if (allConfigs.length === 0) {
            return null;
        }

        // Group by department
        const departmentMap = new Map<string, CourseChapterTemplate[]>();

        for (const config of allConfigs) {
            const courses = departmentMap.get(config.department) ?? [];
            courses.push({
                course: config.course,
                chapters: config.chapters,
            });
            departmentMap.set(config.department, courses);
        }

        // Convert map to array and sort
        const departmentTemplates: DepartmentChapterTemplates[] = Array.from(departmentMap.entries())
            .map(([department, courses]) => ({
                department,
                courses: courses.sort((a, b) => a.course.localeCompare(b.course)),
            }))
            .sort((a, b) => a.department.localeCompare(b.department));

        return {
            defaultChapters: [],
            departmentTemplates,
            updatedAt: new Date(),
        };
    } catch (error) {
        console.error('Failed to get full chapter templates data:', error);
        return null;
    }
}

/**
 * Save full chapter templates data to Firestore
 * @param year - Academic year
 * @param data - Full chapter templates data to save
 */
export async function saveFullChapterTemplatesData(
    year: string,
    data: Omit<FullChapterTemplatesData, 'updatedAt'>
): Promise<void> {
    const now = new Date().toISOString();

    // Process each department and course
    for (const deptTemplate of data.departmentTemplates) {
        for (const courseTemplate of deptTemplate.courses) {
            await setChapterConfig({
                year,
                department: deptTemplate.department,
                course: courseTemplate.course,
                chapters: courseTemplate.chapters,
            });
        }
    }

    console.log(`Saved chapter templates at ${now}`);
}

/** Result of loading or seeding chapter templates */
export interface LoadOrSeedChapterTemplatesResult {
    data: FullChapterTemplatesData;
    /** Whether new templates were seeded (true) or existing ones loaded (false) */
    seeded: boolean;
    /** Number of new templates seeded for missing department/course combinations */
    missingSeededCount?: number;
}

/** Department/course pair for identifying unique combinations */
export interface DepartmentCoursePair {
    department: string;
    course: string;
}

/**
 * Seed chapter templates from default data if Firestore is empty
 * @param year - Academic year
 * @param defaultData - Default data to seed (from chapters.json)
 * @returns The loaded or seeded chapter templates data with seeding status
 */
export async function loadOrSeedChapterTemplates(
    year: string,
    defaultData: Omit<FullChapterTemplatesData, 'updatedAt'>
): Promise<LoadOrSeedChapterTemplatesResult> {
    // Check if any templates exist
    const templatesExist = await hasChapterTemplates(year);

    if (templatesExist) {
        // Load existing data from Firestore
        const existing = await getFullChapterTemplatesData(year);
        if (existing) {
            return { data: existing, seeded: false };
        }
    }

    // Firestore is empty, seed with default data
    await saveFullChapterTemplatesData(year, defaultData);

    // Return the seeded data with current timestamp
    return {
        data: {
            ...defaultData,
            updatedAt: new Date(),
        },
        seeded: true,
    };
}

/**
 * Seed default chapter templates for department/course combinations that don't have templates
 * @param year - Academic year
 * @param departmentCoursePairs - Array of department/course pairs to check
 * @param defaultChapters - Default chapters to use for missing templates
 * @returns Number of templates that were seeded
 */
export async function seedMissingChapterTemplates(
    year: string,
    departmentCoursePairs: DepartmentCoursePair[],
    defaultChapters: ChapterTemplate[]
): Promise<number> {
    if (departmentCoursePairs.length === 0 || defaultChapters.length === 0) {
        return 0;
    }

    // Get all existing templates
    const existingConfigs = await getAllChapterConfigs(year);

    // Build a set of existing department+course keys for quick lookup
    const existingKeys = new Set(
        existingConfigs.map((config) => `${config.department.trim().toLowerCase()}|${config.course.trim().toLowerCase()}`)
    );

    // Find pairs that don't have templates
    const missingPairs = departmentCoursePairs.filter((pair) => {
        const key = `${pair.department.trim().toLowerCase()}|${pair.course.trim().toLowerCase()}`;
        return !existingKeys.has(key);
    });

    if (missingPairs.length === 0) {
        return 0;
    }

    // Seed templates for missing pairs
    let seededCount = 0;
    for (const pair of missingPairs) {
        try {
            await setChapterConfig({
                year,
                department: pair.department.trim(),
                course: pair.course.trim(),
                chapters: defaultChapters,
            });
            seededCount++;
        } catch (error) {
            console.error(`Failed to seed chapter template for ${pair.department}/${pair.course}:`, error);
        }
    }

    return seededCount;
}

/**
 * Clear all chapter templates for a given year
 * Use with caution - this deletes all chapter configurations
 * @param year - Academic year
 */
export async function clearAllChapterTemplates(year: string = DEFAULT_YEAR): Promise<void> {
    const allConfigs = await getAllChapterConfigs(year);

    // Batch delete in chunks
    const chunks = chunkArray(allConfigs, FIRESTORE_BATCH_WRITE_LIMIT);

    for (const chunk of chunks) {
        const batch = writeBatch(firebaseFirestore);
        for (const config of chunk) {
            const context = normalizeCourseTemplateContext({
                year,
                department: config.department,
                course: config.course,
            });
            const ref = getChapterTemplateDocRef(context);
            batch.delete(ref);
        }
        await batch.commit();
    }
}

/**
 * Import chapter templates from JSON data, replacing existing templates
 * @param year - Academic year
 * @param data - Chapter templates data to import
 * @param clearExisting - Whether to clear existing templates before import (default: true)
 */
export async function importChapterTemplates(
    year: string,
    data: Omit<FullChapterTemplatesData, 'updatedAt'>,
    clearExisting: boolean = true
): Promise<void> {
    if (clearExisting) {
        await clearAllChapterTemplates(year);
    }
    await saveFullChapterTemplatesData(year, data);
}

/**
 * Export chapter templates to a downloadable format
 * @param year - Academic year
 * @returns Exportable chapter templates data or null if none exist
 */
export async function exportChapterTemplates(
    year: string = DEFAULT_YEAR
): Promise<FullChapterTemplatesData | null> {
    return getFullChapterTemplatesData(year);
}
