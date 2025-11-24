import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Skeleton,
    Stack,
    TextField,
    Typography,
    Grid,
    Tooltip,
} from '@mui/material';
import {
    Upload as UploadIcon,
    ArrowOutward as ArrowOutwardIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';
import type { ThesisWorkspaceProps, WorkspaceCommentPayload } from './types';
import type { ThesisChapter } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import { ConversationPanel } from '../Conversation';
import type { ConversationParticipant } from '../Conversation';
import { thesisCommentToChatMessage } from '../../utils/chatUtils';
import { formatFileSize, getChapterSubmissions } from '../../utils/fileUtils';
import { getFilesByIds } from '../../utils/firebase/firestore/file';
import { FileCard } from '../File';

const statusMeta: Record<string, { label: string; chipColor: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
    approved: { label: 'Approved', chipColor: 'success' },
    under_review: { label: 'Under review', chipColor: 'info' },
    revision_required: { label: 'Needs revision', chipColor: 'warning' },
    not_submitted: { label: 'Not submitted', chipColor: 'default' },
};

const formatChapterLabel = (chapter: ThesisChapter) => `Chapter ${chapter.id}`;

const computeProgress = (chapters: ThesisChapter[] = []): number => {
    if (!chapters.length) {
        return 0;
    }
    const approved = chapters.filter((chapter) => chapter.status === 'approved').length;
    return Math.round((approved / chapters.length) * 100);
};

interface VersionOption {
    id: string;
    label: string;
    versionIndex: number;
    file?: FileAttachment;
}

type ChapterVersionMap = Record<number, VersionOption[]>;

const buildVersionOptions = (chapter?: ThesisChapter, files?: FileAttachment[]): VersionOption[] => {
    if (!chapter) {
        return [];
    }

    const submissions = chapter.submissions ?? [];
    const fileMap = new Map((files ?? []).map((file) => [file.id ?? '', file]));

    if (submissions.length > 0) {
        return submissions.map((submissionId, index) => {
            const file = submissionId ? fileMap.get(submissionId) : undefined;
            return {
                id: submissionId || file?.id || `version-${index + 1}`,
                label: file?.name ?? `Version ${index + 1}`,
                versionIndex: index,
                file,
            } satisfies VersionOption;
        });
    }

    if (files && files.length > 0) {
        return files.map((file, index) => ({
            id: file.id ?? `version-${index + 1}`,
            label: file.name ?? `Version ${index + 1}`,
            versionIndex: index,
            file,
        } satisfies VersionOption));
    }

    return [];
};

const formatDateTimeLabel = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const candidate = new Date(value);
    if (Number.isNaN(candidate.getTime())) {
        return value;
    }
    const datePart = candidate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const timePart = candidate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
};

const buildFileSizeLabel = (file?: FileAttachment) => {
    if (!file?.size) {
        return undefined;
    }
    const numericSize = Number(file.size);
    if (!Number.isNaN(numericSize) && Number.isFinite(numericSize) && numericSize > 0) {
        return formatFileSize(numericSize);
    }
    return file.size;
};

const resolveParticipantName = (
    uid: string | undefined,
    participants?: Record<string, ConversationParticipant>
) => {
    if (!uid) {
        return undefined;
    }
    return participants?.[uid]?.displayName
        ?? participants?.[uid]?.roleLabel
        ?? uid;
};

const buildSubmissionMeta = (
    file?: FileAttachment,
    participants?: Record<string, ConversationParticipant>
) => {
    if (!file) {
        return undefined;
    }
    const submittedBy = resolveParticipantName(file.author, participants);
    const submittedOn = formatDateTimeLabel(file.uploadDate);
    if (submittedBy && submittedOn) {
        return `Submitted by ${submittedBy} on ${submittedOn}`;
    }
    if (submittedBy) {
        return `Submitted by ${submittedBy}`;
    }
    if (submittedOn) {
        return `Submitted on ${submittedOn}`;
    }
    return undefined;
};

const fetchChapterFiles = async (thesisId: string, chapter: ThesisChapter): Promise<FileAttachment[]> => {
    const submissionIds = (chapter.submissions ?? [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id): id is string => id.length > 0);

    if (submissionIds.length > 0) {
        try {
            const files = await getFilesByIds(submissionIds);
            if (files.length > 0) {
                const fileMap = new Map((files ?? []).map((file) => [file.id ?? '', file]));
                const ordered = submissionIds
                    .map((id) => fileMap.get(id))
                    .filter((file): file is FileAttachment => Boolean(file));
                if (ordered.length > 0) {
                    return ordered;
                }
            }
        } catch (error) {
            console.error('Failed to load submission files by id:', error);
        }
    }

    return getChapterSubmissions(chapter.id, thesisId);
};

