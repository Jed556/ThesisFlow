import type { ThesisGroup } from '../types/group';
import type { UserProfile } from '../types/profile';
import { getUserById } from './firebase/firestore/user';

export {
    acceptInvite,
    acceptJoinRequest,
    cancelJoinRequest,
    createGroup,
    deleteGroup,
    getGroupById,
    getGroupsByCourse,
    getGroupsByLeader,
    getGroupsByMember,
    inviteUserToGroup,
    rejectJoinRequest,
    removeInviteFromGroup,
    requestToJoinGroup,
    submitGroupForReview,
} from './firebase/firestore/groups';

export { getUserById, getUsersByFilter } from './firebase/firestore/user';

/**
 * Collects all relevant participant UIDs from a thesis group ensuring uniqueness.
 *
 * @param groupData Thesis group source object
 * @returns Array of unique participant UIDs
 */
const collectMemberIds = (groupData: ThesisGroup): string[] => {
    const ids = new Set<string>();
    ids.add(groupData.members.leader);
    groupData.members.members.forEach((uid) => ids.add(uid));
    if (groupData.members.adviser) {
        ids.add(groupData.members.adviser);
    }
    if (groupData.members.editor) {
        ids.add(groupData.members.editor);
    }
    if (groupData.members.statistician) {
        ids.add(groupData.members.statistician);
    }
    (groupData.members.panels ?? []).forEach((uid) => ids.add(uid));
    return Array.from(ids);
};

/**
 * Builds a map of profile records for all known group participants.
 *
 * @param groupData Thesis group whose participants should be resolved
 * @returns Map keyed by participant UID for quick lookups
 */
export async function buildGroupProfileMap(groupData: ThesisGroup): Promise<Map<string, UserProfile>> {
    const ids = collectMemberIds(groupData);
    const profileMap = new Map<string, UserProfile>();
    await Promise.all(
        ids.map(async (uid) => {
            const profile = await getUserById(uid);
            if (profile) {
                profileMap.set(uid, profile);
            }
        })
    );
    return profileMap;
}
