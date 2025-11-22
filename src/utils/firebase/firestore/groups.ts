import {
    collection, doc, getDocs, getDoc, query, where, orderBy, serverTimestamp, writeBatch, onSnapshot
} from 'firebase/firestore';
import type {
    DocumentData, DocumentReference, DocumentSnapshot, QueryDocumentSnapshot, Timestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisGroup } from '../../../types/group';

const COLLECTION_NAME = 'groupIndex';
const GROUP_HIERARCHY_ROOT = 'groups';
const GROUP_META_FIELD = '__meta';
const DEFAULT_DEPARTMENT_SEGMENT = 'general';
const DEFAULT_COURSE_SEGMENT = 'common';

type GroupSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

interface GroupMeta {
    departmentKey: string;
    courseKey: string;
}

interface ResolvedGroupRefs {
    canonicalRef: DocumentReference<DocumentData>;
    indexRef: DocumentReference<DocumentData>;
    snapshot: DocumentSnapshot<DocumentData>;
    meta: GroupMeta;
    dataWithoutMeta: Record<string, unknown>;
}

const INTERNAL_FIELD_NAMES = [GROUP_META_FIELD];

function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }

    const normalised = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalised || fallback;
}

function buildGroupMeta(group: Partial<ThesisGroup>): GroupMeta {
    return {
        departmentKey: sanitizePathSegment(group.department ?? group.course ?? null, DEFAULT_DEPARTMENT_SEGMENT),
        courseKey: sanitizePathSegment(group.course ?? null, DEFAULT_COURSE_SEGMENT),
    };
}

function attachMeta(payload: Record<string, unknown>, meta: GroupMeta): Record<string, unknown> {
    return {
        ...payload,
        [GROUP_META_FIELD]: meta,
    };
}

function extractSnapshotDataAndMeta(snapshot: DocumentSnapshot<DocumentData>): {
    data: Record<string, unknown>;
    meta: GroupMeta;
} {
    const raw = snapshot.data();

    if (!raw) {
        throw new Error(`Group document "${snapshot.id}" is missing data.`);
    }

    const cloned = { ...(raw as Record<string, unknown>) };
    const metaSource = cloned[GROUP_META_FIELD];

    let meta: GroupMeta | undefined;
    if (metaSource && typeof metaSource === 'object') {
        const metaRecord = metaSource as Record<string, unknown>;
        const departmentKey = typeof metaRecord.departmentKey === 'string' ? metaRecord.departmentKey : undefined;
        const courseKey = typeof metaRecord.courseKey === 'string' ? metaRecord.courseKey : undefined;
        if (departmentKey && courseKey) {
            meta = { departmentKey, courseKey };
        }
    }

    delete cloned[GROUP_META_FIELD];

    return {
        data: cloned,
        meta: meta ?? buildGroupMeta(cloned as Partial<ThesisGroup>),
    };
}

export interface GroupListenerOptions {
    onData: (groups: ThesisGroup[]) => void;
    onError?: (error: Error) => void;
}

function getCanonicalGroupRef(groupId: string, meta: GroupMeta): DocumentReference<DocumentData> {
    return doc(firebaseFirestore, GROUP_HIERARCHY_ROOT, meta.departmentKey, meta.courseKey, groupId);
}

async function resolveGroupRefs(groupId: string): Promise<ResolvedGroupRefs> {
    const indexRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);
    const snapshot = await getDoc(indexRef);

    if (!snapshot.exists()) {
        throw new Error('Group not found');
    }

    const { data, meta } = extractSnapshotDataAndMeta(snapshot);

    return {
        canonicalRef: getCanonicalGroupRef(groupId, meta),
        indexRef,
        snapshot,
        meta,
        dataWithoutMeta: data,
    };
}

async function commitGroupUpdate(
    refs: ResolvedGroupRefs,
    updatePayload: Record<string, unknown>
): Promise<void> {
    const payloadWithTimestamps = attachMeta(
        {
            ...updatePayload,
            updatedAt: serverTimestamp(),
        },
        refs.meta
    );

    const batch = writeBatch(firebaseFirestore);
    batch.update(refs.canonicalRef, payloadWithTimestamps);
    batch.update(refs.indexRef, payloadWithTimestamps);
    await batch.commit();
}

