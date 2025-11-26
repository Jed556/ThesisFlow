/**
 * Firebase Storage utilities for thesis file uploads
 * Handles document uploads, media files, and attachments for thesis submissions
 */

import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { firebaseStorage } from '../firebaseConfig';
import type { FileAttachment, FileCategory } from '../../../types/file';
import type { ThesisStage } from '../../../types/thesis';
import { getError } from '../../../../utils/errorUtils';
import { getFileCategory, getFileExtension, validateFile } from '../../fileUtils';
import { setFileMetadata, getFilesByThesis, deleteFileMetadata } from '../firestore/file';

/**
 * Allowed file types for thesis submissions
 */
export const ALLOWED_THESIS_DOCUMENT_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword' // .doc
] as const;

/**
 * Allowed media types for attachments
 */
export const ALLOWED_MEDIA_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
} as const;

/**
 * Maximum file sizes by category (in bytes)
 */
export const MAX_FILE_SIZES = {
    document: 50 * 1024 * 1024,  // 50MB
    image: 10 * 1024 * 1024,     // 10MB
    video: 500 * 1024 * 1024,    // 500MB
    audio: 100 * 1024 * 1024     // 100MB
} as const;

interface UploadThesisFileOptions {
    file: File;
    userUid: string;
    thesisId: string;
    groupId: string;
    chapterId?: number;
    chapterStage?: ThesisStage;
    commentId?: string;
    category?: 'submission' | 'attachment' | 'revision';
    metadata?: Record<string, string>;
    terminalStage?: ThesisStage;
    terminalRequirementId?: string;
}

interface UploadThesisFileResult {
    url: string;
    fileAttachment: FileAttachment;
}

/**
 * Validates thesis document file type
 */
export function validateThesisDocument(file: File): { isValid: boolean; error?: string } {
    // Check file type
    const validType = ALLOWED_THESIS_DOCUMENT_TYPES.some(type => type === file.type);
    if (!validType) {
        return {
            isValid: false,
            error: 'Only PDF and DOCX files are allowed for thesis submissions'
        };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZES.document) {
        return {
            isValid: false,
            error: `File size must be less than ${MAX_FILE_SIZES.document / (1024 * 1024)}MB`
        };
    }

    return { isValid: true };
}

/**
 * Validates media file for attachments
 */
export function validateMediaFile(file: File): { isValid: boolean; error?: string } {
    const extension = getFileExtension(file.name);
    const category = getFileCategory(extension) as FileCategory;

    // Check if category is supported for media
    if (!['image', 'video', 'audio'].includes(category)) {
        return {
            isValid: false,
            error: 'Unsupported file type for media attachment'
        };
    }

    // Check file type against allowed types
    const allowedTypes = ALLOWED_MEDIA_TYPES[category as keyof typeof ALLOWED_MEDIA_TYPES];
    const validType = allowedTypes.some(type => type === file.type);
    if (!validType) {
        return {
            isValid: false,
            error: `File type ${file.type} is not allowed for ${category} files`
        };
    }

    // Check file size
    const maxSize = MAX_FILE_SIZES[category as keyof typeof MAX_FILE_SIZES];
    if (file.size > maxSize) {
        return {
            isValid: false,
            error: `File size must be less than ${maxSize / (1024 * 1024)}MB for ${category} files`
        };
    }

    return { isValid: true };
}

interface GenerateFilePathParams {
    userUid: string;
    thesisId: string;
    groupId: string;
    fileName: string;
    chapterId?: number;
    chapterStage?: ThesisStage;
    commentId?: string;
    category: string;
    terminalStage?: ThesisStage;
}

function sanitizePathSegment(value: string | number | undefined | null, fallback: string = 'general'): string {
    if (value === undefined || value === null) {
        return fallback;
    }
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
}

/**
 * Generates a unique file path for thesis uploads using UIDs with group/stage context.
 */
