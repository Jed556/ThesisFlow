import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import type {
    DocumentData,
    DocumentSnapshot,
    QueryDocumentSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisGroup } from '../../../types/group';

const COLLECTION_NAME = 'groups';

type GroupSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

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
        const q = query(groupsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => mapGroupDocument(doc));
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
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const newGroupRef = doc(groupsRef);

        const sanitizedGroup = sanitizeGroupForWrite(group, { includeDefaultMembers: true });

        await setDoc(newGroupRef, {
            ...sanitizedGroup,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return {
            id: newGroupRef.id,
            ...group,
            members: normalizeGroupMembers(group.members),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
        const groupRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);

        const rest = { ...updates } as Partial<Omit<ThesisGroup, 'id'>>;
        const restRecord = rest as Record<string, unknown>;
        delete restRecord.id;
        delete restRecord.createdAt;
        delete restRecord.updatedAt;

        const updatePayload = sanitizeGroupForWrite(rest, { includeDefaultMembers: false });

        await updateDoc(groupRef, {
            ...updatePayload,
            updatedAt: serverTimestamp(),
        });
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
        const groupRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);
        await deleteDoc(groupRef);
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
        const groupRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);

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

        sanitized.updatedAt = serverTimestamp();

        await setDoc(groupRef, sanitized);
    } catch (error) {
        console.error('Error setting group:', error);
        throw new Error('Failed to set group');
    }
}
