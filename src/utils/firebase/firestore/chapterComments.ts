import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
    onSnapshot, query, where, orderBy, type Unsubscribe
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ChapterComment } from '../../../types/chapter';

/**
 * Firestore collection for chapter comments
 * Path: comments/{commentId}
 * 
 * Comments are stored flat with context fields for filtering:
 * - department, course, groupId, stage, chapterId for filtering
 * - parentId for threaded replies
 */
const COMMENTS_COLLECTION = 'comments';

/**
 * Context for a chapter comment - used for Firestore queries
 */
export interface ChapterCommentContext {
    department: string;
    course: string;
    groupId: string;
    stage: string;
    chapterId: number;
}

/**
 * Full chapter comment document as stored in Firestore
 */
export interface ChapterCommentDocument extends ChapterComment {
    // Context fields for filtering
    department: string;
    course: string;
    groupId: string;
    stage: string;
    chapterId: number;

    // Optional parent for threaded replies
    parentId?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;
}

/**
 * Add a new chapter comment
 * @param context - Chapter context (department, course, group, stage, chapter)
 * @param comment - Comment data (author, message, attachments)
 * @param parentId - Optional parent comment ID for threaded replies
 * @returns Promise resolving to the new comment ID
 */
export async function addChapterComment(
    context: ChapterCommentContext,
    comment: Omit<ChapterComment, 'id' | 'date'>,
    parentId?: string
): Promise<string> {
    const now = new Date().toISOString();

    const commentDoc: Omit<ChapterCommentDocument, 'id'> = {
        ...comment,
        department: context.department,
        course: context.course,
        groupId: context.groupId,
        stage: context.stage,
        chapterId: context.chapterId,
        parentId,
        date: now,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(firebaseFirestore, COMMENTS_COLLECTION), commentDoc);
    return docRef.id;
}

/**
 * Update an existing chapter comment
 * @param commentId - Comment document ID
 * @param updates - Partial updates to apply
 */
export async function updateChapterComment(
    commentId: string,
    updates: Partial<Pick<ChapterComment, 'message' | 'attachments' | 'resolved'>>
): Promise<void> {
    const docRef = doc(firebaseFirestore, COMMENTS_COLLECTION, commentId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Delete a chapter comment
 * @param commentId - Comment document ID
 */
export async function deleteChapterComment(commentId: string): Promise<void> {
    const docRef = doc(firebaseFirestore, COMMENTS_COLLECTION, commentId);
    await deleteDoc(docRef);
}

/**
 * Get all comments for a specific chapter
 * @param context - Chapter context for filtering
 * @returns Promise resolving to array of comments
 */
export async function getChapterComments(context: ChapterCommentContext): Promise<ChapterCommentDocument[]> {
    const commentsRef = collection(firebaseFirestore, COMMENTS_COLLECTION);
    const q = query(
        commentsRef,
        where('department', '==', context.department),
        where('course', '==', context.course),
        where('groupId', '==', context.groupId),
        where('stage', '==', context.stage),
        where('chapterId', '==', context.chapterId),
        orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    } as ChapterCommentDocument));
}

/**
 * Listen to real-time updates for chapter comments
 * @param context - Chapter context for filtering
 * @param onData - Callback when comments change
 * @param onError - Optional error handler
 * @returns Unsubscribe function
 */
export function listenChapterComments(
    context: ChapterCommentContext,
    onData: (comments: ChapterCommentDocument[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const commentsRef = collection(firebaseFirestore, COMMENTS_COLLECTION);
    const q = query(
        commentsRef,
        where('department', '==', context.department),
        where('course', '==', context.course),
        where('groupId', '==', context.groupId),
        where('stage', '==', context.stage),
        where('chapterId', '==', context.chapterId),
        orderBy('createdAt', 'asc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as ChapterCommentDocument));
            onData(comments);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Error listening to chapter comments:', error);
            }
        }
    );
}

/**
 * Get replies to a specific comment
 * @param parentId - Parent comment ID
 * @returns Promise resolving to array of reply comments
 */
export async function getCommentReplies(parentId: string): Promise<ChapterCommentDocument[]> {
    const commentsRef = collection(firebaseFirestore, COMMENTS_COLLECTION);
    const q = query(
        commentsRef,
        where('parentId', '==', parentId),
        orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    } as ChapterCommentDocument));
}

/**
 * Add a reply to an existing comment
 * @param context - Chapter context
 * @param parentId - Parent comment ID
 * @param reply - Reply comment data
 * @returns Promise resolving to the new reply ID
 */
export async function addCommentReply(
    context: ChapterCommentContext,
    parentId: string,
    reply: Omit<ChapterComment, 'id' | 'date'>
): Promise<string> {
    return addChapterComment(context, reply, parentId);
}

/**
 * Resolve or unresolve a comment thread
 * @param commentId - Comment document ID
 * @param resolved - Whether the comment is resolved
 */
export async function resolveComment(commentId: string, resolved: boolean): Promise<void> {
    await updateChapterComment(commentId, { resolved });
}

/**
 * Get all comments for a group across all chapters (for moderator/head/admin views)
 * @param department - Department to filter by
 * @param course - Course to filter by
 * @param groupId - Group ID to filter by
 * @returns Promise resolving to array of comments
 */
export async function getGroupComments(
    department: string,
    course: string,
    groupId: string
): Promise<ChapterCommentDocument[]> {
    const commentsRef = collection(firebaseFirestore, COMMENTS_COLLECTION);
    const q = query(
        commentsRef,
        where('department', '==', department),
        where('course', '==', course),
        where('groupId', '==', groupId),
        orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    } as ChapterCommentDocument));
}
