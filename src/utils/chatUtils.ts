import type { ChatMessage, ChatParticipantRole } from '../types/chat';
import type { FileAttachment } from '../types/file';
import type { SortOrder } from '../types/sort';
import type { ThesisComment, ThesisRole } from '../types/thesis';
import { sortArray } from './sortUtils';
import { formatFileSize } from './fileUtils';
import { isSameDay, addDays, parseThesisDate } from './dateUtils';

/**
 * Convert thesis role to chat participant role
 * @param thesisRole - The thesis role to convert
 * @returns The corresponding chat participant role
 */
export const thesisRoleToChatRole = (thesisRole: ThesisRole): ChatParticipantRole => {
    switch (thesisRole) {
        case 'leader':
            return 'leader';
        case 'member':
            return 'member';
        case 'adviser':
            return 'adviser';
        case 'editor':
            return 'editor';
        case 'unknown':
        default:
            return 'unknown';
    }
};

/**
 * Convert thesis comment to chat message
 * @param comment - The thesis comment to convert
 * @param index - Optional index for unique ID generation
 * @returns The corresponding chat message
 */
export const thesisCommentToChatMessage = (comment: ThesisComment, index?: number): ChatMessage => {
    const id = `msg-${comment.author}-${comment.date}-${index || 0}`;
    const dateStr = typeof comment.date === 'string' ? comment.date : comment.date.toISOString();
    const dateObj = typeof comment.date === 'string' ? new Date(comment.date) : comment.date;

    const attachments: FileAttachment[] = (comment.attachments ?? []).map((attachment, attIndex) => {
        if (typeof attachment === 'string') {
            return {
                name: `Attachment ${attIndex + 1}`,
                type: 'file',
                size: '0',
                url: attachment,
                mimeType: 'application/octet-stream',
                uploadDate: dateStr,
                author: comment.author,
                category: 'attachment',
            } satisfies FileAttachment;
        }
        return attachment;
    });

    return {
        id,
        senderId: comment.author,
        content: comment.comment,
        timestamp: dateObj,
        attachments,
        metadata: {
            version: comment.version
        }
    };
};

/**
 * Convert chat message to thesis comment
 * @param message - The chat message to convert
 * @param version - Optional version number for the comment
 * @returns The corresponding thesis comment
 */
const randomId = () => {
    const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
    if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID();
    }
    return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const chatMessageToThesisComment = (message: ChatMessage, version?: number): ThesisComment => ({
    id: message.id ?? randomId(),
    author: message.senderId,
    date: typeof message.timestamp === 'string' ? message.timestamp : message.timestamp.toISOString(),
    comment: message.content,
    attachments: message.attachments ?? [],
    version: version ?? (typeof message.metadata?.version === 'number' ? message.metadata.version : undefined),
});

/**
 * Sort chat messages using sortUtils
 * @param messages - Array of messages to sort
 * @param order - Sort order ('asc' for oldest first, 'desc' for newest first)
 * @returns Sorted array of messages
 */
export const sortMessages = (messages: ChatMessage[], order: SortOrder = 'asc'): ChatMessage[] => {
    return sortArray(messages, {
        field: 'timestamp',
        order: order
    });
};

/**
 * Group messages by sender (consecutive messages from same sender)
 * @param messages - Array of messages to group
 * @returns Array of message groups
 */
export const groupMessagesBySender = (messages: ChatMessage[]): ChatMessage[][] => {
    if (messages.length === 0) return [];

    const groups: ChatMessage[][] = [];
    let currentGroup: ChatMessage[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
        const currentMessage = messages[i];
        const previousMessage = messages[i - 1];

        if (currentMessage.senderId === previousMessage.senderId) {
            currentGroup.push(currentMessage);
        } else {
            groups.push(currentGroup);
            currentGroup = [currentMessage];
        }
    }

    groups.push(currentGroup);
    return groups;
};

/**
 * Format date for grouping (Today, Yesterday, or date string)
 * @param timestamp - The timestamp to format
 * @returns Formatted date string
 */
export const formatDateGroup = (timestamp: string | Date): string => {
    // Normalize input using the project's date parsing utility
    const date = typeof timestamp === 'string' ? parseThesisDate(timestamp) : timestamp;
    const now = new Date();

    // Start-of-day reference for today and yesterday
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = addDays(today, -1);

    // Message date normalized to start-of-day for comparison
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (isSameDay(messageDate, today)) {
        return 'Today';
    } else if (isSameDay(messageDate, yesterday)) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
};

/**
 * Group messages by date
 * @param messages - Array of messages to group
 * @returns Map of date strings to message arrays
 */
export const groupMessagesByDate = (messages: ChatMessage[]): Map<string, ChatMessage[]> => {
    const grouped = new Map<string, ChatMessage[]>();

    messages.forEach(message => {
        const dateKey = formatDateGroup(message.timestamp);

        if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(message);
    });

    return grouped;
};

