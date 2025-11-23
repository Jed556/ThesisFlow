import React from 'react';
import { Typography, Box, Card, CardContent, IconButton, Divider, Skeleton, alpha } from '@mui/material';
import { PictureAsPdf, Description, AttachFile, VideoFile, Image, AudioFile, Visibility, Reply } from '@mui/icons-material';
import Avatar, { Name } from '../Avatar/Avatar';
import type { ChatMessage, ChatParticipantRole } from '../../types/chat';
import type { FileAttachment, FileCategory } from '../../types/file';
import { getFileCategory } from '../../utils/fileUtils';

/**
 * Props for the MessageCard component
 */
interface MessageCardProps {
    /**
     * The chat message to display
     */
    message: ChatMessage;
    /**
     * Whether this message is from the current user
     */
    isUser: boolean;
    /**
     * Whether to show the sender's avatar
     * @default true
     */
    showAvatar?: boolean;
    /**
     * Whether to show the sender's name
     * @default true
     */
    showSenderName?: boolean;
    /**
     * Whether to show the sender's role
     * @default true
     */
    showSenderRole?: boolean;
    /**
     * Whether to show the timestamp
     * @default true
     */
    showTimestamp?: boolean;
    /**
     * Custom display name (overrides message.senderName)
     */
    displayName?: string;
    /**
     * Custom role display text
     */
    roleDisplayText?: string;
    /**
     * Callback when an attachment is clicked
     */
    onAttachmentClick?: (attachment: FileAttachment) => void;
    /**
     * Callback when the message is clicked
     */
    onMessageClick?: (message: ChatMessage) => void;
    /**
     * Custom avatar color based on role
     */
    avatarColor?: string;
    /**
     * Maximum width of the message card as a percentage
     * @default 80
     */
    maxWidth?: number;
    /**
     * Callback when the reply button is clicked
     */
    onReply?: (message: ChatMessage) => void;
    /**
     * The message that this message is replying to
     */
    repliedMessage?: ChatMessage;
    /**
     * Whether the message is still loading
     * @default false
     */
    loading?: boolean;
    /**
     * Whether attachments are still loading (content is ready)
     * @default false
     */
    attachmentsLoading?: boolean;
}

/**
 * Get the attachment icon for a file type
 * @param type - The type of the attachment
 * @returns The icon component for the attachment
 */
const getAttachmentIcon = (type: FileCategory) => {
    switch (type) {
        case 'image':
            return <Image color="primary" />;
        case 'video':
            return <VideoFile color="secondary" />;
        case 'audio':
            return <AudioFile color="success" />;
        case 'document':
            return <Description color="primary" />;
        case 'archive':
            return <AttachFile color="info" />;
        case 'other':
        default:
            return <AttachFile color="action" />;
    }
};

/**
 * Get specialized icon for document types
 */
const getDocumentIcon = (attachment: FileAttachment) => {
    const name = attachment.name.toLowerCase();
    const mime = attachment.mimeType?.toLowerCase() || '';

    if (name.endsWith('.pdf') || mime.includes('pdf')) {
        return <PictureAsPdf color="error" />;
    }
    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word')) {
        return <Description color="primary" />;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('excel') || mime.includes('spreadsheet')) {
        return <Description color="success" />;
    }

    return getAttachmentIcon(getFileCategory(attachment.type));
};

/**
 * Format timestamp for display
 * @param timestamp - The timestamp string or Date object
 * @returns Formatted timestamp string
 */
