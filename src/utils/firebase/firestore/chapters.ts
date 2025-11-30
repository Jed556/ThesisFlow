/**
 * Firebase Firestore - Thesis Chapters
 * CRUD operations for Chapter documents within thesis stages using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}
 * 
 * Note: This file handles chapter documents within thesis stages.
 * For chapter configuration/templates, see chapter.ts
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, writeBatch, onSnapshot, type QueryConstraint,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisChapter, ThesisData, ThesisStatus, ExpertRole, ExpertApprovalState } from '../../../types/thesis';
import type { WorkspaceChapterDecision } from '../../../types/workspace';
import { CHAPTERS_SUBCOLLECTION } from '../../../config/firestore';
import { buildChaptersCollectionPath, buildChapterDocPath, buildThesisDocPath } from './paths';

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
// ============================================================================
// Chapter Decision Operations (Thesis document embedded chapters)
// ============================================================================

/** Context for chapter decision operations */
export interface ChapterDecisionContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
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
 * Update chapter decision in the thesis document
 * @param input - The thesis context, chapter ID, decision, and role
 * @returns Decision result with updated status and approvals
 */
export async function updateChapterDecision(
    input: UpdateChapterDecisionInput
): Promise<ChapterDecisionResult> {
    const { ctx, chapterId, decision, role } = input;
    const { year, department, course, groupId, thesisId } = ctx;

    if (!thesisId) {
        throw new Error('thesisId is required to update chapter decision');
    }

    const docPath = buildThesisDocPath(year, department, course, groupId, thesisId);
    const ref = doc(firebaseFirestore, docPath);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    const chapters = thesis.chapters ?? [];
    const chapterIndex = chapters.findIndex((ch) => ch.id === chapterId);

    if (chapterIndex === -1) {
        throw new Error(`Chapter ${chapterId} not found in thesis ${thesisId}`);
    }

    const chapter = chapters[chapterIndex];
    const decidedAt = new Date().toISOString();
    const isApproved = decision === 'approved';

    // Update expert approvals
    const expertApprovals: ExpertApprovalState = {
        ...(chapter.expertApprovals ?? {}),
        [role]: isApproved,
    };

    // Calculate overall status
    const status = calculateOverallStatus(expertApprovals, decision);

    // Create updated chapter
    const updatedChapter: ThesisChapter = {
        ...chapter,
        status,
        lastModified: decidedAt,
        expertApprovals,
    };

    // Update the chapters array
    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex] = updatedChapter;

    // Save to Firestore
    await setDoc(ref, {
        chapters: updatedChapters,
        lastUpdated: decidedAt,
    }, { merge: true });

    return {
        status,
        decidedAt,
        expertApprovals,
    };
}