async function moveGroupDocument(
    groupId: string,
    refs: ResolvedGroupRefs,
    nextData: Record<string, unknown>,
    nextMeta: GroupMeta
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);
    batch.delete(refs.canonicalRef);

    const basePayload = { ...nextData };
    if (!basePayload.createdAt) {
        basePayload.createdAt = refs.dataWithoutMeta.createdAt ?? serverTimestamp();
    }

    const payloadWithTimestamps = attachMeta(
        {
            ...basePayload,
            updatedAt: serverTimestamp(),
        },
        nextMeta
    );

    batch.set(getCanonicalGroupRef(groupId, nextMeta), payloadWithTimestamps);
    batch.set(refs.indexRef, payloadWithTimestamps);

    await batch.commit();
}

/**
 * Normalizes Firestore timestamp values into ISO8601 strings.
 */
function normalizeTimestamp(value: unknown): string | undefined {
    if (!value) {
        return undefined;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof (value as Timestamp)?.toDate === 'function') {
        return (value as Timestamp).toDate().toISOString();
    }

    return undefined;
}

/**
 * Builds a strongly typed ThesisGroup.members object from the Firestore payload.
 */
function normalizeGroupMembers(raw: unknown): ThesisGroup['members'] {
    if (!raw || typeof raw !== 'object') {
        return {
            leader: '',
            members: [],
        };
    }

    const rawMembers = raw as Record<string, unknown>;
    const leader = typeof rawMembers.leader === 'string' ? rawMembers.leader : '';
    const members = Array.isArray(rawMembers.members)
        ? rawMembers.members.filter((value): value is string => typeof value === 'string')
        : [];
    const normalised: ThesisGroup['members'] = {
        leader,
        members,
    };

    if (typeof rawMembers.adviser === 'string' && rawMembers.adviser) {
        normalised.adviser = rawMembers.adviser;
    }

    if (typeof rawMembers.editor === 'string' && rawMembers.editor) {
        normalised.editor = rawMembers.editor;
    }

    const panels = Array.isArray(rawMembers.panels)
        ? rawMembers.panels.filter((value): value is string => typeof value === 'string')
        : [];

    if (panels.length > 0) {
        normalised.panels = panels;
    }

    return normalised;
}

interface SanitizeMembersOptions {
    includeDefaults?: boolean;
}

function sanitizeMembersForWrite(
    members: Partial<ThesisGroup['members']> | undefined,
    options: SanitizeMembersOptions = {}
): Record<string, unknown> | undefined {
    if (!members) {
        return options.includeDefaults ? { leader: '', members: [] } : undefined;
    }

    const { includeDefaults = false } = options;
    const sanitized: Record<string, unknown> = {};

    if (members.leader !== undefined) {
        sanitized.leader = members.leader;
    } else if (includeDefaults) {
        sanitized.leader = '';
    }

    if (members.members !== undefined) {
        sanitized.members = members.members;
    } else if (includeDefaults) {
        sanitized.members = [];
    }

    if (members.adviser !== undefined) {
        sanitized.adviser = members.adviser ?? null;
    }

    if (members.editor !== undefined) {
        sanitized.editor = members.editor ?? null;
    }

    if (members.panels !== undefined) {
        sanitized.panels = members.panels;
    }

    if (Object.keys(sanitized).length === 0) {
        return includeDefaults ? { leader: '', members: [] } : undefined;
    }

    return sanitized;
}

interface SanitizeGroupOptions {
    includeDefaultMembers?: boolean;
}

function sanitizeGroupForWrite(
    group: Partial<Omit<ThesisGroup, 'id'>>,
    options: SanitizeGroupOptions = {}
): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const { includeDefaultMembers = false } = options;

    Object.entries(group).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }

        if (key === 'members') {
            const membersValue = sanitizeMembersForWrite(
                value as Partial<ThesisGroup['members']>,
                { includeDefaults: includeDefaultMembers }
            );

            if (membersValue !== undefined) {
                data.members = membersValue;
            }

            return;
        }

        data[key] = value;
    });

    return data;
}

