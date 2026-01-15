/**
 * Firebase Firestore - User Audits
 * CRUD operations for User Audit documents using hierarchical structure:
 * - year/{year}/users/{userId}/audits/{auditId}
 * - year/{year}/departments/{dept}/users/{userId}/audits/{auditId}
 * - year/{year}/departments/{dept}/courses/{course}/users/{userId}/audits/{auditId}
 * 
 * User audits are personal notifications visible only to the target user.
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc,
    updateDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot,
    type QueryConstraint, Timestamp, writeBatch
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type {
    UserAuditEntry, UserAuditEntryFormData, UserAuditQueryOptions,
    UserAuditListenerOptions, AuditAction, AuditCategory, AuditDetails,
    UserAuditContext, UserAuditLevel
} from '../../../types/audit';
import { AUDITS_SUBCOLLECTION } from '../../../config/firestore';
import {
    buildYearUserAuditsCollectionPath, buildYearUserAuditDocPath,
    buildDepartmentUserAuditsCollectionPath, buildDepartmentUserAuditDocPath,
    buildCourseUserAuditsCollectionPath, buildCourseUserAuditDocPath
} from './paths';
import { devLog } from '../../devUtils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the collection path based on context
 */
function buildUserAuditCollectionPath(ctx: UserAuditContext): string {
    switch (ctx.level) {
        case 'year':
            return buildYearUserAuditsCollectionPath(ctx.year, ctx.targetUserId);
        case 'department':
            if (!ctx.department) {
                throw new Error('Department is required for department-level audits');
            }
            return buildDepartmentUserAuditsCollectionPath(ctx.year, ctx.department, ctx.targetUserId);
        case 'course':
            if (!ctx.department || !ctx.course) {
                throw new Error('Department and course are required for course-level audits');
            }
            return buildCourseUserAuditsCollectionPath(
                ctx.year, ctx.department, ctx.course, ctx.targetUserId
            );
        default:
            throw new Error(`Invalid audit level: ${ctx.level}`);
    }
}

/**
 * Build the document path based on context
 */
function buildUserAuditDocumentPath(ctx: UserAuditContext, auditId: string): string {
    switch (ctx.level) {
        case 'year':
            return buildYearUserAuditDocPath(ctx.year, ctx.targetUserId, auditId);
        case 'department':
            if (!ctx.department) {
                throw new Error('Department is required for department-level audits');
            }
            return buildDepartmentUserAuditDocPath(
                ctx.year, ctx.department, ctx.targetUserId, auditId
            );
        case 'course':
            if (!ctx.department || !ctx.course) {
                throw new Error('Department and course are required for course-level audits');
            }
            return buildCourseUserAuditDocPath(
                ctx.year, ctx.department, ctx.course, ctx.targetUserId, auditId
            );
        default:
            throw new Error(`Invalid audit level: ${ctx.level}`);
    }
}

/**
 * Convert Firestore document data to UserAuditEntry
 */
