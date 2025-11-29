import type { ThesisData } from '../types/thesis';

/**
 * Thesis utility functions
 * Re-exports for convenience from Firebase Firestore thesis module
 */

export {
    getThesisTeamMembers, getThesisTeamMembersById, calculateThesisProgress,
} from './firebase/firestore/thesis';

const TOPIC_APPROVAL_KEYWORDS = ['approved', 'accepted', 'granted'] as const;

export function isTopicApproved(thesis?: Pick<ThesisData, 'overallStatus' | 'title'> | null): boolean {
    if (!thesis) {
        return false;
    }

    const normalizedStatus = (thesis.overallStatus ?? '').toLowerCase();
    if (TOPIC_APPROVAL_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))) {
        return true;
    }

    const promotedTitle = thesis.title?.trim();
    if (!promotedTitle) {
        return false;
    }

    if (!normalizedStatus || normalizedStatus === 'not_submitted') {
        return false;
    }

    return true;
}