/**
 * Filter messages by sender
 * @param messages - Array of messages to filter
 * @param senderIds - Array of sender IDs to include
 * @returns Filtered array of messages
 */
export const filterMessagesBySender = (messages: ChatMessage[], senderIds: string[]): ChatMessage[] => {
    return messages.filter(message => senderIds.includes(message.senderId));
};

/**
 * Filter messages by date range
 * @param messages - Array of messages to filter
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Filtered array of messages
 */
export const filterMessagesByDateRange = (
    messages: ChatMessage[],
    startDate: Date,
    endDate: Date
): ChatMessage[] => {
    // Normalize input range to start-of-day and end-of-day
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    return messages.filter(message => {
        const raw = typeof message.timestamp === 'string' ? parseThesisDate(message.timestamp) : message.timestamp;
        const msgDate = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());

        return msgDate >= start && msgDate <= end;
    });
};

/**
 * Filter messages that have attachments
 * @param messages - Array of messages to filter
 * @returns Messages with attachments
 */
export const filterMessagesWithAttachments = (messages: ChatMessage[]): ChatMessage[] => {
    return messages.filter(message => message.attachments && message.attachments.length > 0);
};

/**
 * Search messages by content
 * @param messages - Array of messages to search
 * @param query - Search query string
 * @param caseSensitive - Whether the search should be case sensitive
 * @returns Filtered array of messages matching the query
 */
export const searchMessages = (
    messages: ChatMessage[],
    query: string,
    caseSensitive: boolean = false
): ChatMessage[] => {
    if (!query.trim()) return messages;

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    return messages.filter(message => {
        const content = caseSensitive ? message.content : message.content.toLowerCase();
        return content.includes(searchQuery);
    });
};

/**
 * Get unique senders from messages
 * @param messages - Array of messages
 * @returns Array of unique sender IDs
 */
export const getUniqueSenders = (messages: ChatMessage[]): string[] => {
    return Array.from(new Set(messages.map(message => message.senderId)));
};

/**
 * Count messages by sender
 * @param messages - Array of messages
 * @returns Map of sender IDs to message counts
 */
export const countMessagesBySender = (messages: ChatMessage[]): Map<string, number> => {
    const counts = new Map<string, number>();

    messages.forEach(message => {
        const count = counts.get(message.senderId) || 0;
        counts.set(message.senderId, count + 1);
    });

    return counts;
};

/**
 * Get most recent message
 * @param messages - Array of messages
 * @returns The most recent message, or null if array is empty
 */
export const getMostRecentMessage = (messages: ChatMessage[]): ChatMessage | null => {
    if (messages.length === 0) return null;

    return messages.reduce((latest, current) => {
        const latestDate = typeof latest.timestamp === 'string' ? parseThesisDate(latest.timestamp) : latest.timestamp;
        const currentDate = typeof current.timestamp === 'string' ? parseThesisDate(current.timestamp) : current.timestamp;

        return currentDate > latestDate ? current : latest;
    });
};

/**
 * Calculate total attachment size for a message
 * @param message - The message to calculate size for
 * @returns Total size in bytes (returns 0 if sizes cannot be parsed)
 */
export const calculateMessageAttachmentSize = (message: ChatMessage): number => {
    if (!message.attachments || message.attachments.length === 0) return 0;

    return message.attachments.reduce((total, attachment) => {
        // Parse size string (e.g., "1.5 MB" -> bytes)
        const sizeStr = attachment.size.toLowerCase();
        let bytes = 0;

        if (sizeStr.includes('kb')) {
            bytes = parseFloat(sizeStr) * 1024;
        } else if (sizeStr.includes('mb')) {
            bytes = parseFloat(sizeStr) * 1024 * 1024;
        } else if (sizeStr.includes('gb')) {
            bytes = parseFloat(sizeStr) * 1024 * 1024 * 1024;
        } else if (sizeStr.includes('bytes')) {
            bytes = parseFloat(sizeStr);
        }

        return total + bytes;
    }, 0);
};

/**
 * Validate message content
 * @param content - The message content to validate
 * @param minLength - Minimum length (default: 1)
 * @param maxLength - Maximum length (default: 5000)
 * @returns Validation result
 */
export const validateMessageContent = (
    content: string,
    minLength: number = 1,
    maxLength: number = 5000
): { isValid: boolean; error?: string } => {
    if (!content || content.trim().length < minLength) {
        return {
            isValid: false,
            error: `Message must be at least ${minLength} character${minLength === 1 ? '' : 's'} long`
        };
    }

    if (content.length > maxLength) {
        return {
            isValid: false,
            error: `Message cannot exceed ${maxLength} characters`
        };
    }

    return { isValid: true };
};