function generateThesisFilePath(params: GenerateFilePathParams): string {
    const {
        userUid,
        thesisId,
        groupId,
        fileName,
        chapterId,
        chapterStage,
        commentId,
        category,
        terminalStage,
    } = params;

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const sanitizedGroup = sanitizePathSegment(groupId, thesisId);

    if (terminalStage) {
        const stageSegment = sanitizePathSegment(terminalStage);
        return `theses/${sanitizedGroup}/terminal/${stageSegment}/${userUid}_${timestamp}_${sanitizedFileName}`;
    }

    if (chapterId !== undefined) {
        if (!chapterStage) {
            throw new Error('chapterStage is required when uploading files for a chapter.');
        }
        const stageSegment = sanitizePathSegment(chapterStage);
        const chapterSegment = sanitizePathSegment(chapterId, 'chapter');

        if (commentId) {
            return `theses/${sanitizedGroup}/chat/${stageSegment}/${chapterSegment}/${userUid}_${timestamp}_${sanitizedFileName}`;
        }

        return `theses/${sanitizedGroup}/chapters/${stageSegment}/${chapterSegment}/${category}/${userUid}_${timestamp}_${sanitizedFileName}`;
    }

    return `theses/${sanitizedGroup}/attachments/${category}/${userUid}_${timestamp}_${sanitizedFileName}`;
}

/**
 * Generates a file hash for database references
 */
