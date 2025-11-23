import {
    collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc,
    where, writeBatch, type DocumentData, type DocumentReference, type DocumentSnapshot, type QueryDocumentSnapshot,
    type QueryConstraint, type QuerySnapshot
} from 'firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { UserProfile, UserRole } from '../../../types/profile';

export const USER_HIERARCHY_ROOT = 'users';
const DEFAULT_DEPARTMENT_SEGMENT = 'general';
const DEFAULT_COURSE_SEGMENT = 'common';
const DEPARTMENT_USERS_COLLECTION = 'departmentUsers';
const COURSES_COLLECTION = 'courses';
const STUDENTS_COLLECTION = 'students';

const ROOT_SCOPE_ROLES: ReadonlySet<UserRole> = new Set(['admin', 'developer']);
const DEPARTMENT_SCOPE_ROLES: ReadonlySet<UserRole> = new Set([
    'moderator',
    'head',
    'adviser',
    'editor',
    'statistician',
    'panel',
]);
const COURSE_SCOPE_ROLES: ReadonlySet<UserRole> = new Set(['student']);

type UserScope = 'root' | 'department' | 'course';
type ScopeIdentifier = UserScope;

interface UserPathInfo {
    scope: UserScope;
    pathSegments: string[];
}

interface LocatedUserDocument {
    scope: UserScope;
    docRef: DocumentReference<DocumentData>;
    snapshot: DocumentSnapshot<DocumentData>;
}

type AnyDocSnapshot = QueryDocumentSnapshot<unknown> | DocumentSnapshot<unknown>;

interface ScopeMaps {
    root: Map<string, UserProfile>;
    department: Map<string, UserProfile>;
    course: Map<string, UserProfile>;
}

function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }

    const normalised = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

    return normalised || fallback;
}

function resolveDepartmentKey(profile: Partial<UserProfile>): string {
    const departmentSource = profile.department
        ?? profile.departments?.[0]
        ?? profile.course
        ?? DEFAULT_DEPARTMENT_SEGMENT;
    return sanitizePathSegment(departmentSource, DEFAULT_DEPARTMENT_SEGMENT);
}

function resolveCourseKey(profile: Partial<UserProfile>): string {
    const courseSource = profile.course
        ?? profile.moderatedCourses?.[0]
        ?? profile.department
        ?? DEFAULT_COURSE_SEGMENT;
    return sanitizePathSegment(courseSource, DEFAULT_COURSE_SEGMENT);
}

function determineScope(profile: Partial<UserProfile>): UserScope {
    const role = profile.role as UserRole | undefined;
    if (role && ROOT_SCOPE_ROLES.has(role)) {
        return 'root';
    }
    if (role && COURSE_SCOPE_ROLES.has(role)) {
        return 'course';
    }
    if (role && DEPARTMENT_SCOPE_ROLES.has(role)) {
        return 'department';
    }
    if (profile.course) {
        return 'course';
    }
    return 'department';
}

function buildUserPathInfo(profile: Partial<UserProfile>): UserPathInfo {
    const scope = determineScope(profile);
    if (scope === 'root') {
        return { scope, pathSegments: [] };
    }

    const departmentKey = resolveDepartmentKey(profile);
    if (scope === 'department') {
        return {
            scope,
            pathSegments: [departmentKey, DEPARTMENT_USERS_COLLECTION],
        };
    }

    const courseKey = resolveCourseKey(profile);
    return {
        scope: 'course',
        pathSegments: [departmentKey, COURSES_COLLECTION, courseKey, STUDENTS_COLLECTION],
    };
}

function getUserDocRef(uid: string, info: UserPathInfo): DocumentReference<DocumentData> {
    if (info.scope === 'root') {
        return doc(firebaseFirestore, USER_HIERARCHY_ROOT, uid);
    }
    return doc(firebaseFirestore, USER_HIERARCHY_ROOT, ...info.pathSegments, uid);
}

