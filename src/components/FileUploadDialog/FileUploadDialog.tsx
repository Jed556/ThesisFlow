import * as React from 'react';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    LinearProgress, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { CloudUpload, Delete as DeleteIcon } from '@mui/icons-material';
import type { ChapterStage } from '../../types/chapter';
import { CHAPTER_STAGE_OPTIONS } from '../../types/chapter';
import type { ChapterPathContext } from '../../utils/chapterPaths';
import {
    uploadChapterFiles, type ChapterFileUploadResult, type UploadChapterFilesOptions,
} from '../../utils/firebase/storage/chapterFiles';

interface FileUploadDialogProps {
    open: boolean;
    onClose: () => void;
    context: Omit<ChapterPathContext, 'stage'>;
    authorUid: string;
    allowedStages?: ChapterStage[];
    fixedStage?: ChapterStage;
    validator?: UploadChapterFilesOptions['validator'];
    accept?: string;
    allowMultiple?: boolean;
    category?: UploadChapterFilesOptions['category'];
    onCompleted?: (results: ChapterFileUploadResult[]) => void;
    onError?: (error: Error) => void;
}

type FileUploadItem = {
    id: string;
    file: File;
    progress: number;
};

const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.txt';

const getStageOptions = (fixedStage?: ChapterStage, allowedStages?: ChapterStage[]): ChapterStage[] => {
    if (fixedStage) {
        return [fixedStage];
    }

    if (allowedStages && allowedStages.length > 0) {
        return allowedStages;
    }

    return [...CHAPTER_STAGE_OPTIONS];
};

const createFileId = (file: File) => `${file.name}-${file.lastModified}-${file.size}`;

export default function FileUploadDialog({
    open,
    onClose,
    context,
    authorUid,
    allowedStages,
    fixedStage,
    validator,
    accept = DEFAULT_ACCEPT,
    allowMultiple = true,
    category = 'submission',
    onCompleted,
    onError,
}: FileUploadDialogProps) {
    const stageOptions = React.useMemo(() => getStageOptions(fixedStage, allowedStages), [allowedStages, fixedStage]);
    const [stage, setStage] = React.useState<ChapterStage | undefined>(fixedStage ?? stageOptions[0]);
    const [files, setFiles] = React.useState<FileUploadItem[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [success, setSuccess] = React.useState(false);

    const resetState = React.useCallback(() => {
        setFiles([]);
        setError(null);
        setUploading(false);
        setSuccess(false);
        setStage(fixedStage ?? stageOptions[0]);
    }, [fixedStage, stageOptions]);

    React.useEffect(() => {
        if (!open) {
            resetState();
        }
    }, [open, resetState]);

    const handleClose = () => {
        if (uploading) {
            return;
        }
        onClose();
    };

    const upsertFiles = (selectedFiles: FileList | null) => {
        if (!selectedFiles) {
            return;
        }

        const incoming: FileUploadItem[] = [];
        for (const file of Array.from(selectedFiles)) {
            if (files.some((item) => item.file.name === file.name && item.file.size === file.size)) {
                continue;
            }
            incoming.push({ id: createFileId(file), file, progress: 0 });
        }

        if (!incoming.length) {
            setError('No new files were selected.');
            return;
        }

        setFiles((prev) => [...prev, ...incoming]);
        setError(null);
    };

    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        upsertFiles(event.target.files);
        event.target.value = '';
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        if (uploading) {
            return;
        }
        upsertFiles(event.dataTransfer.files);
    };

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    };

    const handleRemove = (fileId: string) => {
        if (uploading) {
            return;
        }
        setFiles((prev) => prev.filter((item) => item.id !== fileId));
    };

    const handleUpload = async () => {
        if (!files.length) {
            setError('Select at least one file to upload.');
            return;
        }

        if (!stage) {
            setError('Select a stage before uploading.');
            return;
        }

        if (!context.department || !context.course || !context.groupId) {
            setError('Missing department, course, or group information.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const results = await uploadChapterFiles({
                ...context,
                stage,
                files: files.map((item) => item.file),
                authorUid,
                category,
                validator,
                onProgress: (update) => {
                    setFiles((prev) => prev.map((item) => (
                        item.file.name === update.fileName
                            ? { ...item, progress: update.progress }
                            : item
                    )));
                },
            });

            setSuccess(true);
            onCompleted?.(results);
            setTimeout(() => {
                handleClose();
            }, 1000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload files. Please try again.';
            setError(message);
            onError?.(err instanceof Error ? err : new Error(message));
        } finally {
            setUploading(false);
        }
    };

    const stageDisabled = Boolean(fixedStage);
    const stageValue = fixedStage ?? stage;

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>Upload Chapter Files</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Files will be stored under {context.department}/{context.course}/{context.groupId} using the
                        selected stage and chapter.
                    </Typography>

                    <TextField
                        select
                        label="Stage"
                        value={stageValue ?? ''}
                        onChange={(event) => setStage(event.target.value as ChapterStage)}
                        disabled={stageDisabled}
                        helperText={stageDisabled ? 'Stage is fixed for this chapter.' : 'Select the stage for this upload.'}
                    >
                        {stageOptions.map((stageOption) => (
                            <MenuItem key={stageOption} value={stageOption}>
                                {stageOption}
                            </MenuItem>
                        ))}
                    </TextField>

                    {error && (
                        <Alert severity="error">{error}</Alert>
                    )}

                    {success && (
                        <Alert severity="success">Files uploaded successfully.</Alert>
                    )}

                    <Box
                        component="label"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        sx={{
                            border: 2,
                            borderStyle: 'dashed',
                            borderRadius: 2,
                            borderColor: 'divider',
                            p: 3,
                            textAlign: 'center',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            bgcolor: uploading ? 'action.disabledBackground' : 'background.paper',
                            transition: 'border-color 200ms ease',
                            '&:hover': {
                                borderColor: uploading ? 'divider' : 'primary.main',
                            },
                        }}
                    >
                        <input
                            type="file"
                            hidden
                            multiple={allowMultiple}
                            accept={accept}
                            disabled={uploading}
                            onChange={handleFileInputChange}
                        />
                        <CloudUpload color="primary" sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="body1">
                            {uploading ? 'Uploading files…' : 'Click to browse or drag files here'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Accepted types: {accept || DEFAULT_ACCEPT}
                        </Typography>
                    </Box>

                    <List dense>
                        {files.map((item) => (
                            <ListItem
                                key={item.id}
                                divider
                                secondaryAction={(
                                    <IconButton edge="end" onClick={() => handleRemove(item.id)} disabled={uploading}>
                                        <DeleteIcon />
                                    </IconButton>
                                )}
                            >
                                <ListItemText
                                    primary={item.file.name}
                                    secondary={`${(item.file.size / (1024 * 1024)).toFixed(2)} MB`}
                                />
                                {uploading && (
                                    <Box sx={{ width: '100%', ml: 2 }}>
                                        <LinearProgress value={item.progress} variant="determinate" />
                                    </Box>
                                )}
                            </ListItem>
                        ))}
                        {files.length === 0 && (
                            <ListItem>
                                <ListItemText primary="No files selected yet." />
                            </ListItem>
                        )}
                    </List>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={uploading}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={uploading || !files.length || !stageValue}
                >
                    {uploading ? 'Uploading…' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
