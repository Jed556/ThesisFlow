import {
    doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc,
    deleteDoc, documentId, writeBatch, type QueryConstraint, type QuerySnapshot,
    type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { UserProfile, UserRole } from '../../../types/profile';

/** Firestore collection name used for user documents */
const USERS_COLLECTION = 'users';

/**
 * Get the currently signed-in user's email from Firebase Auth.
 * @returns User email string or null when no user is signed in.
 */
export function getCurrentUserId(): string | null {
    const user = firebaseAuth.currentUser;
    return user?.uid ?? null;
}

/**
 * Convenience: fetch the currently signed-in user's profile from Firestore.
 * @returns UserProfile or null when no user is signed in or profile does not exist
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const uid = getCurrentUserId();
    if (!uid) return null;
    return await getUserById(uid);
}

// Generic users collection helpers
/**
 * Fetch a user profile by email from the `users` collection.
 * @param email - Email address to look up
 * @returns UserProfile or null when not found
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;
    const q = query(collection(firebaseFirestore, USERS_COLLECTION), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as UserProfile;
}

/**
 * Fetch a user profile by UID from the `users` collection.
 * @param uid - User ID to look up
 * @returns UserProfile or null when not found
 */
export async function getUserById(uid: string): Promise<UserProfile | null> {
    if (!uid) return null;
    const docRef = doc(firebaseFirestore, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as UserProfile;
}

/**
 * Find users by an arbitrary field/value pair.
 * Useful for quick queries such as `findUserByField('department', 'CS')`.
 * @param field - Firestore field to query
 * @param value - Value to match
 * @returns Array of matching UserProfile documents
 */
export async function findUserByField(field: string, value: unknown): Promise<UserProfile[]> {
    const q = query(collection(firebaseFirestore, USERS_COLLECTION), where(field, '==', value));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => doc.data() as UserProfile);
}

/**
 * Get all users in the `users` collection.
 * Note: For large collections this should be paginated or limited.
 * @returns Array of UserProfile
 */
export async function getAllUsers(): Promise<UserProfile[]> {
    const snap = await getDocs(collection(firebaseFirestore, USERS_COLLECTION));
    return snap.docs.map(d => d.data() as UserProfile);
}

/**
 * Fetch multiple user profiles by their Firebase Auth UIDs in chunks of 10.
 * @param uids - Array of user UIDs to resolve
 * @returns Array of UserProfile documents matching the provided UIDs
 */
export async function getUsersByIds(uids: string[]): Promise<UserProfile[]> {
    if (!uids || uids.length === 0) {
        return [];
    }

    const uniqueIds = Array.from(new Set(uids.map((uid) => encodeURIComponent(uid))));
    const users: UserProfile[] = [];
    const chunkSize = 10;

    for (let index = 0; index < uniqueIds.length; index += chunkSize) {
        const chunk = uniqueIds.slice(index, index + chunkSize);
        const usersRef = collection(firebaseFirestore, USERS_COLLECTION);
        const usersQuery = query(usersRef, where(documentId(), 'in', chunk));
        const snapshot = await getDocs(usersQuery);

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as UserProfile;
            const resolvedUid = data.uid ?? decodeURIComponent(docSnap.id);
            users.push({ ...data, uid: resolvedUid });
        });
    }

    return users;
}

/**
 * Options accepted by the real-time user listener.
 */
