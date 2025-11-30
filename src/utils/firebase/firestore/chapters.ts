/**
 * Firebase Firestore - Thesis Chapters
 * CRUD operations for Chapter documents within thesis stages using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}
 * 
 * Also includes chapter configuration/template management for courses:
 * configuration/departments/{department}/courses/{course}/chapters/{configId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, orderBy, where, serverTimestamp, writeBatch, onSnapshot,
    type QueryConstraint, type DocumentData, type QuerySnapshot, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisChapter, ThesisStatus, ExpertRole, ExpertApprovalState } from '../../../types/thesis';
import type { ChapterTemplate, ThesisChapterConfig } from '../../../types/chapter';
import type { ThesisGroup } from '../../../types/group';
import type { WorkspaceChapterDecision } from '../../../types/workspace';
import {
    CHAPTERS_SUBCOLLECTION, FIRESTORE_IN_QUERY_LIMIT, FIRESTORE_BATCH_WRITE_LIMIT,
    CONFIGURATION_ROOT, COURSES_SUBCOLLECTION, THESIS_SUBCOLLECTION, DEFAULT_YEAR,
} from '../../../config/firestore';
import {
    buildChaptersCollectionPath, buildChapterDocPath, buildConfigDepartmentPath,
    buildConfigCoursePath, buildChapterConfigsPath,
} from './paths';
import { cleanData } from './firestore';
import { DEFAULT_CHAPTER_STAGE, normalizeChapterOrder } from '../../chapterUtils';
import { templatesToThesisChapters, buildDefaultChapterTemplates } from '../../thesisChapterTemplates';
import { getGroupsInCourse } from './groups';

// ============================================================================
// Types
// ============================================================================

export interface ChapterContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: string;
}

export interface ChapterListenerOptions {
    onData: (chapters: ThesisChapter[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Chapter CRUD Operations
// ============================================================================

/**
 * Create a chapter document under a stage
 * @param ctx - Chapter context containing path information
 * @param chapterData - Chapter data (without id)
 * @returns Created chapter document ID
 */
export async function createChapter(
    ctx: ChapterContext,
    chapterData: Omit<ThesisChapter, 'id'>
): Promise<string> {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(chaptersRef);

    await setDoc(newDocRef, {
        ...chapterData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Create a chapter with a specific ID
 * @param ctx - Chapter context containing path information
 * @param chapterId - Chapter document ID
 * @param chapterData - Chapter data (without id)
 */
export async function createChapterWithId(
    ctx: ChapterContext,
    chapterId: string,
    chapterData: Omit<ThesisChapter, 'id'>
): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        ...chapterData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Get a chapter document by ID
 * @param ctx - Chapter context containing path information
 * @param chapterId - Chapter document ID
 * @returns Chapter data or null if not found
 */
export async function getChapter(ctx: ChapterContext, chapterId: string): Promise<ThesisChapter | null> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: Number(docSnap.id), ...docSnap.data() } as unknown as ThesisChapter;
}

/**
 * Get all chapters for a stage
 * @param ctx - Chapter context containing path information
 * @returns Array of chapters ordered by id (ascending)
 */
export async function getChaptersForStage(ctx: ChapterContext): Promise<ThesisChapter[]> {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const q = query(chaptersRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: Number(docSnap.id) || 0,
        ...docSnap.data(),
    } as unknown as ThesisChapter));
}

/**
 * Get all chapters across all stages using collectionGroup query
 * Note: This queries the CHAPTERS_SUBCOLLECTION which is used for both
 * thesis chapters and chapter configs. Filter results as needed.
 * @param constraints - Optional query constraints
 * @returns Array of all chapters
 */
export async function getAllChapters(constraints?: QueryConstraint[]): Promise<ThesisChapter[]> {
    const chaptersQuery = collectionGroup(firebaseFirestore, CHAPTERS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(chaptersQuery, ...constraints)
        : chaptersQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: Number(docSnap.id) || 0,
        ...docSnap.data(),
    } as unknown as ThesisChapter));
}

/**
 * Update a chapter document
 * @param ctx - Chapter context containing path information
 * @param chapterId - Chapter document ID
 * @param data - Partial chapter data to update
 */
export async function updateChapter(
    ctx: ChapterContext,
    chapterId: string,
    data: Partial<ThesisChapter>
): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a chapter document
 * @param ctx - Chapter context containing path information
 * @param chapterId - Chapter document ID
 */
