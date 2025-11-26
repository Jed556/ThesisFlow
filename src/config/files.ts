/**
 * File configuration and constants for ThesisFlow
 * Centralized configuration for file uploads, limits, and validation
 */

import type { FileType, FileCategory } from '../types/file';

/**
 * Maximum file size limits by category (in bytes)
 */
export const FILE_SIZE_LIMITS = {
    document: 50 * 1024 * 1024,  // 50MB
    image: 10 * 1024 * 1024,     // 10MB
    video: 500 * 1024 * 1024,    // 500MB
    audio: 100 * 1024 * 1024,    // 100MB
    archive: 100 * 1024 * 1024,  // 100MB
    other: 25 * 1024 * 1024      // 25MB
} as const;

/**
 * Supported file types by category
 */
export const SUPPORTED_FILE_TYPES: Record<FileCategory, readonly FileType[]> = {
    document: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'rtf', 'csv', 'json', 'xml', 'md'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    other: []
} as const;

/**
 * Allowed MIME types for each category
 */
export const ALLOWED_MIME_TYPES = {
    document: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint', // .ppt
        'text/plain',
        'text/rtf',
        'text/csv',
        'application/json',
        'application/xml',
        'text/markdown'
    ],
    image: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'image/webp',
        'image/tiff'
    ],
    video: [
        'video/mp4',
        'video/x-msvideo', // .avi
        'video/quicktime', // .mov
        'video/x-ms-wmv',
        'video/x-flv',
        'video/webm',
        'video/x-matroska', // .mkv
        'video/3gpp'
    ],
    audio: [
        'audio/mpeg', // .mp3
        'audio/wav',
        'audio/ogg',
        'audio/flac',
        'audio/aac',
        'audio/mp4', // .m4a
        'audio/x-ms-wma'
    ],
    archive: [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip'
    ],
    other: []
} as const;

/**
 * Image compression settings
 */
export const IMAGE_COMPRESSION = {
    avatar: {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85
    },
    banner: {
        maxWidth: 1500,
        maxHeight: 500,
        quality: 0.85
    },
    thumbnail: {
        maxSize: 200,
        quality: 0.8
    },
    preview: {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.85
    }
} as const;

/**
 * File storage paths
 */
export const STORAGE_PATHS = {
    userFiles: (uid: string) => `users/${uid}/files`,
    avatars: (uid: string) => `users/${uid}/avatar`,
    banners: (uid: string) => `users/${uid}/banner`,
    temp: (uid: string) => `users/${uid}/temp`
} as const;

/**
 * Firestore collections
 */
export const FIRESTORE_COLLECTIONS = {
    files: 'files',
    userFiles: (uid: string) => `users/${uid}/files`
} as const;

/**
 * File upload limits
 */
export const UPLOAD_LIMITS = {
    maxConcurrentUploads: 5,
    maxBatchSize: 10,
    retryAttempts: 3,
    chunkSize: 1024 * 1024 // 1MB chunks for large files
} as const;

/**
 * Safe file extensions (for 'other' category)
 */
export const SAFE_FILE_EXTENSIONS: readonly FileType[] = ['txt', 'csv', 'json', 'xml', 'md'];

/**
 * File validation rules
 */
export const VALIDATION_RULES = {
    minFileSize: 1, // 1 byte
    maxFileNameLength: 255,
    allowedFileNamePattern: /^[a-zA-Z0-9._\-\s()[\]]+$/,
    prohibitedExtensions: ['exe', 'bat', 'cmd', 'sh', 'dll', 'scr', 'vbs', 'js']
} as const;
