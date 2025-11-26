/**
 * Video file storage utilities
 * Handles video uploads with metadata extraction
 */

import type { FileAttachment } from '../../../types/file';
import { uploadFileToStorage, generateFilePath, generateUniqueFileId } from './common';
import { setFileMetadata } from '../firestore/file';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from '../../../config/files';
import { formatFileSize, getFileExtension } from '../../fileUtils';

/**
 * Allowed video MIME types
 */
export const ALLOWED_VIDEO_TYPES = ALLOWED_MIME_TYPES.video;

/**
 * Maximum video file size
 */
export const MAX_VIDEO_SIZE = FILE_SIZE_LIMITS.video;

/**
 * Validate video file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateVideo(file: File): { isValid: boolean; error?: string } {
    // Check MIME type
    const validType = ALLOWED_VIDEO_TYPES.some(type => type === file.type);
    if (!validType) {
        return {
            isValid: false,
            error: 'Invalid video type. Allowed: MP4, WebM, MOV'
        };
    }

    // Check file size
    if (file.size > MAX_VIDEO_SIZE) {
        return {
            isValid: false,
            error: `File size exceeds ${MAX_VIDEO_SIZE / (1024 * 1024)}MB limit`
        };
    }

    return { isValid: true };
}

/**
 * Extract video metadata
 * @param file - Video file
 * @returns Video metadata
 */
async function extractVideoMetadata(file: File): Promise<{
    width?: number;
    height?: number;
    duration?: number;
}> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: video.videoWidth || undefined,
                height: video.videoHeight || undefined,
                duration: video.duration
            });
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({});
        };

        video.src = url;
    });
}

/**
 * Upload a video file
 * @param file - Video file to upload
 * @param ownerUid - Owner's UID
 * @param context - Additional context
 * @returns Upload result with file metadata
 */
export async function uploadVideo(
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
    const validation = validateVideo(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    // Generate file ID and path
    const fileId = generateUniqueFileId(ownerUid, 'video');
    const storagePath = generateFilePath(ownerUid, fileId, file.name);

    // Extract video metadata
    const videoMetadata = await extractVideoMetadata(file);

    // Upload to Storage with metadata
    const uploadMetadata: Record<string, string> = {
        uploadedBy: ownerUid,
        originalName: file.name,
        fileType: 'video'
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
        metadata: videoMetadata,
        ...(context?.thesisId && { thesisId: context.thesisId }),
        ...(context?.chapterId !== undefined && { chapterId: context.chapterId }),
        ...(context?.commentId && { commentId: context.commentId })
    };

    // Save to Firestore
    await setFileMetadata(fileId, metadata, ownerUid);

    return { fileId, url: downloadURL, metadata };
}
