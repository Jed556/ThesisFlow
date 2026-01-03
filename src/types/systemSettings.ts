/**
 * System settings type definitions for ThesisFlow
 * Controls global application behavior for submissions, chat, and other features
 */

/**
 * Submission mode for chapters and terminal requirements
 * - 'file': Uses Firebase Storage for file uploads (traditional)
 * - 'link': Uses URL/link submission (Google Docs, Drive, etc.)
 */
export type SubmissionMode = 'file' | 'link';

/**
 * Chapter submission settings
 */
export interface ChapterSubmissionSettings {
    /**
     * Submission mode for chapter documents
     * - 'link': Students provide Google Docs/Drive URLs (default, no storage costs)
     * - 'file': Students upload files to Firebase Storage
     */
    mode: SubmissionMode;
    /** Optional placeholder text for URL input when mode is 'link' */
    linkPlaceholder?: string;
    /** Allowed URL patterns (regex strings) when mode is 'link' */
    allowedLinkPatterns?: string[];
}

/**
 * Terminal requirement settings
 * When mode is 'link', terminal requirements use a checklist-style workflow
 */
export interface TerminalRequirementSettings {
    /**
     * Submission mode for terminal requirement documents
     * - 'link': Uses a shared GDrive folder link per group with checklist workflow
     * - 'file': Students upload individual files to Firebase Storage
     */
    mode: SubmissionMode;
    /**
     * When mode is 'link', this is the Google Drive folder URL template
     * Groups can have their own folder set during setup
     */
    defaultDriveFolderUrl?: string;
}

/**
 * Chat feature settings
 */
export interface ChatSettings {
    /** Whether file attachments are enabled in chat */
    attachmentsEnabled: boolean;
    /** Maximum file size in MB for chat attachments (when enabled) */
    maxAttachmentSizeMb?: number;
    /** Allowed file types for chat attachments */
    allowedAttachmentTypes?: string[];
}

/**
 * Complete system settings document structure
 */
export interface SystemSettings {
    /** Settings ID (usually 'global' for singleton) */
    id: string;
    /** Chapter submission settings */
    chapterSubmissions: ChapterSubmissionSettings;
    /** Terminal requirement settings */
    terminalRequirements: TerminalRequirementSettings;
    /** Chat feature settings */
    chat: ChatSettings;
    /** Last update timestamp */
    updatedAt?: string;
    /** User who last updated settings */
    updatedBy?: string;
}

/**
 * Default system settings values
 */
export const DEFAULT_SYSTEM_SETTINGS: Omit<SystemSettings, 'id'> = {
    chapterSubmissions: {
        mode: 'link',
        linkPlaceholder: 'Enter Google Docs or Google Drive URL',
        allowedLinkPatterns: [
            'docs\\.google\\.com',
            'drive\\.google\\.com',
        ],
    },
    terminalRequirements: {
        mode: 'link',
    },
    chat: {
        attachmentsEnabled: false,
        maxAttachmentSizeMb: 10,
        allowedAttachmentTypes: ['image/*', 'application/pdf', 'application/msword'],
    },
};