function docToUserAuditEntry(
    docSnap: { id: string; data: () => Record<string, unknown> | undefined }
): UserAuditEntry | null {
    const data = docSnap.data();
    if (!data) return null;

    return {
        id: docSnap.id,
        locationType: 'user',
        name: (data.name as string) || '',
        description: (data.description as string) || '',
        userId: (data.userId as string) || '',
        targetUserId: (data.targetUserId as string) || '',
        category: (data.category as AuditCategory) || 'other',
        action: (data.action as AuditAction) || 'custom',
        level: (data.level as UserAuditLevel) || 'year',
        department: data.department as string | undefined,
        course: data.course as string | undefined,
        relatedGroupId: data.relatedGroupId as string | undefined,
        timestamp: data.timestamp instanceof Timestamp
            ? data.timestamp.toDate().toISOString()
            : (data.timestamp as string) || new Date().toISOString(),
        details: data.details as AuditDetails | undefined,
        showSnackbar: data.showSnackbar as boolean | undefined,
        snackbarShown: (data.snackbarShown as boolean) ?? false,
        read: (data.read as boolean) ?? false,
    };
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new user audit entry
 * @param ctx - User audit context containing path information
 * @param data - User audit entry form data
 * @returns Created audit entry ID
 */
export async function createUserAuditEntry(
    ctx: UserAuditContext,
    data: UserAuditEntryFormData
): Promise<string> {
    const collectionPath = buildUserAuditCollectionPath(ctx);
    devLog('Creating user audit at path:', collectionPath);
    const auditsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(auditsRef);

    const auditData = {
        locationType: 'user',
        name: data.name,
        description: data.description,
        userId: data.userId,
        targetUserId: ctx.targetUserId,
        category: data.category,
        action: data.action,
        level: ctx.level,
        department: ctx.department || null,
        course: ctx.course || null,
        relatedGroupId: data.relatedGroupId || null,
        details: data.details || null,
        showSnackbar: data.showSnackbar ?? true,
        snackbarShown: false,
        read: false,
        timestamp: serverTimestamp(),
    };

    await setDoc(newDocRef, auditData);
    return newDocRef.id;
}

/**
 * Create multiple user audit entries in batch
 * Useful for notifying multiple users about the same event
 * @param entries - Array of context and form data pairs
 * @returns Array of created audit entry IDs
 */
export async function createUserAuditEntriesBatch(
    entries: { ctx: UserAuditContext; data: UserAuditEntryFormData }[]
): Promise<string[]> {
    const batch = writeBatch(firebaseFirestore);
    const ids: string[] = [];

    for (const { ctx, data } of entries) {
        const collectionPath = buildUserAuditCollectionPath(ctx);
        const auditsRef = collection(firebaseFirestore, collectionPath);
        const newDocRef = doc(auditsRef);

        const auditData = {
            locationType: 'user',
            name: data.name,
            description: data.description,
            userId: data.userId,
            targetUserId: ctx.targetUserId,
            category: data.category,
            action: data.action,
            level: ctx.level,
            department: ctx.department || null,
            course: ctx.course || null,
            relatedGroupId: data.relatedGroupId || null,
            details: data.details || null,
            showSnackbar: data.showSnackbar ?? true,
            snackbarShown: false,
            read: false,
            timestamp: serverTimestamp(),
        };

        batch.set(newDocRef, auditData);
        ids.push(newDocRef.id);
    }

    await batch.commit();
    return ids;
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a single user audit entry by ID
 * @param ctx - User audit context containing path information
 * @param auditId - Audit entry ID
 * @returns User audit entry or null if not found
 */
export async function getUserAuditEntry(
    ctx: UserAuditContext,
    auditId: string
): Promise<UserAuditEntry | null> {
    const docPath = buildUserAuditDocumentPath(ctx, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docToUserAuditEntry(docSnap);
}

/**
 * Get user audit entries with optional filtering
 * @param ctx - User audit context containing path information
 * @param options - Query options for filtering
 * @returns Array of user audit entries
 */
export async function getUserAuditEntries(
    ctx: UserAuditContext,
    options?: UserAuditQueryOptions
): Promise<UserAuditEntry[]> {
    const collectionPath = buildUserAuditCollectionPath(ctx);
    const auditsRef = collection(firebaseFirestore, collectionPath);

    const constraints: QueryConstraint[] = [];

    // Add filters
    if (options?.category) {
        constraints.push(where('category', '==', options.category));
    }
    if (options?.action) {
        constraints.push(where('action', '==', options.action));
    }
    if (options?.read !== undefined) {
        constraints.push(where('read', '==', options.read));
    }

    // Add ordering
    const direction = options?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    // Add limit
    if (options?.limit) {
        constraints.push(limit(options.limit));
    }

    const q = query(auditsRef, ...constraints);
    const snapshot = await getDocs(q);

    let entries = snapshot.docs
        .map((docSnap) => docToUserAuditEntry(docSnap))
        .filter((entry): entry is UserAuditEntry => entry !== null);

    // Apply date filters client-side (Firestore doesn't support compound queries well)
    if (options?.startDate) {
        const startTime = new Date(options.startDate).getTime();
        entries = entries.filter((entry) => new Date(entry.timestamp).getTime() >= startTime);
    }
    if (options?.endDate) {
        const endTime = new Date(options.endDate).getTime();
        entries = entries.filter((entry) => new Date(entry.timestamp).getTime() <= endTime);
    }

    return entries;
}

/**
 * Get all user audit entries for a user across all levels
 * Uses collection group query
 * @param userId - The user ID to get audits for
 * @param options - Query options for filtering
 * @returns Array of user audit entries
 */
export async function getAllUserAuditEntries(
    userId: string,
    options?: UserAuditQueryOptions
): Promise<UserAuditEntry[]> {
    const auditsQuery = collectionGroup(firebaseFirestore, AUDITS_SUBCOLLECTION);

    const constraints: QueryConstraint[] = [
        where('locationType', '==', 'user'),
        where('targetUserId', '==', userId),
    ];

    if (options?.category) {
        constraints.push(where('category', '==', options.category));
    }
    if (options?.action) {
        constraints.push(where('action', '==', options.action));
    }
    if (options?.read !== undefined) {
        constraints.push(where('read', '==', options.read));
    }

    const direction = options?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    if (options?.limit) {
        constraints.push(limit(options.limit));
    }

    const q = query(auditsQuery, ...constraints);
    const snapshot = await getDocs(q);

    let entries = snapshot.docs
        .map((docSnap) => docToUserAuditEntry(docSnap))
        .filter((entry): entry is UserAuditEntry => entry !== null);

    // Apply date filters client-side
    if (options?.startDate) {
        const startTime = new Date(options.startDate).getTime();
        entries = entries.filter((entry) => new Date(entry.timestamp).getTime() >= startTime);
    }
    if (options?.endDate) {
        const endTime = new Date(options.endDate).getTime();
        entries = entries.filter((entry) => new Date(entry.timestamp).getTime() <= endTime);
    }

    return entries;
}

/**
 * Get unread user audit count
 * @param ctx - User audit context
 * @returns Count of unread audits
 */
export async function getUnreadUserAuditCount(ctx: UserAuditContext): Promise<number> {
    const entries = await getUserAuditEntries(ctx, { read: false });
    return entries.length;
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Mark a user audit entry as read
 * @param ctx - User audit context
 * @param auditId - Audit entry ID
 */
export async function markUserAuditAsRead(
    ctx: UserAuditContext,
    auditId: string
): Promise<void> {
    const docPath = buildUserAuditDocumentPath(ctx, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    await updateDoc(docRef, { read: true });
}

/**
 * Mark multiple user audit entries as read
 * @param ctx - User audit context
 * @param auditIds - Array of audit entry IDs
 */
export async function markUserAuditsAsRead(
    ctx: UserAuditContext,
    auditIds: string[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const auditId of auditIds) {
        const docPath = buildUserAuditDocumentPath(ctx, auditId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.update(docRef, { read: true });
    }

    await batch.commit();
}

/**
 * Mark a user audit snackbar as shown
 * This prevents the snackbar from showing again on page reload/login
 * @param ctx - User audit context
 * @param auditId - Audit entry ID
 */
export async function markUserAuditSnackbarShown(
    ctx: UserAuditContext,
    auditId: string
): Promise<void> {
    const docPath = buildUserAuditDocumentPath(ctx, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    await updateDoc(docRef, { snackbarShown: true });
}

/**
 * Mark multiple user audit snackbars as shown
 * @param ctx - User audit context
 * @param auditIds - Array of audit entry IDs
 */
export async function markUserAuditSnackbarsShown(
    ctx: UserAuditContext,
    auditIds: string[]
): Promise<void> {
    if (auditIds.length === 0) return;

    const batch = writeBatch(firebaseFirestore);

    for (const auditId of auditIds) {
        const docPath = buildUserAuditDocumentPath(ctx, auditId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.update(docRef, { snackbarShown: true });
    }

    await batch.commit();
}

/**
 * Mark all user audit entries as read
 * @param ctx - User audit context
 */
export async function markAllUserAuditsAsRead(ctx: UserAuditContext): Promise<void> {
    const entries = await getUserAuditEntries(ctx, { read: false });
    if (entries.length === 0) return;

    await markUserAuditsAsRead(ctx, entries.map((e) => e.id));
}

/**
 * Mark user audit entries as read by navigation segment.
 * Uses the navigation mapping to determine which audits belong to a specific segment.
 * @param ctx - User audit context
 * @param segment - Navigation segment (e.g., 'group', 'thesis', 'audits')
 * @returns Number of entries marked as read
 */
export async function markUserAuditsBySegmentAsRead(
    ctx: UserAuditContext,
    segment: string
): Promise<number> {
    // Import dynamically to avoid circular dependencies
    const { getSegmentForAuditEntry } = await import('../../navigationMappingUtils');

    const entries = await getUserAuditEntries(ctx, { read: false });
    if (entries.length === 0) return 0;

    // Filter entries that belong to this segment
    const segmentEntries = entries.filter(entry => {
        const entrySegment = getSegmentForAuditEntry(
            entry.category,
            entry.action,
            entry.details
        );
        return entrySegment === segment;
    });

    if (segmentEntries.length === 0) return 0;

    await markUserAuditsAsRead(ctx, segmentEntries.map((e) => e.id));
    return segmentEntries.length;
}

/**
 * Mark user audit entries as page-viewed by navigation segment.
 * This is used for drawer badge counting - only audits where pageViewed !== true are counted.
 * When a user visits a page, all unviewed audits for that segment should be marked as pageViewed.
 * 
 * @param ctx - User audit context
 * @param segment - Navigation segment (e.g., 'group', 'thesis', 'audits')
 * @param userRole - Optional user role for role-specific segment mapping
 * @returns Number of entries marked as page-viewed
 */
export async function markUserAuditsBySegmentAsPageViewed(
    ctx: UserAuditContext,
    segment: string,
    userRole?: string
): Promise<number> {
    // Import dynamically to avoid circular dependencies
    const { getSegmentForAuditEntry } = await import('../../navigationMappingUtils');

    // Get all entries that haven't been page-viewed yet
    const entries = await getUserAuditEntries(ctx, {});
    const unviewedEntries = entries.filter(entry => entry.pageViewed !== true);

    if (unviewedEntries.length === 0) return 0;

    // Filter entries that belong to this segment (with role-specific mapping)
    const segmentEntries = unviewedEntries.filter(entry => {
        const entrySegment = getSegmentForAuditEntry(
            entry.category,
            entry.action,
            entry.details,
            userRole as import('../../../types/profile').UserRole | undefined
        );
        return entrySegment === segment;
    });

    if (segmentEntries.length === 0) return 0;

    // Batch update all matching entries
    const batch = writeBatch(firebaseFirestore);
    for (const entry of segmentEntries) {
        const docPath = buildUserAuditDocumentPath(ctx, entry.id);
        const docRef = doc(firebaseFirestore, docPath);
        batch.update(docRef, { pageViewed: true });
    }
    await batch.commit();

    return segmentEntries.length;
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a user audit entry
 * @param ctx - User audit context
 * @param auditId - Audit entry ID to delete
 */
export async function deleteUserAuditEntry(
    ctx: UserAuditContext,
    auditId: string
): Promise<void> {
    const docPath = buildUserAuditDocumentPath(ctx, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Delete multiple user audit entries
 * @param ctx - User audit context
 * @param auditIds - Array of audit entry IDs to delete
 */
export async function deleteUserAuditEntries(
    ctx: UserAuditContext,
    auditIds: string[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const auditId of auditIds) {
        const docPath = buildUserAuditDocumentPath(ctx, auditId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

/**
 * Delete all read user audit entries (cleanup)
 * @param ctx - User audit context
 */
export async function deleteReadUserAudits(ctx: UserAuditContext): Promise<void> {
    const entries = await getUserAuditEntries(ctx, { read: true });
    if (entries.length === 0) return;

    await deleteUserAuditEntries(ctx, entries.map((e) => e.id));
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to user audit entries for a specific context
 * @param ctx - User audit context
 * @param options - Listener callbacks
 * @param queryOptions - Optional query filters
 * @returns Unsubscribe function
 */
export function listenUserAuditEntries(
    ctx: UserAuditContext,
    options: UserAuditListenerOptions,
    queryOptions?: UserAuditQueryOptions
): () => void {
    const collectionPath = buildUserAuditCollectionPath(ctx);
    const auditsRef = collection(firebaseFirestore, collectionPath);

    const constraints: QueryConstraint[] = [];

    if (queryOptions?.category) {
        constraints.push(where('category', '==', queryOptions.category));
    }
    if (queryOptions?.action) {
        constraints.push(where('action', '==', queryOptions.action));
    }
    if (queryOptions?.read !== undefined) {
        constraints.push(where('read', '==', queryOptions.read));
    }

    const direction = queryOptions?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    if (queryOptions?.limit) {
        constraints.push(limit(queryOptions.limit));
    }

    const q = query(auditsRef, ...constraints);

    return onSnapshot(
        q,
        (snapshot) => {
            let entries = snapshot.docs
                .map((docSnap) => docToUserAuditEntry(docSnap))
                .filter((entry): entry is UserAuditEntry => entry !== null);

            // Apply date filters client-side
            if (queryOptions?.startDate) {
                const startTime = new Date(queryOptions.startDate).getTime();
                entries = entries.filter((entry) =>
                    new Date(entry.timestamp).getTime() >= startTime
                );
            }
            if (queryOptions?.endDate) {
                const endTime = new Date(queryOptions.endDate).getTime();
                entries = entries.filter((entry) =>
                    new Date(entry.timestamp).getTime() <= endTime
                );
            }

            options.onData(entries);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('User audit listener error:', error);
            }
        }
    );
}

/**
 * Listen to all user audit entries across all levels using collection group
 * @param userId - The user ID to listen for
 * @param options - Listener callbacks
 * @param queryOptions - Optional query filters
 * @returns Unsubscribe function
 */
export function listenAllUserAuditEntries(
    userId: string,
    options: UserAuditListenerOptions,
    queryOptions?: UserAuditQueryOptions
): () => void {
    const auditsQuery = collectionGroup(firebaseFirestore, AUDITS_SUBCOLLECTION);

    const constraints: QueryConstraint[] = [
        where('locationType', '==', 'user'),
        where('targetUserId', '==', userId),
    ];

    if (queryOptions?.category) {
        constraints.push(where('category', '==', queryOptions.category));
    }
    if (queryOptions?.action) {
        constraints.push(where('action', '==', queryOptions.action));
    }
    if (queryOptions?.read !== undefined) {
        constraints.push(where('read', '==', queryOptions.read));
    }

    const direction = queryOptions?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    if (queryOptions?.limit) {
        constraints.push(limit(queryOptions.limit));
    }

    const q = query(auditsQuery, ...constraints);

    return onSnapshot(
        q,
        (snapshot) => {
            let entries = snapshot.docs
                .map((docSnap) => docToUserAuditEntry(docSnap))
                .filter((entry): entry is UserAuditEntry => entry !== null);

            // Apply date filters client-side
            if (queryOptions?.startDate) {
                const startTime = new Date(queryOptions.startDate).getTime();
                entries = entries.filter((entry) =>
                    new Date(entry.timestamp).getTime() >= startTime
                );
            }
            if (queryOptions?.endDate) {
                const endTime = new Date(queryOptions.endDate).getTime();
                entries = entries.filter((entry) =>
                    new Date(entry.timestamp).getTime() <= endTime
                );
            }

            options.onData(entries);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('All user audits listener error:', error);
            }
        }
    );
}
