import type { ThesisGroup, GroupStatus } from '../types/group';
import type { HistoricalThesisEntry } from '../types/profile';

const COMPLETED_STATUS_TOKENS: GroupStatus[] = ['completed', 'archived'];

/**
 * Determines whether a group status indicates completion.
 */
export function isCompletedGroupStatus(status?: GroupStatus | string | null): boolean {
    if (!status) {
        return false;
    }
    return COMPLETED_STATUS_TOKENS.includes(status as GroupStatus);
}

/**
 * Filters the provided group list to include only active (non-completed) entries.
 */
export function filterActiveGroups(groups: ThesisGroup[]): ThesisGroup[] {
    return groups.filter((group) => !isCompletedGroupStatus(group.status));
}

/**
 * Derive a chronological thesis history for a mentor across completed groups.
 */
export function deriveMentorThesisHistory(
    allGroups: ThesisGroup[],
    userUid: string,
    role: 'adviser' | 'editor' | 'statistician'
): HistoricalThesisEntry[] {
    const completed = allGroups.filter((group) => {
        const members = group.members;
        const isUserInRole = role === 'adviser'
            ? members.adviser === userUid
            : role === 'editor'
                ? members.editor === userUid
                : members.statistician === userUid;
        return isUserInRole && isCompletedGroupStatus(group.status);
    });

    return completed.map((group) => {
        const thesis = group.thesis;
        const rawDate = thesis?.submissionDate ? new Date(thesis.submissionDate) : null;
        const year = rawDate && !Number.isNaN(rawDate.getTime())
            ? rawDate.getFullYear().toString()
            : '—';
        return {
            year,
            title: thesis?.title ?? group.name,
            role: role === 'adviser'
                ? 'Adviser'
                : role === 'editor'
                    ? 'Editor'
                    : 'Statistician',
            outcome: group.status,
        } satisfies HistoricalThesisEntry;
    }).sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
}
