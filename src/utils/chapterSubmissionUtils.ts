import type {
    ChapterSubmissionEntry,
    ChapterSubmissionStatus,
    ExpertApprovalState,
    ThesisChapter,
} from '../types/thesis';

export type ThesisChapterSubmission = ThesisChapter['submissions'][number];

const DEFAULT_STATUS: ChapterSubmissionStatus = 'under_review';

export const extractSubmissionId = (submission: ThesisChapterSubmission): string => (
    typeof submission === 'string' ? submission : submission.id
);

export const normalizeSubmissionEntry = (
    submission: ThesisChapterSubmission,
): ChapterSubmissionEntry => {
    if (typeof submission === 'string') {
        return {
            id: submission,
            status: DEFAULT_STATUS,
        } satisfies ChapterSubmissionEntry;
    }

    // Map ThesisStatus to ChapterSubmissionStatus
    const normalizeStatus = (status?: string): ChapterSubmissionStatus => {
        switch (status) {
            case 'draft':
                return 'draft';
            case 'approved':
                return 'approved';
            case 'rejected':
                return 'rejected';
            case 'revision':
            case 'revision_required':
                return 'revision_required';
            case 'ignored':
                return 'ignored';
            default:
                return DEFAULT_STATUS;
        }
    };

    return {
        id: submission.id,
        status: normalizeStatus(submission.status),
        // Preserve link for link submissions
        link: (submission as { link?: string }).link,
        // Preserve expertApprovals for link submissions (needed for approval workflow)
        expertApprovals: (submission as { expertApprovals?: ExpertApprovalState }).expertApprovals,
    } satisfies ChapterSubmissionEntry;
};

export const normalizeChapterSubmissions = (
    submissions?: ThesisChapter['submissions'],
): ChapterSubmissionEntry[] => (submissions ?? []).map((submission) => normalizeSubmissionEntry(submission));

export const appendSubmissionEntry = (
    submissions: ThesisChapter['submissions'],
    entry: ChapterSubmissionEntry,
): ChapterSubmissionEntry[] => {
    const normalized = normalizeChapterSubmissions(submissions);
    return [...normalized, entry];
};

export const setSubmissionStatusAt = (
    submissions: ThesisChapter['submissions'],
    index: number,
    status: ChapterSubmissionStatus,
): ChapterSubmissionEntry[] => {
    const normalized = normalizeChapterSubmissions(submissions);
    if (!Number.isInteger(index) || index < 0 || index >= normalized.length) {
        return normalized;
    }
    const next = [...normalized];
    next[index] = {
        ...next[index],
        status,
    } satisfies ChapterSubmissionEntry;
    return next;
};

export const getLatestSubmissionIndex = (
    submissions: ThesisChapter['submissions'],
): number => {
    const length = submissions?.length ?? 0;
    return length > 0 ? length - 1 : -1;
};
