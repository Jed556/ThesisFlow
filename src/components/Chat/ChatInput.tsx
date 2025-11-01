import React, { useState, useRef } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Stack,
    Chip,
    Tooltip,
    Paper,
    Typography,
    alpha
} from '@mui/material';
import {
    Send,
    AttachFile,
    Image,
    VideoFile,
    Close,
    InsertDriveFile
} from '@mui/icons-material';
import type { ChatMessage } from '../../types/chat';
import type { FileAttachment, FileCategory } from '../../types/file';
import { formatFileSize, getFileCategory } from '../../utils/fileUtils';

/**
 * Props for the ChatInput component
 */
interface ChatInputProps {
    /**
     * Callback when a message is sent
     */
    onSendMessage: (message: string, attachments: FileAttachment[]) => void;
    /**
     * Placeholder text for the input field
     * @default "Type a message..."
     */
    placeholder?: string;
    /**
     * Whether to allow attachments
     * @default true
     */
    allowAttachments?: boolean;
    /**
     * Allowed attachment types
     * @default ['image', 'video', 'document']
     */
    allowedAttachmentTypes?: FileCategory[];
    /**
     * Maximum attachment size in bytes
     * @default 10485760 (10MB)
     */
    maxAttachmentSize?: number;
    /**
     * Message being replied to (for reply/quote feature)
     */
    replyToMessage?: ChatMessage;
    /**
     * Callback when reply is cancelled
     */
    onCancelReply?: () => void;
    /**
     * Function to get display name for a sender ID
     */
    getDisplayName?: (senderId: string) => string;
    /**
     * Maximum number of attachments per message
     * @default 5
     */
    maxAttachments?: number;
    /**
     * Whether the input is disabled
     * @default false
     */
    disabled?: boolean;
    /**
     * Whether to show the send button always (even when input is empty)
     * @default false
     */
    alwaysShowSendButton?: boolean;
    /**
     * Callback when attachments are added (for custom validation/processing)
     */
    onAttachmentsChange?: (attachments: FileAttachment[]) => void;
    /**
     * Custom error handler
     */
    onError?: (error: string) => void;
    /**
     * Whether to auto-focus the input field
     * @default false
     */
    autoFocus?: boolean;
    /**
     * Minimum rows for the text field
     * @default 1
     */
    minRows?: number;
    /**
     * Maximum rows for the text field
     * @default 4
     */
    maxRows?: number;
}

/**
 * Get attachment type from file
 * @param file - The file to check
 * @returns The attachment type
 */
const getAttachmentType = (file: File): FileCategory => {
    const mimeType = file.type.toLowerCase();

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') ||
        mimeType.includes('word') ||
        mimeType.includes('document') ||
        mimeType.includes('spreadsheet') ||
        mimeType.includes('presentation')) {
        return 'document';
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') ||
        mimeType.includes('7z') || mimeType.includes('tar')) {
        return 'archive';
    }

    return 'other';
};

/**
 * Get accept string for file input based on allowed types
 */
const getAcceptString = (allowedTypes: FileCategory[]): string => {
    const acceptMap: Record<FileCategory, string> = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
        archive: '.zip,.rar,.7z,.tar,.gz',
        other: '*/*'
    };

    return allowedTypes.map(type => acceptMap[type]).join(',');
};

/**
 * ChatInput component - input field with attachment support for chat messages
 */
