/**
 * Firebase Firestore - Chapter Submissions
 * CRUD operations for Submission documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}/submissions/{submissionId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, onSnapshot, type QueryConstraint
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ChapterSubmission } from '../../../types/thesis';
import { buildSubmissionsCollectionPath, buildSubmissionDocPath, SUBMISSIONS_SUBCOLLECTION } from '../../../config/firestore';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: string;
    chapterId: string;
}

export interface SubmissionListenerOptions {
    onData: (submissions: ChapterSubmission[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Submission CRUD Operations
// ============================================================================

/**
 * Create a submission document under a chapter
 * @param ctx - Submission context containing path information
 * @param submissionData - Submission data (without id)
 * @returns Created submission document ID
 */
export async function createSubmission(
    ctx: SubmissionContext,
    submissionData: Omit<ChapterSubmission, 'id'>
): Promise<string> {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(submissionsRef);

    await setDoc(newDocRef, {
        ...submissionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Get a submission document by ID
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 * @returns Submission data or null if not found
 */
export async function getSubmission(ctx: SubmissionContext, submissionId: string): Promise<ChapterSubmission | null> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ChapterSubmission;
}

/**
 * Get all submissions for a chapter
 * @param ctx - Submission context containing path information
 * @returns Array of submissions ordered by creation time (descending)
 */
export async function getSubmissionsForChapter(ctx: SubmissionContext): Promise<ChapterSubmission[]> {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ChapterSubmission));
}

/**
 * Get all submissions across all chapters using collectionGroup query
 * @param constraints - Optional query constraints
 * @returns Array of all submissions
 */
export async function getAllSubmissions(constraints?: QueryConstraint[]): Promise<ChapterSubmission[]> {
    const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(submissionsQuery, ...constraints)
        : submissionsQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ChapterSubmission));
}

/**
 * Update a submission document
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 * @param data - Partial submission data to update
 */
export async function updateSubmission(
    ctx: SubmissionContext,
    submissionId: string,
    data: Partial<ChapterSubmission>
): Promise<void> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a submission document
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 */
export async function deleteSubmission(ctx: SubmissionContext, submissionId: string): Promise<void> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to submissions for a specific chapter
 * @param ctx - Submission context containing path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenSubmissionsForChapter(
    ctx: SubmissionContext,
    options: SubmissionListenerOptions
): () => void {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const submissions = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as ChapterSubmission));
            options.onData(submissions);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Submission listener error:', error);
        }
    );
}
