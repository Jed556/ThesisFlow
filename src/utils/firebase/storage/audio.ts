/**
 * Audio file storage utilities
 * Handles audio uploads with metadata extraction
 */

import type { FileAttachment } from '../../../types/file';
import { uploadFileToStorage, generateFilePath, generateUniqueFileId } from './common';
import { setFileMetadata } from '../firestore/file';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from '../../../config/files';
import { formatFileSize, getFileExtension } from '../../fileUtils';

/**
 * Allowed audio MIME types
 */
export const ALLOWED_AUDIO_TYPES = ALLOWED_MIME_TYPES.audio;

/**
 * Maximum audio file size
 */
export const MAX_AUDIO_SIZE = FILE_SIZE_LIMITS.audio;

/**
 * Validate audio file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateAudio(file: File): { isValid: boolean; error?: string } {
    // Check MIME type
    const validType = ALLOWED_AUDIO_TYPES.some(type => type === file.type);
    if (!validType) {
        return {
            isValid: false,
            error: 'Invalid audio type. Allowed: MP3, WAV, M4A, OGG'
        };
    }

    // Check file size
    if (file.size > MAX_AUDIO_SIZE) {
        return {
            isValid: false,
            error: `File size exceeds ${MAX_AUDIO_SIZE / (1024 * 1024)}MB limit`
        };
    }

    return { isValid: true };
}

/**
 * Extract audio metadata
 * @param file - Audio file
 * @returns Audio metadata
 */
async function extractAudioMetadata(file: File): Promise<{
    duration?: number;
}> {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        const url = URL.createObjectURL(file);

        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve({
                duration: audio.duration
            });
        };

        audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({});
        };

        audio.src = url;
    });
}

/**
 * Upload an audio file
 * @param file - Audio file to upload
 * @param ownerUid - Owner's UID
 * @param context - Additional context
 * @returns Upload result with file metadata
 */
export async function uploadAudio(
    file: File,
    ownerUid: string,
    context?: {
        groupId: string;
        thesisId?: string;
        chapterId?: number;
        commentId?: string;
        category?: 'submission' | 'attachment';
    }
): Promise<{ fileId: string; url: string; metadata: FileAttachment }> {
    // Validate
    const validation = validateAudio(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    if (!context?.groupId) {
        throw new Error('groupId is required to upload audio files');
    }

    // Generate file ID and path
    const fileId = generateUniqueFileId(ownerUid, 'audio');
    const storagePath = generateFilePath(ownerUid, fileId, file.name);

    // Extract audio metadata
    const audioMetadata = await extractAudioMetadata(file);

    // Upload to Storage with metadata
    const uploadMetadata: Record<string, string> = {
        uploadedBy: ownerUid,
        originalName: file.name,
        fileType: 'audio'
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
        metadata: audioMetadata,
        groupId: context.groupId,
        ...(context?.thesisId && { thesisId: context.thesisId }),
        ...(context?.chapterId !== undefined && { chapterId: context.chapterId }),
        ...(context?.commentId && { commentId: context.commentId })
    };

    // Save to Firestore
    await setFileMetadata(fileId, metadata, ownerUid, { groupId: context.groupId });

    return { fileId, url: downloadURL, metadata };
}