const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    placeholder = 'Type a message...',
    allowAttachments = true,
    allowedAttachmentTypes = ['image', 'video', 'document'],
    maxAttachmentSize = 10485760, // 10MB
    maxAttachments = 5,
    disabled = false,
    alwaysShowSendButton = false,
    onAttachmentsChange,
    onError,
    autoFocus = false,
    minRows = 1,
    maxRows = 4,
    replyToMessage,
    onCancelReply,
    getDisplayName
}) => {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasContent = message.trim().length > 0 || attachments.length > 0;

    /**
     * Handle file selection
     */
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newAttachments: FileAttachment[] = [];
        let errorOccurred = false;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Check if we've reached max attachments
            if (attachments.length + newAttachments.length >= maxAttachments) {
                onError?.(`Maximum ${maxAttachments} attachments allowed`);
                errorOccurred = true;
                break;
            }

            // Check file size
            if (file.size > maxAttachmentSize) {
                onError?.(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxAttachmentSize)}`);
                errorOccurred = true;
                continue;
            }

            // Get attachment type
            const attachmentType = getAttachmentType(file);

            // Check if type is allowed
            if (!allowedAttachmentTypes.includes(attachmentType)) {
                onError?.(`File type "${attachmentType}" is not allowed`);
                errorOccurred = true;
                continue;
            }

            // Create attachment object
            const attachment: FileAttachment = {
                id: `${Date.now()}-${i}`,
                name: file.name,
                type: file.name.split('.').pop() || 'unknown',
                size: formatFileSize(file.size),
                mimeType: file.type,
                author: 'current-user', // This should be replaced with actual user email
                uploadDate: new Date().toISOString(),
                category: 'attachment',
                // In a real app, you would upload the file here and get a URL
                url: URL.createObjectURL(file)
            };

            newAttachments.push(attachment);
        }

        if (newAttachments.length > 0) {
            const updatedAttachments = [...attachments, ...newAttachments];
            setAttachments(updatedAttachments);
            onAttachmentsChange?.(updatedAttachments);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    /**
     * Remove an attachment
     */
    const handleRemoveAttachment = (attachmentId: string) => {
        const updatedAttachments = attachments.filter(att => att.id !== attachmentId);
        setAttachments(updatedAttachments);
        onAttachmentsChange?.(updatedAttachments);
    };

    /**
     * Handle send message
     */
    const handleSend = () => {
        if (!hasContent || disabled) return;

        onSendMessage(message.trim(), attachments);

        // Reset state
        setMessage('');
        setAttachments([]);
        onAttachmentsChange?.([]);
    };

    /**
     * Handle key press (Ctrl+Enter or Cmd+Enter to send)
     */
    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            handleSend();
        }
    };

    /**
     * Get icon for attachment type
     */
    const getAttachmentIcon = (type: FileCategory) => {
        switch (type) {
            case 'image':
                return <Image fontSize="small" />;
            case 'video':
                return <VideoFile fontSize="small" />;
            default:
                return <InsertDriveFile fontSize="small" />;
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            {/* Reply Preview Banner */}
            {replyToMessage && (
                <Box
                    sx={{
                        mb: 1.5,
                        p: 1.5,
                        bgcolor: 'action.selected',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        borderLeft: 3,
                        borderColor: 'primary.main'
                    }}
                >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 600,
                                color: 'text.secondary',
                                display: 'block',
                                mb: 0.5
                            }}
                        >
                            Replying to {getDisplayName?.(replyToMessage.senderId)
                                || replyToMessage.senderName || replyToMessage.senderId}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                fontSize: '0.875rem',
                                color: 'text.primary',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {replyToMessage.content}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={onCancelReply}
                        sx={{
                            flexShrink: 0,
                            color: 'text.secondary',
                            '&:hover': {
                                color: 'error.main'
                            }
                        }}
                        aria-label="Cancel reply"
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </Box>
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {attachments.map((attachment) => (
                            <Chip
                                key={attachment.id || attachment.url}
                                icon={getAttachmentIcon(getFileCategory(attachment.type))}
                                label={`${attachment.name} (${attachment.size})`}
                                onDelete={() => handleRemoveAttachment(attachment.id || attachment.url)}
                                deleteIcon={<Close />}
                                size="small"
                                sx={{
                                    maxWidth: '200px',
                                    '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }
                                }}
                            />
                        ))}
                    </Stack>
                </Box>
            )}

            {/* Input Area */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                {/* Attachment Button */}
                {allowAttachments && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={getAcceptString(allowedAttachmentTypes)}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            disabled={disabled || attachments.length >= maxAttachments}
                        />
                        <Tooltip title={attachments.length >= maxAttachments ?
                            `Maximum ${maxAttachments} attachments` : 'Attach files'}>
                            <span>
                                <IconButton
                                    color="primary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={disabled || attachments.length >= maxAttachments}
                                    sx={{
                                        mb: 0.5,
                                        transition: theme => theme.transitions.create(['transform', 'background-color'], {
                                            duration: theme.transitions.duration.shorter,
                                            easing: theme.transitions.easing.easeInOut
                                        }),
                                        '&:hover': {
                                            transform: 'scale(1.1)'
                                        }
                                    }}
                                >
                                    <AttachFile />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </>
                )}

                {/* Text Field */}
                <TextField
                    fullWidth
                    multiline
                    minRows={minRows}
                    maxRows={maxRows}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    variant="outlined"
                    size="small"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: theme => alpha(theme.palette.background.default, 0.5)
                        }
                    }}
                />

                {/* Send Button */}
                {(alwaysShowSendButton || hasContent) && (
                    <Tooltip title="Send (Ctrl+Enter)">
                        <span>
                            <IconButton
                                color="primary"
                                onClick={handleSend}
                                disabled={!hasContent || disabled}
                                sx={{
                                    mb: 0.5,
                                    transition: theme => theme.transitions.create(['transform', 'background-color'], {
                                        duration: theme.transitions.duration.shorter,
                                        easing: theme.transitions.easing.easeInOut
                                    }),
                                    '&:hover:not(:disabled)': {
                                        transform: 'scale(1.1)'
                                    }
                                }}
                            >
                                <Send />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Box>

            {/* Helper Text */}
            <Box sx={{ mt: 0.5, px: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                        Press Ctrl+Enter to send
                    </Box>
                    {attachments.length > 0 && (
                        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                            {attachments.length}/{maxAttachments} attachments
                        </Box>
                    )}
                </Stack>
            </Box>
        </Paper>
    );
};

export default ChatInput;