function mapGroupDocument(snapshot: GroupSnapshot): ThesisGroup {
    const data = snapshot.data();

    if (!data) {
        throw new Error(`Group document "${snapshot.id}" is missing data.`);
    }

    const docData = { ...(data as Record<string, unknown>) };

    INTERNAL_FIELD_NAMES.forEach((field) => {
        delete docData[field];
    });

    const rawMembersField = docData.members;
    const legacyMembersArray = Array.isArray(rawMembersField)
        ? rawMembersField
        : undefined;
    const legacyLeader = docData.leader;
    const legacyAdviser = docData.adviser;
    const legacyEditor = docData.editor;
    const legacyPanels = docData.panels;

    const hasNestedMembers =
        rawMembersField && typeof rawMembersField === 'object' && !Array.isArray(rawMembersField);

    const membersPayload = hasNestedMembers
        ? rawMembersField
        : {
            leader: legacyLeader,
            members: legacyMembersArray,
            adviser: legacyAdviser,
            editor: legacyEditor,
            panels: legacyPanels,
        };

    delete docData.members;
    delete docData.leader;
    delete docData.adviser;
    delete docData.editor;
    delete docData.panels;

    const createdAt = docData.createdAt;
    const updatedAt = docData.updatedAt;

    delete docData.createdAt;
    delete docData.updatedAt;

    return {
        id: snapshot.id,
        ...(docData as Omit<ThesisGroup, 'id' | 'members' | 'createdAt' | 'updatedAt'>),
        members: normalizeGroupMembers(membersPayload),
        createdAt: normalizeTimestamp(createdAt) ?? new Date().toISOString(),
        updatedAt: normalizeTimestamp(updatedAt) ?? new Date().toISOString(),
    };
}

/**
 * Listen to groups where the specified mentor is assigned as adviser or editor.
 */
export function listenGroupsByMentorRole(
    role: 'adviser' | 'editor',
    mentorUid: string | null | undefined,
    options: GroupListenerOptions
): () => void {
    if (!mentorUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const fieldPath = role === 'adviser' ? 'members.adviser' : 'members.editor';
    const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const groupsQuery = query(groupsRef, where(fieldPath, '==', mentorUid));

    return onSnapshot(
        groupsQuery,
        (snapshot) => {
            const groups = snapshot.docs.map((docSnap) => mapGroupDocument(docSnap));
            options.onData(groups);
        },
        (error) => {
            if (options.onError) {
                options.onError(error as Error);
            } else {
                console.error('Group mentor listener error:', error);
            }
        }
    );
}

/**
 * Get all thesis groups
 */
export async function getAllGroups(): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const snapshot = await getDocs(query(groupsRef, orderBy('createdAt', 'desc')));

        return snapshot.docs.map((doc) => mapGroupDocument(doc));
    } catch (error) {
        console.error('Error getting groups:', error);
        throw new Error('Failed to fetch groups');
    }
}

/**
 * Get a specific group by ID
 */
export async function getGroupById(groupId: string): Promise<ThesisGroup | null> {
    try {
        const groupRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);
        const snapshot = await getDoc(groupRef);

        if (!snapshot.exists()) {
            return null;
        }

        return mapGroupDocument(snapshot);
    } catch (error) {
        console.error('Error getting group:', error);
        throw new Error('Failed to fetch group');
    }
}

/**
 * Get groups by status
 */
export async function getGroupsByStatus(status: ThesisGroup['status']): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('status', '==', status));
        const snapshot = await getDocs(q);

        return snapshot.docs
            .map((doc) => mapGroupDocument(doc))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
        console.error('Error getting groups by status:', error);
        throw new Error('Failed to fetch groups by status');
    }
}

/**
 * Get groups where the provided user UID is the designated leader.
 */
export async function getGroupsByLeader(leaderUid: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('members.leader', '==', leaderUid));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => mapGroupDocument(doc));
    } catch (error) {
        console.error('Error getting groups by leader:', error);
        throw new Error('Failed to fetch groups by leader');
    }
}

/**
 * Get groups where the provided user UID is listed as a member.
 */
export async function getGroupsByMember(memberUid: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('members.members', 'array-contains', memberUid));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => mapGroupDocument(doc));
    } catch (error) {
        console.error('Error getting groups by member:', error);
        throw new Error('Failed to fetch groups by member');
    }
}

/**
 * Create a new group
 */