function mapUserSnapshot(snapshot: AnyDocSnapshot): UserProfile | null {
    const raw = snapshot.data() as Record<string, unknown> | undefined;
    if (!raw || typeof raw.role !== 'string') {
        return null;
    }

    const uid = typeof raw.uid === 'string' ? raw.uid : snapshot.id;
    return { ...(raw as unknown as UserProfile), uid };
}

async function queryCollectionGroupForUid(collectionId: string, uid: string): Promise<DocumentSnapshot<DocumentData> | null> {
    const cg = collectionGroup(firebaseFirestore, collectionId);
    const cgQuery = query(cg, where('uid', '==', uid), limit(1));
    const cgSnapshot = await getDocs(cgQuery);
    if (cgSnapshot.empty) {
        return null;
    }
    return cgSnapshot.docs[0];
}

async function locateUserDocument(uid: string): Promise<LocatedUserDocument | null> {
    const rootRef = doc(firebaseFirestore, USER_HIERARCHY_ROOT, uid);
    const rootSnap = await getDoc(rootRef);
    if (rootSnap.exists()) {
        return { scope: 'root', docRef: rootRef, snapshot: rootSnap };
    }

    const departmentSnap = await queryCollectionGroupForUid(DEPARTMENT_USERS_COLLECTION, uid);
    if (departmentSnap) {
        return { scope: 'department', docRef: departmentSnap.ref, snapshot: departmentSnap };
    }

    const courseSnap = await queryCollectionGroupForUid(STUDENTS_COLLECTION, uid);
    if (courseSnap) {
        return { scope: 'course', docRef: courseSnap.ref, snapshot: courseSnap };
    }

    return null;
}

function buildWritePayload(
    uid: string,
    mergedData: Record<string, unknown>,
    existingCreatedAt: unknown
): Record<string, unknown> {
    const timestamp = serverTimestamp();
    const payload: Record<string, unknown> = {
        ...mergedData,
        uid,
        updatedAt: timestamp,
    };

    if (!('createdAt' in mergedData) || mergedData.createdAt === undefined) {
        payload.createdAt = existingCreatedAt ?? timestamp;
    }

    return payload;
}

function buildScopeQuery(scope: ScopeIdentifier, constraints: QueryConstraint[]): ReturnType<typeof query> {
    if (scope === 'root') {
        const base = collection(firebaseFirestore, USER_HIERARCHY_ROOT);
        return constraints.length > 0 ? query(base, ...constraints) : query(base);
    }

    const collectionId = scope === 'department' ? DEPARTMENT_USERS_COLLECTION : STUDENTS_COLLECTION;
    const base = collectionGroup(firebaseFirestore, collectionId);
    return constraints.length > 0 ? query(base, ...constraints) : base;
}

type UserDocArray = QueryDocumentSnapshot<DocumentData>[];

async function queryScopeSnapshots(
    scope: ScopeIdentifier,
    constraints: QueryConstraint[]
): Promise<UserDocArray> {
    const scopeQuery = buildScopeQuery(scope, constraints);
    const snap = await getDocs(scopeQuery);
    return snap.docs as UserDocArray;
}

async function queryUsersAcrossScopes(constraints: QueryConstraint[] = []): Promise<UserProfile[]> {
    const scopes: ScopeIdentifier[] = ['root', 'department', 'course'];
    const results = await Promise.all(scopes.map((scope) => queryScopeSnapshots(scope, constraints)));
    const merged = new Map<string, UserProfile>();

    results.forEach((docs) => {
        docs.forEach((docSnap) => {
            const profile = mapUserSnapshot(docSnap);
            if (profile) {
                merged.set(profile.uid, profile);
            }
        });
    });

    return Array.from(merged.values());
}

async function fetchFirstUserByConstraints(constraints: QueryConstraint[]): Promise<UserProfile | null> {
    const scopes: ScopeIdentifier[] = ['root', 'department', 'course'];
    for (const scope of scopes) {
        const docs = await queryScopeSnapshots(scope, constraints);
        if (docs.length > 0) {
            const profile = mapUserSnapshot(docs[0]);
            if (profile) {
                return profile;
            }
        }
    }
    return null;
}

function buildConstraintsFromFilter(filter: UserFilterOptions): QueryConstraint[] {
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

    return constraints;
}

