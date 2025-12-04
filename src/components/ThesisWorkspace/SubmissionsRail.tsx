import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import {
    Upload as UploadIcon,
} from '@mui/icons-material';
import type { ExpertRole, ThesisChapter, ThesisStageName } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../Conversation';
import { SubmissionCard } from '../File';
import type { VersionOption } from '../../types/workspace';
import { normalizeChapterSubmissions } from '../../utils/chapterSubmissionUtils';
import { resolveChapterStage } from '../../utils/thesisStageUtils';

const ACCEPTED_FILE_TYPES = [
    '.pdf', '.doc', '.docx',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

/**
 * Build version options from chapter submissions
 */
export const buildVersionOptions = (
    chapter?: ThesisChapter,
    files?: FileAttachment[],
    stageFilter?: ThesisStageName,
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

/**
 * Determine if a submission is a draft (not yet submitted)
 * A draft has 'draft' status or no status (undefined)
 */
const isDraftSubmission = (version: VersionOption): boolean => {
    const status = version.file?.submissionStatus ?? version.status;
    return !status || status === 'draft';
};

interface SubmissionsRailProps {
    /** The selected chapter */
    chapter: ThesisChapter | null;
    /** Versions/submissions for the chapter */
    versions: VersionOption[];
    /** Currently selected version index */
    selectedVersionIndex: number | null;
    /** Callback when a version is selected */
    onSelectVersion: (versionIndex: number) => void;
    /** Callback to view a file (opens file viewer) */
    onViewFile?: (file: FileAttachment) => void;
    /** Callback to upload a new version */
    onUploadVersion?: (file: File) => void;
    /** Callback when submit is clicked (student submits draft) */
    onSubmit?: (versionId: string, file?: FileAttachment) => void;
    /** Callback when approve is clicked */
    onApprove?: (versionId: string, file?: FileAttachment) => void;
    /** Callback when reject is clicked */
    onReject?: (versionId: string, file?: FileAttachment) => void;
    /** Callback when delete is clicked */
    onDelete?: (versionId: string, file?: FileAttachment) => void;
    /** Whether the current user is a student */
    isStudent?: boolean;
    /** The current expert role */
    currentExpertRole?: ExpertRole;
    /** Whether there is a statistician in the thesis group */
    hasStatistician?: boolean;
    /** Participants for resolving display names */
    participants?: Record<string, ConversationParticipant>;
    /** Whether uploading is in progress */
    isUploading?: boolean;
    /** ID of version being processed */
    processingVersionId?: string | null;
    /** Whether loading versions */
    isLoading?: boolean;
    /** Loading message */
    loadingMessage?: string;
    /** Active stage filter */
    activeStage?: ThesisStageName;
}

/**
 * SubmissionsRail - Shows submissions/versions for a selected chapter
 * Uses SubmissionCard which has built-in workflow actions for upload, submit, approve, reject
 */
export const SubmissionsRail: React.FC<SubmissionsRailProps> = ({
    chapter,
    versions,
    selectedVersionIndex,
    onSelectVersion,
    onViewFile,
    onUploadVersion,
    onSubmit,
    onApprove,
    onReject,
    onDelete,
    isStudent,
    currentExpertRole,
    hasStatistician,
    participants,
    isUploading,
    processingVersionId,
    isLoading,
    loadingMessage,
}) => {
    const handleUploadChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            onUploadVersion?.(file);
            event.target.value = '';
        },
        [onUploadVersion]
    );

    // Check if any version is approved (used to mark others as ignored)
    const hasApprovedVersion = versions.some(
        (v) => v.file?.submissionStatus === 'approved' || v.status === 'approved'
    );

    // Derive chapter status from the latest file submissions
    const latestFile = versions.length > 0 ? versions[versions.length - 1]?.file : undefined;
    const derivedChapterStatus = latestFile?.submissionStatus;

    // Determine if uploads are allowed based on derived status
    const uploadsLockedByStatus =
        derivedChapterStatus === 'approved' || derivedChapterStatus === 'under_review';
    const allowUploads = Boolean(isStudent && onUploadVersion && !uploadsLockedByStatus);
    const uploadHelperText = isStudent && uploadsLockedByStatus
        ? derivedChapterStatus === 'approved'
            ? 'This chapter is approved. Upload a new version only after it is reopened.'
            : 'Uploads are disabled while this chapter is under review.'
        : undefined;

    if (!chapter) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="body2" color="text.secondary">
                        Select a chapter to view its submissions.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1.5}>
            {/* Header */}
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Chapter {chapter.id} Submissions
                </Typography>
                {chapter.title && (
                    <Typography variant="body2" color="text.secondary">
                        {chapter.title}
                    </Typography>
                )}
            </Box>

            {/* Loading indicator */}
            {isLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                        {loadingMessage ?? 'Loading submissions…'}
                    </Typography>
                </Stack>
            )}

            {/* Empty state */}
            {!isLoading && versions.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    {isStudent
                        ? 'No versions yet. Upload a file to start the conversation.'
                        : 'No versions have been uploaded for this chapter.'}
                </Typography>
            )}

            {/* Version cards using SubmissionCard */}
            {versions.map((version) => {
                const isVersionActive = version.versionIndex === selectedVersionIndex;
                const isDraft = isDraftSubmission(version);
                const isProcessing = processingVersionId === version.id;
                // Use per-file expertApprovals (status is now per-submission)
                const fileExpertApprovals = version.file?.expertApprovals;
                // Mark as ignored if another version is approved and this one is under review
                const versionStatus = version.file?.submissionStatus ?? version.status;
                const isIgnored = hasApprovedVersion && versionStatus === 'under_review';

                return (
                    <Box key={version.id}>
                        <SubmissionCard
                            file={version.file}
                            versionLabel={`v${version.versionIndex + 1}`}
                            versionIndex={version.versionIndex}
                            status={versionStatus}
                            isDraft={isDraft}
                            isIgnored={isIgnored}
                            expertApprovals={fileExpertApprovals}
                            selected={isVersionActive}
                            participants={participants}
                            isStudent={isStudent}
                            currentExpertRole={currentExpertRole}
                            hasStatistician={hasStatistician}
                            onView={onViewFile ? (file) => {
                                onSelectVersion(version.versionIndex);
                                onViewFile(file);
                            } : undefined}
                            onSubmit={
                                isStudent && isDraft && onSubmit && version.file
                                    ? () => onSubmit(version.id, version.file)
                                    : undefined
                            }
                            onApprove={
                                currentExpertRole && onApprove && version.file
                                    ? () => onApprove(version.id, version.file)
                                    : undefined
                            }
                            onRequestRevision={
                                currentExpertRole && onReject && version.file
                                    ? () => onReject(version.id, version.file)
                                    : undefined
                            }
                            onDelete={
                                isStudent && isDraft && onDelete && version.file
                                    ? () => onDelete(version.id, version.file)
                                    : undefined
                            }
                            isProcessing={isProcessing}
                            showDeleteButton={Boolean(isStudent && isDraft && onDelete)}
                        />
                    </Box>
                );
            })}

            {/* Upload button */}
            {allowUploads && (
                <Stack spacing={0.5}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={
                            isUploading ? (
                                <CircularProgress size={16} />
                            ) : (
                                <UploadIcon fontSize="small" />
                            )
                        }
                        disabled={isUploading}
                        component="label"
                    >
                        {isUploading ? 'Uploading…' : 'Upload version'}
                        <input
                            type="file"
                            hidden
                            accept={ACCEPTED_FILE_TYPES}
                            onChange={handleUploadChange}
                        />
                    </Button>
                    {uploadHelperText && (
                        <Typography variant="body2" color="text.secondary">
                            {uploadHelperText}
                        </Typography>
                    )}
                </Stack>
            )}

            {/* Upload disabled helper text for non-students */}
            {!isStudent && !currentExpertRole && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Only students can upload new versions.
                </Typography>
            )}
        </Stack>
    );
};

export default SubmissionsRail;
