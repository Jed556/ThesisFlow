/**
 * Firebase Storage utilities for thesis file uploads
 * Handles document uploads, media files, and attachments for thesis submissions
 */

import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getMetadata } from 'firebase/storage';
import { firebaseStorage } from '../firebaseConfig';
import type { FileAttachment, FileCategory } from '../../../types/file';
import type { ThesisStageName } from '../../../types/thesis';
import { getError } from '../../../../utils/errorUtils';
import { getFileCategory, getFileExtension, validateFile } from '../../fileUtils';
import { getFilesForChapter, getLatestChapterFile, type FileQueryContext } from '../firestore/file';

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
    chapterStage?: ThesisStageName;
    commentId?: string;
    category?: 'submission' | 'attachment' | 'revision';
    metadata?: Record<string, string>;
    terminalStage?: ThesisStageName;
    terminalRequirementId?: string;
    /** Academic year for hierarchical storage path */
    year?: string;
    /** Department for hierarchical storage path */
    department?: string;
    /** Course for hierarchical storage path */
    course?: string;
}

interface UploadThesisFileResult {
    url: string;
    fileAttachment: FileAttachment;
}

interface TerminalRequirementFileQuery {
    thesisId: string;
    groupId: string;
    stage: ThesisStageName;
    requirementId: string;
    year?: string;
    department?: string;
    course?: string;
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
    chapterStage?: ThesisStageName;
    commentId?: string;
    category: string;
    terminalStage?: ThesisStageName;
    /** Academic year for hierarchical storage path */
    year?: string;
    /** Department for hierarchical storage path */
    department?: string;
    /** Course for hierarchical storage path */
    course?: string;
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
 * Generates a unique file path for thesis uploads using hierarchical structure.
 * Path format: {year}/{department}/{course}/{group}/thesis/{thesis}/{stage}/{chapter}/submissions/{filename}
 * Or chat: {year}/{department}/{course}/{group}/thesis/{thesis}/{stage}/{chapter}/chats/{filename}
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
        year,
        department,
        course,
    } = params;

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Build hierarchical base path
    const yearSegment = sanitizePathSegment(year, 'current');
    const deptSegment = sanitizePathSegment(department, 'general');
    const courseSegment = sanitizePathSegment(course, 'common');
    const groupSegment = sanitizePathSegment(groupId, 'group');
    const thesisSegment = sanitizePathSegment(thesisId, 'thesis');

    // Base path: {year}/{department}/{course}/{group}/thesis/{thesis}
    const basePath = `${yearSegment}/${deptSegment}/${courseSegment}/${groupSegment}/thesis/${thesisSegment}`;

    if (terminalStage) {
        const stageSegment = sanitizePathSegment(terminalStage);
        // Terminal requirements path
        return `${basePath}/terminal/${stageSegment}/${userUid}_${timestamp}_${sanitizedFileName}`;
    }

    if (chapterId !== undefined) {
        if (!chapterStage) {
            throw new Error('chapterStage is required when uploading files for a chapter.');
        }
        const stageSegment = sanitizePathSegment(chapterStage);
        const chapterSegment = sanitizePathSegment(chapterId, 'chapter');

        if (commentId) {
            // Chat attachments path
            return `${basePath}/${stageSegment}/${chapterSegment}/chats/${userUid}_${timestamp}_${sanitizedFileName}`;
        }

        // Chapter submissions path
        return `${basePath}/${stageSegment}/${chapterSegment}/submissions/${userUid}_${timestamp}_${sanitizedFileName}`;
    }

    // General attachments path
    return `${basePath}/attachments/${category}/${userUid}_${timestamp}_${sanitizedFileName}`;
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
        year,
        department,
        course,
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
            year,
            department,
            course,
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

        // File metadata is stored in submission/chat documents, not in a separate files collection
        // The caller (e.g., handleUploadChapter) is responsible for creating the submission record

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
 * Deletes a thesis file from Storage
 * @param fileUrl - Download URL of the file to delete
 */
export async function deleteThesisFile(
    fileUrl: string,
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
    } catch (error) {
        const { message } = getError(error, 'Failed to delete thesis file');
        throw new Error(message);
    }
}