const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return String(timestamp);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Less than 1 minute ago
    if (diffMins < 1) return 'Just now';

    // Less than 1 hour ago
    if (diffMins < 60) return `${diffMins}m ago`;

    // Less than 24 hours ago
    if (diffHours < 24) return `${diffHours}h ago`;

    // Less than 7 days ago
    if (diffDays < 7) return `${diffDays}d ago`;

    // Older - show date
    return date.toLocaleDateString('en-US',
        { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

/**
 * MessageCard component - displays a single chat message
 * @param message - The chat message to display
 * @param isUser - Whether this message is from the current user
 * @param showAvatar - Whether to show the sender's avatar
 * @param showSenderName - Whether to show the sender's name
 * @param showSenderRole - Whether to show the sender's role
 * @param showTimestamp - Whether to show the timestamp
 * @param displayName - Custom display name (overrides message.senderName)
 * @param roleDisplayText - Custom role display text
 * @param onAttachmentClick - Callback when an attachment is clicked
 * @param onMessageClick - Callback when the message is clicked
 * @param avatarColor - Custom avatar color based on role
 * @param maxWidth - Maximum width of the message card as a percentage
 * @param onReply - Callback when the reply button is clicked
 * @param repliedMessage - The message that this message is replying to
 */
const MessageCard: React.FC<MessageCardProps> = ({
    message,
    isUser,
    showAvatar = true,
    showSenderName = true,
    showSenderRole = true,
    showTimestamp = true,
    displayName,
    roleDisplayText,
    onAttachmentClick,
    onMessageClick,
    avatarColor,
    maxWidth = 80,
    onReply,
    repliedMessage,
    loading = false,
    attachmentsLoading = false
}) => {
    const senderName = displayName || message.senderName || message.senderId;
    const hasAttachments = message.attachments && message.attachments.length > 0;

    const handleAttachmentClick = (attachment: FileAttachment) => {
        if (onAttachmentClick) {
            onAttachmentClick(attachment);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                mb: 2
            }}
        >
            <Card
                variant="outlined"
                sx={{
                    maxWidth: `${maxWidth}%`,
                    ml: isUser ? 2 : 1,
                    mr: isUser ? 1 : 2,
                    bgcolor: isUser ? 'primary.main' : 'background.paper',
                    cursor: onMessageClick ? 'pointer' : 'default',
                    position: 'relative',
                    transition: theme => theme.transitions.create(['transform', 'box-shadow'], {
                        duration: theme.transitions.duration.shorter,
                        easing: theme.transitions.easing.easeInOut
                    }),
                    '&:hover': onMessageClick ? {
                        boxShadow: 2
                    } : {},
                    '&:hover .reply-button': {
                        opacity: 1
                    }
                }}
                onClick={() => onMessageClick?.(message)}
            >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* Reply Button (appears on hover) */}
                    {!loading && onReply && (
                        <IconButton
                            className="reply-button"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReply(message);
                            }}
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: isUser ? undefined : 8,
                                left: isUser ? 8 : undefined,
                                opacity: 0,
                                transition: theme => theme.transitions.create('opacity', {
                                    duration: theme.transitions.duration.shorter
                                }),
                                bgcolor: isUser ? alpha('#ffffff', 0.2) : 'action.hover',
                                color: isUser ? 'primary.contrastText' : 'text.secondary',
                                '&:hover': {
                                    bgcolor: isUser ? alpha('#ffffff', 0.3) : 'action.selected'
                                }
                            }}
                            aria-label="Reply to message"
                        >
                            <Reply fontSize="small" />
                        </IconButton>
                    )}

                    {/* Header: Avatar + Name + Role + Timestamp */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {!isUser && showAvatar && (
                            loading ? (
                                <Skeleton
                                    variant="circular"
                                    width={28}
                                    height={28}
                                    sx={{ mr: 1.5 }}
                                />
                            ) : (
                                <Avatar
                                    email={message.senderId}
                                    initials={[Name.FIRST]}
                                    size="small"
                                    editable={false}
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        mr: 1.5,
                                        bgcolor: avatarColor || 'primary.main'
                                    }}
                                />
                            )
                        )}
                        <Box sx={{ flexGrow: 1, textAlign: isUser ? 'right' : 'left' }}>
                            {showSenderName && (
                                loading ? (
                                    <Skeleton
                                        variant="text"
                                        width={80}
                                        height={20}
                                        sx={{ ml: isUser ? 'auto' : 0 }}
                                    />
                                ) : (
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontSize: '0.875rem',
                                            color: isUser ? 'primary.contrastText' : 'text.primary'
                                        }}
                                    >
                                        {isUser ? 'You' : senderName}
                                    </Typography>
                                )
                            )}
                            {(showSenderRole || showTimestamp) && (
                                loading ? (
                                    <Skeleton
                                        variant="text"
                                        width={120}
                                        height={16}
                                        sx={{ ml: isUser ? 'auto' : 0 }}
                                    />
                                ) : (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: isUser ? 'primary.contrastText' : 'text.secondary',
                                            opacity: isUser ? 0.9 : 1
                                        }}
                                    >
                                        {showSenderRole && roleDisplayText && `${roleDisplayText}`}
                                        {showSenderRole && roleDisplayText && showTimestamp && ' • '}
                                        {showTimestamp && formatTimestamp(message.timestamp)}
                                    </Typography>
                                )
                            )}
                        </Box>
                        {isUser && showAvatar && (
                            loading ? (
                                <Skeleton
                                    variant="circular"
                                    width={28}
                                    height={28}
                                    sx={{ ml: 1.5 }}
                                />
                            ) : (
                                <Avatar
                                    email={message.senderId}
                                    size="small"
                                    editable={false}
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        ml: 1.5,
                                        bgcolor: 'primary.contrastText',
                                        color: 'primary.main'
                                    }}
                                />
                            )
                        )}
                    </Box>

                    {/* Replied Message Quote */}
                    {!loading && repliedMessage && (
                        <Box
                            sx={{
                                ml: isUser ? 0 : (showAvatar ? 5 : 0),
                                mr: isUser ? (showAvatar ? 5 : 0) : 0,
                                mb: 1,
                                p: 1,
                                borderLeft: theme => `3px solid ${isUser ?
                                    theme.palette.primary.contrastText : theme.palette.primary.main}`,
                                bgcolor: theme => isUser
                                    ? alpha(theme.palette.primary.contrastText, 0.1)
                                    : alpha(theme.palette.action.hover, 0.5),
                                borderRadius: 1
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 600,
                                    display: 'block',
                                    mb: 0.5,
                                    color: isUser ? 'primary.contrastText' : 'text.primary',
                                    opacity: isUser ? 0.9 : 1
                                }}
                            >
                                Replying to {repliedMessage.senderName || repliedMessage.senderId}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: '0.75rem',
                                    fontStyle: 'italic',
                                    color: isUser ? 'primary.contrastText' : 'text.secondary',
                                    opacity: 0.8,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}
                            >
                                {repliedMessage.content}
                            </Typography>
                        </Box>
                    )}

                    {/* Message Content */}
                    {loading ? (
                        <Box sx={{
                            ml: isUser ? 0 : (showAvatar ? 5 : 0),
                            mr: isUser ? (showAvatar ? 5 : 0) : 0
                        }}>
                            <Skeleton variant="text" width="90%" height={20} />
                            <Skeleton variant="text" width="75%" height={20} />
                            <Skeleton variant="text" width="60%" height={20} />
                        </Box>
                    ) : (
                        <Typography
                            variant="body2"
                            sx={{
                                ml: isUser ? 0 : (showAvatar ? 5 : 0),
                                mr: isUser ? (showAvatar ? 5 : 0) : 0,
                                mb: hasAttachments ? 1 : 0,
                                textAlign: isUser ? 'right' : 'left',
                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        >
                            {message.content}
                        </Typography>
                    )}

                    {/* Attachments */}
                    {hasAttachments && (
                        <Box sx={{
                            ml: isUser ? 0 : (showAvatar ? 5 : 0),
                            mr: isUser ? (showAvatar ? 5 : 0) : 0,
                            mt: 1
                        }}>
                            <Divider sx={{
                                mb: 1,
                                borderColor: isUser ? 'primary.contrastText' : 'divider',
                                opacity: isUser ? 0.3 : 1
                            }} />
                            <Typography
                                variant="caption"
                                sx={{
                                    mb: 1,
                                    display: 'block',
                                    textAlign: isUser ? 'right' : 'left',
                                    color: isUser ? 'primary.contrastText' : 'text.secondary',
                                    opacity: isUser ? 0.9 : 1
                                }}
                            >
                                Attachments:
                            </Typography>
                            {attachmentsLoading ? (
                                // Skeleton for loading attachments
                                <>
                                    {[1, 2].map((i) => (
                                        <Box
                                            key={i}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                mb: 0.5,
                                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                                            }}
                                        >
                                            <Skeleton variant="circular" width={20} height={20} />
                                            <Skeleton variant="text" width={150} height={20} />
                                            <Skeleton variant="text" width={60} height={16} />
                                        </Box>
                                    ))}
                                </>
                            ) : (
                                // Actual attachments
                                message.attachments!.map((attachment, index) => (
                                    <Box
                                        key={attachment.id || index}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mb: 0.5,
                                            justifyContent: isUser ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        {!isUser && getDocumentIcon(attachment)}
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                fontSize: '0.8rem',
                                                color: isUser ? 'primary.contrastText' : 'primary.main',
                                                '&:hover': {
                                                    opacity: 0.8
                                                }
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAttachmentClick(attachment);
                                            }}
                                        >
                                            {attachment.name}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: isUser ? 'primary.contrastText' : 'text.secondary',
                                                opacity: isUser ? 0.9 : 1
                                            }}
                                        >
                                            ({attachment.size})
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            sx={{
                                                color: isUser ? 'primary.contrastText' : 'primary.main'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAttachmentClick(attachment);
                                            }}
                                        >
                                            <Visibility fontSize="small" />
                                        </IconButton>
                                        {isUser && getDocumentIcon(attachment)}
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}

                    {/* Edited indicator */}
                    {!loading && message.isEdited && (
                        <Typography
                            variant="caption"
                            sx={{
                                mt: 0.5,
                                display: 'block',
                                textAlign: isUser ? 'right' : 'left',
                                fontStyle: 'italic',
                                color: isUser ? 'primary.contrastText' : 'text.secondary',
                                opacity: 0.7
                            }}
                        >
                            (edited)
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default MessageCard;
