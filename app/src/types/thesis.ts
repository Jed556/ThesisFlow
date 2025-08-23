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

// Comment/feedback interface
export interface ThesisComment {
    author: string;
    role: 'adviser' | 'editor' | 'student';
    date: string;
    comment: string;
    attachments: FileAttachment[];
    documentVersion?: number; // Version of the document this comment refers to
    documentName?: string; // Name of the document this comment refers to
}

// Chapter interface
export interface ThesisChapter {
    id: number;
    title: string;
    status: 'approved' | 'under_review' | 'revision_required' | 'not_submitted';
    submissionDate: string | null;
    lastModified: string | null;
    comments: ThesisComment[];
}

// Main thesis data interface
export interface ThesisData {
    title: string;
    student: string;
    adviser: string;
    editor: string;
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

// Status color mapping type
export type StatusColor = 'success' | 'warning' | 'error' | 'default';

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
