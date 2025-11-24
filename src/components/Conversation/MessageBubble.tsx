import * as React from 'react';
import {
    Avatar,
    Box,
    Chip,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Edit as EditIcon,
    Reply as ReplyIcon,
} from '@mui/icons-material';
import type { ChatMessage } from '../../types/chat';
import type { MessageBubbleProps } from './types';
import { formatFileSize } from '../../utils/fileUtils';

const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const ReplyPreview = ({ message, participant }: { message: ChatMessage; participant?: { displayName?: string } }) => (
    <Paper
        elevation={0}
        sx={{
            borderLeft: 2,
            borderColor: 'primary.light',
            bgcolor: 'action.hover',
            px: 1.5,
            py: 1,
            mb: 1.25,
        }}
    >
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Replying to {participant?.displayName ?? message.senderName ?? 'participant'}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
            {message.content}
        </Typography>
    </Paper>
);

const AttachmentList = ({
    attachments,
}: {
    attachments?: ChatMessage['attachments'];
}) => {
    if (!attachments || attachments.length === 0) {
        return null;
    }

    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {attachments.map((attachment) => {
                const parsedSize = Number(attachment.size);
                const sizeLabel = Number.isFinite(parsedSize)
                    ? formatFileSize(parsedSize)
                    : attachment.size;
                return (
                    <Chip
                        key={attachment.url}
                        label={`${attachment.name}${attachment.size ? ` • ${sizeLabel}` : ''}`}
                        component="a"
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                        variant="outlined"
                        size="small"
                    />
                );
            })}
        </Stack>
    );
};

export default function MessageBubble({
    message,
    isOwnMessage,
    participant,
    showReplyPreview = true,
    repliedMessage,
    onReply,
    onEdit,
}: MessageBubbleProps) {
    const initials = React.useMemo(() => {
        const value = participant?.displayName || message.senderName || message.senderId;
        return value
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
    }, [participant?.displayName, message.senderName, message.senderId]);

    const actions = (
        <Stack direction="row" spacing={1}>
            {onReply && (
                <Tooltip title="Reply">
                    <IconButton
                        size="small"
                        onClick={() => onReply?.(message)}
                        aria-label="Reply to message"
                    >
                        <ReplyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
            {onEdit && isOwnMessage && (
                <Tooltip title="Edit">
                    <IconButton
                        size="small"
                        onClick={() => onEdit?.(message)}
                        aria-label="Edit message"
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Stack>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: isOwnMessage ? 'row-reverse' : 'row', gap: 1.5 }}>
            <Avatar src={participant?.avatarUrl} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                {initials}
            </Avatar>
            <Paper
                elevation={0}
                sx={{
                    flex: 1,
                    borderRadius: 3,
                    borderTopLeftRadius: isOwnMessage ? 3 : 1,
                    borderTopRightRadius: isOwnMessage ? 1 : 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isOwnMessage ? 'primary.50' : 'background.paper',
                    px: 2.5,
                    py: 2,
                }}
            >
                <Stack direction="row" alignItems="flex-start" spacing={1} justifyContent="space-between">
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2">
                                {participant?.displayName || message.senderName || 'Unknown user'}
                            </Typography>
                            {participant?.roleLabel && (
                                <Chip label={participant.roleLabel} size="small" variant="outlined" />
                            )}
                            {message.metadata?.version !== undefined && (
                                <Chip label={`V${Number(message.metadata.version) + 1}`} size="small" color="info" />
                            )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(message.timestamp)}
                            {message.isEdited ? ' • Edited' : ''}
                        </Typography>
                    </Box>
                    {actions}
                </Stack>

                {showReplyPreview && repliedMessage && (
                    <ReplyPreview
                        message={repliedMessage}
                        participant={{ displayName: participant?.displayName || repliedMessage.senderName }}
                    />
                )}

                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                    {message.content}
                </Typography>

                <AttachmentList attachments={message.attachments} />
            </Paper>
        </Box>
    );
}
