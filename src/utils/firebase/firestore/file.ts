/**
 * Firestore utilities for file metadata management
 * Files are stored within submission and chat documents following the hierarchical structure:
 * - Submissions: year/{year}/departments/{dept}/courses/{course}/groups/{group}/thesis/{thesis}/stages/{stage}/chapters/{chapter}/submissions/{submission}
 * - Chats: ...submissions/{submission}/chats/{chat}
 * 
 * File metadata is embedded in submission.files[] arrays, not in a separate root collection.
 */

import { collectionGroup, getDocs } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { FileAttachment } from '../../../types/file';
import type { ChapterSubmission, ThesisStageName } from '../../../types/thesis';
import { SUBMISSIONS_SUBCOLLECTION } from '../../../config/firestore';

/**
 * Generate a unique file ID
 */
export function generateFileId(uid: string, timestamp: number = Date.now()): string {
    return `${uid}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get file by ID from submissions across all paths
 * Searches through all submissions to find a file with the given ID
 * @param fileId - File identifier
 * @returns File metadata or null if not found
 */
export async function getFileById(fileId: string): Promise<FileAttachment | null> {
    if (!fileId) return null;

    try {
        // Query all submissions using collectionGroup
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const file = submission.files?.find((f) => f.id === fileId);
            if (file) {
                return file;
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting file by ID:', error);
        return null;
    }
}

/**
 * Get multiple files by their IDs from submissions
 * @param fileIds - Array of file identifiers
 * @returns Array of file attachments
 */
export async function getFilesByIds(fileIds: string[]): Promise<FileAttachment[]> {
    if (!fileIds || fileIds.length === 0) return [];

    try {
        // Query all submissions using collectionGroup
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: FileAttachment[] = [];
        const fileIdSet = new Set(fileIds);

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const matchingFiles = (submission.files ?? []).filter((f) => f.id && fileIdSet.has(f.id));
            files.push(...matchingFiles);
        }

        return files;
    } catch (error) {
        console.error('Error getting files by IDs:', error);
        return [];
    }
}

/**
 * Get files by thesis context from submissions
 * @param thesisId - Thesis ID
 * @param chapterId - Optional chapter ID
 * @param category - Optional file category
 * @param stage - Optional thesis stage
 * @returns Array of file attachments
 */
export async function getFilesByThesis(
    thesisId: string,
    chapterId?: number,
    category?: 'submission' | 'attachment',
    stage?: ThesisStageName,
): Promise<FileAttachment[]> {
    try {
        // Query all submissions using collectionGroup
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: FileAttachment[] = [];

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const submissionFiles = submission.files ?? [];

            for (const file of submissionFiles) {
                // Filter by thesisId
                if (file.thesisId !== thesisId) continue;

                // Filter by chapterId if specified
                if (chapterId !== undefined && file.chapterId !== chapterId) continue;

                // Filter by category if specified
                if (category && file.category !== category) continue;

                // Filter by stage if specified
                if (stage && file.chapterStage !== stage) continue;

                files.push(file);
            }
        }

        // Sort by uploadDate descending
        return files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error getting files by thesis:', error);
        return [];
    }
}

/**
 * Get files uploaded for a specific terminal requirement.
 * @param thesisId - Thesis document identifier
 * @param requirementId - Terminal requirement identifier
 */
export async function getFilesByTerminalRequirement(
    thesisId: string,
    requirementId: string,
): Promise<FileAttachment[]> {
    try {
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: FileAttachment[] = [];

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const matchingFiles = (submission.files ?? []).filter(
                (f) => f.thesisId === thesisId && f.terminalRequirementId === requirementId
            );
            files.push(...matchingFiles);
        }

        // Sort by uploadDate descending
        return files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error getting files by terminal requirement:', error);
        return [];
    }
}

/**
 * Get files by comment ID (from chat attachments)
 * @param commentId - Comment/Chat ID
 * @returns Array of file attachments
 */
export async function getFilesByComment(commentId: string): Promise<FileAttachment[]> {
    try {
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: FileAttachment[] = [];

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const matchingFiles = (submission.files ?? []).filter((f) => f.commentId === commentId);
            files.push(...matchingFiles);
        }

        // Sort by uploadDate descending
        return files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error getting files by comment:', error);
        return [];
    }
}

/**
 * Get files by author UID from submissions
 * @param authorUid - Author's UID
 * @param thesisId - Optional thesis ID to filter
 * @returns Array of file attachments
 */
export async function getFilesByAuthor(
    authorUid: string,
    thesisId?: string
): Promise<FileAttachment[]> {
    try {
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: FileAttachment[] = [];

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const matchingFiles = (submission.files ?? []).filter((f) => {
                if (f.author !== authorUid) return false;
                if (thesisId && f.thesisId !== thesisId) return false;
                return true;
            });
            files.push(...matchingFiles);
        }

        // Sort by uploadDate descending
        return files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error getting files by author:', error);
        return [];
    }
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
    const files = await getFilesByAuthor(ownerUid);
    return limitCount ? files.slice(0, limitCount) : files;
}

/**
 * Delete file metadata - Note: This is a no-op as files are embedded in submissions
 * To delete a file, update the submission document to remove it from the files array
 * @param fileId - File identifier (unused)
 * @deprecated Files are embedded in submissions, use updateSubmission to remove files
 */
export async function deleteFileMetadata(fileId: string): Promise<void> {
    void fileId; // Suppress unused parameter warning
    console.warn('deleteFileMetadata is deprecated. Files are embedded in submissions. Use updateSubmission to remove files.');
    // This is kept for backward compatibility but does nothing
    // The actual deletion should be done by updating the submission document
}

/**
 * Delete multiple file records by their IDs
 * @param fileIds - Array of file IDs to delete (unused)
 * @deprecated Files are embedded in submissions, use updateSubmission to remove files
 */
export async function bulkDeleteFileMetadata(fileIds: string[]): Promise<void> {
    void fileIds; // Suppress unused parameter warning
    console.warn('bulkDeleteFileMetadata is deprecated. Files are embedded in submissions. Use updateSubmission to remove files.');
    // This is kept for backward compatibility but does nothing
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

/**
 * Get all files (admin function, use with caution)
 * @param limitCount - Maximum number of files to return
 * @returns Array of file attachments with IDs
 */
export async function getAllFiles(limitCount: number = 100): Promise<(FileAttachment & { id: string })[]> {
    try {
        const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
        const snapshot = await getDocs(submissionsQuery);

        const files: (FileAttachment & { id: string })[] = [];

        for (const docSnap of snapshot.docs) {
            const submission = docSnap.data() as ChapterSubmission;
            const submissionFiles = (submission.files ?? [])
                .filter((f): f is FileAttachment & { id: string } => Boolean(f.id));
            files.push(...submissionFiles);

            if (files.length >= limitCount) break;
        }

        // Sort by createdAt/uploadDate descending and limit
        return files
            .sort((a, b) => {
                const aTime = new Date(a.uploadDate ?? '').getTime();
                const bTime = new Date(b.uploadDate ?? '').getTime();
                if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
                return bTime - aTime;
            })
            .slice(0, limitCount);
    } catch (error) {
        console.error('Error getting all files:', error);
        return [];
    }
}

// ============================================================================
// Legacy exports - kept for backward compatibility but deprecated
// ============================================================================

/**
 * @deprecated Use submission documents directly. Files are embedded in submissions.
 */
export async function setFileMetadata(
    fileId: string,
    fileInfo: FileAttachment,
    ownerUid: string
): Promise<void> {
    void fileId; void fileInfo; void ownerUid; // Suppress unused parameter warnings
    console.warn('setFileMetadata is deprecated. Files should be embedded in submission documents via createSubmission.');
    // No-op - files are now stored in submission documents
}

/**
 * @deprecated Use submission documents directly. Files are embedded in submissions.
 */
export async function updateFileMetadata(
    fileId: string,
    updates: Partial<FileAttachment>
): Promise<void> {
    void fileId; void updates; // Suppress unused parameter warnings
    console.warn('updateFileMetadata is deprecated. Update the submission document directly to modify file metadata.');
    // No-op - files are now stored in submission documents
}
