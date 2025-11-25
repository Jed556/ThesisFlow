import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Divider, Grid, IconButton, LinearProgress, List, ListItem, ListItemText, MenuItem,
    Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { Groups as GroupsIcon } from '@mui/icons-material';
import type {
    WorkspaceFilterConfig, WorkspaceCommentPayload, WorkspaceEditPayload,
    WorkspaceUploadPayload, ChapterVersionMap, WorkspaceChapterDecisionPayload, WorkspaceChapterDecision,
} from '../../types/workspace';
import type { MentorRole, ThesisChapter, ThesisData, ThesisStage } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import { ConversationPanel, type ConversationParticipant } from '../Conversation';
import { thesisCommentToChatMessage } from '../../utils/chatUtils';
import { getChapterSubmissions } from '../../utils/fileUtils';
import { getFilesByIds } from '../../utils/firebase/firestore/file';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { getAssignedMentorRoles, resolveChapterMentorApprovals } from '../../utils/mentorUtils';
import { extractSubmissionId, normalizeChapterSubmissions } from '../../utils/chapterSubmissionUtils';
import ChapterRail, { buildVersionOptions, formatChapterLabel } from './ChapterRail';

const computeProgress = (chapters: ThesisChapter[] = []): number => {
    if (!chapters.length) {
        return 0;
    }
    const approved = chapters.filter((chapter) => chapter.status === 'approved').length;
    return Math.round((approved / chapters.length) * 100);
};

const STAGE_METADATA: { value: ThesisStage; label: string; helper?: string }[] = [
    { value: 'Pre-Proposal', label: 'Pre-Proposal' },
    { value: 'Post-Proposal', label: 'Post-Proposal' },
    { value: 'Pre-Defense', label: 'Pre Defense' },
    { value: 'Post-Defense', label: 'Post Defense' },
];

const resolveChapterStage = (chapter: ThesisChapter): ThesisStage => chapter.stage ?? 'Pre-Proposal';

interface ThesisWorkspaceProps {
    thesisId?: string;
    thesis?: ThesisData | null;
    participants?: Record<string, ConversationParticipant>;
    currentUserId?: string;
    mentorRole?: MentorRole;
    filters?: WorkspaceFilterConfig[];
    isLoading?: boolean;
    allowCommenting?: boolean;
    emptyStateMessage?: string;
    conversationHeight?: number | string;
    onCreateComment?: (payload: WorkspaceCommentPayload) => Promise<void> | void;
    onEditComment?: (payload: WorkspaceEditPayload) => Promise<void> | void;
    onUploadChapter?: (payload: WorkspaceUploadPayload) => Promise<void> | void;
    onChapterDecision?: (payload: WorkspaceChapterDecisionPayload) => Promise<void> | void;
}

