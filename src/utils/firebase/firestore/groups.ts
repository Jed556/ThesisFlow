/**
 * Firebase Firestore - Groups
 * CRUD operations for ThesisGroup documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query,
    where, orderBy, serverTimestamp, writeBatch, onSnapshot, arrayUnion, arrayRemove,
    type QueryConstraint, type DocumentReference, type DocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisGroup, ThesisGroupFormData, GroupStatus } from '../../../types/group';
import type { ThesisData } from '../../../types/thesis';
import {
    buildGroupsCollectionPath, buildGroupDocPath, extractPathParams, buildInvitesDocPath, buildRequestsDocPath
} from './paths';
import { DEFAULT_YEAR, GROUPS_SUBCOLLECTION, JOIN_SUBCOLLECTION } from '../../../config/firestore';
import { getAcademicYear } from '../../../utils/dateUtils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore document data to ThesisGroup
 */
function docToThesisGroup(docSnap: DocumentSnapshot): ThesisGroup | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
        id: docSnap.id,
        name: data.name || '',
        description: data.description || '',
        members: data.members || { leader: '', members: [] },
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        status: data.status || 'draft',
        thesis: data.thesis,
        department: data.department || '',
        course: data.course || '',
        rejectionReason: data.rejectionReason,
    } as ThesisGroup;
}

/**
 * Extract year, department, and course from a group document reference path
 */
