/**
 * Conversation-centric types and helpers shared by chat UI components.
 */
import type { FileAttachment } from './file';

export type ChatMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Role of a participant in a conversation.
 * Includes both user roles and thesis-specific roles (leader/member).
 */
export type ChatParticipantRole =
    | 'student'
    | 'adviser'
    | 'editor'
    | 'statistician'
    | 'panel'
    | 'admin'
    | 'leader'
    | 'member'
    | 'unknown';

/**
 * Metadata associated with a chat message
 */
export interface ChatMessageMetadata {
    /** Whether the message is from the current user */
    isFromMe?: boolean;
    /** Additional context about the message */
    context?: string;
    /** Reference to related entity (e.g., thesis chapter) */
    reference?: string;
    /** Version number for edited messages or file versions */
    version?: number;
    /** Custom data attached to the message */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custom?: Record<string, any>;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    /** Display name of the sender */
    senderName?: string;
    content: string;
    timestamp: Date;
    attachments?: FileAttachment[];
    status?: ChatMessageStatus;
    isEdited?: boolean;
    replyTo?: string;
    /** Additional message metadata */
    metadata?: ChatMessageMetadata;
}

export interface ChatConversation {
    id: string;
    title?: string;
    messages: ChatMessage[];
    type?: 'direct' | 'group' | 'channel' | 'support';
    createdAt: Date;
    lastMessageAt?: Date;
}

export interface ChatInputState {
    message: string;
    attachments: FileAttachment[];
    isSending: boolean;
    replyTo?: ChatMessage;
}
