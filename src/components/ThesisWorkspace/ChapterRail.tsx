import * as React from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { ChapterSubmissionStatus, ThesisChapter, ThesisStageName } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../Conversation';
import { formatFileSize } from '../../utils/fileUtils';
import type { VersionOption } from '../../types/workspace';
import { normalizeChapterSubmissions } from '../../utils/chapterSubmissionUtils';
import { resolveChapterStage } from '../../utils/thesisStageUtils';
import { hasRoleApproved } from '../../utils/expertUtils';

const statusMeta: Record<string, { label: string; chipColor: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
    approved: { label: 'Approved', chipColor: 'success' },
    under_review: { label: 'Under review', chipColor: 'info' },
    revision_required: { label: 'Needs revision', chipColor: 'warning' },
    draft: { label: 'Draft', chipColor: 'default' },
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
        case 'draft':
            return 'Draft';
        case 'ignored':
            return 'Ignored';
        default:
            return undefined;
    }
};

export const buildSubmissionMeta = (
    file?: FileAttachment,
    participants?: Record<string, ConversationParticipant>,
) => {
    if (!file) {
        return undefined;
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
    return parts.length ? parts.join(' • ') : undefined;
};

export const buildSubmissionStatusChip = (
    status?: ChapterSubmissionStatus,
): { label?: string; color?: ChipProps['color'] } => {
    const label = formatSubmissionStatus(status);
    if (!label) {
        return { label: undefined, color: undefined };
    }
    let color: ChipProps['color'] = 'default';
    if (status === 'approved') {
        color = 'success';
    } else if (status === 'revision_required') {
        color = 'warning';
    } else if (status === 'under_review') {
        color = 'info';
    } else if (status === 'draft') {
        color = 'default';
    } else if (status === 'ignored') {
        color = 'default';
    }
    return { label, color };
};

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
    const matchesStage = (file?: FileAttachment, link?: string) => {
        if (!stageFilter) {
            return true;
        }
        // Link submissions are already fetched from the correct stage via Firestore path
        // They don't have chapterStage stored, so always include them
        if (!file && link) {
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
            if (!matchesStage(file, submission.link)) {
                return acc;
            }
            acc.push({
                id: submission.id || file?.id || `version-${index + 1}`,
                label: submission.link
                    ? `Link ${index + 1}`
                    : (file?.name ?? `Version ${index + 1}`),
                versionIndex: index,
                file,
                link: submission.link,
                status: submission.status,
                // Include expertApprovals for link submissions (file submissions get it from file.expertApprovals)
                expertApprovals: submission.expertApprovals,
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

/** Derived chapter status from file submissions */
type DerivedChapterStatus = 'approved' | 'under_review' | 'revision_required' | 'draft' | 'not_submitted';

/**
 * Check if a submission is fully approved based on expertApprovals
 * Adviser and Editor are always required; Statistician is optional
 */
const isFullyApprovedByExperts = (
    expertApprovals: FileAttachment['expertApprovals'] | undefined,
    hasStatistician = false,
): boolean => {
    if (!expertApprovals || !Array.isArray(expertApprovals) || expertApprovals.length === 0) {
        return false;
    }
    const hasAdviser = hasRoleApproved(expertApprovals, 'adviser');
    const hasEditor = hasRoleApproved(expertApprovals, 'editor');
    const hasStatisticianApproval = hasRoleApproved(expertApprovals, 'statistician');
    // Adviser and Editor are required; Statistician only if present
    return hasAdviser && hasEditor && (!hasStatistician || hasStatisticianApproval);
};

/**
 * Derive chapter status from its file and link submissions
 * Priority: any approved = approved, any under_review = under_review, any revision = revision, any draft = draft, else not_submitted
 * If ANY version is approved, the chapter is considered approved (best version wins)
 * Note: 'ignored' status is not considered for chapter-level status (it's a derived display state)
 * @param files - File attachments for the chapter (file submission mode)
 * @param chapter - Optional chapter object to check link submissions
 * @param hasStatistician - Whether statistician approval is required
 */
export const deriveChapterStatus = (
    files?: FileAttachment[],
    chapter?: ThesisChapter,
    hasStatistician = false,
): DerivedChapterStatus => {
    // Track if any submission is fully approved (either by status or by expertApprovals)
    let anyApproved = false;
    let anyUnderReview = false;
    let anyRevision = false;
    let anyDraft = false;
    let hasSubmissions = false;

    // Check file submissions
    if (files && files.length > 0) {
        hasSubmissions = true;
        files.forEach((f) => {
            // Check if approved by status OR by expertApprovals
            if (f.submissionStatus === 'approved' || isFullyApprovedByExperts(f.expertApprovals, hasStatistician)) {
                anyApproved = true;
            } else if (f.submissionStatus === 'under_review') {
                anyUnderReview = true;
            } else if (f.submissionStatus === 'revision_required') {
                anyRevision = true;
            } else if (f.submissionStatus === 'draft' || !f.submissionStatus) {
                anyDraft = true;
            }
        });
    }

    // Check link submissions from chapter.submissions
    if (chapter?.submissions) {
        const normalizedSubmissions = normalizeChapterSubmissions(chapter.submissions);
        normalizedSubmissions.forEach((sub) => {
            // Only include link submissions (they don't have corresponding files)
            if (sub.link) {
                hasSubmissions = true;
                // Check if approved by status OR by expertApprovals
                if (sub.status === 'approved' || isFullyApprovedByExperts(sub.expertApprovals, hasStatistician)) {
                    anyApproved = true;
                } else if (sub.status === 'under_review') {
                    anyUnderReview = true;
                } else if (sub.status === 'revision_required') {
                    anyRevision = true;
                } else if (sub.status === 'draft' || !sub.status) {
                    anyDraft = true;
                }
            }
        });
    }

    // If no submissions at all, not submitted
    if (!hasSubmissions) {
        return 'not_submitted';
    }

    // Priority 1: If ANY submission is approved, chapter is approved (best version wins)
    if (anyApproved) return 'approved';

    // Priority 2: If any submission is under review, chapter is under review
    if (anyUnderReview) return 'under_review';

    // Priority 3: If any submission has revision required, chapter needs revision
    if (anyRevision) return 'revision_required';

    // Priority 4: If any submission is draft (uploaded but not submitted)
    if (anyDraft) return 'draft';

    return 'not_submitted';
};

/**
 * Simplified ChapterRail Props - Only for showing chapter list
 */
interface ChapterRailProps {
    chapters: ThesisChapter[];
    selectedChapterId: number | null;
    onSelectChapter: (chapterId: number) => void;
    /** Count of versions per chapter for display */
    versionCounts?: Record<number, number>;
    /** Files per chapter for deriving status */
    chapterFiles?: Record<number, FileAttachment[]>;
    /** Whether loading is in progress */
    isLoading?: boolean;
    /** Whether the thesis has a statistician assigned */
    hasStatistician?: boolean;
}

/**
 * Simplified ChapterRail - Only shows chapter list without versions
 * Versions are shown in a separate SubmissionsRail component
 * Status is derived from individual file submissions
 */
export const ChapterRail: React.FC<ChapterRailProps> = ({
    chapters,
    selectedChapterId,
    onSelectChapter,
    versionCounts,
    chapterFiles,
    isLoading,
    hasStatistician = false,
}) => {
    if (chapters.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="body2" color="text.secondary">
                        No chapters available for this stage.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1.5}>
            {chapters.map((chapter) => {
                const isActive = chapter.id === selectedChapterId;
                const files = chapterFiles?.[chapter.id];
                const derivedStatus = deriveChapterStatus(files, chapter, hasStatistician);
                const meta = statusMeta[derivedStatus];
                const versionCount = versionCounts?.[chapter.id] ?? 0;

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
                            opacity: isLoading ? 0.7 : 1,
                        }}
                        onClick={() => onSelectChapter(chapter.id)}
                    >
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {formatChapterLabel(chapter)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {versionCount} version{versionCount !== 1 ? 's' : ''}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={meta.label}
                                    color={meta.chipColor}
                                    size="small"
                                    variant="outlined"
                                />
                            </Stack>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
};

export default ChapterRail;