const fetchChapterFiles = async (thesisId: string, chapter: ThesisChapter): Promise<FileAttachment[]> => {
    const submissionIds = (chapter.submissions ?? [])
        .map((submission) => extractSubmissionId(submission))
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

const WorkspaceFilters = ({ filters }: { filters?: WorkspaceFilterConfig[]; }) => {
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

export default function ThesisWorkspace({
    thesisId, thesis, participants, currentUserId, mentorRole, filters, isLoading,
    allowCommenting = true,
    emptyStateMessage = 'Select a group to inspect its thesis.',
    conversationHeight = 640, onCreateComment, onEditComment, onUploadChapter, onChapterDecision
}: ThesisWorkspaceProps) {
    const [activeChapterId, setActiveChapterId] = React.useState<number | null>(null);
    const [activeVersionIndex, setActiveVersionIndex] = React.useState<number | null>(null);
    const [uploadingChapterId, setUploadingChapterId] = React.useState<number | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [chapterFiles, setChapterFiles] = React.useState<Record<number, FileAttachment[]>>({});
    const [isFetchingChapterFiles, setIsFetchingChapterFiles] = React.useState(false);
    const [chapterFilesError, setChapterFilesError] = React.useState<string | null>(null);
    const [pendingDecision, setPendingDecision] = React.useState<{
        chapterId: number;
        decision: WorkspaceChapterDecision;
    } | null>(null);
    const [decisionError, setDecisionError] = React.useState<string | null>(null);
    const [isSubmittingDecision, setIsSubmittingDecision] = React.useState(false);
    const [activeStage, setActiveStage] = React.useState<ThesisStage>(STAGE_METADATA[0].value);

    React.useEffect(() => {
        setChapterFiles({});
        setChapterFilesError(null);
        setIsFetchingChapterFiles(false);
    }, [thesisId]);

    const normalizedChapters = React.useMemo(() => {
        if (!thesis?.chapters) {
            return [] as ThesisChapter[];
        }
        return thesis.chapters.map((chapter) => ({
            ...chapter,
            submissions: normalizeChapterSubmissions(chapter.submissions),
            mentorApprovals: resolveChapterMentorApprovals(chapter, thesis),
        } satisfies ThesisChapter));
    }, [thesis]);

    const stageCompletionMap = React.useMemo(() => {
        return STAGE_METADATA.reduce<Record<ThesisStage, boolean>>((acc, stage) => {
            const stageChapters = normalizedChapters.filter((chapter) => resolveChapterStage(chapter) === stage.value);
            acc[stage.value] = stageChapters.length > 0
                && stageChapters.every((chapter) => chapter.status === 'approved');
            return acc;
        }, {} as Record<ThesisStage, boolean>);
    }, [normalizedChapters]);

    const stageLockMap = React.useMemo(() => STAGE_METADATA.reduce<Record<ThesisStage, boolean>>((acc, stage, index) => {
        if (index === 0) {
            acc[stage.value] = false;
        } else {
            const previousStage = STAGE_METADATA[index - 1].value;
            acc[stage.value] = !(stageCompletionMap[previousStage] ?? false);
        }
        return acc;
    }, {} as Record<ThesisStage, boolean>), [stageCompletionMap]);

    const stageChapters = React.useMemo(
        () => normalizedChapters.filter((chapter) => resolveChapterStage(chapter) === activeStage),
        [normalizedChapters, activeStage],
    );

    const mentorRoles = React.useMemo(() => getAssignedMentorRoles(thesis), [
        thesis?.adviser,
        thesis?.editor,
        thesis?.statistician,
    ]);

    const isStageLocked = stageLockMap[activeStage] ?? false;
    const previousStageMeta = React.useMemo(() => {
        const currentIndex = STAGE_METADATA.findIndex((stage) => stage.value === activeStage);
        if (currentIndex <= 0) {
            return null;
        }
        return STAGE_METADATA[currentIndex - 1];
    }, [activeStage]);
    const activeStageMeta = React.useMemo(
        () => STAGE_METADATA.find((stage) => stage.value === activeStage) ?? STAGE_METADATA[0],
        [activeStage],
    );
    const stageLockedDescription = React.useMemo(() => {
        if (!isStageLocked) {
            return undefined;
        }
        if (previousStageMeta) {
            return `Complete all ${previousStageMeta.label} chapters to unlock ${activeStageMeta.label}.`;
        }
        return 'This stage will unlock once prerequisites are satisfied.';
    }, [isStageLocked, previousStageMeta, activeStageMeta]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStage) => {
        setActiveStage(nextStage);
    }, []);

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
        if (isStageLocked || stageChapters.length === 0) {
            setActiveChapterId(null);
            setActiveVersionIndex(null);
            return;
        }

        setActiveChapterId((previous) => {
            const stillExists = typeof previous === 'number'
                ? stageChapters.some((chapter) => chapter.id === previous)
                : false;
            if (stillExists) {
                return previous;
            }
            const firstChapterId = stageChapters[0]?.id ?? null;
            if (firstChapterId !== previous) {
                setActiveVersionIndex(null);
            }
            return firstChapterId;
        });
    }, [isStageLocked, stageChapters]);

    const activeChapter = React.useMemo(() => normalizedChapters.find((chapter) => chapter.id === activeChapterId), [
        normalizedChapters,
        activeChapterId,
    ]);
    const activeChapterFiles = activeChapter ? chapterFiles[activeChapter.id] : undefined;
    const isConversationReadOnly = activeChapter?.status === 'approved';

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
        normalizedChapters.forEach((chapter) => {
            map[chapter.id] = buildVersionOptions(chapter, chapterFiles[chapter.id]);
        });
        return map;
    }, [normalizedChapters, chapterFiles]);

    const versionOptions = activeChapterId ? (versionOptionsByChapter[activeChapterId] ?? []) : [];
    const loadingChapterId = isFetchingChapterFiles ? activeChapter?.id ?? null : null;
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
    const enableUploads = Boolean(onUploadChapter && thesisId && !isStageLocked);
    const activeChapterUploadsLocked = Boolean(
        activeChapter && (activeChapter.status === 'approved' || activeChapter.status === 'under_review')
    );
    const canUploadActiveChapter = Boolean(enableUploads && activeChapter && !activeChapterUploadsLocked);
    const enableChapterDecisions = Boolean(onChapterDecision && thesisId && mentorRole);
    const composerDisabled = !hasChapterSelection
        || !hasVersionSelection
        || !hasAvailableVersions
        || !allowCommenting
        || !onCreateComment
        || !thesisId
        || isConversationReadOnly;

    const chapterDecisionHelperText = React.useMemo(() => {
        if (!enableChapterDecisions) {
            return undefined;
        }
        if (!activeChapter) {
            return 'Select a chapter to enable decisions.';
        }
        if (activeChapter.status === 'approved') {
            return 'This chapter is already approved.';
        }
        if (!hasAvailableVersions) {
            return 'Awaiting a submission before you can decide on this chapter.';
        }
        if (!hasVersionSelection) {
            return 'Select a version to approve or request revisions.';
        }
        return undefined;
    }, [enableChapterDecisions, activeChapter, hasAvailableVersions, hasVersionSelection]);

    const reviewActionsDisabled = Boolean(chapterDecisionHelperText)
        || Boolean(pendingDecision)
        || isSubmittingDecision;
    const reviewActionsProcessingChapterId = isSubmittingDecision ? pendingDecision?.chapterId ?? null : null;

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
        if (isConversationReadOnly && selectedVersionLabel) {
            return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel} · Approved (read-only)`;
        }
        return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}`;
    }, [
        activeChapter,
        hasAvailableVersions,
        hasVersionSelection,
        selectedVersionLabel,
        isConversationReadOnly,
        activeVersionIndex,
    ]);

    const conversationEmptyState = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to view its conversation.';
        }
        if (!hasAvailableVersions) {
            if (canUploadActiveChapter) {
                return 'Upload a version of this chapter to start a discussion.';
            }
            if (activeChapterUploadsLocked) {
                return activeChapter?.status === 'approved'
                    ? 'This chapter is approved. Uploads are disabled unless your adviser reopens it.'
                    : 'A submission is currently under review. Wait for feedback before uploading another version.';
            }
            return 'Waiting for a submission to unlock this conversation.';
        }
        if (!hasVersionSelection) {
            return 'Choose a specific version to review its discussion.';
        }
        if (isConversationReadOnly) {
            return 'This chapter was approved. Conversation is locked for further replies.';
        }
        return 'No discussion yet for this version.';
    }, [
        activeChapter,
        hasAvailableVersions,
        hasVersionSelection,
        canUploadActiveChapter,
        activeChapterUploadsLocked,
        isConversationReadOnly,
    ]);

    const composerPlaceholder = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to start a conversation.';
        }
        if (!hasAvailableVersions) {
            if (canUploadActiveChapter) {
                return 'Upload a chapter version to start a conversation.';
            }
            if (activeChapterUploadsLocked) {
                return activeChapter?.status === 'approved'
                    ? `${formatChapterLabel(activeChapter)} is approved. Uploads are disabled until it is reopened.`
                    : 'Uploads are disabled while this chapter is under review.';
            }
            return 'Waiting for a submission to start a conversation.';
        }
        if (!hasVersionSelection || activeVersionIndex === null) {
            return 'Select a version to start a conversation.';
        }
        if (isConversationReadOnly && selectedVersionLabel) {
            return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel} is approved. Conversation is read-only.`;
        }
        return `Discuss ${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}…`;
    }, [
        activeChapter,
        hasAvailableVersions,
        hasVersionSelection,
        selectedVersionLabel,
        activeVersionIndex,
        canUploadActiveChapter,
        activeChapterUploadsLocked,
        isConversationReadOnly,
    ]);

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

    const handleRequestDecision = React.useCallback((chapterId: number, decision: WorkspaceChapterDecision) => {
        if (!enableChapterDecisions || !mentorRole || chapterDecisionHelperText || pendingDecision || isSubmittingDecision) {
            return;
        }
        setPendingDecision({ chapterId, decision });
        setDecisionError(null);
    }, [enableChapterDecisions, mentorRole, chapterDecisionHelperText, pendingDecision, isSubmittingDecision]);

    const handleCloseDecisionDialog = React.useCallback(() => {
        if (isSubmittingDecision) {
            return;
        }
        setPendingDecision(null);
        setDecisionError(null);
    }, [isSubmittingDecision]);

    const handleConfirmDecision = React.useCallback(async () => {
        if (!pendingDecision || !onChapterDecision || !thesisId || !mentorRole) {
            return;
        }

        setIsSubmittingDecision(true);
        setDecisionError(null);

        try {
            await onChapterDecision({
                thesisId,
                chapterId: pendingDecision.chapterId,
                decision: pendingDecision.decision,
                role: mentorRole,
                versionIndex: pendingDecision.chapterId === activeChapter?.id ? activeVersionIndex : undefined,
            });
            setPendingDecision(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update chapter status.';
            setDecisionError(message);
        } finally {
            setIsSubmittingDecision(false);
        }
    }, [pendingDecision, onChapterDecision, thesisId, mentorRole, activeChapter?.id, activeVersionIndex]);

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

    if (!thesis || normalizedChapters.length === 0) {
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

    const progress = computeProgress(normalizedChapters);
    const pendingChapter = pendingDecision
        ? normalizedChapters.find((chapter) => chapter.id === pendingDecision.chapterId)
        : undefined;
    const pendingDecisionVersionLabel = pendingDecision && pendingDecision.chapterId === activeChapter?.id
        ? selectedVersionLabel
        : undefined;
    const decisionDialogTitle = pendingDecision?.decision === 'approved'
        ? 'Approve chapter'
        : 'Request revisions';
    const pendingDecisionStatus = pendingDecision?.decision === 'approved' ? 'approved' : 'needing revision';
    const decisionVersionSuffix = pendingDecisionVersionLabel ? ` for ${pendingDecisionVersionLabel}` : '';
    const decisionDialogDescription = pendingDecision && pendingChapter
        ? `${formatChapterLabel(pendingChapter)} will be marked as ${pendingDecisionStatus}${decisionVersionSuffix}.`
        : 'Apply your decision to this chapter.';
    const decisionConfirmLabel = pendingDecision?.decision === 'approved'
        ? 'Approve chapter'
        : 'Request revisions';

    return (
        <>
            <Box>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <Tabs
                        value={activeStage}
                        onChange={handleStageChange}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        {STAGE_METADATA.map((stage) => {
                            const stageLocked = stageLockMap[stage.value];
                            const stageCompleted = stageCompletionMap[stage.value];
                            const chipLabel = stageLocked ? 'Locked' : stageCompleted ? 'Completed' : 'In progress';
                            const chipColor = stageLocked ? 'default' : stageCompleted ? 'success' : 'info';
                            const chipVariant = stageLocked ? 'outlined' : 'filled';
                            return (
                                <Tab
                                    key={stage.value}
                                    value={stage.value}
                                    label={(
                                        <Stack spacing={0.5} alignItems="center">
                                            <Typography variant="body2" fontWeight={600}>{stage.label}</Typography>
                                            <Chip
                                                label={chipLabel}
                                                size="small"
                                                color={chipColor}
                                                variant={chipVariant}
                                            />
                                        </Stack>
                                    )}
                                />
                            );
                        })}
                    </Tabs>
                </Card>

                {isStageLocked ? (
                    <UnauthorizedNotice
                        title={`${activeStageMeta.label} locked`}
                        description={stageLockedDescription}
                        variant="box"
                        sx={{ mt: 2 }}
                    />
                ) : (
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
                                            chapters={stageChapters}
                                            selectedChapterId={activeChapterId}
                                            selectedVersionIndex={activeVersionIndex}
                                            onSelectChapter={handleChapterSelect}
                                            onSelectVersion={handleVersionSelect}
                                            onUploadChapter={handleChapterUpload}
                                            uploadingChapterId={uploadingChapterId}
                                            enableUploads={enableUploads}
                                            mentorRoles={mentorRoles}
                                            currentMentorRole={mentorRole}
                                            versionOptionsByChapter={versionOptionsByChapter}
                                            loadingChapterId={loadingChapterId}
                                            loadingMessage="Fetching submissions…"
                                            participants={participants}
                                            reviewActions={enableChapterDecisions ? {
                                                onApprove: (chapterId) => handleRequestDecision(chapterId, 'approved'),
                                                onRequestRevision: (chapterId) => handleRequestDecision(
                                                    chapterId,
                                                    'revision_required',
                                                ),
                                                disabled: reviewActionsDisabled,
                                                helperText: chapterDecisionHelperText,
                                                processingChapterId: reviewActionsProcessingChapterId,
                                            } : undefined}
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
                                        composerMetadata={{
                                            chapterId: activeChapter?.id,
                                            versionIndex: activeVersionIndex ?? undefined,
                                            thesisId,
                                        }}
                                    />
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}
            </Box>

            <Dialog
                open={Boolean(pendingDecision)}
                onClose={handleCloseDecisionDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{decisionDialogTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {decisionDialogDescription}
                    </DialogContentText>
                    {decisionError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {decisionError}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDecisionDialog} disabled={isSubmittingDecision}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color={pendingDecision?.decision === 'approved' ? 'success' : 'warning'}
                        onClick={() => void handleConfirmDecision()}
                        disabled={isSubmittingDecision}
                    >
                        {isSubmittingDecision ? 'Saving…' : decisionConfirmLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
