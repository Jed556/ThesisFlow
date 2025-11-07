import { doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
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
 * Check whether the specified user has the provided role.
 * @param uid - User ID of the user to check
 * @param role - Role to compare against
 * @returns true when the user's role matches, false otherwise
 */
export async function isUserInRole(uid: string, role: UserRole): Promise<boolean> {
    const profile = await getUserById(uid);
    if (!profile) return false;
    return profile.role === role;
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

    const deletePromises = uids.map(uid => {
        const id = encodeURIComponent(uid);
        const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Subscribe to realtime updates for a user profile document.
 * @param uid - User ID of the user to subscribe to
 * @param callback - Called with UserProfile|null on each change
 * @returns Unsubscribe function
 */
export function onUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
    if (!uid) return () => { /* No-op unsubscribe */ };
    const docRef = doc(firebaseFirestore, USERS_COLLECTION, uid);
    return onSnapshot(docRef, (snap) => {
        callback(snap.exists() ? (snap.data() as UserProfile) : null);
    });
}

/**
 * Subscribe to realtime updates for the currently signed-in user's profile.
 * Useful to reflect role or profile changes live in the UI.
 * @param callback - Called with UserProfile|null when profile updates
 * @returns Unsubscribe function
 */
export function onCurrentUserProfile(callback: (profile: UserProfile | null) => void) {
    const uid = getCurrentUserId();
    if (!uid) return () => { /* No-op unsubscribe */ };
    return onUserProfile(uid, callback);
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
