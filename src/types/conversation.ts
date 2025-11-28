/**
 * Conversation-centric types and helpers shared by chat UI components.
 */
import type { FileAttachment } from './file';

export type ChatMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
    id: string;
    senderId: string;
    content: string;
    timestamp: Date;
    attachments?: FileAttachment[];
    status?: ChatMessageStatus;
    isEdited?: boolean;
    replyTo?: string;
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
