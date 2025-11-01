import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Divider, Skeleton } from '@mui/material';
import MessageCard from './MessageCard';
import ChatInput from './ChatInput';
import AnimatedList from '../Animate/AnimatedList/AnimatedList';
import type { ChatMessage, ChatAttachment, ChatBoxConfig } from '../../types/chat';
import { groupMessagesByDate } from '../../utils/chatUtils';

/**
 * Props for the ChatBox component
 */
interface ChatBoxProps {
    /**
     * Array of chat messages to display
     */
    messages: ChatMessage[];
    /**
     * ID of the current user (to determine which messages are from the user)
     */
    currentUserId: string;
    /**
     * Callback when a new message is sent
     */
    onSendMessage?: (message: string, attachments: ChatAttachment[]) => void;
    /**
     * Configuration for the chat box
     */
    config?: ChatBoxConfig;
    /**
     * Whether to show the input field
     * @default true
     */
    showInput?: boolean;
    /**
     * Custom height for the chat container
     * @default '600px'
     */
    height?: string | number;
    /**
     * Whether to enable auto-scroll to bottom on new messages
     * @default true
     */
    autoScroll?: boolean;
    /**
     * Custom display name resolver
     */
    getDisplayName?: (senderId: string) => string;
    /**
     * Custom role display text resolver
     */
    getRoleDisplayText?: (senderId: string, role?: string) => string;
    /**
     * Custom avatar color resolver
     */
    getAvatarColor?: (senderId: string, role?: string) => string;
    /**
     * Callback when an attachment is clicked
     */
    onAttachmentClick?: (attachment: ChatAttachment) => void;
    /**
     * Callback when a message is clicked
     */
    onMessageClick?: (message: ChatMessage) => void;
    /**
     * Custom empty state message
     */
    emptyStateMessage?: string;
    /**
     * Whether to show loading state
     * @default false
     */
    isLoading?: boolean;
    /**
     * Custom loading message
     */
    loadingMessage?: string;
    /**
     * Stagger delay for message animations (ms)
     * @default 40
     */
    animationStaggerDelay?: number;
    /**
     * Animation variant for messages
     * @default 'slideUp'
     */
    animationVariant?: 'fade' | 'slideUp' | 'slideLeft' | 'scale' | 'none';
    /**
     * Custom error handler for chat input
     */
    onInputError?: (error: string) => void;
    /**
     * Whether messages are grouped by date
     * @default false
     */
    groupByDate?: boolean;
    /**
     * Whether messages are grouped by sender
     * @default false
     */
    groupBySender?: boolean;
}

/**
 * Default chat box configuration
 */
const defaultConfig: ChatBoxConfig = {
    showTimestamps: true,
    showAvatars: true,
    showSenderNames: true,
    showSenderRoles: true,
    groupByDate: false,
    groupBySender: false,
    sortOrder: 'asc',
    allowEditing: false,
    allowDeletion: false,
    allowReplies: true,
    allowAttachments: true,
    allowedAttachmentTypes: ['image', 'video', 'document', 'other'],
    maxAttachmentSize: 10485760, // 10MB
    maxAttachments: 5
};

/**
 * ChatBox component - main chat container with messages and input
 */
