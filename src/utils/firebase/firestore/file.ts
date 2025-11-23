/**
 * Firestore utilities for file metadata management
 * Unified file metadata storage with support for various contexts (thesis, user, etc.)
 */

import {
    doc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
    collectionGroup,
    type DocumentReference,
    type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { FileAttachment } from '../../../types/file';
import { resolveGroupRefs, type ResolvedGroupRefs } from './groups';

/** Subcollection name for storing file metadata under group documents */
const FILES_SUBCOLLECTION = 'files';

export interface FileMetadataContext {
    groupId: string;
}

async function getGroupFilesCollection(groupId: string): Promise<{
    refs: ResolvedGroupRefs;
    collectionRef: ReturnType<typeof collection>;
}> {
    const refs = await resolveGroupRefs(groupId);
    return {
        refs,
        collectionRef: collection(refs.canonicalRef, FILES_SUBCOLLECTION),
    };
}

function getFilesCollectionGroup() {
    return collectionGroup(firebaseFirestore, FILES_SUBCOLLECTION);
}

async function findFileDocRefById(fileId: string): Promise<DocumentReference<DocumentData> | null> {
    const filesQuery = query(
        getFilesCollectionGroup(),
        where('id', '==', fileId),
        limit(1)
    );
    const snapshot = await getDocs(filesQuery);
    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0].ref;
}

/**
 * Generate a unique file ID
 */
