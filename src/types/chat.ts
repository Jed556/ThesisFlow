/**
 * Chat message and conversation types
 * Uses FileAttachment from file.ts for attachments
 */

import type { FileAttachment, FileCategory } from './file';
import type { SortOrder } from './sort';

/**
 * Chat participant role types
 */
export type ChatParticipantRole = 'student' | 'leader' | 'member' | 'adviser' | 'editor' | 'admin' | 'user' | 'unknown';

/**
 * Chat participant interface
 */
export interface ChatParticipant {
    /**
     * Unique identifier (usually email)
     */
    id: string;
    /**
     * Display name of the participant
     */
    displayName: string;
    /**
     * Role of the participant
     */
    role: ChatParticipantRole;
    /**
     * Avatar URL or identifier
     */
    avatarUrl?: string;
}

/**
 * Chat message status types
 */
export type ChatMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Chat message interface
 */
export interface ChatMessage {
    /**
     * Unique identifier for the message
     */
    id: string;
    /**
     * Sender's identifier (usually email)
     */
    senderId: string;
    /**
     * Sender's display name (optional, for quick rendering)
     */
    senderName?: string;
    /**
     * Sender's role (optional, for quick rendering)
     */
    senderRole?: ChatParticipantRole;
    /**
     * Message content/text
     */
    content: string;
    /**
     * Timestamp of when the message was sent
     */
    timestamp: string | Date;
    /**
     * Array of file attachments
     */
    attachments?: FileAttachment[];
    /**
     * Message status
     */
    status?: ChatMessageStatus;
    /**
     * Optional metadata for context-specific data
     */
    metadata?: Record<string, any>;
    /**
     * Whether the message has been edited
     */
    isEdited?: boolean;
    /**
     * Reply to another message (message ID)
     */
    replyTo?: string;
}

/**
 * Chat conversation interface
 */
export interface ChatConversation {
    /**
     * Unique identifier for the conversation
     */
    id: string;
    /**
     * Title or name of the conversation
     */
    title?: string;
    /**
     * Array of participant IDs
     */
    participants: string[];
    /**
     * Array of messages in the conversation
     */
    messages: ChatMessage[];
    /**
     * Type of conversation
     */
    type?: 'direct' | 'group' | 'channel' | 'support';
    /**
     * Timestamp of when the conversation was created
     */
    createdAt: string | Date;
    /**
     * Timestamp of the last message
     */
    lastMessageAt?: string | Date;
    /**
     * Optional metadata for context-specific data
     */
    metadata?: Record<string, any>;
}

/**
 * Chat input state interface
 */
export interface ChatInputState {
    /**
     * Current message text
     */
    message: string;
    /**
     * Attachments being uploaded/attached
     */
    attachments: FileAttachment[];
    /**
     * Whether the message is being sent
     */
    isSending: boolean;
    /**
     * Reply to message (if any)
     */
    replyTo?: ChatMessage;
}

/**
 * Chat box configuration interface
 */
export interface ChatBoxConfig {
    /**
     * Whether to show timestamps
     */
    showTimestamps?: boolean;
    /**
     * Whether to show avatars
     */
    showAvatars?: boolean;
    /**
     * Whether to show sender names
     */
    showSenderNames?: boolean;
    /**
     * Whether to show sender roles
     */
    showSenderRoles?: boolean;
    /**
     * Whether to group messages by date
     */
    groupByDate?: boolean;
    /**
     * Whether to group messages by sender
     */
    groupBySender?: boolean;
    /**
     * Sort order for messages
     */
    sortOrder?: SortOrder;
    /**
     * Whether to enable message editing
     */
    allowEditing?: boolean;
    /**
     * Whether to enable message deletion
     */
    allowDeletion?: boolean;
    /**
     * Whether to enable message replies
     */
    allowReplies?: boolean;
    /**
     * Whether to enable file attachments
     */
    allowAttachments?: boolean;
    /**
     * Allowed attachment types (file categories)
     */
    allowedAttachmentTypes?: FileCategory[];
    /**
     * Maximum attachment size in bytes
     */
    maxAttachmentSize?: number;
    /**
     * Maximum number of attachments per message
     */
    maxAttachments?: number;
}