function createEmptyScopeMaps(): ScopeMaps {
    return {
        root: new Map(),
        department: new Map(),
        course: new Map(),
    };
}

function handleScopeSnapshot(
    scopeMaps: ScopeMaps,
    scope: ScopeIdentifier,
    snapshot: QuerySnapshot<unknown>,
    emit: () => void,
): void {
    const targetMap = scopeMaps[scope];
    targetMap.clear();

    snapshot.docs.forEach((docSnap) => {
        const profile = mapUserSnapshot(docSnap);
        if (profile) {
            targetMap.set(profile.uid, profile);
        }
    });

    emit();
}

function mergeScopeMaps(scopeMaps: ScopeMaps): UserProfile[] {
    const merged = new Map<string, UserProfile>();
    (['root', 'department', 'course'] as ScopeIdentifier[]).forEach((scope) => {
        scopeMaps[scope].forEach((profile, uid) => {
            merged.set(uid, profile);
        });
    });
    return Array.from(merged.values());
}

export function getCurrentUserId(): string | null {
    const user = firebaseAuth.currentUser;
    return user?.uid ?? null;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    const uid = getCurrentUserId();
    if (!uid) {
        return null;
    }
    return await getUserById(uid);
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
    if (!email) {
        return null;
    }
    return await fetchFirstUserByConstraints([where('email', '==', email)]);
}

export async function getUserById(uid: string): Promise<UserProfile | null> {
    if (!uid) {
        return null;
    }

    const located = await locateUserDocument(uid);
    if (!located) {
        return null;
    }

    const profile = mapUserSnapshot(located.snapshot);
    return profile;
}

export async function findUserByField(field: string, value: unknown): Promise<UserProfile[]> {
    if (!field) {
        return [];
    }
    return await queryUsersAcrossScopes([where(field, '==', value)]);
}

export async function getAllUsers(): Promise<UserProfile[]> {
    return await queryUsersAcrossScopes();
}

export async function getUsersByIds(uids: string[]): Promise<UserProfile[]> {
    if (!uids || uids.length === 0) {
        return [];
    }

    const profiles = await Promise.all(uids.map(async (uid) => await getUserById(uid)));
    return profiles.filter((profile): profile is UserProfile => Boolean(profile));
}

export interface UserListenerOptions {
    onData: (profiles: UserProfile[]) => void;
    onError?: (error: Error) => void;
}

export function listenUsers(
    constraints: QueryConstraint[] | undefined,
    options: UserListenerOptions
): () => void {
    const { onData, onError } = options;
    const scopeMaps = createEmptyScopeMaps();
    const scopes: ScopeIdentifier[] = ['root', 'department', 'course'];

    const emit = (): void => {
        onData(mergeScopeMaps(scopeMaps));
    };

    const handleError = (error: Error): void => {
        if (onError) {
            onError(error);
        } else {
            console.error('Users listener error:', error);
        }
    };

    const unsubscribers = scopes.map((scope) => {
        const scopeQuery = buildScopeQuery(scope, constraints ?? []);
        return onSnapshot(
            scopeQuery,
            (snapshot) => handleScopeSnapshot(scopeMaps, scope, snapshot, emit),
            (error) => handleError(error as Error)
        );
    });

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
}

export interface UserFilterOptions {
    role?: UserRole;
    department?: string;
    course?: string;
}

export function listenUsersByFilter(
    filter: UserFilterOptions,
    options: UserListenerOptions
): () => void {
    const constraints = buildConstraintsFromFilter(filter);
    return listenUsers(constraints, options);
}