/**
 * Lists all files for a specific chapter
 * @param ctx - File query context with hierarchical path information
 * @returns Promise with array of file attachments
 */
export async function listChapterFiles(ctx: FileQueryContext): Promise<FileAttachment[]> {
    try {
        return await getFilesForChapter(ctx);
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
    chapterStage?: ThesisStageName,
): Promise<string[]> {
    try {
        const sanitizedGroup = sanitizePathSegment(groupId ?? thesisId, thesisId);
        const stageSegment = sanitizePathSegment(chapterStage ?? 'stage');
        const chapterSegment = sanitizePathSegment(chapterId, 'chapter');
        const basePath = chapterId !== undefined
            ? `theses/${sanitizedGroup}/chapters/${stageSegment}/${chapterSegment}`
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
 * @param ctx - File query context with hierarchical path information
 * @returns Promise with the latest file attachment or null
 */
export async function getLatestChapterSubmission(ctx: FileQueryContext): Promise<FileAttachment | null> {
    try {
        return await getLatestChapterFile(ctx);
    } catch (error) {
        console.error('Error getting latest chapter submission:', error);
        return null;
    }
}

function buildTerminalStagePath(
    thesisId: string,
    groupId: string,
    stage: ThesisStageName,
    year?: string,
    department?: string,
    course?: string,
): string {
    const yearSegment = sanitizePathSegment(year, 'current');
    const deptSegment = sanitizePathSegment(department, 'general');
    const courseSegment = sanitizePathSegment(course, 'common');
    const groupSegment = sanitizePathSegment(groupId, 'group');
    const thesisSegment = sanitizePathSegment(thesisId, 'thesis');
    const stageSegment = sanitizePathSegment(stage);
    return `${yearSegment}/${deptSegment}/${courseSegment}/${groupSegment}/thesis/${thesisSegment}/terminal/${stageSegment}`;
}

export async function listTerminalRequirementFiles(
    query: TerminalRequirementFileQuery,
): Promise<FileAttachment[]> {
    const {
        thesisId,
        groupId,
        stage,
        requirementId,
        year,
        department,
        course,
    } = query;

    if (!thesisId || !groupId) {
        return [];
    }

    try {
        const stagePath = buildTerminalStagePath(thesisId, groupId, stage, year, department, course);
        const stageRef = ref(firebaseStorage, stagePath);
        const listResult = await listAll(stageRef);

        const attachments = await Promise.all(listResult.items.map(async (itemRef) => {
            try {
                const metadata = await getMetadata(itemRef);
                const custom = metadata.customMetadata ?? {};
                if (custom.terminalRequirementId !== requirementId) {
                    return null;
                }

                const downloadUrl = await getDownloadURL(itemRef);
                const fileName = custom.originalName ?? metadata.name ?? itemRef.name;
                const extension = getFileExtension(fileName) ?? 'document';
                const uploadDate = metadata.timeCreated ?? new Date().toISOString();
                const attachment: FileAttachment = {
                    id: metadata.name ?? itemRef.name,
                    thesisId,
                    groupId,
                    name: fileName,
                    type: extension,
                    size: ((metadata.size ?? 0) as number).toString(),
                    url: downloadUrl,
                    mimeType: metadata.contentType ?? undefined,
                    author: custom.uploadedBy ?? '',
                    uploadDate,
                    category: (custom.category as FileAttachment['category']) ?? 'attachment',
                    terminalStage: (custom.terminalStage as ThesisStageName) ?? stage,
                    terminalRequirementId: custom.terminalRequirementId ?? requirementId,
                };
                return attachment;
            } catch (metadataError) {
                console.error('Failed to read terminal requirement file metadata:', metadataError);
                return null;
            }
        }));

        return attachments
            .filter((file): file is FileAttachment => Boolean(file))
            .sort((a, b) => {
                const aTime = new Date(a.uploadDate ?? '').getTime();
                const bTime = new Date(b.uploadDate ?? '').getTime();
                if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
                    return 0;
                }
                return bTime - aTime;
            });
    } catch (error) {
        if ((error as { code?: string }).code === 'storage/object-not-found') {
            return [];
        }
        console.error('Error listing terminal requirement files:', error);
        return [];
    }
}
