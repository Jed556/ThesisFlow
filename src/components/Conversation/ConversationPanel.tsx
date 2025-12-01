import * as React from 'react';
import { Box, Divider, Skeleton, Stack, Typography } from '@mui/material';
import type { ChatMessage } from '../../types/chat';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import type {
    ConversationComposerPayload,
    ConversationEditPayload,
    ConversationPanelProps,
} from './types';

const sortMessages = (messages: ChatMessage[]): ChatMessage[] => {
    return [...messages].sort((a, b) => {
        const aDate = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp;
        const bDate = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp;
        return aDate.getTime() - bDate.getTime();
    });
};

export default function ConversationPanel({
    messages,
    currentUserId,
    participants,
    isLoading,
    emptyStateMessage = 'No discussion yet. Start the conversation!',
    composerPlaceholder,
    disableComposer,
    allowAttachments = true,
    height = 540,
    composerMetadata,
    onSendMessage,
    onEditMessage,
    onReplyRequest,
}: ConversationPanelProps) {
    const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = React.useState<ChatMessage | null>(null);

    const sortedMessages = React.useMemo(() => sortMessages(messages), [messages]);
    const messageMap = React.useMemo(() => new Map(
        sortedMessages.map((msg) => [msg.id ?? `${msg.senderId}-${msg.timestamp}`, msg])
    ), [sortedMessages]);

    const handleReply = (message: ChatMessage) => {
        setEditingMessage(null);
        setReplyTo(message);
        onReplyRequest?.(message);
    };

    const handleEdit = (message: ChatMessage) => {
        setReplyTo(null);
        setEditingMessage(message);
    };

    const handleSend = async (payload: ConversationComposerPayload) => {
        const mergedPayload = {
            ...payload,
            metadata: {
                ...(payload.metadata ?? {}),
                ...(composerMetadata ?? {}),
            },
        } satisfies ConversationComposerPayload;

        if (editingMessage && onEditMessage) {
            const editPayload: ConversationEditPayload = {
                ...mergedPayload,
                messageId: editingMessage.id,
            };
            await onEditMessage(editPayload);
        } else {
            await onSendMessage?.(mergedPayload);
        }

        setReplyTo(null);
        setEditingMessage(null);
    };

    const renderMessages = () => {
        if (sortedMessages.length === 0) {
            return (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                        {emptyStateMessage}
                    </Typography>
                </Stack>
            );
        }

        return (
            <Stack spacing={2}
                sx={{
                    '& > :last-child': {
                        pb: 1,
                    },
                }}
            >
                {sortedMessages.map((message) => (
                    <MessageBubble
                        key={message.id || `${message.senderId}-${message.timestamp}`}
                        message={message}
                        isOwnMessage={message.senderId === currentUserId}
                        participant={participants?.[message.senderId]}
                        repliedMessage={message.replyTo ? messageMap.get(message.replyTo) : undefined}
                        onReply={disableComposer ? undefined : handleReply}
                        onEdit={disableComposer ? undefined : handleEdit}
                    />
                ))}
            </Stack>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height, px: 3, overflowY: 'auto' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
                {isLoading ? (
                    <Stack spacing={2}>
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} variant="rounded" height={90} />
                        ))}
                    </Stack>
                ) : (
                    renderMessages()
                )}
            </Box>

            {!disableComposer && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <MessageComposer
                        placeholder={composerPlaceholder}
                        allowAttachments={allowAttachments}
                        disabled={isLoading}
                        replyTo={replyTo}
                        editingMessage={editingMessage}
                        onCancelReply={() => setReplyTo(null)}
                        onCancelEdit={() => setEditingMessage(null)}
                        onSend={handleSend}
                    />
                </>
            )}
        </Box>
    );
}
