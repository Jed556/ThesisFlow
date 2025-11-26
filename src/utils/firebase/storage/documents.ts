/**
 * Document file storage utilities
 * Handles PDF, DOCX, and other document uploads
 */

import type { FileAttachment } from '../../../types/file';
import { uploadFileToStorage, generateFilePath, generateUniqueFileId } from './common';
import { setFileMetadata } from '../firestore/file';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from '../../../config/files';
import { formatFileSize } from '../../fileUtils';
import { getFileExtension } from '../../fileUtils';

/**
 * Allowed document MIME types
 */
export const ALLOWED_DOCUMENT_TYPES = ALLOWED_MIME_TYPES.document;

/**
 * Maximum document file size
 */
export const MAX_DOCUMENT_SIZE = FILE_SIZE_LIMITS.document;

/**
 * Validate document file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateDocument(file: File): { isValid: boolean; error?: string } {
    // Check MIME type
    const validType = ALLOWED_DOCUMENT_TYPES.some(type => type === file.type);
    if (!validType) {
        return {
            isValid: false,
            error: 'Invalid document type. Allowed: PDF, DOCX, XLSX, PPTX, TXT'
        };
    }

    // Check file size
    if (file.size > MAX_DOCUMENT_SIZE) {
        return {
            isValid: false,
            error: `File size exceeds ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB limit`
        };
    }

    return { isValid: true };
}

/**
 * Upload a document file
 * @param file - Document file to upload
 * @param ownerUid - Owner's UID
 * @param context - Additional context (thesis, chapter, etc.)
 * @returns Upload result with file metadata
 */
export async function uploadDocument(
    file: File,
    ownerUid: string,
    context?: {
        thesisId?: string;
        chapterId?: number;
        commentId?: string;
        category?: 'submission' | 'attachment';
    }
): Promise<{ fileId: string; url: string; metadata: FileAttachment }> {
    // Validate
    const validation = validateDocument(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    // Generate file ID and path
    const fileId = generateUniqueFileId(ownerUid, 'doc');
    const storagePath = generateFilePath(ownerUid, fileId, file.name);

    // Upload to Storage with metadata
    const uploadMetadata: Record<string, string> = {
        uploadedBy: ownerUid,
        originalName: file.name,
        fileType: 'document'
    };

    if (context?.thesisId) uploadMetadata.thesisId = context.thesisId;
    if (context?.chapterId !== undefined) uploadMetadata.chapterId = context.chapterId.toString();
    if (context?.commentId) uploadMetadata.commentId = context.commentId;
    if (context?.category) uploadMetadata.category = context.category;

    const downloadURL = await uploadFileToStorage(file, storagePath, uploadMetadata);

    // Create metadata
    const metadata: FileAttachment = {
        id: fileId,
        name: file.name,
        type: getFileExtension(file.name),
        size: formatFileSize(file.size),
        url: downloadURL,
        mimeType: file.type,
        uploadDate: new Date().toISOString(),
        author: ownerUid,
        category: context?.category || 'attachment',
        ...(context?.thesisId && { thesisId: context.thesisId }),
        ...(context?.chapterId !== undefined && { chapterId: context.chapterId }),
        ...(context?.commentId && { commentId: context.commentId })
    };

    // Save to Firestore
    await setFileMetadata(fileId, metadata, ownerUid);

    return { fileId, url: downloadURL, metadata };
}