export async function getUsersByFilter(options: UserFilterOptions = {}): Promise<UserProfile[]> {
    const constraints = buildConstraintsFromFilter(options);
    return await queryUsersAcrossScopes(constraints);
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!uid) {
        throw new Error('uid required');
    }

    const cleanedData = cleanData({ uid, ...data }, 'update') as Record<string, unknown>;
    const existing = await locateUserDocument(uid);
    const existingData = existing?.snapshot.data() ?? {};
    const mergedData = { ...existingData, ...cleanedData };

    const pathInfo = buildUserPathInfo(mergedData as Partial<UserProfile>);
    const targetRef = getUserDocRef(uid, pathInfo);
    const payload = buildWritePayload(uid, mergedData, existingData.createdAt);

    if (!existing) {
        await setDoc(targetRef, payload, { merge: true });
        return;
    }

    if (existing.docRef.path === targetRef.path) {
        await setDoc(targetRef, payload, { merge: true });
        return;
    }

    const batch = writeBatch(firebaseFirestore);
    batch.delete(existing.docRef);
    batch.set(targetRef, payload);
    await batch.commit();
}

export async function deleteUserProfile(uid: string): Promise<void> {
    if (!uid) {
        throw new Error('User ID required');
    }

    const located = await locateUserDocument(uid);
    if (!located) {
        throw new Error('User not found');
    }

    await deleteDoc(located.docRef);
}

export async function bulkDeleteUserProfiles(uids: string[]): Promise<void> {
    if (!uids || uids.length === 0) {
        throw new Error('UIDs required');
    }

    const refs: DocumentReference<DocumentData>[] = [];
    for (const uid of uids) {
        const located = await locateUserDocument(uid);
        if (located) {
            refs.push(located.docRef);
        }
    }

    const chunkSize = 400;
    for (let index = 0; index < refs.length; index += chunkSize) {
        const batch = writeBatch(firebaseFirestore);
        refs.slice(index, index + chunkSize).forEach((ref) => {
            batch.delete(ref);
        });
        await batch.commit();
    }
}

export function onUserProfile(
    uid: string | null | undefined,
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void
): () => void {
    if (!uid) {
        return () => { /* no-op */ };
    }

    let activeSource: ScopeIdentifier | null = null;
    const emit = (scope: ScopeIdentifier, profile: UserProfile | null): void => {
        if (profile) {
            activeSource = scope;
            onData(profile);
            return;
        }

        if (activeSource === scope) {
            activeSource = null;
            onData(null);
        }
    };

    const handleError = (error: Error): void => {
        if (onError) {
            onError(error);
        } else {
            console.error('User profile listener error:', error);
        }
    };

    const unsubscribers: (() => void)[] = [];

    const rootUnsub = onSnapshot(
        doc(firebaseFirestore, USER_HIERARCHY_ROOT, uid),
        (snapshot) => {
            if (!snapshot.exists()) {
                emit('root', null);
                return;
            }

            const profile = mapUserSnapshot(snapshot);
            if (profile) {
                emit('root', profile);
            }
        },
        (error) => handleError(error as Error)
    );
    unsubscribers.push(rootUnsub);

    const departmentQuery = query(
        collectionGroup(firebaseFirestore, DEPARTMENT_USERS_COLLECTION),
        where('uid', '==', uid)
    );
    const departmentUnsub = onSnapshot(
        departmentQuery,
        (snapshot) => {
            if (snapshot.empty) {
                emit('department', null);
                return;
            }

            const profile = mapUserSnapshot(snapshot.docs[0]);
            if (profile) {
                emit('department', profile);
            }
        },
        (error) => handleError(error as Error)
    );
    unsubscribers.push(departmentUnsub);

    const studentQuery = query(
        collectionGroup(firebaseFirestore, STUDENTS_COLLECTION),
        where('uid', '==', uid)
    );
    const studentUnsub = onSnapshot(
        studentQuery,
        (snapshot) => {
            if (snapshot.empty) {
                emit('course', null);
                return;
            }

            const profile = mapUserSnapshot(snapshot.docs[0]);
            if (profile) {
                emit('course', profile);
            }
        },
        (error) => handleError(error as Error)
    );
    unsubscribers.push(studentUnsub);

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };

}
export function onCurrentUserProfile(
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void
): () => void {
    const uid = getCurrentUserId();
    if (!uid) {
        return () => { /* no-op */ };
    }
    return onUserProfile(uid, onData, onError);
}

export async function getProfile(uid: string): Promise<UserProfile | undefined> {
    const profile = await getUserById(uid);
    return profile ?? undefined;
}
