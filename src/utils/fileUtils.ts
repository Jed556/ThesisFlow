import type { FileType, FileCategory, FileTypeInfo, FileUploadProgress, MediaMetadata, FileAttachment } from '../types/file';

/**
 * File utilities for handling file encoding, processing, and database upload preparation
 */

// Maximum file size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    document: 50 * 1024 * 1024, // 50MB
    image: 10 * 1024 * 1024,    // 10MB
    video: 500 * 1024 * 1024,   // 500MB
    audio: 100 * 1024 * 1024,   // 100MB
    archive: 100 * 1024 * 1024, // 100MB
    other: 25 * 1024 * 1024     // 25MB
} as const;

// Supported file types by category
export const SUPPORTED_FILE_TYPES: Record<FileCategory, readonly FileType[]> = {
    document: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'rtf', 'csv', 'json', 'xml', 'md'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    other: []
} as const;

/**
 * Get file extension from filename
 * @param filename - The name of the file
 * @returns The file extension
 */
export function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Get file category based on extension
 * @param extension - The file extension to categorize
 * @returns The file category
 */
export function getFileCategory(extension: string): FileCategory {
    const ext = extension.toLowerCase() as FileType;

    if ((SUPPORTED_FILE_TYPES.document as readonly string[]).includes(ext)) return 'document';
    if ((SUPPORTED_FILE_TYPES.image as readonly string[]).includes(ext)) return 'image';
    if ((SUPPORTED_FILE_TYPES.video as readonly string[]).includes(ext)) return 'video';
    if ((SUPPORTED_FILE_TYPES.audio as readonly string[]).includes(ext)) return 'audio';
    if ((SUPPORTED_FILE_TYPES.archive as readonly string[]).includes(ext)) return 'archive';

    return 'other';
}

/**
 * Get file type information for UI display
 * @param extension - The file extension to get info for
 * @returns The file type information
 */
export function getFileTypeInfo(extension: string): FileTypeInfo {
    const category = getFileCategory(extension);

    const typeInfoMap: Record<FileCategory, FileTypeInfo> = {
        document: { category: 'document', icon: 'description', color: '#1976d2', canPreview: extension === 'pdf' },
        image: { category: 'image', icon: 'image', color: '#388e3c', canPreview: true },
        video: { category: 'video', icon: 'movie', color: '#f57c00', canPreview: true },
        audio: { category: 'audio', icon: 'audiotrack', color: '#7b1fa2', canPreview: true },
        archive: { category: 'archive', icon: 'archive', color: '#5d4037', canPreview: false },
        other: { category: 'other', icon: 'insert_drive_file', color: '#616161', canPreview: false }
    };

    return typeInfoMap[category];
}

/**
 * Validate file before upload
 * @param file - The file to validate
 * @returns An object containing the validation result and error message (if any)
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
    const extension = getFileExtension(file.name);
    const category = getFileCategory(extension);
    const maxSize = FILE_SIZE_LIMITS[category];

    // Check file size
    if (file.size > maxSize) {
        return {
            isValid: false,
            error: `File size exceeds the limit of ${formatFileSize(maxSize)} for ${category} files`
        };
    }

    // Check if file type is supported
    if (category === 'other' && !isSafeFileType(extension)) {
        return {
            isValid: false,
            error: `File type .${extension} is not supported`
        };
    }

    return { isValid: true };
}

/**
 * Check if file type is considered safe for upload
 * @param extension - The file extension to check
 * @returns True if the file type is safe, false otherwise
 */
function isSafeFileType(extension: string): boolean {
    const safeExtensions: readonly FileType[] = ['txt', 'csv', 'json', 'xml', 'md'];
    return (safeExtensions as readonly string[]).includes(extension.toLowerCase());
}

/**
 * Format file size for display
 * @param bytes - The file size in bytes
 * @returns The formatted file size string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Convert file to base64 for database storage
 * @param file - The file to convert
 * @returns A promise that resolves with the base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // Remove data URL prefix to get pure base64
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            } else {
                reject(new Error('Failed to read file as base64'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Convert file to ArrayBuffer for processing
 * @param file - The file to convert
 * @returns A promise that resolves with the ArrayBuffer
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Generate a unique hash for file identification
 * @param file - The file to generate a hash for
 * @returns A promise that resolves with the generated hash
 */
export async function generateFileHash(file: File): Promise<string> {
    const arrayBuffer = await fileToArrayBuffer(file);
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

/**
 * Extract metadata from media files
 * @param file - The file to extract metadata from
 * @returns A promise that resolves with the extracted metadata
 */
export async function extractMediaMetadata(file: File): Promise<MediaMetadata | null> {
    const category = getFileCategory(getFileExtension(file.name));

    if (category === 'image') {
        return extractImageMetadata(file);
    } else if (category === 'video' || category === 'audio') {
        return extractVideoAudioMetadata(file);
    }

    return null;
}

/**
 * Extract metadata from image files
 * @param file - The image file to extract metadata from
 * @returns A promise that resolves with the extracted metadata
 */
async function extractImageMetadata(file: File): Promise<MediaMetadata> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({});
        };

        img.src = url;
    });
}

/**
 * Extract metadata from video/audio files
 * @param file - The video/audio file to extract metadata from
 * @returns A promise that resolves with the extracted metadata
 */
