/**
 * Conversation-centric types and helpers shared by chat UI components.
 */
import type { FileAttachment, FileCategory } from './file';
import type { SortOrder } from './sort';

export type ChatParticipantRole = 'student' | 'leader' | 'member' | 'adviser' | 'editor' | 'admin' | 'user' | 'unknown';

export interface ChatParticipant {
    id: string;
    displayName: string;
    role: ChatParticipantRole;
    avatarUrl?: string;
}

export type ChatMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName?: string;
    senderRole?: ChatParticipantRole;
    content: string;
    timestamp: string | Date;
    attachments?: FileAttachment[];
    status?: ChatMessageStatus;
    metadata?: Record<string, any>;
    isEdited?: boolean;
    replyTo?: string;
}

export interface ChatConversation {
    id: string;
    title?: string;
    participants: string[];
    messages: ChatMessage[];
    type?: 'direct' | 'group' | 'channel' | 'support';
    createdAt: string | Date;
    lastMessageAt?: string | Date;
    metadata?: Record<string, any>;
}

export interface ChatInputState {
    message: string;
    attachments: FileAttachment[];
    isSending: boolean;
    replyTo?: ChatMessage;
}

export type { FileAttachment as ChatAttachment };
export type { FileCategory as ChatAttachmentType };
export type { SortOrder as ChatSortOrder };

export interface ChatBoxConfig {
    showTimestamps?: boolean;
    showAvatars?: boolean;
    showSenderNames?: boolean;
    showSenderRoles?: boolean;
    groupByDate?: boolean;
    groupBySender?: boolean;
    sortOrder?: SortOrder;
    allowEditing?: boolean;
    allowDeletion?: boolean;
    allowReplies?: boolean;
    allowAttachments?: boolean;
    allowedAttachmentTypes?: FileCategory[];
    maxAttachmentSize?: number;
    maxAttachments?: number;
}
