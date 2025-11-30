import {
    doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc, deleteDoc, writeBatch,
    type QueryConstraint, type QuerySnapshot, type DocumentData, serverTimestamp, collectionGroup,
} from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { cleanData } from './firestore';
import { USERS_SUBCOLLECTION } from '../../../config/firestore';
import {
    buildCourseUsersCollectionPath, buildCourseUserDocPath, buildDepartmentUsersCollectionPath,
    buildDepartmentUserDocPath, buildYearUsersCollectionPath, buildYearUserDocPath,
} from './paths';

import type { UserProfile, UserRole } from '../../../types/profile';

// ============================================================================
// Role-Based Path Classification
// ============================================================================

/** Roles that use course-level user paths */
const COURSE_LEVEL_ROLES: readonly UserRole[] = ['student'] as const;

/** Roles that use department-level user paths */
const DEPARTMENT_LEVEL_ROLES: readonly UserRole[] = [
    'statistician', 'editor', 'adviser', 'panel', 'moderator', 'head'
] as const;

/** Roles that use year-level user paths (global admins) */
const YEAR_LEVEL_ROLES: readonly UserRole[] = ['admin', 'developer'] as const;

/**
 * Determine the path level for a given user role
 */
export function getPathLevelForRole(role: UserRole): 'course' | 'department' | 'year' {
    if (COURSE_LEVEL_ROLES.includes(role)) return 'course';
    if (DEPARTMENT_LEVEL_ROLES.includes(role)) return 'department';
    if (YEAR_LEVEL_ROLES.includes(role)) return 'year';
    // Default to department if unknown
    return 'department';
}

// ============================================================================
// Context Types
// ============================================================================

export interface CourseUserContext {
    year: string;
    department: string;
    course: string;
}

export interface DepartmentUserContext {
    year: string;
    department: string;
}

export interface YearUserContext {
    year: string;
}

/**
 * Full user context that includes all possible path components
 */
export interface UserContext {
    year: string;
    department?: string;
    course?: string;
}

// ============================================================================
// Current User Helpers
// ============================================================================

/**
 * Get the currently signed-in user's UID from Firebase Auth.
 * @returns User UID string or null when no user is signed in.
 */
export function getCurrentUserId(): string | null {
    const user = firebaseAuth.currentUser;
    return user?.uid ?? null;
}

/**
 * Convenience: fetch the currently signed-in user's profile from Firestore.
 * Uses collectionGroup query to find the user across hierarchical paths.
 * @returns UserProfile or null when no user is signed in or profile does not exist
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const uid = getCurrentUserId();
    if (!uid) return null;
    return await findUserById(uid);
}

// ============================================================================
// User Lookup Functions (using collectionGroup)
// ============================================================================

/**
 * Find a user profile by UID using collectionGroup query.
 * Searches across all hierarchical user paths (course, department, year levels).
 * @param uid - User ID to look up
 * @returns UserProfile or null when not found
 */
export async function findUserById(uid: string): Promise<UserProfile | null> {
    if (!uid) return null;

    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where('uid', '==', uid));
    const snap = await getDocs(q);

    if (snap.empty) return null;
    return snap.docs[0].data() as UserProfile;
}

/**
 * Find a user profile by email using collectionGroup query.
 * @param email - Email address to look up
 * @returns UserProfile or null when not found
 */
export async function findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;

    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) return null;
    return snap.docs[0].data() as UserProfile;
}

/**
 * Find users by an arbitrary field/value pair using collectionGroup query.
 * @param field - Firestore field to query
 * @param value - Value to match
 * @returns Array of matching UserProfile documents
 */
export async function findUsersByField(field: string, value: unknown): Promise<UserProfile[]> {
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where(field, '==', value));
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Fetch multiple user profiles by their UIDs using collectionGroup query.
 * Processes in chunks of 10 to respect Firestore IN query limits.
 * @param uids - Array of user UIDs to resolve
 * @returns Array of UserProfile documents matching the provided UIDs
 */