export async function createGroup(group: Omit<ThesisGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<ThesisGroup> {
    try {
        const leaderUid = typeof group.members === 'object' && 'leader' in group.members
            ? group.members.leader
            : '';

        if (!leaderUid) {
            throw new Error('Leader UID is required to create a group');
        }

        const groupId = leaderUid;
        const meta = buildGroupMeta(group);
        const canonicalRef = getCanonicalGroupRef(groupId, meta);
        const indexRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);

        const sanitizedGroup = sanitizeGroupForWrite(group, { includeDefaultMembers: true });
        const payload = attachMeta(
            {
                ...sanitizedGroup,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            },
            meta
        );

        const batch = writeBatch(firebaseFirestore);
        batch.set(canonicalRef, payload);
        batch.set(indexRef, payload);
        await batch.commit();

        const now = new Date().toISOString();

        return {
            id: groupId,
            ...group,
            members: normalizeGroupMembers(group.members),
            createdAt: now,
            updatedAt: now,
        };
    } catch (error) {
        console.error('Error creating group:', error);
        throw new Error('Failed to create group');
    }
}

/**
 * Update an existing group
 */
export async function updateGroup(groupId: string, updates: Partial<ThesisGroup>): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);

        const rest = { ...updates } as Partial<Omit<ThesisGroup, 'id'>>;
        const restRecord = rest as Record<string, unknown>;
        delete restRecord.id;
        delete restRecord.createdAt;
        delete restRecord.updatedAt;

        const updatePayload = sanitizeGroupForWrite(rest, { includeDefaultMembers: false });

        if (Object.keys(updatePayload).length === 0) {
            return;
        }

        const mergedData = { ...refs.dataWithoutMeta, ...updatePayload } as Record<string, unknown>;
        const nextMeta = buildGroupMeta(mergedData as Partial<ThesisGroup>);
        const metaChanged =
            nextMeta.departmentKey !== refs.meta.departmentKey ||
            nextMeta.courseKey !== refs.meta.courseKey;

        if (metaChanged) {
            if (!mergedData.createdAt) {
                mergedData.createdAt = refs.dataWithoutMeta.createdAt ?? serverTimestamp();
            }

            await moveGroupDocument(groupId, refs, mergedData, nextMeta);
            return;
        }

        await commitGroupUpdate(refs, updatePayload);
    } catch (error) {
        console.error('Error updating group:', error);
        throw new Error('Failed to update group');
    }
}

/**
 * Delete a group
 */
export async function deleteGroup(groupId: string): Promise<void> {
    try {
        const indexRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);
        const snapshot = await getDoc(indexRef);

        if (!snapshot.exists()) {
            return;
        }

        const { meta } = extractSnapshotDataAndMeta(snapshot);

        const batch = writeBatch(firebaseFirestore);
        batch.delete(indexRef);
        batch.delete(getCanonicalGroupRef(groupId, meta));
        await batch.commit();
    } catch (error) {
        console.error('Error deleting group:', error);
        throw new Error('Failed to delete group');
    }
}

/**
 * Set a group document (for imports)
 */
export async function setGroup(groupId: string, group: ThesisGroup): Promise<void> {
    try {
        const meta = buildGroupMeta(group);
        const canonicalRef = getCanonicalGroupRef(groupId, meta);
        const indexRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);

        const rest = { ...group } as Partial<Omit<ThesisGroup, 'id'>>;
        const restRecord = rest as Record<string, unknown>;
        delete restRecord.id;
        delete restRecord.updatedAt;

        const includeDefaultMembers = Object.prototype.hasOwnProperty.call(rest, 'members');
        const sanitized = sanitizeGroupForWrite(rest, { includeDefaultMembers }) as Record<string, unknown> & {
            createdAt?: unknown;
            updatedAt?: unknown;
        };

        if (!('createdAt' in sanitized) || sanitized.createdAt === undefined) {
            sanitized.createdAt = serverTimestamp();
        }

        sanitized.updatedAt = sanitized.updatedAt ?? serverTimestamp();

        const payload = attachMeta(sanitized, meta);

        const batch = writeBatch(firebaseFirestore);
        batch.set(canonicalRef, payload);
        batch.set(indexRef, payload);
        await batch.commit();
    } catch (error) {
        console.error('Error setting group:', error);
        throw new Error('Failed to set group');
    }
}

/**
 * Get groups by course (students can only see groups in their course)
 */
export async function getGroupsByCourse(course: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('course', '==', course));
        const snapshot = await getDocs(q);

        return snapshot.docs
            .map((doc) => mapGroupDocument(doc))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
        console.error('Error getting groups by course:', error);
        throw new Error('Failed to fetch groups by course');
    }
}

