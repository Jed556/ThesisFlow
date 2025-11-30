import type { ThesisData } from '../types/thesis';
import type { ThesisGroup, GroupStatus } from '../types/group';

/**
 * Thesis utility functions
 * Re-exports for convenience from Firebase Firestore thesis module
 */

export {
    getThesisTeamMembers, getThesisTeamMembersById, calculateThesisProgress,
} from './firebase/firestore/thesis';

const COMPLETED_GROUP_STATUSES: GroupStatus[] = ['completed', 'archived'];

/**
 * Check if a group status indicates a completed thesis
 * @param status - Group status to check
 */
export function isCompletedGroupStatus(status?: GroupStatus | null): boolean {
    if (!status) return false;
    return COMPLETED_GROUP_STATUSES.includes(status);
}

/**
 * Check if a topic has been approved based on thesis title
 * A topic is considered approved if the thesis has a title (from approved proposal)
 * Note: Chapter data is now stored in subcollections and should be fetched separately
 * @param thesis - Thesis data with title
 */
export function isTopicApproved(thesis?: Pick<ThesisData, 'title'> | null): boolean {
    if (!thesis) {
        return false;
    }

    // If thesis has a title, topic was approved
    const promotedTitle = thesis.title?.trim();
    if (promotedTitle) {
        return true;
    }

    return false;
}

/**
 * Check if a group has an active thesis (based on group status)
 * @param group - ThesisGroup to check
 */
export function hasActiveThesis(group?: ThesisGroup | null): boolean {
    if (!group) return false;
    return group.status === 'active' && Boolean(group.thesis);
}
