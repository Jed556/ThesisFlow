import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import {
    Upload as UploadIcon,
} from '@mui/icons-material';
import type { ChapterSubmissionStatus, MentorRole, ThesisChapter, ThesisStage } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../Conversation';
import { FileCard } from '../File';
import { formatFileSize } from '../../utils/fileUtils';
import type { ChapterVersionMap, VersionOption } from '../../types/workspace';
import { mentorRoleLabels } from '../../utils/mentorUtils';
import { normalizeChapterSubmissions } from '../../utils/chapterSubmissionUtils';
import { resolveChapterStage } from '../../utils/thesisStageUtils';

const statusMeta: Record<string, { label: string; chipColor: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
    approved: { label: 'Approved', chipColor: 'success' },
    under_review: { label: 'Under review', chipColor: 'info' },
    revision_required: { label: 'Needs revision', chipColor: 'warning' },
    not_submitted: { label: 'Not submitted', chipColor: 'default' },
};

export const formatChapterLabel = (chapter: ThesisChapter) => {
    const title = chapter.title?.trim();
    return title ? `Chapter ${chapter.id}: ${title}` : `Chapter ${chapter.id}`;
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

export const buildFileSizeLabel = (file?: FileAttachment) => {
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

const formatSubmissionStatus = (status?: ChapterSubmissionStatus) => {
    switch (status) {
        case 'approved':
            return 'Approved';
        case 'revision_required':
            return 'Needs revision';
        case 'under_review':
            return 'Under review';
        default:
            return undefined;
    }
};

export const buildSubmissionMeta = (
    file?: FileAttachment,
    participants?: Record<string, ConversationParticipant>,
    status?: ChapterSubmissionStatus,
) => {
    if (!file) {
        return status ? `Status: ${formatSubmissionStatus(status)}` : undefined;
    }
    const submittedBy = resolveParticipantName(file.author, participants);
    const submittedOn = formatDateTimeLabel(file.uploadDate);
    const parts: string[] = [];
    if (submittedBy && submittedOn) {
        parts.push(`Submitted by ${submittedBy} on ${submittedOn}`);
    } else if (submittedBy) {
        parts.push(`Submitted by ${submittedBy}`);
    } else if (submittedOn) {
        parts.push(`Submitted on ${submittedOn}`);
    }
    if (status) {
        parts.push(`Status: ${formatSubmissionStatus(status)}`);
    }
    return parts.length ? parts.join(' • ') : undefined;
};

export const buildVersionOptions = (
    chapter?: ThesisChapter,
    files?: FileAttachment[],
    stageFilter?: ThesisStage,
): VersionOption[] => {
    if (!chapter) {
        return [];
    }

    const submissions = normalizeChapterSubmissions(chapter.submissions);
    const fileMap = new Map((files ?? []).map((file) => [file.id ?? '', file]));
    const defaultStage = resolveChapterStage(chapter);
    const matchesStage = (file?: FileAttachment) => {
        if (!stageFilter) {
            return true;
        }
        if (!file) {
            return stageFilter === defaultStage;
        }
        if (!file.chapterStage) {
            return stageFilter === defaultStage;
        }
        return file.chapterStage === stageFilter;
    };

    if (submissions.length > 0) {
        return submissions.reduce<VersionOption[]>((acc, submission, index) => {
            const file = submission.id ? fileMap.get(submission.id) : undefined;
            if (!matchesStage(file)) {
                return acc;
            }
            acc.push({
                id: submission.id || file?.id || `version-${index + 1}`,
                label: file?.name ?? `Version ${index + 1}`,
                versionIndex: index,
                file,
                status: submission.status,
            });
            return acc;
        }, []);
    }

    if (files && files.length > 0) {
        return files
            .filter((file) => matchesStage(file))
            .map((file, index) => ({
                id: file.id ?? `version-${index + 1}`,
                label: file.name ?? `Version ${index + 1}`,
                versionIndex: index,
                file,
            } satisfies VersionOption));
    }

    return [];
};

interface ChapterRailProps {
    chapters: ThesisChapter[];
    selectedChapterId: number | null;
    selectedVersionIndex: number | null;
    onSelectChapter: (chapterId: number) => void;
    onSelectVersion: (versionIndex: number) => void;
    onUploadChapter?: (chapterId: number, file: File) => void;
    uploadingChapterId?: number | null;
    enableUploads?: boolean;
    mentorRoles?: MentorRole[];
    currentMentorRole?: MentorRole;
    versionOptionsByChapter: ChapterVersionMap;
    participants?: Record<string, ConversationParticipant>;
    loadingChapterId?: number | null;
    loadingMessage?: string;
    activeStage: ThesisStage;
    reviewActions?: {
        onApprove: (chapterId: number) => void;
        onRequestRevision: (chapterId: number) => void;
        disabled?: boolean;
        helperText?: string;
        processingChapterId?: number | null;
    };
}

export const ChapterRail: React.FC<ChapterRailProps> = ({
    chapters,
    selectedChapterId,
    selectedVersionIndex,
    onSelectChapter,
    onSelectVersion,
    onUploadChapter,
    uploadingChapterId,
    enableUploads,
    mentorRoles,
    currentMentorRole,
    versionOptionsByChapter,
    participants,
    loadingChapterId,
    loadingMessage,
    activeStage,
    reviewActions,
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
                const versions = versionOptionsByChapter[chapter.id]
                    ?? buildVersionOptions(chapter, undefined, activeStage);
                const isUploading = uploadingChapterId === chapter.id;
                const isDecisionInFlight = reviewActions?.processingChapterId === chapter.id;
                const showReviewActions = !enableUploads && Boolean(reviewActions);
                const uploadsLockedByStatus = chapter.status === 'approved' || chapter.status === 'under_review';
                const allowUploadsForChapter = Boolean(enableUploads && onUploadChapter && !uploadsLockedByStatus);
                const uploadHelperText = enableUploads && uploadsLockedByStatus
                    ? (chapter.status === 'approved'
                        ? 'This chapter is approved. Upload a new version only after it is reopened.'
                        : 'Uploads are disabled while this chapter is under review.')
                    : undefined;
                const reviewLockedByStatus = chapter.status === 'approved';
                const resolveApprovalForRole = (role: MentorRole) => (
                    reviewLockedByStatus ? true : Boolean(chapter.mentorApprovals?.[role])
                );
                const alreadyApprovedByCurrent = currentMentorRole
                    ? resolveApprovalForRole(currentMentorRole)
                    : reviewLockedByStatus;
                const baseReviewDisabled = Boolean(reviewActions?.disabled) || isDecisionInFlight || reviewLockedByStatus;
                const approveDisabled = baseReviewDisabled || alreadyApprovedByCurrent;
                const revisionDisabled = baseReviewDisabled;
                const reviewHelperText = showReviewActions
                    ? reviewLockedByStatus
                        ? 'This chapter is already approved.'
                        : alreadyApprovedByCurrent
                            ? 'You already approved this chapter.'
                            : reviewActions?.helperText
                    : undefined;
                const showVersionLoader = chapter.id === loadingChapterId;

                return (
                    <Card
                        key={chapter.id}
                        variant={isActive ? 'outlined' : 'elevation'}
                        sx={{
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive ? 'primary.main' : 'divider',
                            cursor: 'pointer',
                            transition: 'border-color 120ms ease',
                            '&:hover': { borderColor: 'primary.main' },
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
                                </Stack>
                            </Stack>

                            {mentorRoles && mentorRoles.length > 0 && (
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                                    {mentorRoles.map((role) => {
                                        const approved = resolveApprovalForRole(role);
                                        return (
                                            <Chip
                                                key={`${chapter.id}-${role}`}
                                                label={`${mentorRoleLabels[role]} · ${approved ? 'Approved' : 'Pending'}`}
                                                size="small"
                                                color={approved ? 'success' : 'default'}
                                                variant={approved ? 'filled' : 'outlined'}
                                            />
                                        );
                                    })}
                                </Stack>
                            )}

                            {isActive && (
                                <Stack spacing={1.25} sx={{ mt: 2 }}>
                                    {showVersionLoader && (
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <CircularProgress size={16} />
                                            <Typography variant="body2" color="text.secondary">
                                                {loadingMessage ?? 'Loading versions…'}
                                            </Typography>
                                        </Stack>
                                    )}
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
                                                metaLabel={buildSubmissionMeta(version.file, participants, version.status)}
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
                                        <Stack spacing={0.5}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={isUploading ? <CircularProgress size={16} /> : <UploadIcon fontSize="small" />}
                                                disabled={isUploading || !allowUploadsForChapter}
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
                                            {uploadHelperText && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {uploadHelperText}
                                                </Typography>
                                            )}
                                        </Stack>
                                    )}

                                    {showReviewActions && reviewActions && (
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                disabled={approveDisabled}
                                                startIcon={isDecisionInFlight ? <CircularProgress size={16} /> : undefined}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    reviewActions.onApprove(chapter.id);
                                                }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="warning"
                                                size="small"
                                                disabled={revisionDisabled}
                                                startIcon={isDecisionInFlight ? <CircularProgress size={16} /> : undefined}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    reviewActions.onRequestRevision(chapter.id);
                                                }}
                                            >
                                                Request revision
                                            </Button>
                                        </Stack>
                                    )}

                                    {showReviewActions && reviewHelperText && (
                                        <Typography variant="body2" color="text.secondary">
                                            {reviewHelperText}
                                        </Typography>
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

export default ChapterRail;