/**
 * Get groups by department (heads can only see groups in their department)
 */
export async function getGroupsByDepartment(department: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('department', '==', department));
        const snapshot = await getDocs(q);

        return snapshot.docs
            .map((doc) => mapGroupDocument(doc))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
        console.error('Error getting groups by department:', error);
        throw new Error('Failed to fetch groups by department');
    }
}

/**
 * Fetch groups via the new hierarchical Firestore path for a specific department/course pair.
 */
export async function getGroupsInDepartmentCourse(
    department: string,
    course: string
): Promise<ThesisGroup[]> {
    try {
        const departmentKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
        const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
        const groupsRef = collection(firebaseFirestore, GROUP_HIERARCHY_ROOT, departmentKey, courseKey);
        const snapshot = await getDocs(query(groupsRef, orderBy('createdAt', 'desc')));

        return snapshot.docs.map((doc) => mapGroupDocument(doc));
    } catch (error) {
        console.error('Error getting hierarchical groups:', error);
        throw new Error('Failed to fetch hierarchical groups');
    }
}

/**
 * Send an invite to a student to join a group
 */
export async function inviteUserToGroup(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const invites = group.invites ?? [];

        if (invites.includes(userUid)) {
            throw new Error('User already invited');
        }

        await commitGroupUpdate(refs, {
            invites: [...invites, userUid],
        });
    } catch (error) {
        console.error('Error inviting user to group:', error);
        throw error;
    }
}

/**
 * Remove an invite from a group (user accepted or declined)
 */
export async function removeInviteFromGroup(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const invites = (group.invites ?? []).filter(uid => uid !== userUid);

        await commitGroupUpdate(refs, {
            invites,
        });
    } catch (error) {
        console.error('Error removing invite from group:', error);
        throw error;
    }
}

/**
 * Request to join a group
 */
export async function requestToJoinGroup(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const requests = group.requests ?? [];

        if (requests.includes(userUid)) {
            throw new Error('Request already sent');
        }

        await commitGroupUpdate(refs, {
            requests: [...requests, userUid],
        });
    } catch (error) {
        console.error('Error requesting to join group:', error);
        throw error;
    }
}

/**
 * Accept a join request and add the user to the group
 */
export async function acceptJoinRequest(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const requests = (group.requests ?? []).filter(uid => uid !== userUid);
        const members = [...new Set([...group.members.members, userUid])];

        await commitGroupUpdate(refs, {
            'members.members': members,
            requests,
        });
    } catch (error) {
        console.error('Error accepting join request:', error);
        throw error;
    }
}

/**
 * Reject a join request
 */
export async function rejectJoinRequest(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const requests = (group.requests ?? []).filter(uid => uid !== userUid);

        await commitGroupUpdate(refs, {
            requests,
        });
    } catch (error) {
        console.error('Error rejecting join request:', error);
        throw error;
    }
}

/**
 * Accept an invite and add the user to the group
 */
export async function acceptInvite(groupId: string, userUid: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        const group = mapGroupDocument(refs.snapshot as GroupSnapshot);
        const invites = (group.invites ?? []).filter(uid => uid !== userUid);
        const members = [...new Set([...group.members.members, userUid])];

        await commitGroupUpdate(refs, {
            'members.members': members,
            invites,
        });
    } catch (error) {
        console.error('Error accepting invite:', error);
        throw error;
    }
}

/**
 * Submit a group for review (draft -> review)
 */
export async function submitGroupForReview(groupId: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        await commitGroupUpdate(refs, { status: 'review' });
    } catch (error) {
        console.error('Error submitting group for review:', error);
        throw new Error('Failed to submit group for review');
    }
}

/**
 * Approve a group (review -> active)
 */
export async function approveGroup(groupId: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        await commitGroupUpdate(refs, {
            status: 'active',
            rejectionReason: null,
        });
    } catch (error) {
        console.error('Error approving group:', error);
        throw new Error('Failed to approve group');
    }
}

/**
 * Reject a group with a reason (review -> rejected)
 */
export async function rejectGroup(groupId: string, reason: string): Promise<void> {
    try {
        const refs = await resolveGroupRefs(groupId);
        await commitGroupUpdate(refs, {
            status: 'rejected',
            rejectionReason: reason,
        });
    } catch (error) {
        console.error('Error rejecting group:', error);
        throw new Error('Failed to reject group');
    }
}
