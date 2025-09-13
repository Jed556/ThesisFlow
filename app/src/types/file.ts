/**
 * File-related type definitions for the ThesisFlow application
 * Contains all file handling, upload, and metadata types
 */

// File type for icon mapping - expanded to include media files
export type FileType =
    // Documents
    | 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'pptx' | 'ppt' | 'txt' | 'rtf'
    // Images
    | 'jpg' | 'jpeg' | 'png' | 'gif' | 'bmp' | 'svg' | 'webp' | 'tiff'
    // Videos
    | 'mp4' | 'avi' | 'mov' | 'wmv' | 'flv' | 'webm' | 'mkv' | '3gp'
    // Audio
    | 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a' | 'wma'
    // Archives
    | 'zip' | 'rar' | '7z' | 'tar' | 'gz'
    // Other
    | string;

// File categories for better organization
export type FileCategory = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

// Helper interface for file type categorization
export interface FileTypeInfo {
    category: FileCategory;
    icon: string;
    color: string;
    canPreview: boolean;
}

// File upload progress interface
export interface FileUploadProgress {
    fileName: string;
    progress: number; // 0-100
    status: 'uploading' | 'completed' | 'error';
    error?: string;
}

// Media file metadata interface
export interface MediaMetadata {
    width?: number;
    height?: number;
    duration?: number; // in seconds
    bitrate?: string;
    codec?: string;
    frameRate?: number;
}

// File attachment interface
export interface FileAttachment {
    name: string;
    type: string;
    size: string;
    url: string;
    mimeType?: string; // e.g., 'image/jpeg', 'video/mp4', 'audio/wav'
    thumbnail?: string; // URL for thumbnail/preview (for images/videos)
    duration?: string; // For audio/video files (e.g., "3:45")
    uploadDate?: string;
    metadata?: MediaMetadata; // Additional metadata for media files
}

// Extended file attachment with submission metadata
export interface FileRegistryEntry extends FileAttachment {
    author: string; // email
    submissionDate: string;
    category: 'submission' | 'attachment';
}

// File validation result interface
export interface FileValidationResult {
    isValid: boolean;
    error?: string;
}

// File processing result interface
export interface FileProcessingResult {
    hash: string;
    base64Data: string;
    fileInfo: FileAttachment;
}

// Batch upload configuration interface
export interface BatchUploadConfig {
    maxConcurrentUploads?: number;
    retryAttempts?: number;
    onProgress?: (progress: FileUploadProgress[]) => void;
    onFileComplete?: (result: FileProcessingResult) => void;
    onFileError?: (fileName: string, error: string) => void;
}

// File upload context interface
export interface FileUploadContext {
    author: string; // email
    category: 'submission' | 'attachment';
    chapterId?: number;
    commentId?: string;
}

// File operation status
export type FileOperationStatus = 'pending' | 'processing' | 'completed' | 'error';

// File operation result
export interface FileOperationResult {
    success: boolean;
    fileName: string;
    hash?: string;
    error?: string;
    metadata?: MediaMetadata;
}