export interface UserListenerOptions {
    onData: (profiles: UserProfile[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Subscribe to users collection changes given optional filter constraints.
 * @param constraints - Optional Firestore query constraints to scope the listener
 * @param options - Listener callbacks invoked for data updates or errors
 * @returns Unsubscribe handler to detach the snapshot listener
 */
export function listenUsers(
    constraints: QueryConstraint[] | undefined,
    options: UserListenerOptions
): () => void {
    const { onData, onError } = options;
    const baseCollection = collection(firebaseFirestore, USERS_COLLECTION);
    const usersQuery = constraints && constraints.length > 0
        ? query(baseCollection, ...constraints)
        : baseCollection;

    return onSnapshot(
        usersQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const profiles = snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
            onData(profiles);
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Users listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to users filtered by role/department with real-time updates.
 * @param filter - Filter options applied to the users query
 * @param options - Listener callbacks invoked for updates or errors
 * @returns Unsubscribe handler to detach the listener
 */
export function listenUsersByFilter(
    filter: UserFilterOptions,
    options: UserListenerOptions
): () => void {
    const constraints: QueryConstraint[] = [];

    if (filter.role) {
        constraints.push(where('role', '==', filter.role));
    }

    if (filter.department) {
        constraints.push(where('department', '==', filter.department));
    }

    if (filter.course) {
        constraints.push(where('course', '==', filter.course));
    }

    return listenUsers(constraints, options);
}

export interface UserFilterOptions {
    role?: UserRole;
    department?: string;
    course?: string;
}

/**
 * Query users by optional role and department filters.
 * @param options Optional role and department to narrow the results
 */
export async function getUsersByFilter(options: UserFilterOptions = {}): Promise<UserProfile[]> {
    const constraints = [];

    if (options.role) {
        constraints.push(where('role', '==', options.role));
    }

    if (options.department) {
        constraints.push(where('department', '==', options.department));
    }

    if (options.course) {
        constraints.push(where('course', '==', options.course));
    }

    const baseCollection = collection(firebaseFirestore, USERS_COLLECTION);
    const usersQuery = constraints.length > 0 ? query(baseCollection, ...constraints) : baseCollection;
    const snap = await getDocs(usersQuery);
    return snap.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Create or update a user's profile in Firestore (merge mode).
 * @param uid - User ID to use as the document key
 * @param data - Partial UserProfile fields to write/merge
 */
export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!uid) throw new Error('uid required');
    const id = encodeURIComponent(uid);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);

    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData({ uid, ...data });

    await setDoc(ref, cleanedData, { merge: true });
}

/**
 * Delete a user profile document entirely from Firestore.
 * @param uid - User ID used for the document key
 */
export async function deleteUserProfile(uid: string): Promise<void> {
    if (!uid) throw new Error('User ID required');
    const id = encodeURIComponent(uid);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple user profiles by their UIDs
 * @param uids - Array of user UIDs to delete
 * @returns Promise that resolves when all deletions are complete
 */
export async function bulkDeleteUserProfiles(uids: string[]): Promise<void> {
    if (!uids || uids.length === 0) throw new Error('UIDs required');
    const batch = writeBatch(firebaseFirestore);

    uids.forEach((uid) => {
        const id = encodeURIComponent(uid);
        const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
        batch.delete(ref);
    });

    await batch.commit();
}

/**
 * Subscribe to realtime updates for a user profile document.
 * @param uid - User ID of the user to subscribe to
 * @param callback - Called with UserProfile|null on each change
 * @returns Unsubscribe function
 */
export function onUserProfile(
    uid: string | null | undefined,
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void
): () => void {
    if (!uid) return () => { /* no-op */ };
    const docRef = doc(firebaseFirestore, USERS_COLLECTION, uid);
    return onSnapshot(
        docRef,
        (snap) => {
            onData(snap.exists() ? (snap.data() as UserProfile) : null);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('User profile listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to realtime updates for the currently signed-in user's profile.
 * Useful to reflect role or profile changes live in the UI.
 * @param callback - Called with UserProfile|null when profile updates
 * @returns Unsubscribe function
 */
export function onCurrentUserProfile(
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void
): () => void {
    const uid = getCurrentUserId();
    if (!uid) return () => { /* no-op */ };
    return onUserProfile(uid, onData, onError);
}

/**
 * Get user profile by email (alias for getUserByEmail for backward compatibility)
 * @param uid - User ID to look up
 * @returns UserProfile or undefined when not found
 */
export async function getProfile(uid: string): Promise<UserProfile | undefined> {
    const profile = await getUserById(uid);
    return profile || undefined;
}

/**
 * Get formatted display name for user
 * @param uid - User ID of the user
 * @returns Formatted display name or UID as fallback
 */
export async function getDisplayName(uid: string): Promise<string> {
    const profile = await getProfile(uid);

    if (!profile) {
        return uid;
    }

    const parts: string[] = [];

    if (profile.name.prefix) {
        parts.push(profile.name.prefix);
    }
    parts.push(profile.name.first);
    if (profile.name.middle) {
        parts.push(profile.name.middle);
    }
    parts.push(profile.name.last);
    if (profile.name.suffix) {
        parts.push(profile.name.suffix);
    }

    return parts.join(' ');
}