export async function findUsersByIds(uids: string[]): Promise<UserProfile[]> {
    if (!uids || uids.length === 0) {
        return [];
    }

    const uniqueIds = Array.from(new Set(uids));
    const users: UserProfile[] = [];
    const chunkSize = 10;

    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);

    for (let index = 0; index < uniqueIds.length; index += chunkSize) {
        const chunk = uniqueIds.slice(index, index + chunkSize);
        const q = query(usersGroup, where('uid', 'in', chunk));
        const snapshot = await getDocs(q);

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as UserProfile;
            users.push(data);
        });
    }

    return users;
}

/**
 * Get all users across all hierarchical paths using collectionGroup query.
 * Note: For large collections this should be paginated or limited.
 * @returns Array of UserProfile
 */
export async function findAllUsers(): Promise<UserProfile[]> {
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const snap = await getDocs(usersGroup);

    return snap.docs.map(d => d.data() as UserProfile);
}

// ============================================================================
// User Filter Options and Queries
// ============================================================================

export interface UserFilterOptions {
    role?: UserRole;
    department?: string;
    course?: string;
}

/**
 * Options accepted by the real-time user listener.
 */
export interface UserListenerOptions {
    onData: (profiles: UserProfile[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Query users by optional role, department, and course filters using collectionGroup.
 * @param options - Optional role, department, and course to narrow the results
 * @returns Array of matching UserProfile documents
 */
export async function findUsersByFilter(options: UserFilterOptions = {}): Promise<UserProfile[]> {
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const constraints: QueryConstraint[] = [];

    if (options.role) {
        constraints.push(where('role', '==', options.role));
    }

    if (options.department) {
        constraints.push(where('department', '==', options.department));
    }

    if (options.course) {
        constraints.push(where('course', '==', options.course));
    }

    const q = constraints.length > 0
        ? query(usersGroup, ...constraints)
        : usersGroup;

    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Subscribe to users collection changes using collectionGroup with optional filters.
 * @param constraints - Optional Firestore query constraints to scope the listener
 * @param options - Listener callbacks invoked for data updates or errors
 * @returns Unsubscribe handler to detach the snapshot listener
 */
export function listenUsers(
    constraints: QueryConstraint[] | undefined,
    options: UserListenerOptions
): () => void {
    const { onData, onError } = options;
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);

    const usersQuery = constraints && constraints.length > 0
        ? query(usersGroup, ...constraints)
        : usersGroup;

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
 * Subscribe to users filtered by role/department/course with real-time updates.
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

// ============================================================================
// User Profile Write Operations
// ============================================================================

/**
 * Build the correct document path for a user based on their role and context.
 * @param userId - User's UID
 * @param role - User's role
 * @param context - Context containing year, department, course
 * @returns Document path for the user
 */
export function buildUserDocPath(
    userId: string,
    role: UserRole,
    context: UserContext
): string {
    const pathLevel = getPathLevelForRole(role);

    switch (pathLevel) {
        case 'course':
            if (!context.department || !context.course) {
                throw new Error('Course-level users require department and course in context');
            }
            return buildCourseUserDocPath(context.year, context.department, context.course, userId);

        case 'department':
            if (!context.department) {
                throw new Error('Department-level users require department in context');
            }
            return buildDepartmentUserDocPath(context.year, context.department, userId);

        case 'year':
            return buildYearUserDocPath(context.year, userId);

        default:
            throw new Error(`Unknown path level for role: ${role}`);
    }
}

/**
 * Create or update a user's profile in Firestore using hierarchical path.
 * The path is determined by the user's role and context.
 * @param userId - User ID
 * @param role - User's role (determines path level)
 * @param context - Context containing year, department, course
 * @param data - Partial UserProfile fields to write/merge
 */
export async function setUserProfile(
    userId: string,
    role: UserRole,
    context: UserContext,
    data: Partial<UserProfile>
): Promise<void> {
    if (!userId) throw new Error('userId required');

    const docPath = buildUserDocPath(userId, role, context);
    const docRef = doc(firebaseFirestore, docPath);

    // Clean data: use 'update' mode since we're using merge (keeps null to delete fields)
    const cleanedData = cleanData({
        uid: userId,
        role,
        ...data,
        updatedAt: serverTimestamp(),
    }, 'update');

    await setDoc(docRef, cleanedData, { merge: true });
}

/**
 * Update an existing user's profile by finding their document first.
 * Use this when you don't have the full context (year/department/course).
 * @param userId - User ID to update
 * @param data - Partial UserProfile fields to merge
 */
export async function updateUserProfile(
    userId: string,
    data: Partial<UserProfile>
): Promise<void> {
    if (!userId) throw new Error('userId required');

    // Find the user document first using collectionGroup
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where('uid', '==', userId));
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error(`User with ID ${userId} not found`);
    }

    // Update the found document
    const docRef = snap.docs[0].ref;

    const cleanedData = cleanData({
        ...data,
        updatedAt: serverTimestamp(),
    }, 'update');

    await setDoc(docRef, cleanedData, { merge: true });
}

/**
 * Create a new user profile in Firestore using hierarchical path.
 * @param userId - User ID
 * @param role - User's role (determines path level)
 * @param context - Context containing year, department, course
 * @param data - Full UserProfile data to create
 */
export async function createUserProfile(
    userId: string,
    role: UserRole,
    context: UserContext,
    data: Omit<UserProfile, 'uid' | 'role'>
): Promise<void> {
    if (!userId) throw new Error('userId required');

    const docPath = buildUserDocPath(userId, role, context);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = cleanData({
        uid: userId,
        role,
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, 'create');

    await setDoc(docRef, cleanedData);
}

/**
 * Delete a user profile document from Firestore.
 * Searches for the user across all hierarchical paths and deletes if found.
 * @param uid - User ID used for the document key
 */
export async function deleteUserProfile(uid: string): Promise<void> {
    if (!uid) throw new Error('User ID required');

    // Find the user document first using collectionGroup
    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where('uid', '==', uid));
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error(`User with ID ${uid} not found`);
    }

    // Delete all matching documents (should only be one)
    const batch = writeBatch(firebaseFirestore);
    snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
    });

    await batch.commit();
}

