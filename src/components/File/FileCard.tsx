import * as React from 'react';
import {
    Avatar, Box, Card, CardContent, Chip, IconButton, Stack, Tooltip, Typography,
    type ChipProps,
} from '@mui/material';
import {
    Delete as DeleteIcon, Download as DownloadIcon,
    InsertDriveFile as GenericFileIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import type { FileAttachment } from '../../types/file';

type FileCardClickEvent = React.SyntheticEvent<HTMLDivElement>;

/**
 * Action button configuration for FileCard
 */
export interface FileCardAction {
    /** Unique key for the action */
    key: string;
    /** Icon to display */
    icon: React.ReactNode;
    /** Tooltip text */
    tooltip: string;
    /** Click handler */
    onClick: (file?: FileAttachment) => void;
    /** Whether the action is disabled */
    disabled?: boolean;
    /** Color for the icon button */
    color?: 'inherit' | 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

/**
 * Visual variant for the FileCard
 * - 'card': Default with Card wrapper and borders
 * - 'box': No borders, just content in a Box
 */
export type FileCardVariant = 'card' | 'box';

export interface FileCardProps {
    file?: FileAttachment;
    title?: string;
    sizeLabel?: string;
    metaLabel?: string;
    versionLabel?: string;
    statusChipLabel?: string;
    statusChipColor?: ChipProps['color'];
    statusChipVariant?: ChipProps['variant'];
    /** Show draft status chip when true */
    isDraft?: boolean;
    selected?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    /** Visual variant: 'card' (default) or 'box' (no borders) */
    variant?: FileCardVariant;
    onClick?: (event: FileCardClickEvent) => void;
    onDownload?: (file?: FileAttachment) => void;
    onDelete?: (file?: FileAttachment) => void;
    showDownloadButton?: boolean;
    showDeleteButton?: boolean;
    /** Additional action buttons to render */
    additionalActions?: FileCardAction[];
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
    statusChipLabel,
    statusChipColor,
    statusChipVariant,
    isDraft,
    selected,
    disabled,
    icon,
    variant = 'card',
    onClick,
    onDownload,
    onDelete,
    showDownloadButton = true,
    showDeleteButton = true,
    additionalActions,
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

    const versionChip = versionLabel ? (
        <Chip
            size="small"
            color={selected ? 'primary' : 'default'}
            label={versionLabel}
            sx={{ fontWeight: 600 }}
        />
    ) : null;

    const draftChip = isDraft ? (
        <Chip
            size="small"
            label="Draft"
            color="warning"
            variant="outlined"
        />
    ) : null;

    const statusChip = statusChipLabel ? (
        <Chip
            size="small"
            label={statusChipLabel}
            color={statusChipColor ?? 'default'}
            variant={statusChipVariant ?? 'outlined'}
        />
    ) : null;

    const hasInlineChips = Boolean(statusChip) || Boolean(versionChip) || Boolean(draftChip);

    const content = (
        <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
                variant="rounded"
                sx={{
                    bgcolor: 'transparent',
                    color: isPdfFile(file) ? 'error.main' : 'text.secondary',
                    width: 40,
                    height: 40,
                }}
            >
                {iconNode}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography variant="subtitle2" noWrap sx={{ flexShrink: 0 }}>{effectiveTitle}</Typography>
                    {hasInlineChips && (
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                            {versionChip}
                            {draftChip}
                            {statusChip}
                        </Stack>
                    )}
                </Stack>
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
                {additionalActions?.map((action) => (
                    <Tooltip key={action.key} title={action.disabled ? `${action.tooltip} (unavailable)` : action.tooltip}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (!action.disabled) {
                                        action.onClick(file);
                                    }
                                }}
                                disabled={action.disabled}
                                aria-label={action.tooltip}
                                color={action.color}
                            >
                                {action.icon}
                            </IconButton>
                        </span>
                    </Tooltip>
                ))}
                {showDeleteButton && (
                    <Tooltip title={deleteDisabled ? 'Delete unavailable' : 'Delete file'}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={handleDelete}
                                disabled={deleteDisabled}
                                aria-label="Delete file"
                                color="error"
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Stack>
        </Stack>
    );

    // Box variant - no borders, minimal styling
    if (variant === 'box') {
        return (
            <Box
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                sx={{
                    py: 1.5,
                    px: 2,
                    borderRadius: 1,
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    cursor: interactive ? 'pointer' : 'default',
                    transition: 'background-color 120ms ease',
                    '&:hover': interactive ? { bgcolor: 'action.hover' } : undefined,
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                {content}
            </Box>
        );
    }

    // Card variant - default with borders
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
                transition: 'border-color 120ms ease',
                '&:hover': interactive ? { borderColor: 'primary.main' } : undefined,
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                {content}
            </CardContent>
        </Card>
    );
}