export function generateFileId(uid: string, timestamp: number = Date.now()): string {
    return `${uid}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store or update file metadata in Firestore
 * @param fileId - Unique file identifier
 * @param fileInfo - File attachment metadata
 * @param ownerUid - UID of the file owner
 */
export async function setFileMetadata(
    fileId: string,
    fileInfo: FileAttachment,
    ownerUid: string,
    context: FileMetadataContext
): Promise<void> {
    if (!context.groupId) {
        throw new Error('groupId is required to store file metadata');
    }

    const { refs, collectionRef } = await getGroupFilesCollection(context.groupId);
    const ref = doc(collectionRef, fileId);
    const now = new Date().toISOString();

    const metadata: FileAttachment = {
        ...fileInfo,
        id: fileId,
        owner: ownerUid,
        groupId: context.groupId,
        departmentKey: refs.meta.departmentKey,
        courseKey: refs.meta.courseKey,
        createdAt: fileInfo.createdAt ?? now,
        updatedAt: now,
    };

    const cleanedData = cleanData(metadata, 'create');
    await setDoc(ref, cleanedData, { merge: true });
}

/**
 * Get file metadata by ID
 * @param fileId - File identifier
 * @returns File metadata or null if not found
 */
export async function getFileById(fileId: string): Promise<FileAttachment | null> {
    const filesQuery = query(
        getFilesCollectionGroup(),
        where('id', '==', fileId),
        limit(1)
    );
    const snap = await getDocs(filesQuery);
    if (snap.empty) {
        return null;
    }

    return snap.docs[0].data() as FileAttachment;
}

/**
 * Get multiple files by their IDs
 * @param fileIds - Array of file identifiers
 * @returns Array of file attachments
 */
export async function getFilesByIds(fileIds: string[]): Promise<FileAttachment[]> {
    if (!fileIds || fileIds.length === 0) return [];

    const files: FileAttachment[] = [];

    // Firestore 'in' queries are limited to 10 items
    const batchSize = 10;
    for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        const q = query(getFilesCollectionGroup(), where('id', 'in', batch));

        const querySnapshot = await getDocs(q);
        files.push(...querySnapshot.docs.map(doc => doc.data() as FileAttachment));
    }

    return files;
}

/**
 * Get all files owned by a user
 * @param ownerUid - Owner's UID
 * @param limitCount - Maximum number of files to return
 * @returns Array of file attachments
 */
export async function getFilesByOwner(
    ownerUid: string,
    limitCount?: number
): Promise<FileAttachment[]> {
    try {
        const filesRef = getFilesCollectionGroup();
        let q = query(
            filesRef,
            where('owner', '==', ownerUid),
            orderBy('createdAt', 'desc')
        );

        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
    } catch (error) {
        console.error('Error getting files by owner:', error);
        return [];
    }
}

/**
 * Get files by thesis context
 * @param thesisId - Thesis ID
 * @param chapterId - Optional chapter ID
 * @param category - Optional file category
 * @returns Array of file attachments
 */
export async function getFilesByThesis(
    thesisId: string,
    chapterId?: number,
    category?: 'submission' | 'attachment'
): Promise<FileAttachment[]> {
    try {
        const filesRef = getFilesCollectionGroup();

        if (chapterId !== undefined && category) {
            const q = query(
                filesRef,
                where('thesisId', '==', thesisId),
                where('chapterId', '==', chapterId),
                where('category', '==', category),
                orderBy('uploadDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
        } else if (chapterId !== undefined) {
            const q = query(
                filesRef,
                where('thesisId', '==', thesisId),
                where('chapterId', '==', chapterId),
                orderBy('uploadDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
        } else if (category) {
            const q = query(
                filesRef,
                where('thesisId', '==', thesisId),
                where('category', '==', category),
                orderBy('uploadDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
        } else {
            const q = query(
                filesRef,
                where('thesisId', '==', thesisId),
                orderBy('uploadDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
        }
    } catch (error) {
        console.error('Error getting files by thesis:', error);
        return [];
    }
}

/**
 * Get files by comment ID
 * @param commentId - Comment ID
 * @returns Array of file attachments
 */
export async function getFilesByComment(commentId: string): Promise<FileAttachment[]> {
    try {
        const filesRef = getFilesCollectionGroup();
        const q = query(
            filesRef,
            where('commentId', '==', commentId),
            orderBy('uploadDate', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
    } catch (error) {
        console.error('Error getting files by comment:', error);
        return [];
    }
}

/**
 * Get files by author UID
 * @param authorUid - Author's UID
 * @param thesisId - Optional thesis ID to filter
 * @returns Array of file attachments
 */
export async function getFilesByAuthor(
    authorUid: string,
    thesisId?: string
): Promise<FileAttachment[]> {
    try {
        const filesRef = getFilesCollectionGroup();
        let constraints = [
            where('author', '==', authorUid),
            orderBy('uploadDate', 'desc')
        ];

        if (thesisId) {
            constraints = [
                where('author', '==', authorUid),
                where('thesisId', '==', thesisId),
                orderBy('uploadDate', 'desc')
            ];
        }

        const q = query(filesRef, ...constraints);
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as FileAttachment);
    } catch (error) {
        console.error('Error getting files by author:', error);
        return [];
    }
}

/**
 * Delete file metadata from Firestore
 * @param fileId - File identifier
 */
export async function deleteFileMetadata(fileId: string): Promise<void> {
    if (!fileId) throw new Error('File ID required');
    const ref = await findFileDocRefById(fileId);
    if (!ref) {
        return;
    }

    await deleteDoc(ref);
}

/**
 * Delete multiple file records by their IDs
 * @param fileIds - Array of file IDs to delete
 */
export async function bulkDeleteFileMetadata(fileIds: string[]): Promise<void> {
    if (!fileIds || fileIds.length === 0) throw new Error('File IDs required');
    const batch = writeBatch(firebaseFirestore);

    for (const fileId of fileIds) {
        const ref = await findFileDocRefById(fileId);
        if (ref) {
            batch.delete(ref);
        }
    }

    await batch.commit();
}

/**
 * Update file metadata
 * @param fileId - File identifier
 * @param updates - Partial file data to update
 */
export async function updateFileMetadata(
    fileId: string,
    updates: Partial<FileAttachment>
): Promise<void> {
    const ref = await findFileDocRefById(fileId);
    if (!ref) {
        throw new Error('File not found');
    }
    // Clean data: remove undefined (keep null to delete fields in update mode)
    const cleanedUpdates = cleanData({
        ...updates,
        updatedAt: new Date().toISOString()
    }, 'update');

    await setDoc(ref, cleanedUpdates, { merge: true });
}

/**
 * Get all files (admin function, use with caution)
 * @param limitCount - Maximum number of files to return
 * @returns Array of file attachments with IDs
 */
export async function getAllFiles(limitCount: number = 100): Promise<(FileAttachment & { id: string })[]> {
    const filesRef = getFilesCollectionGroup();
    const q = query(filesRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FileAttachment & { id: string }));
}

/**
 * Get the latest submission for a thesis chapter
 * @param thesisId - Thesis ID
 * @param chapterId - Chapter ID
 * @returns Latest submission file or null
 */
export async function getLatestChapterSubmission(
    thesisId: string,
    chapterId: number
): Promise<FileAttachment | null> {
    try {
        const files = await getFilesByThesis(thesisId, chapterId, 'submission');

        if (files.length === 0) return null;

        // Already sorted by uploadDate desc, return first
        return files[0];
    } catch (error) {
        console.error('Error getting latest chapter submission:', error);
        return null;
    }
}
