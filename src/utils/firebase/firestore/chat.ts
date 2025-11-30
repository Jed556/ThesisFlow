/**
 * Firebase Firestore - Chat & Conversation
 * 
 * This module handles chat messages in hierarchical structure (under submissions):
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}/submissions/{submissionId}/chats/{chatId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc,
    deleteDoc, query, orderBy, serverTimestamp, onSnapshot, type QueryConstraint,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisComment } from '../../../types/thesis';
import { CHATS_SUBCOLLECTION } from '../../../config/firestore';
import { buildChatsCollectionPath, buildChatDocPath } from './paths';

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
// Chapter Comments (via chats subcollection under submissions)
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

/** Context for chapter comment operations (uses chats subcollection) */
export interface ChapterCommentContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: string;
    chapterId: string;
    submissionId: string;
}

/** Input for appending a chapter comment */
export interface AppendChapterCommentInput {
    ctx: ChapterCommentContext;
    comment: Omit<ThesisComment, 'id' | 'date'> & { id?: string; date?: string };
}

/**
 * Append a comment to a chapter submission via chats subcollection
 * Path: thesis/{thesisId}/stages/{stage}/chapters/{chapterId}/submissions/{submissionId}/chats/{chatId}
 * @param input - The chapter context and comment data
 * @returns The persisted comment with ID and date
 */
export async function appendChapterComment({
    ctx,
    comment,
}: AppendChapterCommentInput): Promise<ThesisComment> {
    const { year, department, course, groupId, thesisId, stage, chapterId, submissionId } = ctx;

    if (!thesisId || !stage || !chapterId || !submissionId) {
        throw new Error('thesisId, stage, chapterId, and submissionId are required to append a chapter comment');
    }

    const persistedComment: ThesisComment = {
        id: comment.id ?? generateCommentId(),
        date: comment.date ?? new Date().toISOString(),
        author: comment.author,
        comment: comment.comment,
        attachments: comment.attachments,
        version: comment.version,
    };

    const chatCtx: ChatContext = {
        year,
        department,
        course,
        groupId,
        thesisId,
        stage,
        chapterId,
        submissionId,
    };

    const chatId = await createChat(chatCtx, persistedComment);
    return { ...persistedComment, id: chatId };
}

/** Input for updating a chapter comment */
export interface UpdateChapterCommentInput {
    ctx: ChapterCommentContext;
    commentId: string;
    updates: Partial<Omit<ThesisComment, 'id' | 'author' | 'date'>> & {
        comment?: string;
        attachments?: ThesisComment['attachments'];
    };
}

/**
 * Update an existing comment in a chapter submission via chats subcollection
 * @param input - The chapter context, comment ID, and updates
 * @returns The updated comment
 */
export async function updateChapterComment({
    ctx,
    commentId,
    updates,
}: UpdateChapterCommentInput): Promise<ThesisComment> {
    const { year, department, course, groupId, thesisId, stage, chapterId, submissionId } = ctx;

    if (!thesisId || !stage || !chapterId || !submissionId) {
        throw new Error('thesisId, stage, chapterId, and submissionId are required to update a chapter comment');
    }

    const chatCtx: ChatContext = {
        year,
        department,
        course,
        groupId,
        thesisId,
        stage,
        chapterId,
        submissionId,
    };

    // Get the current chat to preserve existing fields
    const currentChat = await getChat(chatCtx, commentId);
    if (!currentChat) {
        throw new Error(`Comment ${commentId} not found in submission ${submissionId}`);
    }

    const updatedComment: ThesisComment = {
        ...currentChat,
        ...updates,
        comment: updates.comment ?? currentChat.comment,
        attachments: updates.attachments ?? currentChat.attachments,
        isEdited: true,
        date: new Date().toISOString(),
    };

    await updateChat(chatCtx, commentId, updatedComment);

    return updatedComment;
}

/**
 * @deprecated Use ChapterCommentContext instead. This alias is kept for backward compatibility.
 */
export type ThesisCommentContext = ChapterCommentContext;
