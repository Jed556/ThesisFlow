import type { ChatMessage } from '../../types/chat';
import type { FileAttachment } from '../../types/file';

/**
 * Participant metadata used for rendering chat bubbles.
 */
export interface ConversationParticipant {
    uid: string;
    displayName: string;
    roleLabel?: string;
    avatarUrl?: string;
}

/**
 * Payload emitted when the composer submits a new message.
 */
export interface ConversationComposerPayload {
    content: string;
    files: File[];
    replyToId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Payload emitted when an existing message is edited.
 */
export interface ConversationEditPayload extends ConversationComposerPayload {
    messageId: string;
}

/**
 * Externalized props for the shared conversation panel.
 */
export interface ConversationPanelProps {
    messages: ChatMessage[];
    currentUserId?: string;
    participants?: Record<string, ConversationParticipant>;
    isLoading?: boolean;
    emptyStateMessage?: string;
    composerPlaceholder?: string;
    disableComposer?: boolean;
    allowAttachments?: boolean;
    height?: number | string;
    composerMetadata?: Record<string, unknown>;
    onSendMessage?: (payload: ConversationComposerPayload) => Promise<void> | void;
    onEditMessage?: (payload: ConversationEditPayload) => Promise<void> | void;
    onReplyRequest?: (message: ChatMessage) => void;
}

export interface MessageBubbleProps {
    message: ChatMessage;
    isOwnMessage: boolean;
    participant?: ConversationParticipant;
    showReplyPreview?: boolean;
    repliedMessage?: ChatMessage;
    onReply?: (message: ChatMessage) => void;
    onEdit?: (message: ChatMessage) => void;
}

export interface MessageComposerProps {
    placeholder?: string;
    allowAttachments?: boolean;
    disabled?: boolean;
    replyTo?: ChatMessage | null;
    editingMessage?: ChatMessage | null;
    onSend: (payload: ConversationComposerPayload) => Promise<void> | void;
    onCancelReply?: () => void;
    onCancelEdit?: () => void;
}

export interface AttachmentPreview {
    id: string;
    file: File;
    url: string;
}
