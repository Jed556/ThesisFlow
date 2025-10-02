import { firebaseFirestore, firebaseAuth } from './firebaseConfig';
import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

/** Firestore collection name used for user documents */
const USERS_COLLECTION = 'users';
const THESES_COLLECTION = 'theses';
const FILES_COLLECTION = 'files';
const EVENTS_COLLECTION = 'events';
const ACADEMIC_CALENDARS_COLLECTION = 'academic_calendars';

// ==========================
// Profile helpers
// ==========================

import type { UserProfile, UserRole } from '../../types/profile';

/**
 * Get the currently signed-in user's email from Firebase Auth.
 * @returns User email string or null when no user is signed in.
 */
export function getCurrentUserEmail(): string | null {
    const user = firebaseAuth.currentUser;
    return user?.email ?? null;
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
 * Create or update a user's profile in Firestore (merge mode).
 * Uses an encoded email as the document id to make lookups deterministic.
 * @param email - Email to use as the document key
 * @param data - Partial UserProfile fields to write/merge
 */
export async function setUserProfile(email: string, data: Partial<UserProfile>): Promise<void> {
    if (!email) throw new Error('email required');
    const id = encodeURIComponent(email);
    const ref = doc(firebaseFirestore, USERS_COLLECTION, id);
    await setDoc(ref, { email, ...data }, { merge: true });
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
 * Get all users in the `users` collection.
 * Note: For large collections this should be paginated or limited.
 * @returns Array of UserProfile
 */
export async function getAllUsers(): Promise<UserProfile[]> {
    const snap = await getDocs(collection(firebaseFirestore, USERS_COLLECTION));
    return snap.docs.map(d => d.data() as UserProfile);
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
 * Convenience: fetch the currently signed-in user's profile from Firestore.
 * @returns UserProfile or null when no user is signed in or profile does not exist
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const email = getCurrentUserEmail();
    if (!email) return null;
    return await getUserByEmail(email);
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

// ==========================
// Thesis helpers
// ==========================

import type { ThesisData } from '../../types/thesis';

/**
 * Get a thesis data by id
 * @param id - thesis id
 */
export async function getThesisById(id: string): Promise<ThesisData | null> {
    const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as ThesisData;
}

/**
 * Create or update a thesis document
 */
export async function setThesis(id: string | null, data: ThesisData): Promise<string> {
    if (id) {
        const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
        await setDoc(ref, data, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, THESES_COLLECTION), data as any);
        return ref.id;
    }
}

// ==========================
// File helpers
// ==========================

import type { FileAttachment } from '../../types/file';

/**
 * Store or update file metadata record in Firestore
 */
export async function setFileRecord(hash: string, fileInfo: FileAttachment): Promise<void> {
    const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);
    await setDoc(ref, fileInfo, { merge: true });
}

/**
 * Get file metadata by hash
 */
export async function getFileByHash(hash: string): Promise<FileAttachment | null> {
    const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FileAttachment;
}

// ==========================
// Schedule / Event helpers
// ==========================

import type { ScheduleEvent } from '../../types/schedule';

/**
 * Create or update a schedule event
 */
export async function setEvent(id: string | null, event: ScheduleEvent): Promise<string> {
    if (id) {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        await setDoc(ref, event, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, EVENTS_COLLECTION), event as any);
        return ref.id;
    }
}

/**
 * Get an event by id
 */
export async function getEventById(id: string): Promise<ScheduleEvent | null> {
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as ScheduleEvent;
}

/**
 * Subscribe to realtime updates for an event
 */
export function onEvent(id: string, cb: (event: ScheduleEvent | null) => void) {
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    return onSnapshot(ref, snap => cb(snap.exists() ? (snap.data() as ScheduleEvent) : null));
}

// ==========================
// Academic calendars helpers
// ==========================

import type { AcademicCalendar } from '../../types/schedule';

/**
 * Get academic calendar by id
 */
export async function getAcademicCalendarById(id: string): Promise<AcademicCalendar | null> {
    const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as AcademicCalendar;
}

/**
 * Create or update academic calendar
 */
export async function setAcademicCalendar(id: string | null, cal: AcademicCalendar): Promise<string> {
    if (id) {
        const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
        await setDoc(ref, cal, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION), cal as any);
        return ref.id;
    }
}
