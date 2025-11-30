/**
 * Firebase Firestore - Chat & Conversation
 * 
 * This module handles:
 * 1. Chat messages in hierarchical structure (under submissions):
 *    year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}/submissions/{submissionId}/chats/{chatId}
 * 
 * 2. Chapter comments embedded in thesis documents (using hierarchical paths):
 *    year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc,
    deleteDoc, query, orderBy, serverTimestamp, onSnapshot, type QueryConstraint,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisComment, ThesisData, ThesisChapter } from '../../../types/thesis';
import { CHATS_SUBCOLLECTION } from '../../../config/firestore';
import { buildChatsCollectionPath, buildChatDocPath, buildThesisDocPath } from './paths';

// ============================================================================
// Types
// ============================================================================

export interface ChatContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: string;
    chapterId: string;
    submissionId: string;
}

export interface ChatListenerOptions {
    onData: (chats: ThesisComment[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Chat CRUD Operations
// ============================================================================

/**
 * Create a chat message under a submission
 * @param ctx - Chat context containing path information
 * @param chatData - Chat message data (without id)
 * @returns Created chat document ID
 */
export async function createChat(ctx: ChatContext, chatData: Omit<ThesisComment, 'id'>): Promise<string> {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(chatsRef);

    await setDoc(newDocRef, {
        ...chatData,
        createdAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Get a chat message by ID
 * @param ctx - Chat context containing path information
 * @param chatId - Chat document ID
 * @returns Chat data or null if not found
 */
export async function getChat(ctx: ChatContext, chatId: string): Promise<ThesisComment | null> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ThesisComment;
}

/**
 * Get all chat messages for a submission
 * @param ctx - Chat context containing path information
 * @returns Array of chat messages ordered by creation time (ascending)
 */
export async function getChatsForSubmission(ctx: ChatContext): Promise<ThesisComment[]> {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const q = query(chatsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ThesisComment));
}

/**
 * Get all chats across all submissions using collectionGroup query
 * @param constraints - Optional query constraints
 * @returns Array of all chat messages
 */
export async function getAllChats(constraints?: QueryConstraint[]): Promise<ThesisComment[]> {
    const chatsQuery = collectionGroup(firebaseFirestore, CHATS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(chatsQuery, ...constraints)
        : chatsQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ThesisComment));
}

/**
 * Update a chat message
 * @param ctx - Chat context containing path information
 * @param chatId - Chat document ID
 * @param data - Partial chat data to update
 */
export async function updateChat(ctx: ChatContext, chatId: string, data: Partial<ThesisComment>): Promise<void> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        isEdited: true,
    });
}

/**
 * Delete a chat message
 * @param ctx - Chat context containing path information
 * @param chatId - Chat document ID
 */
export async function deleteChat(ctx: ChatContext, chatId: string): Promise<void> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to chat messages for a specific submission
 * @param ctx - Chat context containing path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenChatsForSubmission(
    ctx: ChatContext,
    options: ChatListenerOptions
): () => void {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const q = query(chatsRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const chats = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as ThesisComment));
            options.onData(chats);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Chat listener error:', error);
        }
    );
}

// ============================================================================
// Chapter Comments (Embedded in thesis documents)
// ============================================================================

/**
 * Generate a unique comment ID
 */
function generateCommentId(): string {
    const cryptoObj = typeof globalThis !== 'undefined'
        ? (globalThis.crypto as Crypto | undefined)
        : undefined;
    if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID();
    }
    return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Apply an update to a specific chapter in the thesis
 * @param thesis - The thesis data containing chapters
 * @param chapterId - The ID of the chapter to update
 * @param updater - Function that receives the chapter and returns the updated chapter
 * @returns Updated chapters array
 */
function applyChapterUpdate(
    thesis: ThesisData,
    chapterId: number,
    updater: (chapter: ThesisChapter) => ThesisChapter
): ThesisChapter[] {
    const chapters = thesis.chapters ?? [];
    const index = chapters.findIndex((ch) => ch.id === chapterId);
    if (index === -1) {
        throw new Error(`Chapter ${chapterId} not found in thesis`);
    }
    const updated = [...chapters];
    updated[index] = updater(chapters[index]);
    return updated;
}

/** Context for thesis-level operations */
export interface ThesisCommentContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
}

/** Input for appending a chapter comment */
export interface AppendChapterCommentInput {
    ctx: ThesisCommentContext;
    chapterId: number;
    comment: Omit<ThesisComment, 'id' | 'date'> & { id?: string; date?: string };
}

/**
 * Append a comment to a chapter in the thesis document
 * @param input - The thesis context, chapter ID, and comment data
 * @returns The persisted comment with ID and date
 */
export async function appendChapterComment({
    ctx,
    chapterId,
    comment,
}: AppendChapterCommentInput): Promise<ThesisComment> {
    const { year, department, course, groupId, thesisId } = ctx;

    if (!thesisId) {
        throw new Error('thesisId is required to append a chapter comment');
    }

    const docPath = buildThesisDocPath(year, department, course, groupId, thesisId);
    const ref = doc(firebaseFirestore, docPath);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    const persistedComment: ThesisComment = {
        id: comment.id ?? generateCommentId(),
        date: comment.date ?? new Date().toISOString(),
        author: comment.author,
        comment: comment.comment,
        attachments: comment.attachments,
        version: comment.version,
    };

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => ({
        ...chapter,
        comments: [...(chapter.comments ?? []), persistedComment],
    }));

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: new Date().toISOString(),
    }, { merge: true });

    return persistedComment;
}

/** Input for updating a chapter comment */
export interface UpdateChapterCommentInput {
    ctx: ThesisCommentContext;
    chapterId: number;
    commentId: string;
    updates: Partial<Omit<ThesisComment, 'id' | 'author' | 'date'>> & {
        comment?: string;
        attachments?: ThesisComment['attachments'];
    };
}

/**
 * Update an existing comment in a chapter
 * @param input - The thesis context, chapter ID, comment ID, and updates
 * @returns The updated comment
 */
export async function updateChapterComment({
    ctx,
    chapterId,
    commentId,
    updates,
}: UpdateChapterCommentInput): Promise<ThesisComment> {
    const { year, department, course, groupId, thesisId } = ctx;

    if (!thesisId) {
        throw new Error('thesisId is required to update a chapter comment');
    }

    const docPath = buildThesisDocPath(year, department, course, groupId, thesisId);
    const ref = doc(firebaseFirestore, docPath);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    let updatedComment: ThesisComment | null = null;

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => {
        const comments = [...(chapter.comments ?? [])];
        const index = comments.findIndex((item) => item.id === commentId);
        if (index === -1) {
            throw new Error(`Comment ${commentId} not found in chapter ${chapterId}`);
        }
        const current = comments[index];
        const nextComment: ThesisComment = {
            ...current,
            ...updates,
            comment: updates.comment ?? current.comment,
            attachments: updates.attachments ?? current.attachments,
            isEdited: true,
            date: new Date().toISOString(),
        };
        comments[index] = nextComment;
        updatedComment = nextComment;
        return { ...chapter, comments };
    });

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: new Date().toISOString(),
    }, { merge: true });

    if (!updatedComment) {
        throw new Error('Failed to update comment. Updated comment is undefined.');
    }

    return updatedComment;
}