const WorkspaceFilters = ({ filters }: Pick<ThesisWorkspaceProps, 'filters'>) => {
    if (!filters || filters.length === 0) {
        return null;
    }

    return (
        <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 3 }}
        >
            {filters.map((filter) => (
                <TextField
                    key={filter.id}
                    select
                    fullWidth
                    size="small"
                    label={filter.label}
                    value={filter.value ?? ''}
                    placeholder={filter.placeholder}
                    helperText={filter.helperText}
                    disabled={filter.disabled || filter.loading}
                    required={filter.required}
                    onChange={(event) => filter.onChange(event.target.value)}
                >
                    {filter.options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Stack spacing={0.5}>
                                <Typography variant="body2">{option.label}</Typography>
                                {option.description && (
                                    <Typography variant="caption" color="text.secondary">
                                        {option.description}
                                    </Typography>
                                )}
                            </Stack>
                        </MenuItem>
                    ))}
                </TextField>
            ))}
        </Stack>
    );
};

const ChapterRail = ({
    chapters,
    selectedChapterId,
    selectedVersionIndex,
    onSelectChapter,
    onSelectVersion,
    onUploadChapter,
    uploadingChapterId,
    enableUploads,
    versionOptionsByChapter,
    participants,
}: {
    chapters: ThesisChapter[];
    selectedChapterId: number | null;
    selectedVersionIndex: number | null;
    onSelectChapter: (chapterId: number) => void;
    onSelectVersion: (versionIndex: number) => void;
    onUploadChapter?: (chapterId: number, file: File) => void;
    uploadingChapterId?: number | null;
    enableUploads?: boolean;
    versionOptionsByChapter: ChapterVersionMap;
    participants?: Record<string, ConversationParticipant>;
}) => {
    const handleUploadChange = React.useCallback((chapterId: number, event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        onUploadChapter?.(chapterId, file);
        event.target.value = '';
    }, [onUploadChapter]);

    return (
        <Stack spacing={1.5}>
            {chapters.map((chapter) => {
                const isActive = chapter.id === selectedChapterId;
                const meta = statusMeta[chapter.status] ?? statusMeta.not_submitted;
                const versions = versionOptionsByChapter[chapter.id] ?? buildVersionOptions(chapter);
                const isUploading = uploadingChapterId === chapter.id;

                return (
                    <Card
                        key={chapter.id}
                        variant={isActive ? 'outlined' : 'elevation'}
                        sx={{
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive ? 'primary.main' : 'divider',
                            cursor: 'pointer',
                            transition: 'border-color 120ms ease, transform 120ms ease',
                            '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                        }}
                        onClick={() => onSelectChapter(chapter.id)}
                    >
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {formatChapterLabel(chapter)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {chapter.stage ?? meta.label}
                                    </Typography>
                                </Box>
                                <Stack spacing={1} alignItems="flex-end">
                                    <Chip label={meta.label} color={meta.chipColor} size="small" variant="outlined" />
                                    <Tooltip title="Open chapter details">
                                        <span>
                                            <IconButton size="small" aria-label="Open chapter details">
                                                <ArrowOutwardIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {isActive && (
                                <Stack spacing={1.25} sx={{ mt: 2 }}>
                                    {versions.length === 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            {enableUploads
                                                ? 'No versions yet. Upload a file to start the conversation.'
                                                : 'No versions have been uploaded for this chapter.'}
                                        </Typography>
                                    )}
                                    {versions.map((version) => {
                                        const isVersionActive = version.versionIndex === selectedVersionIndex;
                                        return (
                                            <FileCard
                                                key={version.id}
                                                file={version.file}
                                                title={version.label}
                                                sizeLabel={buildFileSizeLabel(version.file)}
                                                metaLabel={buildSubmissionMeta(version.file, participants)}
                                                versionLabel={`v${version.versionIndex + 1}`}
                                                selected={isVersionActive}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onSelectVersion(version.versionIndex);
                                                }}
                                                showDeleteButton={false}
                                            />
                                        );
                                    })}

                                    {enableUploads && onUploadChapter && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={isUploading ? <CircularProgress size={16} /> : <UploadIcon fontSize="small" />}
                                            disabled={isUploading}
                                            component="label"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            {isUploading ? 'Uploading…' : 'Upload version'}
                                            <input
                                                type="file"
                                                hidden
                                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                onChange={(event) => handleUploadChange(chapter.id, event)}
                                            />
                                        </Button>
                                    )}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
};

const VersionRail = ({
    versions,
    selectedVersionIndex,
    onSelect,
    loading,
    error,
    enableUploads,
    participants,
}: {
    versions: VersionOption[];
    selectedVersionIndex: number | null;
    onSelect: (version: number) => void;
    loading?: boolean;
    error?: string | null;
    enableUploads?: boolean;
    participants?: Record<string, ConversationParticipant>;
}) => {
    if (loading) {
        return (
            <Stack spacing={1}>
                {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={96} />
                ))}
            </Stack>
        );
    }

    if (error) {
        return (
            <Alert severity="error">{error}</Alert>
        );
    }

    if (versions.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="body2" color="text.secondary">
                        {enableUploads
                            ? 'No uploads yet. Submit a document to start tracking versions.'
                            : 'No uploaded versions yet.'}
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1}>
            {versions.map((version) => {
                const isActive = version.versionIndex === selectedVersionIndex;
                return (
                    <FileCard
                        key={version.id}
                        file={version.file}
                        title={version.label}
                        sizeLabel={buildFileSizeLabel(version.file)}
                        metaLabel={buildSubmissionMeta(version.file, participants)}
                        versionLabel={`v${version.versionIndex + 1}`}
                        selected={isActive}
                        onClick={() => onSelect(version.versionIndex)}
                        showDeleteButton={false}
                    />
                );
            })}
        </Stack>
    );
};

export default function ThesisWorkspace({
    thesisId,
    thesis,
    participants,
    currentUserId,
    filters,
    isLoading,
    allowCommenting = true,
    emptyStateMessage = 'Select a group to inspect its thesis.',
    conversationHeight = 640,
    onCreateComment,
    onEditComment,
    onUploadChapter,
}: ThesisWorkspaceProps) {
    const [activeChapterId, setActiveChapterId] = React.useState<number | null>(null);
    const [activeVersionIndex, setActiveVersionIndex] = React.useState<number | null>(null);
    const [uploadingChapterId, setUploadingChapterId] = React.useState<number | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [chapterFiles, setChapterFiles] = React.useState<Record<number, FileAttachment[]>>({});
    const [isFetchingChapterFiles, setIsFetchingChapterFiles] = React.useState(false);
    const [chapterFilesError, setChapterFilesError] = React.useState<string | null>(null);

    const handleChapterSelect = React.useCallback((chapterId: number) => {
        setActiveChapterId(chapterId);
        setActiveVersionIndex(null);
        setChapterFilesError(null);
    }, []);

    const handleVersionSelect = React.useCallback((versionIndex: number) => {
        setActiveVersionIndex((previous) => (previous === versionIndex ? null : versionIndex));
    }, []);

    const handleChapterUpload = React.useCallback((chapterId: number, file: File) => {
        if (!onUploadChapter || !thesisId) {
            return;
        }
        setUploadError(null);
        setUploadingChapterId(chapterId);
        setActiveChapterId(chapterId);
        setActiveVersionIndex(null);

        void (async () => {
            try {
                await onUploadChapter({ thesisId, chapterId, file });
                setChapterFiles((current) => {
                    const next = { ...current };
                    delete next[chapterId];
                    return next;
                });
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Failed to upload chapter version.';
                setUploadError(message);
            } finally {
                setUploadingChapterId((current) => (current === chapterId ? null : current));
            }
        })();
    }, [onUploadChapter, thesisId]);

    React.useEffect(() => {
        if (!thesis?.chapters?.length) {
            setActiveChapterId(null);
            setActiveVersionIndex(null);
            return;
        }

        setActiveChapterId((previous) => {
            const firstChapterId = thesis.chapters[0].id;
            if (previous === null) {
                setActiveVersionIndex(null);
                return firstChapterId;
            }
            const stillExists = thesis.chapters.some((chapter) => chapter.id === previous);
            if (!stillExists) {
                setActiveVersionIndex(null);
                return firstChapterId;
            }
            return previous;
        });
    }, [thesis?.chapters]);

    const activeChapter = React.useMemo(() => thesis?.chapters?.find((chapter) => chapter.id === activeChapterId), [
        thesis?.chapters,
        activeChapterId,
    ]);
    const activeChapterFiles = activeChapter ? chapterFiles[activeChapter.id] : undefined;

    React.useEffect(() => {
        if (!thesisId || !activeChapter) {
            setIsFetchingChapterFiles(false);
            setChapterFilesError(null);
            return;
        }

        const submissionCount = activeChapter.submissions?.length ?? 0;
        if (submissionCount === 0) {
            setIsFetchingChapterFiles(false);
            setChapterFilesError(null);
            setChapterFiles((prev) => {
                if (!prev[activeChapter.id]) {
                    return prev;
                }
                const next = { ...prev };
                delete next[activeChapter.id];
                return next;
            });
            return;
        }

        if (activeChapterFiles && activeChapterFiles.length >= submissionCount && !chapterFilesError) {
            return;
        }

        let cancelled = false;
        setIsFetchingChapterFiles(true);
        setChapterFilesError(null);

        void (async () => {
            try {
                const files = await fetchChapterFiles(thesisId, activeChapter);
                if (cancelled) {
                    return;
                }
                setChapterFiles((prev) => ({ ...prev, [activeChapter.id]: files }));
            } catch (error) {
                if (cancelled) {
                    return;
                }
                const message = error instanceof Error ? error.message : 'Unable to load uploaded files.';
                setChapterFilesError(message);
            } finally {
                if (!cancelled) {
                    setIsFetchingChapterFiles(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [thesisId, activeChapter?.id, activeChapter?.submissions?.length, activeChapterFiles, chapterFilesError]);

    const chapterMessages = React.useMemo(() => {
        if (!activeChapter || activeVersionIndex === null) {
            return [];
        }
        const source = (activeChapter.comments ?? []).filter((comment) => comment.version === activeVersionIndex);
        return source.map((comment, index) => thesisCommentToChatMessage(comment, index));
    }, [activeChapter, activeVersionIndex]);

    const versionOptionsByChapter = React.useMemo<ChapterVersionMap>(() => {
        const map: ChapterVersionMap = {};
        thesis?.chapters?.forEach((chapter) => {
            map[chapter.id] = buildVersionOptions(chapter, chapterFiles[chapter.id]);
        });
        return map;
    }, [thesis?.chapters, chapterFiles]);

    const versionOptions = activeChapterId ? (versionOptionsByChapter[activeChapterId] ?? []) : [];
    const selectedVersionLabel = React.useMemo(() => {
        if (activeVersionIndex === null) {
            return null;
        }
        return versionOptions.find((option) => option.versionIndex === activeVersionIndex)?.label
            ?? `Version ${activeVersionIndex + 1}`;
    }, [versionOptions, activeVersionIndex]);
    const hasChapterSelection = Boolean(activeChapter);
    const hasVersionSelection = typeof activeVersionIndex === 'number';
    const hasAvailableVersions = versionOptions.length > 0;
    const enableUploads = Boolean(onUploadChapter && thesisId);
    const composerDisabled = !hasChapterSelection
        || !hasVersionSelection
        || !hasAvailableVersions
        || !allowCommenting
        || !onCreateComment
        || !thesisId;

    React.useEffect(() => {
        if (!hasAvailableVersions && activeVersionIndex !== null) {
            setActiveVersionIndex(null);
        }
    }, [hasAvailableVersions, activeVersionIndex]);

    const conversationHeaderStatus = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to view its versions.';
        }
        if (!hasAvailableVersions) {
            return `${formatChapterLabel(activeChapter)} · No uploads yet`;
        }
        if (!hasVersionSelection || activeVersionIndex === null) {
            return `${formatChapterLabel(activeChapter)} · Select a version to continue`;
        }
        return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}`;
    }, [activeChapter, hasAvailableVersions, hasVersionSelection, selectedVersionLabel]);

    const conversationEmptyState = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to view its conversation.';
        }
        if (!hasAvailableVersions) {
            return enableUploads
                ? 'Upload a version of this chapter to start a discussion.'
                : 'Waiting for a submission to unlock this conversation.';
        }
        if (!hasVersionSelection) {
            return 'Choose a specific version to review its discussion.';
        }
        return 'No discussion yet for this version.';
    }, [activeChapter, hasAvailableVersions, hasVersionSelection, enableUploads]);

    const composerPlaceholder = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to start a conversation.';
        }
        if (!hasAvailableVersions) {
            return enableUploads
                ? 'Upload a chapter version to start a conversation.'
                : 'Waiting for a submission to start a conversation.';
        }
        if (!hasVersionSelection || activeVersionIndex === null) {
            return 'Select a version to start a conversation.';
        }
        return `Discuss ${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}…`;
    }, [activeChapter, hasAvailableVersions, hasVersionSelection, selectedVersionLabel, activeVersionIndex, enableUploads]);

    const handleCreateMessage = React.useCallback(async (payload: { content: string; files: File[]; replyToId?: string; }) => {
        if (!allowCommenting || !onCreateComment || !thesisId || !activeChapter || activeVersionIndex === null) {
            return;
        }
        const request: WorkspaceCommentPayload = {
            thesisId,
            chapterId: activeChapter.id,
            versionIndex: activeVersionIndex,
            content: payload.content,
            files: payload.files,
            replyToId: payload.replyToId,
        };
        await onCreateComment(request);
    }, [allowCommenting, onCreateComment, thesisId, activeChapter, activeVersionIndex]);

    const handleEditMessage = React.useCallback(async (payload: {
        content: string;
        files: File[];
        replyToId?: string;
        messageId: string;
    }) => {
        if (!onEditComment || !thesisId || !activeChapter || activeVersionIndex === null) {
            return;
        }
        await onEditComment({
            thesisId,
            chapterId: activeChapter.id,
            versionIndex: activeVersionIndex,
            content: payload.content,
            files: payload.files,
            replyToId: payload.replyToId,
            commentId: payload.messageId,
        });
    }, [onEditComment, thesisId, activeChapter, activeVersionIndex]);

    const uploadErrorBanner = uploadError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
            {uploadError}
        </Alert>
    ) : null;

    if (isLoading) {
        return (
            <Box>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Stack spacing={2}>
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} variant="rounded" height={140} />
                            ))}
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Skeleton variant="rounded" height={conversationHeight} />
                    </Grid>
                </Grid>
            </Box>
        );
    }

    if (!thesis || !thesis.chapters?.length) {
        return (
            <Box>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            {emptyStateMessage}
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    const progress = computeProgress(thesis.chapters);

    return (
        <Box>
            <WorkspaceFilters filters={filters} />
            {uploadErrorBanner}
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                    <Stack spacing={3}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <IconButton color="primary" size="large">
                                        <GroupsIcon />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6">{thesis.title}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {thesis.overallStatus || 'In progress'}
                                        </Typography>
                                        {thesis.groupId && (
                                            <Chip label={thesis.groupId} size="small" sx={{ mt: 1 }} />
                                        )}
                                    </Box>
                                </Stack>
                                <Box sx={{ mt: 3 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Overall progress</Typography>
                                        <Typography variant="subtitle2">{progress}%</Typography>
                                    </Stack>
                                    <LinearProgress
                                        variant="determinate"
                                        value={progress}
                                        sx={{ borderRadius: 5, height: 8 }}
                                    />
                                </Box>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <Typography variant="subtitle2" sx={{ mb: 2 }}>Chapters</Typography>
                                <ChapterRail
                                    chapters={thesis.chapters}
                                    selectedChapterId={activeChapterId}
                                    selectedVersionIndex={activeVersionIndex}
                                    onSelectChapter={handleChapterSelect}
                                    onSelectVersion={handleVersionSelect}
                                    onUploadChapter={handleChapterUpload}
                                    uploadingChapterId={uploadingChapterId}
                                    enableUploads={enableUploads}
                                    versionOptionsByChapter={versionOptionsByChapter}
                                    participants={participants}
                                />
                            </CardContent>
                        </Card>

                        {/* <Card>
                            <CardContent>
                                <Typography variant="subtitle2" sx={{ mb: 2 }}>Versions</Typography>
                                {activeChapter ? (
                                    <VersionRail
                                        versions={versionOptions}
                                        selectedVersionIndex={activeVersionIndex}
                                        onSelect={handleVersionSelect}
                                        loading={isFetchingChapterFiles}
                                        error={chapterFilesError}
                                        enableUploads={enableUploads}
                                        participants={participants}
                                    />
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        Select a chapter to view uploaded versions.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card> */}

                        {participants && Object.keys(participants).length > 0 && (
                            <Card>
                                <CardContent>
                                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        Team roster
                                    </Typography>
                                    <List dense>
                                        {Object.values(participants).map((participant) => (
                                            <ListItem key={participant.uid} disableGutters>
                                                <ListItemText
                                                    primary={participant.displayName}
                                                    secondary={participant.roleLabel}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </CardContent>
                            </Card>
                        )}
                    </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="h6">Conversation</Typography>
                                <Typography variant="subtitle2" color="text.secondary">
                                    {conversationHeaderStatus}
                                </Typography>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <ConversationPanel
                                messages={chapterMessages}
                                currentUserId={currentUserId}
                                participants={participants}
                                height={conversationHeight}
                                emptyStateMessage={conversationEmptyState}
                                composerPlaceholder={composerPlaceholder}
                                disableComposer={composerDisabled}
                                allowAttachments
                                onSendMessage={handleCreateMessage}
                                onEditMessage={onEditComment ? handleEditMessage : undefined}
                                composerMetadata={{ chapterId: activeChapter?.id, versionIndex: activeVersionIndex ?? undefined, thesisId }}
                            />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
