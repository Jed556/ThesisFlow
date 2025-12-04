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
