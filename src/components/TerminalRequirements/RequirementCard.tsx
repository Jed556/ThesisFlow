import * as React from 'react';
import {
    Box, Button, Card, CardContent, Chip, LinearProgress, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Download as DownloadIcon } from '@mui/icons-material';
import type { FileAttachment } from '../../types/file';
import type {
    TerminalRequirement,
    TerminalRequirementStatus,
} from '../../types/terminalRequirement';
import { FileCard } from '../File';

const STATUS_META: Record<TerminalRequirementStatus, { label: string; color: 'default' | 'success'; variant: 'filled' | 'outlined'; }> = {
    pending: { label: 'Pending', color: 'default', variant: 'outlined' },
    submitted: { label: 'Submitted', color: 'success', variant: 'filled' },
};

export interface TerminalRequirementCardProps {
    requirement: TerminalRequirement;
    files?: FileAttachment[];
    status: TerminalRequirementStatus;
    loading?: boolean;
    uploading?: boolean;
    disabled?: boolean;
    error?: string | null;
    onUpload?: (files: FileList) => void;
    onDeleteFile?: (file: FileAttachment) => void;
    onViewFile?: (file: FileAttachment) => void;
}

export function TerminalRequirementCard({
    requirement,
    files,
    status,
    loading,
    uploading,
    disabled,
    error,
    onUpload,
    onDeleteFile,
    onViewFile,
}: TerminalRequirementCardProps) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const handleUploadClick = React.useCallback(() => {
        if (disabled || uploading || loading || !onUpload) {
            return;
        }
        inputRef.current?.click();
    }, [disabled, uploading, loading, onUpload]);

    const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { files: fileList } = event.target;
        if (!fileList || fileList.length === 0 || !onUpload) {
            return;
        }
        onUpload(fileList);
        event.target.value = '';
    }, [onUpload]);

    const handleDeleteFile = React.useCallback((file: FileAttachment) => {
        if (!onDeleteFile) {
            return;
        }
        onDeleteFile(file);
    }, [onDeleteFile]);

    if (loading) {
        return (
            <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                    <Stack spacing={2}>
                        <Skeleton variant="text" width="70%" height={28} />
                        <Skeleton variant="rectangular" height={32} />
                        <Skeleton variant="rectangular" height={120} />
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    const statusMeta = STATUS_META[status];
    const hasFiles = Boolean(files && files.length > 0);
    const canUpload = Boolean(onUpload);
    const uploadDisabled = disabled || uploading || !canUpload;

    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>{requirement.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {requirement.description}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                        {requirement.optional && (
                            <Chip label="Optional" size="small" variant="outlined" color="default" />
                        )}
                        <Chip
                            label={statusMeta.label}
                            color={statusMeta.color}
                            variant={statusMeta.variant}
                            size="small"
                        />
                    </Stack>
                </Stack>

                {canUpload && (
                    <>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                            <Button
                                variant="contained"
                                startIcon={<CloudUploadIcon />}
                                onClick={handleUploadClick}
                                disabled={uploadDisabled}
                            >
                                {uploading ? 'Uploading…' : 'Upload files'}
                            </Button>
                            {uploading && (
                                <Box sx={{ flexGrow: 1, width: '100%' }}>
                                    <LinearProgress />
                                </Box>
                            )}
                        </Stack>

                        <input
                            type="file"
                            ref={inputRef}
                            hidden
                            multiple
                            onChange={handleFileChange}
                        />
                    </>
                )}

                {requirement.templateFile?.url && (
                    <Button
                        variant="text"
                        startIcon={<DownloadIcon />}
                        component="a"
                        href={requirement.templateFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        {requirement.templateFile?.name
                            ? `Download ${requirement.templateFile.name}`
                            : 'Download template'}
                    </Button>
                )}

                {error && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}

                <Box sx={{ flexGrow: 1 }}>
                    {hasFiles ? (
                        <Stack spacing={1}>
                            {files!.map((file) => (
                                <Tooltip
                                    key={file.id ?? file.url}
                                    title={onViewFile ? 'Click to view' : ''}
                                    placement="top"
                                    arrow
                                >
                                    <Box
                                        onClick={onViewFile ? () => onViewFile(file) : undefined}
                                        sx={{
                                            cursor: onViewFile ? 'pointer' : 'default',
                                            borderRadius: 1,
                                            transition: (theme) => theme.transitions.create(
                                                ['background-color', 'box-shadow'],
                                                { duration: theme.transitions.duration.short }
                                            ),
                                            ...(onViewFile && {
                                                '&:hover': {
                                                    bgcolor: 'action.hover',
                                                },
                                            }),
                                        }}
                                    >
                                        <FileCard
                                            file={file}
                                            showDeleteButton={Boolean(onDeleteFile)}
                                            onDelete={onDeleteFile ? () => handleDeleteFile(file) : undefined}
                                        />
                                    </Box>
                                </Tooltip>
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            No uploads yet. Submit your document to mark this requirement as submitted.
                        </Typography>
                    )}
                </Box>

                {requirement.instructions && (
                    <Typography variant="caption" color="text.secondary">
                        {requirement.instructions}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