function generateFileHash(fileName: string, size: number, timestamp: number): string {
    return `${fileName}_${size}_${timestamp}`.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Uploads a thesis document or attachment to Firebase Storage
 * @param options - Upload options including file, user UID, thesis ID, etc.
 * @returns Promise with download URL and file attachment metadata
 */
export async function uploadThesisFile(
    options: UploadThesisFileOptions
): Promise<UploadThesisFileResult> {
    const {
        file,
        userUid,
        thesisId,
        groupId,
        chapterId,
        chapterStage,
        commentId,
        category = 'submission',
        metadata = {},
        terminalStage,
        terminalRequirementId,
    } = options;

    try {
        // Validate file
        const extension = getFileExtension(file.name);

        // Validate based on category
        const validation = category === 'submission'
            ? validateThesisDocument(file)
            : validateFile(file);

        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        // Generate file path using UID
        if (chapterId !== undefined && !chapterStage) {
            throw new Error('chapterStage is required when uploading files tied to a chapter.');
        }

        const filePath = generateThesisFilePath({
            userUid,
            thesisId,
            groupId,
            fileName: file.name,
            chapterId,
            chapterStage,
            commentId,
            category,
            terminalStage,
        });

        // Create storage reference
        const fileRef = ref(firebaseStorage, filePath);

        // Prepare metadata
        const storageMetadata = {
            contentType: file.type,
            customMetadata: {
                uploadedBy: userUid,
                thesisId,
                groupId,
                category,
                originalName: file.name,
                ...(chapterId !== undefined && { chapterId: chapterId.toString() }),
                ...(chapterStage && { chapterStage }),
                ...(commentId && { commentId }),
                ...(terminalStage && { terminalStage }),
                ...(terminalRequirementId && { terminalRequirementId }),
                ...metadata
            }
        };

        // Upload file
        const snapshot = await uploadBytes(fileRef, file, storageMetadata);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Generate file hash
        const timestamp = Date.now();
        const fileHash = generateFileHash(file.name, file.size, timestamp);

        // Create file attachment object
        const fileAttachment: FileAttachment = {
            id: fileHash,
            thesisId,
            groupId,
            name: file.name,
            type: extension,
            size: `${file.size}`, // Convert to string
            url: downloadURL,
            mimeType: file.type,
            author: userUid,
            uploadDate: new Date().toISOString(),
            category: category === 'revision' ? 'submission' : category as 'submission' | 'attachment',
            ...(chapterId !== undefined && { chapterId }),
            ...(chapterStage && { chapterStage }),
            ...(commentId && { commentId }),
            ...(terminalStage && { terminalStage }),
            ...(terminalRequirementId && { terminalRequirementId })
        };

        // Save metadata to Firestore
        await setFileMetadata(fileHash, fileAttachment, userUid);

        return {
            url: downloadURL,
            fileAttachment
        };
    } catch (error) {
        const { message } = getError(error, 'Failed to upload thesis file');
        throw new Error(message);
    }
}

/**
 * Uploads multiple thesis files in batch
 * @param files - Array of files to upload
 * @param options - Upload options (same for all files)
 * @param onProgress - Progress callback for each file
 * @returns Promise with array of upload results
 */
export async function uploadThesisFilesBatch(
    files: File[],
    options: Omit<UploadThesisFileOptions, 'file'>,
    onProgress?: (completed: number, total: number) => void
): Promise<UploadThesisFileResult[]> {
    const results: UploadThesisFileResult[] = [];
    let completed = 0;

    for (const file of files) {
        try {
            const result = await uploadThesisFile({ ...options, file });
            results.push(result);
            completed++;
            onProgress?.(completed, files.length);
        } catch (error) {
            const { message } = getError(error, `Failed to upload ${file.name}`);
            console.error(message);
            // Continue with other files even if one fails
        }
    }

    return results;
}

/**
 * Deletes a thesis file from Storage and Firestore
 * @param fileUrl - Download URL of the file to delete
 * @param thesisId - Thesis ID
 * @param fileHash - File hash for Firestore metadata
 */
export async function deleteThesisFile(
    fileUrl: string,
    thesisId: string,
    fileHash: string
): Promise<void> {
    try {
        // Extract storage path from URL
        const url = new URL(fileUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
        if (!pathMatch) {
            throw new Error('Invalid file URL format');
        }

        const filePath = decodeURIComponent(pathMatch[1]);

        // Delete from Storage
        const fileRef = ref(firebaseStorage, filePath);
        await deleteObject(fileRef);

        // Delete metadata from Firestore
        await deleteFileMetadata(fileHash);
    } catch (error) {
        const { message } = getError(error, 'Failed to delete thesis file');
        throw new Error(message);
    }
}

/**
 * Lists all files for a specific chapter
 * @param thesisId - Thesis ID
 * @param chapterId - Chapter ID
 * @returns Promise with array of file attachments
 */
export async function listChapterFiles(
    thesisId: string,
    chapterId: number
): Promise<FileAttachment[]> {
    try {
        // Get files from Firestore metadata
        const files = await getFilesByThesis(thesisId, chapterId);
        return files;
    } catch (error) {
        console.error('Error listing chapter files:', error);
        return [];
    }
}

/**
 * Lists all files in a thesis directory from Storage
 * @param thesisId - Thesis ID
 * @param chapterId - Optional chapter ID to filter
 * @returns Promise with array of storage references
 */
export async function listThesisFilesFromStorage(
    thesisId: string,
    chapterId?: number,
    groupId?: string,
    chapterStage?: ThesisStage,
): Promise<string[]> {
    try {
        const sanitizedGroup = sanitizePathSegment(groupId ?? thesisId, thesisId);
        const basePath = chapterId !== undefined
            ? `theses/${sanitizedGroup}/chapters/${sanitizePathSegment(chapterStage ?? 'stage')}/${sanitizePathSegment(chapterId, 'chapter')}`
            : `theses/${sanitizedGroup}`;

        const listRef = ref(firebaseStorage, basePath);
        const result = await listAll(listRef);

        // Get download URLs for all files
        const urls = await Promise.all(
            result.items.map(itemRef => getDownloadURL(itemRef))
        );

        return urls;
    } catch (error) {
        console.error('Error listing thesis files from storage:', error);
        return [];
    }
}

/**
 * Gets the latest submission for a chapter
 * @param thesisId - Thesis ID
 * @param chapterId - Chapter ID
 * @returns Promise with the latest file attachment or null
 */
export async function getLatestChapterSubmission(
    thesisId: string,
    chapterId: number
): Promise<FileAttachment | null> {
    try {
        const files = await getFilesByThesis(thesisId, chapterId, 'submission');

        // Filter submissions only
        const submissions = files.filter((f: FileAttachment) => f.category === 'submission');

        if (submissions.length === 0) return null;

        // Sort by upload date descending
        submissions.sort((a: FileAttachment, b: FileAttachment) =>
            new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );

        return submissions[0];
    } catch (error) {
        console.error('Error getting latest chapter submission:', error);
        return null;
    }
}
