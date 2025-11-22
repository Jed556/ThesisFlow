import type { ThesisData } from '../types/thesis';
import type { HistoricalThesisEntry } from '../types/profile';

const COMPLETED_STATUS_TOKENS = ['completed', 'defended', 'published', 'archived'] as const;

/**
 * Determines whether a thesis status string indicates completion.
 */
export function isCompletedThesisStatus(status?: string | null): boolean {
    if (!status) {
        return false;
    }
    const normalized = status.toLowerCase();
    return COMPLETED_STATUS_TOKENS.some((token) => normalized.includes(token));
}

/**
 * Filters the provided thesis list to include only active (non-completed) entries.
 */
export function filterActiveMentorTheses<T extends ThesisData>(theses: T[]): T[] {
    return theses.filter((thesis) => !isCompletedThesisStatus(thesis.overallStatus));
}

/**
 * Derive a chronological thesis history for a mentor across completed theses.
 */
export function deriveMentorThesisHistory(
    allTheses: (ThesisData & { id?: string })[],
    userUid: string,
    role: 'adviser' | 'editor' | 'statistician'
): HistoricalThesisEntry[] {
    const completed = allTheses.filter((thesis) => {
        const isUserInRole = role === 'adviser'
            ? thesis.adviser === userUid
            : role === 'editor'
                ? thesis.editor === userUid
                : thesis.statistician === userUid;
        return isUserInRole && isCompletedThesisStatus(thesis.overallStatus);
    });

    return completed.map((thesis) => {
        const rawDate = thesis.submissionDate ? new Date(thesis.submissionDate) : null;
        const year = rawDate && !Number.isNaN(rawDate.getTime())
            ? rawDate.getFullYear().toString()
            : '—';
        return {
            year,
            title: thesis.title,
            role: role === 'adviser'
                ? 'Adviser'
                : role === 'editor'
                    ? 'Editor'
                    : 'Statistician',
            outcome: thesis.overallStatus,
        } satisfies HistoricalThesisEntry;
    }).sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
}