function extractGroupContext(refPath: string): { year: string; department: string; course: string } {
    const params = extractPathParams(refPath);
    return {
        year: params.year || DEFAULT_YEAR,
        department: params.department || '',
        course: params.course || '',
    };
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new thesis group
 */
export async function createGroup(
    year: string,
    department: string,
    course: string,
    data: ThesisGroupFormData
): Promise<string> {
    const collectionPath = buildGroupsCollectionPath(year, department, course);
    const groupsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(groupsRef);

    const groupData = {
        id: newDocRef.id,
        name: data.name,
        description: data.description || '',
        members: {
            leader: data.leader,
            members: data.members || [],
            adviser: data.adviser || null,
            editor: data.editor || null,
            statistician: null,
            panels: [],
        },
        status: data.status || 'draft',
        department,
        course,
        thesis: data.thesis || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(newDocRef, groupData);
    return newDocRef.id;
}

/**
 * Create a group with a specific ID
 */
export async function createGroupWithId(
    year: string,
    department: string,
    course: string,
    groupId: string,
    data: ThesisGroupFormData
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    const groupData = {
        id: groupId,
        name: data.name,
        description: data.description || '',
        members: {
            leader: data.leader,
            members: data.members || [],
            adviser: data.adviser || null,
            editor: data.editor || null,
            statistician: null,
            panels: [],
        },
        status: data.status || 'draft',
        department,
        course,
        thesis: data.thesis || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, groupData);
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a single group by ID
 */
export async function getGroup(
    year: string,
    department: string,
    course: string,
    groupId: string
): Promise<ThesisGroup | null> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToThesisGroup(docSnap);
}

/**
 * Get a group document reference
 */
export function getGroupDocRef(
    year: string,
    department: string,
    course: string,
    groupId: string
): DocumentReference {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    return doc(firebaseFirestore, docPath);
}

/**
 * Get all groups in a course
 */
export async function getGroupsInCourse(
    year: string,
    department: string,
    course: string,
    constraints?: QueryConstraint[]
): Promise<ThesisGroup[]> {
    const collectionPath = buildGroupsCollectionPath(year, department, course);
    const groupsRef = collection(firebaseFirestore, collectionPath);
    const q = constraints?.length
        ? query(groupsRef, ...constraints)
        : query(groupsRef, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(docToThesisGroup)
        .filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get all groups across all courses using collectionGroup query
 * Note: This requires a Firestore index on the 'groups' collection group
 */
export async function getAllGroups(constraints?: QueryConstraint[]): Promise<ThesisGroup[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(groupsQuery, ...constraints)
        : query(groupsQuery, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const group = docToThesisGroup(docSnap);
        if (group) {
            // Extract context from document path
            const context = extractGroupContext(docSnap.ref.path);
            group.department = group.department || context.department;
            group.course = group.course || context.course;
        }
        return group;
    }).filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get groups by status
 */
export async function getGroupsByStatus(
    year: string,
    department: string,
    course: string,
    status: GroupStatus
): Promise<ThesisGroup[]> {
    return getGroupsInCourse(year, department, course, [
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups by status across all courses (collectionGroup)
 */
export async function getAllGroupsByStatus(status: GroupStatus): Promise<ThesisGroup[]> {
    return getAllGroups([
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups where user is a member (leader or member)
 */
export async function getGroupsForMember(
    year: string,
    department: string,
    course: string,
    userId: string
): Promise<ThesisGroup[]> {
    // Query for groups where user is leader
    const leaderGroups = await getGroupsInCourse(year, department, course, [
        where('members.leader', '==', userId),
    ]);

    // Query for groups where user is in members array
    const memberGroups = await getGroupsInCourse(year, department, course, [
        where('members.members', 'array-contains', userId),
    ]);

    // Combine and deduplicate
    const groupMap = new Map<string, ThesisGroup>();
    [...leaderGroups, ...memberGroups].forEach((g) => {
        groupMap.set(g.id, g);
    });

    return Array.from(groupMap.values());
}

/**
 * Get groups where user is a member across all courses (collectionGroup)
 */
export async function getAllGroupsForMember(userId: string): Promise<ThesisGroup[]> {
    // Query for groups where user is leader
    const leaderGroups = await getAllGroups([
        where('members.leader', '==', userId),
    ]);

    // Query for groups where user is in members array
    const memberGroups = await getAllGroups([
        where('members.members', 'array-contains', userId),
    ]);

    // Combine and deduplicate
    const groupMap = new Map<string, ThesisGroup>();
    [...leaderGroups, ...memberGroups].forEach((g) => {
        groupMap.set(g.id, g);
    });

    return Array.from(groupMap.values());
}

/**
 * Get groups by adviser
 */
export async function getGroupsByAdviser(
    year: string,
    department: string,
    course: string,
    adviserId: string
): Promise<ThesisGroup[]> {
    return getGroupsInCourse(year, department, course, [
        where('members.adviser', '==', adviserId),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups by adviser across all courses (collectionGroup)
 */
export async function getAllGroupsByAdviser(adviserId: string): Promise<ThesisGroup[]> {
    return getAllGroups([
        where('members.adviser', '==', adviserId),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups by panel member
 */
export async function getGroupsByPanelMember(
    year: string,
    department: string,
    course: string,
    panelId: string
): Promise<ThesisGroup[]> {
    return getGroupsInCourse(year, department, course, [
        where('members.panels', 'array-contains', panelId),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups by panel member across all courses (collectionGroup)
 */
export async function getAllGroupsByPanelMember(panelId: string): Promise<ThesisGroup[]> {
    return getAllGroups([
        where('members.panels', 'array-contains', panelId),
        orderBy('createdAt', 'desc'),
    ]);
}

/**
 * Get groups with pending invites for a user.
 * Queries the join/invites subcollection documents where userIds contains the userId.
 */
export async function getGroupsWithInviteFor(userId: string): Promise<ThesisGroup[]> {
    // Query join subcollection across all groups using collectionGroup
    const joinQuery = collectionGroup(firebaseFirestore, JOIN_SUBCOLLECTION);
    const q = query(joinQuery, where('userIds', 'array-contains', userId));
    const snapshot = await getDocs(q);

    const groups: ThesisGroup[] = [];
    for (const docSnap of snapshot.docs) {
        // Check if this is an invites document
        if (docSnap.id !== 'invites') continue;

        // Extract group path from document path
        const pathParams = extractPathParams(docSnap.ref.path);
        if (!pathParams.groupId) continue;

        // Fetch the parent group
        const group = await findGroupById(pathParams.groupId);
        if (group) {
            groups.push(group);
        }
    }
    return groups;
}

/**
 * Get groups with pending join requests from a user.
 * Queries the join/requests subcollection documents where userIds contains the userId.
 */
export async function getGroupsWithRequestFrom(userId: string): Promise<ThesisGroup[]> {
    // Query join subcollection across all groups using collectionGroup
    const joinQuery = collectionGroup(firebaseFirestore, JOIN_SUBCOLLECTION);
    const q = query(joinQuery, where('userIds', 'array-contains', userId));
    const snapshot = await getDocs(q);

    const groups: ThesisGroup[] = [];
    for (const docSnap of snapshot.docs) {
        // Check if this is a requests document
        if (docSnap.id !== 'requests') continue;

        // Extract group path from document path
        const pathParams = extractPathParams(docSnap.ref.path);
        if (!pathParams.groupId) continue;

        // Fetch the parent group
        const group = await findGroupById(pathParams.groupId);
        if (group) {
            groups.push(group);
        }
    }
    return groups;
}

/**
 * Get invite user IDs for a group
 */
export async function getGroupInvites(
    year: string,
    department: string,
    course: string,
    groupId: string
): Promise<string[]> {
    const invitesPath = buildInvitesDocPath(year, department, course, groupId);
    const invitesRef = doc(firebaseFirestore, invitesPath);
    const docSnap = await getDoc(invitesRef);
    if (!docSnap.exists()) return [];
    const data = docSnap.data();
    return Array.isArray(data.userIds) ? data.userIds : [];
}

/**
 * Get join request user IDs for a group
 */
export async function getGroupJoinRequests(
    year: string,
    department: string,
    course: string,
    groupId: string
): Promise<string[]> {
    const requestsPath = buildRequestsDocPath(year, department, course, groupId);
    const requestsRef = doc(firebaseFirestore, requestsPath);
    const docSnap = await getDoc(requestsRef);
    if (!docSnap.exists()) return [];
    const data = docSnap.data();
    return Array.isArray(data.userIds) ? data.userIds : [];
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update a group
 */
export async function updateGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    data: Partial<ThesisGroupFormData>
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.thesis !== undefined) updateData.thesis = data.thesis;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.course !== undefined) updateData.course = data.course;

    // Handle members updates
    if (data.leader !== undefined) updateData['members.leader'] = data.leader;
    if (data.members !== undefined) updateData['members.members'] = data.members;
    if (data.adviser !== undefined) updateData['members.adviser'] = data.adviser;
    if (data.editor !== undefined) updateData['members.editor'] = data.editor;
    if (data.statistician !== undefined) updateData['members.statistician'] = data.statistician;
    if (data.panels !== undefined) updateData['members.panels'] = data.panels;

    await updateDoc(docRef, updateData);
}

/**
 * Update group status
 */
export async function updateGroupStatus(
    year: string,
    department: string,
    course: string,
    groupId: string,
    status: GroupStatus,
    rejectionReason?: string
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    const updateData: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
    };

    if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
    }

    await updateDoc(docRef, updateData);
}

/**
 * Update a group by ID (context-free version).
 * Finds the group context using collectionGroup query.
 *
 * @param groupId Group document ID
 * @param data Partial update data
 */
export async function updateGroupById(
    groupId: string,
    data: Partial<ThesisGroupFormData>
): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await updateGroup(ctx.year, ctx.department, ctx.course, groupId, data);
}

/**
 * Set (create or overwrite) group data by ID (context-free version).
 * For imports or cases where full context is unknown. Uses current academic year if creating new.
 *
 * @param groupId Group document ID
 * @param data Group data (must include department and course)
 */
export async function setGroupById(
    groupId: string,
    data: Partial<ThesisGroup> & { department?: string; course?: string }
): Promise<void> {
    // Try to get existing context first
    const existingCtx = await getGroupContext(groupId);

    // If no existing context, build from data
    if (!existingCtx) {
        const year = getAcademicYear();
        const department = data.department;
        const course = data.course;
        if (!department || !course) {
            throw new Error('Department and course required when creating new group');
        }
        await setGroup(year, department, course, groupId, data);
        return;
    }

    await setGroup(existingCtx.year, existingCtx.department, existingCtx.course, groupId, data);
}

/**
 * Add member to group
 */
export async function addMemberToGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const group = await getGroup(year, department, course, groupId);
    if (!group) throw new Error('Group not found');

    const members = [...(group.members.members || [])];
    if (!members.includes(userId)) {
        members.push(userId);
    }

    await updateGroup(year, department, course, groupId, { members });
}

/**
 * Remove member from group
 */
export async function removeMemberFromGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const group = await getGroup(year, department, course, groupId);
    if (!group) throw new Error('Group not found');

    const members = (group.members.members || []).filter((m) => m !== userId);
    await updateGroup(year, department, course, groupId, { members });
}

/**
 * Set group adviser
 */
export async function setGroupAdviser(
    year: string,
    department: string,
    course: string,
    groupId: string,
    adviserId: string | null
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        'members.adviser': adviserId,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Set group editor
 */
export async function setGroupEditor(
    year: string,
    department: string,
    course: string,
    groupId: string,
    editorId: string | null
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        'members.editor': editorId,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Set group statistician
 */
export async function setGroupStatistician(
    year: string,
    department: string,
    course: string,
    groupId: string,
    statisticianId: string | null
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        'members.statistician': statisticianId,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Add panel member to group
 */
export async function addPanelMemberToGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    panelId: string
): Promise<void> {
    const group = await getGroup(year, department, course, groupId);
    if (!group) throw new Error('Group not found');

    const panels = [...(group.members.panels || [])];
    if (!panels.includes(panelId)) {
        panels.push(panelId);
    }

    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        'members.panels': panels,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Remove panel member from group
 */
export async function removePanelMemberFromGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    panelId: string
): Promise<void> {
    const group = await getGroup(year, department, course, groupId);
    if (!group) throw new Error('Group not found');

    const panels = (group.members.panels || []).filter((p) => p !== panelId);

    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        'members.panels': panels,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Add invite to group (uses join/invites subcollection document)
 */
export async function addGroupInvite(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const invitesPath = buildInvitesDocPath(year, department, course, groupId);
    const invitesRef = doc(firebaseFirestore, invitesPath);

    // Use setDoc with merge to create document if it doesn't exist
    await setDoc(invitesRef, {
        userIds: arrayUnion(userId),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    // Also update the group's updatedAt
    const groupPath = buildGroupDocPath(year, department, course, groupId);
    const groupRef = doc(firebaseFirestore, groupPath);
    await updateDoc(groupRef, { updatedAt: serverTimestamp() });
}

/**
 * Remove invite from group (uses join/invites subcollection document)
 */
export async function removeGroupInvite(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const invitesPath = buildInvitesDocPath(year, department, course, groupId);
    const invitesRef = doc(firebaseFirestore, invitesPath);

    await updateDoc(invitesRef, {
        userIds: arrayRemove(userId),
        updatedAt: serverTimestamp(),
    });

    // Also update the group's updatedAt
    const groupPath = buildGroupDocPath(year, department, course, groupId);
    const groupRef = doc(firebaseFirestore, groupPath);
    await updateDoc(groupRef, { updatedAt: serverTimestamp() });
}

/**
 * Add join request to group (uses join/requests subcollection document)
 */
export async function addGroupJoinRequest(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const requestsPath = buildRequestsDocPath(year, department, course, groupId);
    const requestsRef = doc(firebaseFirestore, requestsPath);

    // Use setDoc with merge to create document if it doesn't exist
    await setDoc(requestsRef, {
        userIds: arrayUnion(userId),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    // Also update the group's updatedAt
    const groupPath = buildGroupDocPath(year, department, course, groupId);
    const groupRef = doc(firebaseFirestore, groupPath);
    await updateDoc(groupRef, { updatedAt: serverTimestamp() });
}

/**
 * Remove join request from group (uses join/requests subcollection document)
 */
export async function removeGroupJoinRequest(
    year: string,
    department: string,
    course: string,
    groupId: string,
    userId: string
): Promise<void> {
    const requestsPath = buildRequestsDocPath(year, department, course, groupId);
    const requestsRef = doc(firebaseFirestore, requestsPath);

    await updateDoc(requestsRef, {
        userIds: arrayRemove(userId),
        updatedAt: serverTimestamp(),
    });

    // Also update the group's updatedAt
    const groupPath = buildGroupDocPath(year, department, course, groupId);
    const groupRef = doc(firebaseFirestore, groupPath);
    await updateDoc(groupRef, { updatedAt: serverTimestamp() });
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a group
 * Note: This deletes only the group document. Subcollections (expertRequests, proposals, thesis, audits)
 * must be deleted separately or via a cloud function.
 */
export async function deleteGroup(
    year: string,
    department: string,
    course: string,
    groupId: string
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Delete multiple groups in a batch
 */
export async function deleteGroupsBatch(
    groups: { year: string; department: string; course: string; groupId: string }[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const { year, department, course, groupId } of groups) {
        const docPath = buildGroupDocPath(year, department, course, groupId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a user is a member of a group (leader or member)
 */
export function isGroupMember(group: ThesisGroup, userId: string): boolean {
    return (
        group.members.leader === userId ||
        (group.members.members || []).includes(userId)
    );
}

/**
 * Check if a user is a expert of a group (adviser, editor, statistician, or panel)
 */
export function isGroupExpert(group: ThesisGroup, userId: string): boolean {
    return (
        group.members.adviser === userId ||
        group.members.editor === userId ||
        group.members.statistician === userId ||
        (group.members.panels || []).includes(userId)
    );
}

/**
 * Check if a user has any role in a group
 */
export function hasGroupRole(group: ThesisGroup, userId: string): boolean {
    return isGroupMember(group, userId) || isGroupExpert(group, userId);
}

/**
 * Get user's role in a group
 */
export function getUserGroupRole(
    group: ThesisGroup,
    userId: string
): 'leader' | 'member' | 'adviser' | 'editor' | 'statistician' | 'panel' | null {
    if (group.members.leader === userId) return 'leader';
    if ((group.members.members || []).includes(userId)) return 'member';
    if (group.members.adviser === userId) return 'adviser';
    if (group.members.editor === userId) return 'editor';
    if (group.members.statistician === userId) return 'statistician';
    if ((group.members.panels || []).includes(userId)) return 'panel';
    return null;
}

// ============================================================================
// Listener Options
// ============================================================================

/**
 * Options for group listener callbacks.
 */
export interface GroupListenerOptions {
    onData: (groups: ThesisGroup[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to all groups across all years/departments/courses (collectionGroup).
 *
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenAllGroups(options: GroupListenerOptions): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    return onSnapshot(
        groupsQuery,
        (snapshot) => {
            const groups = snapshot.docs
                .map((d) => docToThesisGroup(d))
                .filter((g): g is ThesisGroup => g !== null);
            options.onData(groups);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Groups listener error:', error);
        }
    );
}

/**
 * Listen to groups within a specific course.
 *
 * @param year Academic year
 * @param department Department identifier
 * @param course Course identifier
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenGroups(
    year: string,
    department: string,
    course: string,
    options: GroupListenerOptions
): () => void {
    const colPath = buildGroupsCollectionPath(year, department, course);
    const colRef = collection(firebaseFirestore, colPath);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
        q,
        (snapshot) => {
            const groups = snapshot.docs
                .map((d) => docToThesisGroup(d))
                .filter((g): g is ThesisGroup => g !== null);
            options.onData(groups);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Groups listener error:', error);
        }
    );
}

/**
 * Listen to groups where the given user is a panel member (collectionGroup).
 *
 * @param panelId Panel member UID
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenGroupsByPanelist(
    panelId: string,
    options: GroupListenerOptions
): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(
        groupsQuery,
        where('members.panels', 'array-contains', panelId),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(
        q,
        (snapshot) => {
            const groups = snapshot.docs
                .map((d) => docToThesisGroup(d))
                .filter((g): g is ThesisGroup => g !== null);
            options.onData(groups);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Groups by panelist listener error:', error);
        }
    );
}

/**
 * Listen to groups where the given user has a specific expert role (collectionGroup).
 *
 * @param role 'adviser' | 'editor' | 'statistician'
 * @param userId Expert UID
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenGroupsByExpertRole(
    role: 'adviser' | 'editor' | 'statistician',
    userId: string,
    options: GroupListenerOptions
): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(
        groupsQuery,
        where(`members.${role}`, '==', userId),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(
        q,
        (snapshot) => {
            const groups = snapshot.docs
                .map((d) => docToThesisGroup(d))
                .filter((g): g is ThesisGroup => g !== null);
            options.onData(groups);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error(`Groups by ${role} listener error:`, error);
        }
    );
}

// ============================================================================
// Context-Free Lookups (via collectionGroup)
// ============================================================================

/**
 * Find a group by ID across all years/departments/courses (searches via collectionGroup).
 * Use when you don't have the full context path.
 *
 * @param groupId Group document ID
 * @returns ThesisGroup if found, null otherwise
 */
export async function findGroupById(groupId: string): Promise<ThesisGroup | null> {
    // First try searching by 'id' field if stored on the document
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const qById = query(groupsQuery, where('id', '==', groupId));
    const snapshotById = await getDocs(qById);
    if (!snapshotById.empty) {
        return docToThesisGroup(snapshotById.docs[0]);
    }

    // Fall back to fetching all groups and filtering by document ID
    // This is less efficient but works when 'id' field is not stored
    console.warn(`Falling back to full scan to find group by ID: ${groupId}`);
    const allSnapshot = await getDocs(groupsQuery);
    const matchingDoc = allSnapshot.docs.find((docSnap) => docSnap.id === groupId);
    if (matchingDoc) {
        return docToThesisGroup(matchingDoc);
    }

    return null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Set a group document with a specific ID (upsert with merge).
 *
 * @param year Academic year
 * @param department Department identifier
 * @param course Course identifier
 * @param groupId Group document ID
 * @param data Group data to set
 */
export async function setGroup(
    year: string,
    department: string,
    course: string,
    groupId: string,
    data: Partial<ThesisGroup>
): Promise<void> {
    const docPath = buildGroupDocPath(year, department, course, groupId);
    const docRef = doc(firebaseFirestore, docPath);
    await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

// ============================================================================
// High-Level Convenience Functions (collectionGroup-based)
// ============================================================================

/**
 * Get groups by department across all years.
 *
 * @param department Department identifier
 * @returns Array of groups in the department
 */
export async function getGroupsByDepartment(department: string): Promise<ThesisGroup[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(groupsQuery, where('department', '==', department));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => docToThesisGroup(d))
        .filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get groups by course across all years.
 *
 * @param course Course identifier
 * @returns Array of groups in the course
 */
export async function getGroupsByCourse(course: string): Promise<ThesisGroup[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(groupsQuery, where('course', '==', course));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => docToThesisGroup(d))
        .filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get groups by leader user ID across all years.
 *
 * @param leaderId User ID of the group leader
 * @returns Array of groups led by this user
 */
export async function getGroupsByLeader(leaderId: string): Promise<ThesisGroup[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(groupsQuery, where('members.leader', '==', leaderId));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => docToThesisGroup(d))
        .filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get groups where user is a member (leader or team member) across all years.
 *
 * @param userId User ID
 * @returns Array of groups where user is a member
 */
export async function getGroupsByMember(userId: string): Promise<ThesisGroup[]> {
    // Firestore doesn't support OR queries easily, so we need two queries
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

    // Get groups where user is leader
    const leaderQuery = query(groupsQuery, where('members.leader', '==', userId));
    const leaderSnapshot = await getDocs(leaderQuery);

    // Get groups where user is in members array
    const memberQuery = query(groupsQuery, where('members.members', 'array-contains', userId));
    const memberSnapshot = await getDocs(memberQuery);

    // Combine and deduplicate
    const groupMap = new Map<string, ThesisGroup>();
    for (const docSnap of [...leaderSnapshot.docs, ...memberSnapshot.docs]) {
        const group = docToThesisGroup(docSnap);
        if (group && !groupMap.has(group.id)) {
            groupMap.set(group.id, group);
        }
    }

    return Array.from(groupMap.values());
}

/**
 * Get groups in a specific department and course.
 *
 * @param department Department identifier
 * @param course Course identifier
 * @returns Array of groups in the department and course
 */
export async function getGroupsInDepartmentCourse(
    department: string,
    course: string
): Promise<ThesisGroup[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(
        groupsQuery,
        where('department', '==', department),
        where('course', '==', course)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => docToThesisGroup(d))
        .filter((g): g is ThesisGroup => g !== null);
}

/**
 * Get unique departments that have groups.
 *
 * @returns Array of unique department identifiers
 */
export async function getGroupDepartments(): Promise<string[]> {
    const groups = await getAllGroups();
    const departments = new Set<string>();
    for (const group of groups) {
        if (group.department) {
            departments.add(group.department);
        }
    }
    return Array.from(departments);
}

/**
 * Get all theses from all groups.
 *
 * @returns Array of all thesis references with their group context
 */
export async function getAllThesesFromGroups(): Promise<
    { groupId: string; thesis: ThesisData }[]
> {
    const groups = await getAllGroups();
    return groups
        .filter((g): g is ThesisGroup & { thesis: ThesisData } => !!g.thesis)
        .map((g) => ({ groupId: g.id, thesis: g.thesis }));
}

// ============================================================================
// Invite & Join Request Convenience Functions
// ============================================================================

/**
 * Invite a user to join a group (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID to invite
 */
export async function inviteUserToGroup(groupId: string, userId: string): Promise<void> {
    const group = await findGroupById(groupId);
    if (!group) throw new Error('Group not found');

    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await addGroupInvite(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Remove an invite from a group (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID to remove invite for
 */
export async function removeInviteFromGroup(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await removeGroupInvite(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Accept an invite to join a group (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID accepting the invite
 */
export async function acceptInvite(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    // Remove invite and add as member
    await removeGroupInvite(ctx.year, ctx.department, ctx.course, groupId, userId);
    await addMemberToGroup(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Request to join a group (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID requesting to join
 */
export async function requestToJoinGroup(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await addGroupJoinRequest(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Cancel a join request (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID canceling the request
 */
export async function cancelJoinRequest(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await removeGroupJoinRequest(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Accept a join request (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID whose request is accepted
 */
export async function acceptJoinRequest(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    // Remove request and add as member
    await removeGroupJoinRequest(ctx.year, ctx.department, ctx.course, groupId, userId);
    await addMemberToGroup(ctx.year, ctx.department, ctx.course, groupId, userId);
}

/**
 * Reject a join request (finds group via collectionGroup).
 *
 * @param groupId Group ID
 * @param userId User ID whose request is rejected
 */
export async function rejectJoinRequest(groupId: string, userId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await removeGroupJoinRequest(ctx.year, ctx.department, ctx.course, groupId, userId);
}

// ============================================================================
// Group Status & Approval Functions
// ============================================================================

/**
 * Submit a group for review (changes status to 'pending').
 *
 * @param groupId Group ID
 */
export async function submitGroupForReview(groupId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await updateGroupStatus(ctx.year, ctx.department, ctx.course, groupId, 'review');
}

/**
 * Approve a group (changes status to 'active').
 *
 * @param groupId Group ID
 */
export async function approveGroup(groupId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    await updateGroupStatus(ctx.year, ctx.department, ctx.course, groupId, 'active');
}

/**
 * Reject a group with a reason (changes status to 'rejected').
 *
 * @param groupId Group ID
 * @param reason Rejection reason
 */
export async function rejectGroup(groupId: string, reason?: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    const docPath = buildGroupDocPath(ctx.year, ctx.department, ctx.course, groupId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        status: 'rejected',
        rejectionReason: reason || '',
        updatedAt: serverTimestamp(),
    });
}

/**
 * Assign a expert to a group.
 *
 * @param groupId Group ID
 * @param expertId Expert user ID
 * @param role Expert role ('adviser', 'editor', 'statistician')
 */
export async function assignExpertToGroup(
    groupId: string,
    expertId: string,
    role: 'adviser' | 'editor' | 'statistician'
): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    switch (role) {
        case 'adviser':
            await setGroupAdviser(ctx.year, ctx.department, ctx.course, groupId, expertId);
            break;
        case 'editor':
            await setGroupEditor(ctx.year, ctx.department, ctx.course, groupId, expertId);
            break;
        case 'statistician':
            await setGroupStatistician(ctx.year, ctx.department, ctx.course, groupId, expertId);
            break;
    }
}

// ============================================================================
// Helper: Get Group Context
// ============================================================================

/**
 * Get the context (year, department, course) for a group by its ID.
 * Uses collectionGroup query to find the group.
 * 
 * Note: Cannot use `__name__` or `documentId()` with collectionGroup queries
 * because they require full document paths, not just document IDs.
 *
 * @param groupId Group ID
 * @returns Context object or null if not found
 */
async function getGroupContext(
    groupId: string
): Promise<{ year: string; department: string; course: string } | null> {
    // First try by id field
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const qById = query(groupsQuery, where('id', '==', groupId));
    const snapshotById = await getDocs(qById);
    if (!snapshotById.empty) {
        return extractGroupContext(snapshotById.docs[0].ref.path);
    }

    // Fall back to fetching all and filtering by document ID
    const allSnapshot = await getDocs(groupsQuery);
    const matchingDoc = allSnapshot.docs.find((docSnap) => docSnap.id === groupId);
    if (matchingDoc) {
        return extractGroupContext(matchingDoc.ref.path);
    }

    return null;
}

// ============================================================================
// Context-Free Convenience Functions
// ============================================================================

/**
 * Create a group using department and course from user profile data.
 * This function computes the year and uses the profile's department/course.
 *
 * @param userDepartment User's department
 * @param userCourse User's course
 * @param data Group form data
 * @returns The created group ID
 */
export async function createGroupForUser(
    userDepartment: string,
    userCourse: string,
    data: ThesisGroupFormData
): Promise<string> {
    const year = getAcademicYear();
    return createGroup(year, userDepartment, userCourse, data);
}

/**
 * Delete a group by its ID (context-free version).
 * Uses collectionGroup to find the group context, then deletes.
 *
 * @param groupId Group document ID
 */
export async function deleteGroupById(groupId: string): Promise<void> {
    const ctx = await getGroupContext(groupId);
    if (!ctx) {
        throw new Error(`Group not found: ${groupId}`);
    }
    return deleteGroup(ctx.year, ctx.department, ctx.course, groupId);
}
