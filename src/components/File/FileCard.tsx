import * as React from 'react';
import {
    Avatar, Box, Card, CardContent, Chip, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import {
    Delete as DeleteIcon, Download as DownloadIcon,
    InsertDriveFile as GenericFileIcon, PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import type { FileAttachment } from '../../types/file';

type FileCardClickEvent = React.SyntheticEvent<HTMLDivElement>;

export interface FileCardProps {
    file?: FileAttachment;
    title?: string;
    sizeLabel?: string;
    metaLabel?: string;
    versionLabel?: string;
    selected?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    onClick?: (event: FileCardClickEvent) => void;
    onDownload?: (file?: FileAttachment) => void;
    onDelete?: (file?: FileAttachment) => void;
    showDownloadButton?: boolean;
    showDeleteButton?: boolean;
}

const isPdfFile = (file?: FileAttachment): boolean => {
    if (!file) {
        return false;
    }
    const source = `${file.mimeType ?? ''} ${file.type ?? ''} ${file.name ?? ''}`.toLowerCase();
    return source.includes('pdf');
};

const openInNewTab = (url?: string) => {
    if (!url) {
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Compact card used for rendering thesis chapter versions and attachments.
 */
export default function FileCard({
    file,
    title,
    sizeLabel,
    metaLabel,
    versionLabel,
    selected,
    disabled,
    icon,
    onClick,
    onDownload,
    onDelete,
    showDownloadButton = true,
    showDeleteButton = true,
}: FileCardProps) {
    const interactive = Boolean(onClick) && !disabled;
    const effectiveTitle = title ?? file?.name ?? 'Untitled file';
    const iconNode = icon ?? (
        isPdfFile(file)
            ? <PdfIcon fontSize="small" color="error" />
            : <GenericFileIcon fontSize="small" color="action" />
    );

    const handleClick = React.useCallback((event: FileCardClickEvent) => {
        if (!interactive) {
            return;
        }
        onClick?.(event);
    }, [interactive, onClick]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!interactive) {
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.(event as unknown as FileCardClickEvent);
        }
    }, [interactive, onClick]);

    const handleDownload = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled) {
            return;
        }
        if (onDownload) {
            onDownload(file);
            return;
        }
        openInNewTab(file?.url);
    }, [disabled, file, onDownload]);

    const handleDelete = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled || !onDelete) {
            return;
        }
        onDelete(file);
    }, [disabled, file, onDelete]);

    const downloadDisabled = disabled || (!onDownload && !file?.url);
    const deleteDisabled = disabled || !onDelete;

    return (
        <Card
            variant="outlined"
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            sx={{
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'primary.50' : 'background.paper',
                cursor: interactive ? 'pointer' : 'default',
                transition: 'border-color 120ms ease, transform 120ms ease',
                '&:hover': interactive ? { borderColor: 'primary.main', transform: 'translateY(-1px)' } : undefined,
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <CardContent sx={{ py: 1.5, px: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                        variant="rounded"
                        sx={{
                            bgcolor: isPdfFile(file) ? 'error.light' : 'action.hover',
                            color: isPdfFile(file) ? 'error.main' : 'text.secondary',
                            width: 40,
                            height: 40,
                        }}
                    >
                        {iconNode}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>{effectiveTitle}</Typography>
                        {sizeLabel && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                                {sizeLabel}
                            </Typography>
                        )}
                        {metaLabel && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {metaLabel}
                            </Typography>
                        )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        {versionLabel && (
                            <Chip
                                size="small"
                                color={selected ? 'primary' : 'default'}
                                label={versionLabel}
                                sx={{ fontWeight: 600 }}
                            />
                        )}
                        {showDownloadButton && (
                            <Tooltip title={downloadDisabled ? 'Download not available' : 'Download file'}>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={handleDownload}
                                        disabled={downloadDisabled}
                                        aria-label="Download file"
                                    >
                                        <DownloadIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        {showDeleteButton && (
                            <Tooltip title={deleteDisabled ? 'Delete unavailable' : 'Delete file'}>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={handleDelete}
                                        disabled={deleteDisabled}
                                        aria-label="Delete file"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