export async function deleteChapter(ctx: ChapterContext, chapterId: string): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to chapters for a specific stage
 * @param ctx - Chapter context containing path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenChaptersForStage(
    ctx: ChapterContext,
    options: ChapterListenerOptions
): () => void {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const q = query(chaptersRef, orderBy('id', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const chapters = snapshot.docs.map((docSnap) => ({
                id: Number(docSnap.id) || 0,
                ...docSnap.data(),
            } as unknown as ThesisChapter));
            options.onData(chapters);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Chapter listener error:', error);
        }
    );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Seed chapters for a thesis stage from a template
 * @param ctx - Chapter context containing path information
 * @param chapters - Array of chapter data (without id)
 */
export async function seedChaptersFromTemplate(
    ctx: ChapterContext,
    chapters: Omit<ThesisChapter, 'id'>[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    chapters.forEach((chapterData, index) => {
        const chapterId = String(index + 1);
        const docPath = buildChapterDocPath(
            ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
        );
        const docRef = doc(firebaseFirestore, docPath);
        batch.set(docRef, {
            ...chapterData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();
}

// ============================================================================
// Chapter Decision Operations (via chapters subcollection)
// ============================================================================

/** Context for chapter decision operations */
export interface ChapterDecisionContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: string;
}

/** Input for updating chapter decision */
export interface UpdateChapterDecisionInput {
    ctx: ChapterDecisionContext;
    chapterId: number;
    decision: WorkspaceChapterDecision;
    role: ExpertRole;
}

/** Result from chapter decision update */
export interface ChapterDecisionResult {
    status: ThesisStatus;
    decidedAt: string;
    expertApprovals: ExpertApprovalState;
}

/**
 * Calculate overall chapter status from expert approvals
 */
function calculateOverallStatus(
    expertApprovals: ExpertApprovalState,
    currentDecision: WorkspaceChapterDecision
): ThesisStatus {
    // If current decision is revision required, chapter needs revision
    if (currentDecision === 'revision_required') {
        return 'revision_required';
    }

    // Check if all required experts have approved
    const approvalValues = Object.values(expertApprovals);
    if (approvalValues.length > 0 && approvalValues.every(Boolean)) {
        return 'approved';
    }

    // Otherwise under review
    return 'under_review';
}

/**
 * Update chapter decision in the chapter document (subcollection)
 * Path: thesis/{thesisId}/stages/{stage}/chapters/{chapterId}
 * @param input - The chapter context, chapter ID, decision, and role
 * @returns Decision result with updated status and approvals
 */
export async function updateChapterDecision(
    input: UpdateChapterDecisionInput
): Promise<ChapterDecisionResult> {
    const { ctx, chapterId, decision, role } = input;
    const { year, department, course, groupId, thesisId, stage } = ctx;

    if (!thesisId || !stage) {
        throw new Error('thesisId and stage are required to update chapter decision');
    }

    const chapterCtx: ChapterContext = {
        year,
        department,
        course,
        groupId,
        thesisId,
        stage,
    };

    // Get the chapter document from subcollection
    const chapter = await getChapter(chapterCtx, String(chapterId));
    if (!chapter) {
        throw new Error(`Chapter ${chapterId} not found in thesis ${thesisId} stage ${stage}`);
    }

    const decidedAt = new Date().toISOString();
    const isApproved = decision === 'approved';

    // Update expert approvals
    const expertApprovals: ExpertApprovalState = {
        ...(chapter.expertApprovals ?? {}),
        [role]: isApproved,
    };

    // Calculate overall status
    const status = calculateOverallStatus(expertApprovals, decision);

    // Update the chapter document in subcollection
    await updateChapter(chapterCtx, String(chapterId), {
        status,
        lastModified: decidedAt,
        expertApprovals,
    });

    return {
        status,
        decidedAt,
        expertApprovals,
    };
}

// ============================================================================
// Chapter Configuration/Template Management
// Path: configuration/departments/{department}/courses/{course}/chapters/{configId}
// ============================================================================

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

// ============================================================================
// Course-specific Chapter Template Utilities
// ============================================================================

/**
 * Get chapter templates for a course with fallback to default templates.
 * Loads from configuration/departments/{department}/courses/{course}/chapters/default
 * Falls back to buildDefaultChapterTemplates() if no config exists.
 * @param department - Department name
 * @param course - Course name
 * @returns Array of chapter templates
 */
export async function getChapterTemplatesForCourse(
    department: string,
    course: string
): Promise<ChapterTemplate[]> {
    const config = await getChapterConfigByCourse(department, course);
    if (config?.chapters && config.chapters.length > 0) {
        return config.chapters;
    }
    return buildDefaultChapterTemplates();
}

/**
 * Get thesis chapters for a course (converted from templates).
 * Loads chapter templates and converts them to ThesisChapter format.
 * Falls back to default chapters if no config exists.
 * @param department - Department name
 * @param course - Course name
 * @returns Array of thesis chapters
 */
export async function getThesisChaptersForCourse(
    department: string,
    course: string
): Promise<ThesisChapter[]> {
    const templates = await getChapterTemplatesForCourse(department, course);
    return templatesToThesisChapters(templates);
}

/**
 * Listen to chapter templates for a course with fallback to defaults.
 * @param department - Department name
 * @param course - Course name
 * @param onData - Callback when data changes (receives templates or defaults)
 * @param onError - Optional error handler
 * @returns Unsubscribe function
 */
export function listenChapterTemplatesForCourse(
    department: string,
    course: string,
    onData: (templates: ChapterTemplate[]) => void,
    onError?: (error: unknown) => void
): () => void {
    return listenChapterConfig(
        department,
        course,
        (config) => {
            if (config?.chapters && config.chapters.length > 0) {
                onData(config.chapters);
            } else {
                onData(buildDefaultChapterTemplates());
            }
        },
        onError
    );
}