const ChatBox: React.FC<ChatBoxProps> = ({
    messages,
    currentUserId,
    onSendMessage,
    config,
    showInput = true,
    height = '600px',
    autoScroll = true,
    getDisplayName,
    getRoleDisplayText,
    getAvatarColor,
    onAttachmentClick,
    onMessageClick,
    emptyStateMessage = 'No messages yet. Start the conversation!',
    isLoading = false,
    loadingMessage = 'Loading messages...',
    animationStaggerDelay = 40,
    animationVariant = 'slideUp',
    onInputError,
    groupByDate = false,
    groupBySender = false
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAnimate, setShouldAnimate] = useState(true);
    const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

    // Merge config with defaults
    const mergedConfig: ChatBoxConfig = { ...defaultConfig, ...config };

    // Sort messages
    const sortedMessages = [...messages].sort((a, b) => {
        const dateA = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp;
        const dateB = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp;

        if (mergedConfig.sortOrder === 'asc') {
            return dateA.getTime() - dateB.getTime();
        } else {
            return dateB.getTime() - dateA.getTime();
        }
    });

    // Scroll to bottom on new messages
    useEffect(() => {
        if (autoScroll && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, autoScroll]);

    // Disable animation after initial load
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(false);
        }, messages.length * animationStaggerDelay + 500);

        return () => clearTimeout(timer);
    }, []);

    /**
     * Handle send message
     */
    const handleSendMessage = (message: string, attachments: ChatAttachment[]) => {
        if (onSendMessage) {
            onSendMessage(message, attachments);
        }
        // Clear reply after sending
        setReplyToMessage(null);
    };

    /**
     * Handle reply to message
     */
    const handleReplyToMessage = (message: ChatMessage) => {
        if (mergedConfig.allowReplies) {
            setReplyToMessage(message);
        }
    };

    /**
     * Handle cancel reply
     */
    const handleCancelReply = () => {
        setReplyToMessage(null);
    };

    /**
     * Find message by ID for displaying replied message
     */
    const findMessageById = (messageId: string): ChatMessage | undefined => {
        return messages.find(msg => msg.id === messageId);
    };

    /**
     * Render messages with optional grouping
     */
    const renderMessages = () => {
        if (groupByDate || mergedConfig.groupByDate) {
            const groupedMessages = groupMessagesByDate(sortedMessages);

            return Array.from(groupedMessages.entries()).map(([dateKey, dateMessages]) => (
                <Box key={dateKey}>
                    {/* Date Divider */}
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                        <Divider sx={{ flexGrow: 1 }} />
                        <Typography
                            variant="caption"
                            sx={{
                                mx: 2,
                                px: 2,
                                py: 0.5,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                color: 'text.secondary',
                                fontWeight: 500
                            }}
                        >
                            {dateKey}
                        </Typography>
                        <Divider sx={{ flexGrow: 1 }} />
                    </Box>

                    {/* Messages for this date */}
                    {dateMessages.map((message, index) => {
                        const isUser = message.senderId === currentUserId;

                        return (
                            <MessageCard
                                key={message.id || `msg-${index}`}
                                message={message}
                                isUser={isUser}
                                showAvatar={mergedConfig.showAvatars}
                                showSenderName={mergedConfig.showSenderNames}
                                showSenderRole={mergedConfig.showSenderRoles}
                                showTimestamp={mergedConfig.showTimestamps}
                                displayName={getDisplayName?.(message.senderId)}
                                roleDisplayText={getRoleDisplayText?.(message.senderId, message.senderRole)}
                                avatarColor={getAvatarColor?.(message.senderId, message.senderRole)}
                                onAttachmentClick={onAttachmentClick}
                                onMessageClick={onMessageClick}
                                onReply={mergedConfig.allowReplies ? handleReplyToMessage : undefined}
                                repliedMessage={message.replyTo ? findMessageById(message.replyTo) : undefined}
                            />
                        );
                    })}
                </Box>
            ));
        }

        // Default: no grouping
        return sortedMessages.map((message, index) => {
            const isUser = message.senderId === currentUserId;

            return (
                <MessageCard
                    key={message.id || `msg-${index}`}
                    message={message}
                    isUser={isUser}
                    showAvatar={mergedConfig.showAvatars}
                    showSenderName={mergedConfig.showSenderNames}
                    showSenderRole={mergedConfig.showSenderRoles}
                    showTimestamp={mergedConfig.showTimestamps}
                    displayName={getDisplayName?.(message.senderId)}
                    roleDisplayText={getRoleDisplayText?.(message.senderId, message.senderRole)}
                    avatarColor={getAvatarColor?.(message.senderId, message.senderRole)}
                    onAttachmentClick={onAttachmentClick}
                    onMessageClick={onMessageClick}
                    onReply={mergedConfig.allowReplies ? handleReplyToMessage : undefined}
                    repliedMessage={message.replyTo ? findMessageById(message.replyTo) : undefined}
                />
            );
        });
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height,
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'hidden'
            }}
        >
            {/* Messages Container */}
            <Box
                ref={messagesContainerRef}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {messages.length === 0 && !isLoading ? (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%'
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {emptyStateMessage}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {shouldAnimate && animationVariant !== 'none' && !isLoading ? (
                            <AnimatedList
                                variant={animationVariant}
                                staggerDelay={animationStaggerDelay}
                            >
                                {renderMessages()}
                            </AnimatedList>
                        ) : isLoading ? (
                            // Show skeleton messages while loading
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {[1, 2, 3].map((i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start',
                                        }}
                                    >
                                        <Box sx={{ maxWidth: '80%', width: '100%', p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1.5 }}>
                                                {i % 2 !== 0 && <Skeleton variant="circular" width={28} height={28} />}
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Skeleton variant="text" width={80} height={20} />
                                                    <Skeleton variant="text" width={120} height={16} />
                                                </Box>
                                                {i % 2 === 0 && <Skeleton variant="circular" width={28} height={28} />}
                                            </Box>
                                            <Skeleton variant="text" width="90%" height={20} />
                                            <Skeleton variant="text" width="75%" height={20} />
                                            <Skeleton variant="text" width="60%" height={20} />
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            renderMessages()
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </Box>

            {/* Input Field */}
            {showInput && onSendMessage && (
                <ChatInput
                    onSendMessage={handleSendMessage}
                    placeholder="Type a message..."
                    allowAttachments={mergedConfig.allowAttachments}
                    allowedAttachmentTypes={mergedConfig.allowedAttachmentTypes}
                    maxAttachmentSize={mergedConfig.maxAttachmentSize}
                    maxAttachments={mergedConfig.maxAttachments}
                    disabled={isLoading}
                    onError={onInputError}
                    replyToMessage={replyToMessage ?? undefined}
                    onCancelReply={handleCancelReply}
                    getDisplayName={getDisplayName}
                />
            )}
        </Box>
    );
};

export default ChatBox;