async function extractVideoAudioMetadata(file: File): Promise<MediaMetadata> {
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
 * Create a thumbnail for image/video files
 * @param file - The file to create a thumbnail for
 * @param maxSize - The maximum size for the thumbnail
 * @returns A promise that resolves with the thumbnail data URL
 */
export async function createThumbnail(file: File, maxSize: number = 200): Promise<string | null> {
    const category = getFileCategory(getFileExtension(file.name));

    if (category === 'image') {
        return createImageThumbnail(file, maxSize);
    } else if (category === 'video') {
        return createVideoThumbnail(file, maxSize);
    }

    return null;
}

/**
 * Create a thumbnail for image files
 * @param file - The image file to create a thumbnail for
 * @param maxSize - The maximum size for the thumbnail
 * @returns A promise that resolves with the thumbnail data URL
 */
async function createImageThumbnail(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate thumbnail dimensions
            const { width, height } = calculateThumbnailSize(img.naturalWidth, img.naturalHeight, maxSize);

            canvas.width = width;
            canvas.height = height;

            // Draw and compress image
            ctx?.drawImage(img, 0, 0, width, height);
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnailDataUrl);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to create image thumbnail'));
        };

        img.src = url;
    });
}

/**
 * Create thumbnail for video files
 * @param file - The video file to create a thumbnail for
 * @param maxSize - The maximum size for the thumbnail
 * @returns A promise that resolves with the thumbnail data URL
 */
async function createVideoThumbnail(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const url = URL.createObjectURL(file);

        video.onloadeddata = () => {
            video.currentTime = 1; // Seek to 1 second
        };

        video.onseeked = () => {
            URL.revokeObjectURL(url);

            // Calculate thumbnail dimensions
            const { width, height } = calculateThumbnailSize(video.videoWidth, video.videoHeight, maxSize);

            canvas.width = width;
            canvas.height = height;

            // Draw video frame
            ctx?.drawImage(video, 0, 0, width, height);
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnailDataUrl);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to create video thumbnail'));
        };

        video.src = url;
    });
}

/**
 * Calculate thumbnail dimensions maintaining aspect ratio
 */
function calculateThumbnailSize(originalWidth: number, originalHeight: number, maxSize: number): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
        return {
            width: Math.min(maxSize, originalWidth),
            height: Math.min(maxSize, originalWidth) / aspectRatio
        };
    } else {
        return {
            width: Math.min(maxSize, originalHeight) * aspectRatio,
            height: Math.min(maxSize, originalHeight)
        };
    }
}

/**
 * Prepare file for upload with all necessary metadata
 * @param file - The file to prepare
 * @param author - The author of the file
 * @returns A promise that resolves with the prepared file data
 */
export async function prepareFileForUpload(file: File, author: string): Promise<{
    hash: string;
    base64Data: string;
    fileInfo: FileAttachment;
}> {
    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    // Generate file hash and encode to base64
    const [hash, base64Data] = await Promise.all([
        generateFileHash(file),
        fileToBase64(file)
    ]);

    // Extract metadata and create thumbnail if applicable
    const [metadata, thumbnail] = await Promise.all([
        extractMediaMetadata(file),
        createThumbnail(file)
    ]);

    // Prepare file info
    const fileInfo: FileAttachment = {
        name: file.name,
        type: getFileExtension(file.name),
        size: formatFileSize(file.size),
        url: `/uploads/${hash}_${file.name}`, // Placeholder URL structure
        mimeType: file.type,
        thumbnail: thumbnail || undefined,
        uploadDate: new Date().toISOString(),
        metadata: metadata || undefined,
        author // email
    };

    return {
        hash,
        base64Data,
        fileInfo
    };
}

/**
 * Create file upload progress tracker
 * @returns 
 */
export function createUploadProgressTracker(): {
    updateProgress: (fileName: string, progress: number) => void;
    setError: (fileName: string, error: string) => void;
    setCompleted: (fileName: string) => void;
    getProgress: () => FileUploadProgress[];
} {
    const progressMap = new Map<string, FileUploadProgress>();

    return {
        updateProgress: (fileName: string, progress: number) => {
            progressMap.set(fileName, {
                fileName,
                progress: Math.min(100, Math.max(0, progress)),
                status: progress >= 100 ? 'completed' : 'uploading'
            });
        },

        setError: (fileName: string, error: string) => {
            progressMap.set(fileName, {
                fileName,
                progress: 0,
                status: 'error',
                error
            });
        },

        setCompleted: (fileName: string) => {
            const current = progressMap.get(fileName);
            if (current) {
                progressMap.set(fileName, {
                    ...current,
                    progress: 100,
                    status: 'completed'
                });
            }
        },

        getProgress: () => Array.from(progressMap.values())
    };
}

/**
 * Batch upload multiple files with progress tracking
 */
export async function batchUploadFiles(
    files: File[],
    author: string,
    onProgress?: (progress: FileUploadProgress[]) => void
): Promise<{ hash: string; base64Data: string; fileInfo: FileAttachment }[]> {
    const tracker = createUploadProgressTracker();
    const results: { hash: string; base64Data: string; fileInfo: FileAttachment }[] = [];

    // Initialize progress for all files
    files.forEach(file => {
        tracker.updateProgress(file.name, 0);
    });

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            tracker.updateProgress(file.name, 25);
            onProgress?.(tracker.getProgress());

            const result = await prepareFileForUpload(file, author);

            tracker.updateProgress(file.name, 75);
            onProgress?.(tracker.getProgress());

            results.push(result);

            tracker.setCompleted(file.name);
            onProgress?.(tracker.getProgress());

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            tracker.setError(file.name, errorMessage);
            onProgress?.(tracker.getProgress());
        }
    }

    return results;
}
