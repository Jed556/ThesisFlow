import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { UserProfile, UserRole } from '../../../types/profile';

/** Firestore collection name used for user documents */
const USERS_COLLECTION = 'users';

/**
 * Get the currently signed-in user's email from Firebase Auth.
 * @returns User email string or null when no user is signed in.
 */
export function getCurrentUserEmail(): string | null {
    const user = firebaseAuth.currentUser;
    return user?.email ?? null;
}

/**
 * Convenience: fetch the currently signed-in user's profile from Firestore.
 * @returns UserProfile or null when no user is signed in or profile does not exist
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const email = getCurrentUserEmail();
    if (!email) return null;
    return await getUserByEmail(email);
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
 * Find users by an arbitrary field/value pair.
 * Useful for quick queries such as `findUserByField('department', 'CS')`.
 * @param field - Firestore field to query
 * @param value - Value to match
 * @returns Array of matching UserProfile documents
 */
export async function findUserByField(field: string, value: any): Promise<UserProfile[]> {
    const q = query(collection(firebaseFirestore, USERS_COLLECTION), where(field, '==', value));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
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
 * @param email - Email of the user to check
 * @param role - Role to compare against
 * @returns true when the user's role matches, false otherwise
 */
export async function isUserInRole(email: string, role: UserRole): Promise<boolean> {
    const profile = await getUserByEmail(email);
    if (!profile) return false;
    return profile.role === role;
}

/**
 * Create or update a user's profile in Firestore (merge mode).
 * Uses an encoded email as the document id to make lookups deterministic.
 * @param email - Email to use as the document key
 * @param data - Partial UserProfile fields to write/merge
 */
export async function setUserProfile(email: string, data: Partial<UserProfile>): Promise<void> {
    if (!email) throw new Error('email required');
    const id = encodeURIComponent(email);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);

    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData({ email, ...data });

    await setDoc(ref, cleanedData, { merge: true });
}

/**
 * Delete a user profile document entirely from Firestore.
 * @param email - Email used for the document key
 */
export async function deleteUserProfile(email: string): Promise<void> {
    if (!email) throw new Error('email required');
    const id = encodeURIComponent(email);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple user profiles by their emails
 * @param emails - Array of user emails to delete
 * @returns Promise that resolves when all deletions are complete
 */
export async function bulkDeleteUserProfiles(emails: string[]): Promise<void> {
    if (!emails || emails.length === 0) throw new Error('Emails required');

    const deletePromises = emails.map(email => {
        const id = encodeURIComponent(email);
        const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Subscribe to realtime updates for a user profile document.
 * @param email - Email of the user to subscribe to
 * @param callback - Called with UserProfile|null on each change
 * @returns Unsubscribe function
 */
export function onUserProfile(email: string, callback: (profile: UserProfile | null) => void) {
    if (!email) return () => { };
    const id = encodeURIComponent(email);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
    return onSnapshot(ref, snap => {
        if (!snap.exists()) return callback(null);
        callback(snap.data() as UserProfile);
    });
}

/**
 * Subscribe to realtime updates for the currently signed-in user's profile.
 * Useful to reflect role or profile changes live in the UI.
 * @param callback - Called with UserProfile|null when profile updates
 * @returns Unsubscribe function
 */
export function onCurrentUserProfile(callback: (profile: UserProfile | null) => void) {
    const email = getCurrentUserEmail();
    if (!email) return () => { };
    return onUserProfile(email, callback);
}
