/**
 * Firebase Firestore - Thesis Stages
 * CRUD operations for Stage documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisStageName } from '../../../types/thesis';
import { THESIS_STAGE_SLUGS, type ThesisStageSlug } from '../../../config/firestore';
import { buildStageDocPath, buildStagesCollectionPath } from './paths';

// ============================================================================
// Types
// ============================================================================

export interface StageContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
}

export interface StageData {
    id: string;
    name: ThesisStageName;
    createdAt?: unknown;
    updatedAt?: unknown;
    [key: string]: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get stage slug from stage name
 * @param stageName - Human-readable stage name
 * @returns Stage slug for use in Firestore paths
 */
export function getStageSlug(stageName: ThesisStageName): ThesisStageSlug {
    return THESIS_STAGE_SLUGS[stageName] || 'pre-proposal';
}

// ============================================================================
// Stage CRUD Operations
// ============================================================================

/**
 * Create a stage document under a thesis
 * @param ctx - Stage context containing path information
 * @param stageName - Human-readable stage name
 * @param data - Additional stage data
 * @returns Stage slug (document ID)
 */
export async function createStage(
    ctx: StageContext,
    stageName: ThesisStageName,
    data: Record<string, unknown>
): Promise<string> {
    const stageSlug = getStageSlug(stageName);
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, stageSlug);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        name: stageName,
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return stageSlug;
}

/**
 * Get a stage document
 * @param ctx - Stage context containing path information
 * @param stage - Stage slug
 * @returns Stage data or null if not found
 */
export async function getStage(
    ctx: StageContext,
    stage: string
): Promise<StageData | null> {
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, stage);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as StageData : null;
}

/**
 * Get all stages for a thesis
 * @param ctx - Stage context containing path information
 * @returns Array of stage data
 */
export async function getStagesForThesis(
    ctx: StageContext
): Promise<StageData[]> {
    const collectionPath = buildStagesCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId);
    const stagesRef = collection(firebaseFirestore, collectionPath);
    const snapshot = await getDocs(stagesRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as StageData));
}

/**
 * Update a stage document
 * @param ctx - Stage context containing path information
 * @param stage - Stage slug
 * @param data - Partial stage data to update
 */
export async function updateStage(
    ctx: StageContext,
    stage: string,
    data: Record<string, unknown>
): Promise<void> {
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, stage);
    const docRef = doc(firebaseFirestore, docPath);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}
