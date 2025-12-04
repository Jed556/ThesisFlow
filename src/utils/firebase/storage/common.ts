/**
 * Common storage utilities shared across all file types
 * Provides base functionality for file uploads, deletion, and path generation
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { firebaseStorage } from '../firebaseConfig';
import { getError } from '../../../../utils/errorUtils';
import { STORAGE_PATHS } from '../../../config/files';

/**
 * Cache for blob URLs to avoid refetching the same file
 */
const blobUrlCache = new Map<string, string>();

/**
 * Fetch a file as blob from Firebase Storage
 * Uses Firebase SDK which handles authentication and CORS properly
 * @param fileUrl - Download URL or storage path
 * @returns Blob of the file
 */
export async function getFileBlob(fileUrl: string): Promise<Blob> {
    try {
        const storagePath = extractStoragePath(fileUrl) ?? fileUrl;
        const storageRef = ref(firebaseStorage, storagePath);
        return await getBlob(storageRef);
    } catch (error) {
        const { message } = getError(error, 'Failed to fetch file');
        throw new Error(`Fetch failed: ${message}`);
    }
}

/**
 * Create a blob URL for a Firebase Storage file
 * Fetches the file via Firebase SDK (avoids CORS issues) and creates a local blob URL
 * @param fileUrl - Download URL or storage path
 * @param mimeType - Optional MIME type override for the blob
 * @returns Local blob URL that can be used in viewers
 */
export async function createFileBlobUrl(fileUrl: string, mimeType?: string): Promise<string> {
    // Check cache first
    const cacheKey = fileUrl + (mimeType ?? '');
    const cached = blobUrlCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const blob = await getFileBlob(fileUrl);

        // Create a new blob with the specified MIME type if provided
        const finalBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
        const blobUrl = URL.createObjectURL(finalBlob);

        // Cache the result
        blobUrlCache.set(cacheKey, blobUrl);

        return blobUrl;
    } catch (error) {
        const { message } = getError(error, 'Failed to create blob URL');
        throw new Error(`Blob URL creation failed: ${message}`);
    }
}

/**
 * Revoke a blob URL to free memory
 * Should be called when the blob URL is no longer needed
 * @param blobUrl - Blob URL to revoke
 */
export function revokeBlobUrl(blobUrl: string): void {
    if (blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
        // Remove from cache
        for (const [key, value] of blobUrlCache.entries()) {
            if (value === blobUrl) {
                blobUrlCache.delete(key);
                break;
            }
        }
    }
}

/**
 * Clear all cached blob URLs and revoke them
 * Should be called when navigating away or cleaning up
 */
export function clearBlobUrlCache(): void {
    for (const blobUrl of blobUrlCache.values()) {
        URL.revokeObjectURL(blobUrl);
    }
    blobUrlCache.clear();
}

/**
 * Generate a storage path for a user's file
 * @param uid - User UID
 * @param fileId - Unique file identifier
 * @param filename - Original filename
 * @returns Storage path
 */
export function generateFilePath(uid: string, fileId: string, filename: string): string {
    const sanitizedFilename = sanitizeFilename(filename);
    return `${STORAGE_PATHS.userFiles(uid)}/${fileId}_${sanitizedFilename}`;
}

/**
 * Sanitize filename to remove unsafe characters
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Upload a file to Firebase Storage
 * @param file - File to upload
 * @param storagePath - Storage path
 * @param metadata - Optional custom metadata
 * @returns Download URL
 */
export async function uploadFileToStorage(
    file: File | Blob,
    storagePath: string,
    metadata?: Record<string, string>
): Promise<string> {
    try {
        const storageRef = ref(firebaseStorage, storagePath);

        const uploadMetadata = {
            contentType: file instanceof File ? file.type : 'application/octet-stream',
            customMetadata: metadata
        };

        const snapshot = await uploadBytes(storageRef, file, uploadMetadata);
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error) {
        const { message } = getError(error, 'Failed to upload file');
        throw new Error(`Upload failed: ${message}`);
    }
}

/**
 * Delete a file from Firebase Storage
 * @param fileUrl - Download URL or storage path
 */
export async function deleteFileFromStorage(fileUrl: string): Promise<void> {
    try {
        let storagePath: string;

        // Check if it's a download URL or a path
        if (fileUrl.startsWith('http')) {
            // Extract storage path from URL
            const url = new URL(fileUrl);
            const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);

            if (!pathMatch) {
                throw new Error('Invalid storage URL');
            }

            storagePath = decodeURIComponent(pathMatch[1]);
        } else {
            storagePath = fileUrl;
        }

        const storageRef = ref(firebaseStorage, storagePath);
        await deleteObject(storageRef);
    } catch (error) {
        const { code, message } = getError(error, 'Failed to delete file');
        // Ignore not found errors (file already deleted)
        if (code !== 'storage/object-not-found') {
            throw new Error(`Delete failed: ${message}`);
        }
    }
}

/**
 * Get download URL for a storage path
 * @param storagePath - Storage path
 * @returns Download URL
 */
export async function getFileUrl(storagePath: string): Promise<string> {
    try {
        const storageRef = ref(firebaseStorage, storagePath);
        return await getDownloadURL(storageRef);
    } catch (error) {
        const { message } = getError(error, 'Failed to get file URL');
        throw new Error(`Get URL failed: ${message}`);
    }
}

/**
 * Extract storage path from download URL
 * @param downloadUrl - Firebase Storage download URL
 * @returns Storage path
 */
export function extractStoragePath(downloadUrl: string): string | null {
    try {
        const url = new URL(downloadUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
        return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
    } catch {
        return null;
    }
}

/**
 * Generate a unique file identifier
 * @param uid - User UID
 * @param prefix - Optional prefix
 * @returns Unique file ID
 */
export function generateUniqueFileId(uid: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return prefix ? `${prefix}_${uid}_${timestamp}_${random}` : `${uid}_${timestamp}_${random}`;
}