/**
 * Delete multiple user profiles by their UIDs
 * @param uids - Array of user UIDs to delete
 * @returns Promise that resolves when all deletions are complete
 */
export async function bulkDeleteUserProfiles(uids: string[]): Promise<void> {
    if (!uids || uids.length === 0) throw new Error('UIDs required');

    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const batch = writeBatch(firebaseFirestore);

    // Process in chunks for IN query limit
    const chunkSize = 10;
    for (let index = 0; index < uids.length; index += chunkSize) {
        const chunk = uids.slice(index, index + chunkSize);
        const q = query(usersGroup, where('uid', 'in', chunk));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
    }

    await batch.commit();
}

// ============================================================================
// User Profile Listeners
// ============================================================================

/**
 * Subscribe to realtime updates for a user profile document.
 * Uses collectionGroup query to find the user across hierarchical paths.
 * @param uid - User ID of the user to subscribe to
 * @param onData - Called with UserProfile|null on each change
 * @param onError - Optional error callback
 * @returns Unsubscribe function
 */
export function onUserProfile(
    uid: string | null | undefined,
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void
): () => void {
    if (!uid) return () => { /* no-op */ };

    const usersGroup = collectionGroup(firebaseFirestore, USERS_SUBCOLLECTION);
    const q = query(usersGroup, where('uid', '==', uid));

    return onSnapshot(
        q,
        (snap) => {
            if (snap.empty) {
                onData(null);
            } else {
                onData(snap.docs[0].data() as UserProfile);
            }
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
 * @param onData - Called with UserProfile|null when profile updates
 * @param onError - Optional error callback
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

// ============================================================================
// Context-Specific User Operations
// ============================================================================

/**
 * Add a user to a course user collection
 */
export async function addCourseUser(
    ctx: CourseUserContext,
    userId: string,
    data?: Partial<UserProfile>
): Promise<void> {
    const docPath = buildCourseUserDocPath(ctx.year, ctx.department, ctx.course, userId);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        uid: userId,
        ...data,
        addedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Get a user from a course user collection
 */
export async function getCourseUser(
    ctx: CourseUserContext,
    userId: string
): Promise<UserProfile | null> {
    const docPath = buildCourseUserDocPath(ctx.year, ctx.department, ctx.course, userId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docSnap.data() as UserProfile;
}

/**
 * Get all users in a course
 */
export async function getCourseUsers(
    ctx: CourseUserContext,
    constraints?: QueryConstraint[]
): Promise<UserProfile[]> {
    const collectionPath = buildCourseUsersCollectionPath(ctx.year, ctx.department, ctx.course);
    const usersRef = collection(firebaseFirestore, collectionPath);
    const q = constraints?.length
        ? query(usersRef, ...constraints)
        : usersRef;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Remove a user from a course user collection
 */
export async function removeCourseUser(ctx: CourseUserContext, userId: string): Promise<void> {
    const docPath = buildCourseUserDocPath(ctx.year, ctx.department, ctx.course, userId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Listen to course users
 */
export function listenCourseUsers(
    ctx: CourseUserContext,
    options: UserListenerOptions
): () => void {
    const collectionPath = buildCourseUsersCollectionPath(ctx.year, ctx.department, ctx.course);
    const usersRef = collection(firebaseFirestore, collectionPath);

    return onSnapshot(
        usersRef,
        (snapshot) => {
            const users = snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
            options.onData(users);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Course users listener error:', error);
        }
    );
}

/**
 * Add a user to a department user collection
 */
export async function addDepartmentUser(
    ctx: DepartmentUserContext,
    userId: string,
    data?: Partial<UserProfile>
): Promise<void> {
    const docPath = buildDepartmentUserDocPath(ctx.year, ctx.department, userId);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        uid: userId,
        ...data,
        addedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Get a user from a department user collection
 */
export async function getDepartmentUser(
    ctx: DepartmentUserContext,
    userId: string
): Promise<UserProfile | null> {
    const docPath = buildDepartmentUserDocPath(ctx.year, ctx.department, userId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docSnap.data() as UserProfile;
}

/**
 * Get all users in a department
 */
export async function getDepartmentUsers(
    ctx: DepartmentUserContext,
    constraints?: QueryConstraint[]
): Promise<UserProfile[]> {
    const collectionPath = buildDepartmentUsersCollectionPath(ctx.year, ctx.department);
    const usersRef = collection(firebaseFirestore, collectionPath);
    const q = constraints?.length
        ? query(usersRef, ...constraints)
        : usersRef;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Remove a user from a department user collection
 */
export async function removeDepartmentUser(ctx: DepartmentUserContext, userId: string): Promise<void> {
    const docPath = buildDepartmentUserDocPath(ctx.year, ctx.department, userId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Listen to department users
 */
export function listenDepartmentUsers(
    ctx: DepartmentUserContext,
    options: UserListenerOptions
): () => void {
    const collectionPath = buildDepartmentUsersCollectionPath(ctx.year, ctx.department);
    const usersRef = collection(firebaseFirestore, collectionPath);

    return onSnapshot(
        usersRef,
        (snapshot) => {
            const users = snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
            options.onData(users);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Department users listener error:', error);
        }
    );
}

/**
 * Add a user to a year user collection (for admin/developer roles)
 */
export async function addYearUser(
    ctx: YearUserContext,
    userId: string,
    data?: Partial<UserProfile>
): Promise<void> {
    const docPath = buildYearUserDocPath(ctx.year, userId);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        uid: userId,
        ...data,
        addedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Get a user from a year user collection
 */
export async function getYearUser(
    ctx: YearUserContext,
    userId: string
): Promise<UserProfile | null> {
    const docPath = buildYearUserDocPath(ctx.year, userId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docSnap.data() as UserProfile;
}

/**
 * Get all users in a year (admin/developer level)
 */
export async function getYearUsers(
    ctx: YearUserContext,
    constraints?: QueryConstraint[]
): Promise<UserProfile[]> {
    const collectionPath = buildYearUsersCollectionPath(ctx.year);
    const usersRef = collection(firebaseFirestore, collectionPath);
    const q = constraints?.length
        ? query(usersRef, ...constraints)
        : usersRef;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
}

/**
 * Remove a user from a year user collection
 */
export async function removeYearUser(ctx: YearUserContext, userId: string): Promise<void> {
    const docPath = buildYearUserDocPath(ctx.year, userId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Listen to year users
 */
export function listenYearUsers(
    ctx: YearUserContext,
    options: UserListenerOptions
): () => void {
    const collectionPath = buildYearUsersCollectionPath(ctx.year);
    const usersRef = collection(firebaseFirestore, collectionPath);

    return onSnapshot(
        usersRef,
        (snapshot) => {
            const users = snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
            options.onData(users);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Year users listener error:', error);
        }
    );
}
