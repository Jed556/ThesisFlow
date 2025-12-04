import type { ThesisStageName, ChapterSubmissionStatus, ExpertApprovalState } from './thesis';

/**
 * File-related type definitions for the ThesisFlow application
 * Contains all file handling, upload, and metadata types
 */

/**
 * Supported file types/extensions
 */
export type FileType =
    // Documents
    | 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'pptx' | 'ppt' | 'txt' | 'rtf'
    | 'csv' | 'json' | 'xml' | 'md'
    // Images
    | 'jpg' | 'jpeg' | 'png' | 'gif' | 'bmp' | 'svg' | 'webp' | 'tiff'
    // Videos
    | 'mp4' | 'avi' | 'mov' | 'wmv' | 'flv' | 'webm' | 'mkv' | '3gp'
    // Audio
    | 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a' | 'wma'
    // Archives
    | 'zip' | 'rar' | '7z' | 'tar' | 'gz'
    // Other safe types
    | string;

/**
 * File categories for better organization
 */
export type FileCategory = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

/**
 * Helper interface for file type categorization
 */
export interface FileTypeInfo {
    category: FileCategory;
    icon: string;
    color: string;
    canPreview: boolean;
}

/**
 * File upload progress
 */
export interface FileUploadProgress {
    fileName: string;
    progress: number; // 0-100
    status: 'uploading' | 'completed' | 'error';
    error?: string;
}

/**
 * Media file metadata
 */
export interface MediaMetadata {
    width?: number;
    height?: number;
    duration?: number; // in seconds
    bitrate?: string;
    codec?: string;
    frameRate?: number;
}

/**
 * File attachment details
 */
export interface FileAttachment {
    id?: string; // Optional unique identifier for the attachment
    groupId?: string;
    thesisId?: string;
    chapterId?: number;
    commentId?: string;
    name: string;
    type: string;
    size: string;
    url: string;
    mimeType?: string; // e.g., 'image/jpeg', 'video/mp4', 'audio/wav'
    thumbnail?: string; // URL for thumbnail/preview (for images/videos)
    duration?: string; // For audio/video files (e.g., "3:45")
    uploadDate: string;
    metadata?: MediaMetadata; // Additional metadata for media files
    author: string; // Firebase UID of the uploader
    category?: 'submission' | 'attachment';
    chapterStage?: ThesisStageName;
    terminalStage?: ThesisStageName;
    terminalRequirementId?: string;
    /** Submission status for review workflow (per-file) */
    submissionStatus?: ChapterSubmissionStatus;
    /** Expert approval states for this specific submission (per-file) */
    expertApprovals?: ExpertApprovalState;
}

/**
 * File validation result
 */
export interface FileValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Processed file result
 */
export interface FileProcessingResult {
    hash: string;
    base64Data: string;
    fileInfo: FileAttachment;
}

/**
 * Batch upload configuration
 */
export interface BatchUploadConfig {
    maxConcurrentUploads?: number;
    retryAttempts?: number;
    onProgress?: (progress: FileUploadProgress[]) => void;
    onFileComplete?: (result: FileProcessingResult) => void;
    onFileError?: (fileName: string, error: string) => void;
}

/**
 * File upload type
 */
export interface FileUploadContext {
    author: string; // Firebase UID
    category: 'submission' | 'attachment';
    chapterId?: number;
    commentId?: string;
}

/**
 * Current status of a file operation
 */
export type FileOperationStatus = 'pending' | 'processing' | 'completed' | 'error';

/**
 * File operation result
 */
export interface FileOperationResult {
    success: boolean;
    fileName: string;
    hash?: string;
    error?: string;
    metadata?: MediaMetadata;
}
