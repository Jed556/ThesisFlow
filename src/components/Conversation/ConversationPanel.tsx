import * as React from 'react';
import {
    Box, Divider, Fab, Skeleton, Stack, Tooltip, Typography, Zoom,
} from '@mui/material';
import { KeyboardArrowDown as ScrollDownIcon } from '@mui/icons-material';
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
    const [showScrollButton, setShowScrollButton] = React.useState(false);
    const messagesContainerRef = React.useRef<HTMLDivElement>(null);

    const sortedMessages = React.useMemo(() => sortMessages(messages), [messages]);
    const messageMap = React.useMemo(() => new Map(
        sortedMessages.map((msg) => [msg.id ?? `${msg.senderId}-${msg.timestamp}`, msg])
    ), [sortedMessages]);

    /** Scroll to the bottom of the messages */
    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        const container = messagesContainerRef.current;
        if (!container) return;

        if (behavior === 'smooth') {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth',
            });
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }, []);

    /** Handle scroll events to show/hide the scroll-to-bottom button */
    const handleScroll = React.useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        // Show button when scrolled up more than 100px from bottom
        setShowScrollButton(distanceFromBottom > 100);
    }, []);

    // Auto-scroll to bottom when new messages arrive (if already near bottom)
    React.useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Only auto-scroll if user is near the bottom (within 150px)
        if (distanceFromBottom < 150) {
            scrollToBottom('instant');
        }
    }, [sortedMessages.length, scrollToBottom]);

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
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
                px: 3,
                boxSizing: 'border-box',
            }}
        >
            {/* Scrollable messages area */}
            <Box
                ref={messagesContainerRef}
                onScroll={handleScroll}
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    pr: 1,
                    py: 1,
                    minHeight: 0,
                }}
            >
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

            {/* Floating scroll-to-bottom button */}
            <Zoom in={showScrollButton}>
                <Tooltip title="Scroll to latest" placement="left">
                    <Fab
                        size="small"
                        color="primary"
                        onClick={() => scrollToBottom('smooth')}
                        sx={{
                            position: 'absolute',
                            bottom: disableComposer ? 16 : 100,
                            right: 24,
                            zIndex: 1,
                        }}
                    >
                        <ScrollDownIcon />
                    </Fab>
                </Tooltip>
            </Zoom>

            {/* Fixed composer at bottom */}
            {!disableComposer && (
                <Box sx={{ flexShrink: 0, pt: 1, pb: 1, bgcolor: 'background.paper' }}>
                    <Divider sx={{ mb: 2 }} />
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
                </Box>
            )}
        </Box>
    );
}
