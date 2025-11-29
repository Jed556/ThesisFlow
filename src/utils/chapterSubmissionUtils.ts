import type {
    ChapterSubmissionEntry,
    ChapterSubmissionStatus,
    MentorRole,
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
            case 'approved':
                return 'approved';
            case 'rejected':
                return 'rejected';
            case 'revision':
            case 'revision_required':
                return 'revision_required';
            default:
                return DEFAULT_STATUS;
        }
    };

    return {
        id: submission.id,
        status: normalizeStatus(submission.status),
        decidedAt: submission.decidedAt ?? undefined,
        decidedBy: submission.decidedBy,
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
    meta?: { decidedAt?: string; decidedBy?: MentorRole | 'system' },
): ChapterSubmissionEntry[] => {
    const normalized = normalizeChapterSubmissions(submissions);
    if (!Number.isInteger(index) || index < 0 || index >= normalized.length) {
        return normalized;
    }
    const next = [...normalized];
    next[index] = {
        ...next[index],
        status,
        decidedAt: meta?.decidedAt ?? next[index].decidedAt,
        decidedBy: meta?.decidedBy ?? next[index].decidedBy,
    } satisfies ChapterSubmissionEntry;
    return next;
};

export const getLatestSubmissionIndex = (
    submissions: ThesisChapter['submissions'],
): number => {
    const length = submissions?.length ?? 0;
    return length > 0 ? length - 1 : -1;
};
