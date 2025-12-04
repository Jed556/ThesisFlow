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
    query, serverTimestamp, writeBatch, onSnapshot, orderBy, type QueryConstraint,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisChapter, ThesisStageName, ChapterSubmissionEntry } from '../../../types/thesis';
import { CHAPTERS_SUBCOLLECTION, THESIS_STAGE_SLUGS } from '../../../config/firestore';
import { buildChaptersCollectionPath, buildChapterDocPath, buildSubmissionsCollectionPath } from './paths';
import StagesConfig from '../../../config/stages.json';

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

/**
 * Context for fetching all chapters across all stages for a thesis
 */
export interface ThesisChaptersContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
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
    // Note: We don't use orderBy('id') because id is the document ID, not a field
    const snapshot = await getDocs(chaptersRef);

    // Convert stage slug back to stage name for filtering
    const stageConfig = StagesConfig.stages.find(s => s.slug === ctx.stage);
    const stageName = stageConfig?.name as ThesisStageName | undefined;

    return snapshot.docs
        .map((docSnap) => ({
            id: Number(docSnap.id) || 0,
            ...docSnap.data(),
            // Add stage as array with the stage name this chapter belongs to
            stage: stageName ? [stageName] : [],
        } as unknown as ThesisChapter))
        .sort((a, b) => a.id - b.id); // Sort by numeric ID
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
 * Fetch submissions for a chapter (one-time read for stage completion checks)
 */
async function fetchSubmissionsForChapter(
    ctx: ChapterContext,
    chapterId: string
): Promise<ChapterSubmissionEntry[]> {
    const submissionsPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const submissionsRef = collection(firebaseFirestore, submissionsPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));

    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            // Derive status from expertApprovals if not directly stored
            let status = data.submissionStatus ?? data.status ?? 'under_review';

            // Check if all required experts have approved
            const expertApprovals = data.expertApprovals ?? [];
            if (Array.isArray(expertApprovals) && expertApprovals.length > 0) {
                const allApproved = expertApprovals.every(
                    (a: { decision?: string }) => a.decision === 'approved' || a.decision === undefined
                );
                const hasRevisionRequired = expertApprovals.some(
                    (a: { decision?: string }) => a.decision === 'revision_required'
                );
                if (hasRevisionRequired) {
                    status = 'revision_required';
                } else if (allApproved && expertApprovals.length >= 2) {
                    // At least adviser and editor approved
                    status = 'approved';
                }
            }

            return {
                id: docSnap.id,
                status,
            } as ChapterSubmissionEntry;
        });
    } catch (error) {
        console.error('[fetchSubmissionsForChapter] Error:', error);
        return [];
    }
}

/**
 * Listen to chapters for a specific stage
 * Also fetches submission status for each chapter to determine approval state
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

    console.log('[listenChaptersForStage] Listening to path:', collectionPath);

    const chaptersRef = collection(firebaseFirestore, collectionPath);
    // Note: We don't use orderBy('id') because id is the document ID, not a field
    // Documents are fetched and then sorted by their numeric document ID

    return onSnapshot(
        chaptersRef,
        async (snapshot) => {
            console.log('[listenChaptersForStage] Received', snapshot.docs.length, 'chapters for stage:', ctx.stage);

            // Convert stage slug back to stage name for filtering
            const stageConfig = StagesConfig.stages.find(s => s.slug === ctx.stage);
            const stageName = stageConfig?.name as ThesisStageName | undefined;

            // Build chapters with their submissions for status checks
            const chaptersWithSubmissions = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const chapterData = docSnap.data();
                    const chapterId = docSnap.id;

                    // Check if chapter already has isApproved flag set
                    const isApproved = chapterData.isApproved === true;

                    // Only fetch submissions if not already marked as approved
                    let submissions: ChapterSubmissionEntry[] = [];
                    if (!isApproved) {
                        submissions = await fetchSubmissionsForChapter(ctx, chapterId);
                    } else {
                        // If approved, create a synthetic approved submission entry
                        submissions = [{ id: chapterData.approvedSubmissionId ?? 'approved', status: 'approved' }];
                    }

                    return {
                        id: Number(chapterId) || 0,
                        ...chapterData,
                        stage: stageName ? [stageName] : [],
                        submissions,
                    } as unknown as ThesisChapter;
                })
            );

            const sortedChapters = chaptersWithSubmissions.sort((a, b) => a.id - b.id);
            options.onData(sortedChapters);
        },
        (error) => {
            console.error('[listenChaptersForStage] Error for stage:', ctx.stage, error);
            if (options.onError) options.onError(error);
            else console.error('Chapter listener error:', error);
        }
    );
}

/**
 * Stage values for thesis chapters (derived from JSON config)
 */
const THESIS_STAGES = StagesConfig.stages.map(s => s.name) as ThesisStageName[];

/**
 * Stage slugs for Firestore paths (derived from JSON config)
 */
