import * as React from 'react';
import {
    Box,
    Button,
    Chip,
    IconButton,
    InputAdornment,
    OutlinedInput,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    AttachFile as AttachFileIcon,
    Close as CloseIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import type { ChatMessage } from '../../types/chat';
import type { AttachmentPreview, MessageComposerProps } from './types';
import { formatFileSize } from '../../utils/fileUtils';

function createPreviewId(file: File) {
    return `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MessageComposer({
    placeholder = 'Write a comment…',
    allowAttachments = true,
    disabled,
    replyTo,
    editingMessage,
    onSend,
    onCancelReply,
    onCancelEdit,
}: MessageComposerProps) {
    const [message, setMessage] = React.useState('');
    const [previews, setPreviews] = React.useState<AttachmentPreview[]>([]);
    const [isSending, setIsSending] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Sync composer text when editing a message
    React.useEffect(() => {
        if (editingMessage) {
            setMessage(editingMessage.content);
        }
    }, [editingMessage?.id]);

    const resetComposer = React.useCallback(() => {
        setMessage('');
        setPreviews((prev) => {
            prev.forEach((preview) => URL.revokeObjectURL(preview.url));
            return [];
        });
    }, []);

    const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length === 0) {
            return;
        }

        const newPreviews = files.map((file) => ({
            id: createPreviewId(file),
            file,
            url: URL.createObjectURL(file),
        }));

        setPreviews((prev) => [...prev, ...newPreviews]);

        // Reset the input so the same file can be selected again later
        event.target.value = '';
    };

    React.useEffect(() => () => {
        previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    }, [previews]);

    const handleRemovePreview = (id: string) => {
        setPreviews((prev) => {
            const next = prev.filter((item) => item.id !== id);
            const removed = prev.find((item) => item.id === id);
            if (removed) {
                URL.revokeObjectURL(removed.url);
            }
            return next;
        });
    };

    const handleSend = async () => {
        if (!message.trim()) {
            return;
        }

        if (disabled || isSending) {
            return;
        }

        setIsSending(true);
        try {
            await onSend({
                content: message.trim(),
                files: previews.map((preview) => preview.file),
                replyToId: replyTo?.id,
            });
            resetComposer();
            onCancelReply?.();
            onCancelEdit?.();
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    };

    return (
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 2 }}>
            {(replyTo || editingMessage) && (
                <Paper
                    elevation={0}
                    sx={{
                        mb: 1.5,
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                    }}
                >
                    <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {editingMessage ? 'Editing message' : `Replying to ${replyTo?.senderName ?? replyTo?.senderId}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {editingMessage?.content ?? replyTo?.content}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        aria-label="Cancel context"
                        onClick={() => {
                            onCancelReply?.();
                            onCancelEdit?.();
                            if (editingMessage) {
                                setMessage('');
                            }
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Paper>
            )}

            <OutlinedInput
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                multiline
                minRows={2}
                maxRows={6}
                disabled={disabled || isSending}
                sx={{
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none',
                    },
                    bgcolor: 'background.paper',
                }}
                endAdornment={(
                    <InputAdornment position="end">
                        {allowAttachments && (
                            <Tooltip title="Attach files">
                                <span>
                                    <IconButton
                                        component="label"
                                        disabled={disabled || isSending}
                                        aria-label="Attach files"
                                    >
                                        <AttachFileIcon />
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            hidden
                                            multiple
                                            onChange={handleAttachmentChange}
                                        />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title="Send">
                            <span>
                                <IconButton
                                    color="primary"
                                    disabled={disabled || isSending || !message.trim()}
                                    aria-label="Send message"
                                    onClick={() => void handleSend()}
                                >
                                    <SendIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </InputAdornment>
                )}
            />

            {previews.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                    {previews.map((preview) => (
                        <Chip
                            key={preview.id}
                            label={`${preview.file.name} • ${formatFileSize(preview.file.size)}`}
                            onDelete={() => handleRemovePreview(preview.id)}
                        />
                    ))}
                </Stack>
            )}

            {(previews.length > 0 || replyTo || editingMessage) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<SendIcon />}
                        disabled={disabled || isSending || !message.trim()}
                        onClick={() => void handleSend()}
                    >
                        {editingMessage ? 'Save changes' : 'Send'}
                    </Button>
                </Box>
            )}
        </Paper>
    );
}
