import {
    collection, doc, getDocs, getDoc, setDoc, deleteDoc, query,
    where, orderBy, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { ThesisGroup } from '../../../types/group';

const COLLECTION_NAME = 'groups';

/**
 * Get all thesis groups
 */
export async function getAllGroups(): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const snapshot = await getDocs(query(groupsRef, orderBy('createdAt', 'desc')));

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as ThesisGroup;
        });
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

        const data = snapshot.data();
        return {
            id: snapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as ThesisGroup;
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

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as ThesisGroup;
        });
    } catch (error) {
        console.error('Error getting groups by status:', error);
        throw new Error('Failed to fetch groups by status');
    }
}

/**
 * Get groups where user is leader
 */
export async function getGroupsByLeader(leaderEmail: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('leader', '==', leaderEmail));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as ThesisGroup;
        });
    } catch (error) {
        console.error('Error getting groups by leader:', error);
        throw new Error('Failed to fetch groups by leader');
    }
}

/**
 * Get groups where user is a member
 */
export async function getGroupsByMember(memberEmail: string): Promise<ThesisGroup[]> {
    try {
        const groupsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(groupsRef, where('members', 'array-contains', memberEmail));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as ThesisGroup;
        });
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

        const groupData = {
            ...group,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(newGroupRef, groupData);

        return {
            id: newGroupRef.id,
            ...group,
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

        // Remove id, createdAt from updates
        const { id, createdAt, ...updateData } = updates as Partial<ThesisGroup>;

        await updateDoc(groupRef, {
            ...updateData,
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

        const groupData: Record<string, unknown> = {
            ...group,
            updatedAt: serverTimestamp(),
        };

        // If no createdAt, add it
        if (!group.createdAt) {
            groupData.createdAt = serverTimestamp();
        }

        await setDoc(groupRef, groupData);
    } catch (error) {
        console.error('Error setting group:', error);
        throw new Error('Failed to set group');
    }
}