const THESIS_STAGE_SLUG_VALUES = StagesConfig.stages.map(s => s.slug);

/**
 * Listen to all chapters across all stages for a thesis
 * Sets up listeners for each stage and combines results
 * @param ctx - Thesis chapters context (without stage)
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function that cleans up all listeners
 */
export function listenAllChaptersForThesis(
    ctx: ThesisChaptersContext,
    options: ChapterListenerOptions
): () => void {
    const stageChapters: Record<string, ThesisChapter[]> = {};
    const unsubscribers: (() => void)[] = [];

    console.log('[listenAllChaptersForThesis] Context:', ctx);
    console.log('[listenAllChaptersForThesis] Stage slugs to listen:', THESIS_STAGE_SLUG_VALUES);

    const emitCombinedChapters = () => {
        // Combine chapters from all stage slugs
        const allChapters = THESIS_STAGE_SLUG_VALUES.flatMap((slug) => stageChapters[slug] ?? []);
        console.log('[listenAllChaptersForThesis] Emitting combined chapters:', allChapters.length);
        options.onData(allChapters);
    };

    // Iterate over stage slugs (used in Firestore paths)
    for (const stageSlug of THESIS_STAGE_SLUG_VALUES) {
        const stageCtx: ChapterContext = { ...ctx, stage: stageSlug };
        const unsubscribe = listenChaptersForStage(stageCtx, {
            onData: (chapters) => {
                stageChapters[stageSlug] = chapters;
                emitCombinedChapters();
            },
            onError: options.onError,
        });
        unsubscribers.push(unsubscribe);
    }

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
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

    console.log('[seedChaptersFromTemplate] Seeding', chapters.length, 'chapters to stage:', ctx.stage);

    chapters.forEach((chapterData, index) => {
        const chapterId = String(index + 1);
        const docPath = buildChapterDocPath(
            ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
        );
        console.log('[seedChaptersFromTemplate] Writing chapter to path:', docPath);
        const docRef = doc(firebaseFirestore, docPath);

        // Remove 'stage' field - it's only used for routing during seeding
        // The stage is determined by the subcollection path, not stored in the document
        const { stage: _stage, ...chapterWithoutStage } = chapterData as ThesisChapter & { stage?: unknown };

        batch.set(docRef, {
            ...chapterWithoutStage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();
    console.log('[seedChaptersFromTemplate] Batch committed for stage:', ctx.stage);
}

/**
 * Seed all chapters for a thesis, organized by their respective stages
 * Groups chapters by their stage property and seeds them to the appropriate subcollections:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stageSlug}/chapters/{chapterId}
 * 
 * @param ctx - Thesis chapters context (without stage)
 * @param chapters - Array of thesis chapters with stage arrays
 */
export async function seedAllChaptersForThesis(
    ctx: ThesisChaptersContext,
    chapters: ThesisChapter[]
): Promise<void> {
    console.log('[seedAllChaptersForThesis] Context:', ctx);
    console.log('[seedAllChaptersForThesis] Chapters to seed:', chapters.length);

    // Group chapters by stage slug
    const chaptersByStage = new Map<string, ThesisChapter[]>();

    for (const chapter of chapters) {
        // Get stages for this chapter (defaults to first stage if not specified)
        const chapterStages = Array.isArray(chapter.stage) && chapter.stage.length > 0
            ? chapter.stage
            : [THESIS_STAGES[0]];

        console.log('[seedAllChaptersForThesis] Chapter', chapter.id, 'stages:', chapterStages);

        for (const stageName of chapterStages) {
            // Convert stage name to slug
            const stageSlug = THESIS_STAGE_SLUGS[stageName as ThesisStageName] ?? stageName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            console.log('[seedAllChaptersForThesis] Stage name:', stageName, '-> slug:', stageSlug);

            if (!chaptersByStage.has(stageSlug)) {
                chaptersByStage.set(stageSlug, []);
            }
            chaptersByStage.get(stageSlug)!.push(chapter);
        }
    }

    console.log('[seedAllChaptersForThesis] Chapters by stage:', Object.fromEntries(chaptersByStage));

    // Seed chapters for each stage
    const seedPromises = Array.from(chaptersByStage.entries()).map(
        ([stageSlug, stageChapters]) => {
            const chapterContext: ChapterContext = {
                ...ctx,
                stage: stageSlug,
            };
            console.log('[seedAllChaptersForThesis] Seeding', stageChapters.length, 'chapters to stage:', stageSlug);
            // Strip 'id' from chapters for seeding (seedChaptersFromTemplate generates new IDs)
            const chaptersWithoutId = stageChapters.map(({ id: _id, ...rest }) => rest);
            return seedChaptersFromTemplate(chapterContext, chaptersWithoutId);
        }
    );

    await Promise.all(seedPromises);
    console.log('[seedAllChaptersForThesis] Seeding complete');
}
