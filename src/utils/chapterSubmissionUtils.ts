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

    return {
        id: submission.id,
        status: submission.status ?? DEFAULT_STATUS,
        decidedAt: submission.decidedAt ?? null,
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
