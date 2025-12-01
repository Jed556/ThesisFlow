/**
 * Firebase Firestore - Audits
 * CRUD operations for Audit documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/audits/{auditId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, onSnapshot,
    type QueryConstraint, Timestamp
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type {
    AuditEntry, AuditEntryFormData, AuditQueryOptions, AuditListenerOptions,
    AuditAction, AuditCategory, AuditDetails
} from '../../../types/audit';
import { AUDITS_SUBCOLLECTION } from '../../../config/firestore';
import { buildAuditsCollectionPath, buildAuditDocPath } from './paths';

// ============================================================================
// Types
// ============================================================================

export interface AuditContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore document data to AuditEntry
 */
function docToAuditEntry(
    docSnap: { id: string; data: () => Record<string, unknown> | undefined },
    groupId: string
): AuditEntry | null {
    const data = docSnap.data();
    if (!data) return null;

    return {
        id: docSnap.id,
        name: (data.name as string) || '',
        description: (data.description as string) || '',
        userId: (data.userId as string) || '',
        category: (data.category as AuditCategory) || 'other',
        action: (data.action as AuditAction) || 'custom',
        timestamp: data.timestamp instanceof Timestamp
            ? data.timestamp.toDate().toISOString()
            : (data.timestamp as string) || new Date().toISOString(),
        details: data.details as AuditDetails | undefined,
        groupId: groupId || (data.groupId as string) || '',
    };
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new audit entry
 * @param ctx - Audit context containing path information
 * @param data - Audit entry form data
 * @returns Created audit entry ID
 */
export async function createAuditEntry(
    ctx: AuditContext,
    data: AuditEntryFormData
): Promise<string> {
    const collectionPath = buildAuditsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const auditsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(auditsRef);

    const auditData = {
        name: data.name,
        description: data.description,
        userId: data.userId,
        category: data.category,
        action: data.action,
        details: data.details || null,
        groupId: ctx.groupId,
        timestamp: serverTimestamp(),
    };

    await setDoc(newDocRef, auditData);
    return newDocRef.id;
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a single audit entry by ID
 * @param ctx - Audit context containing path information
 * @param auditId - Audit entry ID
 * @returns Audit entry or null if not found
 */
export async function getAuditEntry(
    ctx: AuditContext,
    auditId: string
): Promise<AuditEntry | null> {
    const docPath = buildAuditDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docToAuditEntry(docSnap, ctx.groupId);
}

/**
 * Get audit entries for a group with optional filtering
 * @param ctx - Audit context containing path information
 * @param options - Query options for filtering
 * @returns Array of audit entries
 */
export async function getAuditEntries(
    ctx: AuditContext,
    options?: AuditQueryOptions
): Promise<AuditEntry[]> {
    const collectionPath = buildAuditsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const auditsRef = collection(firebaseFirestore, collectionPath);

    const constraints: QueryConstraint[] = [];

    // Add filters
    if (options?.category) {
        constraints.push(where('category', '==', options.category));
    }
    if (options?.action) {
        constraints.push(where('action', '==', options.action));
    }
    if (options?.userId) {
        constraints.push(where('userId', '==', options.userId));
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
        .map((docSnap) => docToAuditEntry(docSnap, ctx.groupId))
        .filter((entry): entry is AuditEntry => entry !== null);

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
 * Get all audit entries across all groups using collectionGroup query
 * Note: This requires a Firestore index on the 'audits' collection group
 * @param options - Query options for filtering
 * @returns Array of audit entries
 */
export async function getAllAuditEntries(options?: AuditQueryOptions): Promise<AuditEntry[]> {
    const auditsQuery = collectionGroup(firebaseFirestore, AUDITS_SUBCOLLECTION);

    const constraints: QueryConstraint[] = [];

    if (options?.category) {
        constraints.push(where('category', '==', options.category));
    }
    if (options?.action) {
        constraints.push(where('action', '==', options.action));
    }
    if (options?.userId) {
        constraints.push(where('userId', '==', options.userId));
    }

    const direction = options?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    if (options?.limit) {
        constraints.push(limit(options.limit));
    }

    const q = constraints.length > 0
        ? query(auditsQuery, ...constraints)
        : query(auditsQuery, orderBy('timestamp', 'desc'));

    const snapshot = await getDocs(q);

    let entries = snapshot.docs
        .map((docSnap) => {
            // Extract groupId from path: .../groups/{groupId}/audits/{auditId}
            const pathParts = docSnap.ref.path.split('/');
            const groupsIndex = pathParts.indexOf('groups');
            const groupId = groupsIndex >= 0 && pathParts.length > groupsIndex + 1
                ? pathParts[groupsIndex + 1]
                : '';
            return docToAuditEntry(docSnap, groupId);
        })
        .filter((entry): entry is AuditEntry => entry !== null);

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

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete an audit entry
 * @param ctx - Audit context containing path information
 * @param auditId - Audit entry ID to delete
 */
export async function deleteAuditEntry(
    ctx: AuditContext,
    auditId: string
): Promise<void> {
    const docPath = buildAuditDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, auditId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to audit entries for a specific group
 * @param ctx - Audit context containing path information
 * @param options - Listener callbacks
 * @param queryOptions - Optional query filters
 * @returns Unsubscribe function
 */
export function listenAuditEntries(
    ctx: AuditContext,
    options: AuditListenerOptions,
    queryOptions?: AuditQueryOptions
): () => void {
    const collectionPath = buildAuditsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const auditsRef = collection(firebaseFirestore, collectionPath);

    const constraints: QueryConstraint[] = [];

    if (queryOptions?.category) {
        constraints.push(where('category', '==', queryOptions.category));
    }
    if (queryOptions?.action) {
        constraints.push(where('action', '==', queryOptions.action));
    }
    if (queryOptions?.userId) {
        constraints.push(where('userId', '==', queryOptions.userId));
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
                .map((docSnap) => docToAuditEntry(docSnap, ctx.groupId))
                .filter((entry): entry is AuditEntry => entry !== null);

            // Apply date filters client-side
            if (queryOptions?.startDate) {
                const startTime = new Date(queryOptions.startDate).getTime();
                entries = entries.filter((entry) => new Date(entry.timestamp).getTime() >= startTime);
            }
            if (queryOptions?.endDate) {
                const endTime = new Date(queryOptions.endDate).getTime();
                entries = entries.filter((entry) => new Date(entry.timestamp).getTime() <= endTime);
            }

            options.onData(entries);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('Audit listener error:', error);
            }
        }
    );
}

/**
 * Listen to all audit entries across all groups
 * @param options - Listener callbacks
 * @param queryOptions - Optional query filters
 * @returns Unsubscribe function
 */
export function listenAllAuditEntries(
    options: AuditListenerOptions,
    queryOptions?: AuditQueryOptions
): () => void {
    const auditsQuery = collectionGroup(firebaseFirestore, AUDITS_SUBCOLLECTION);

    const constraints: QueryConstraint[] = [];

    if (queryOptions?.category) {
        constraints.push(where('category', '==', queryOptions.category));
    }
    if (queryOptions?.action) {
        constraints.push(where('action', '==', queryOptions.action));
    }
    if (queryOptions?.userId) {
        constraints.push(where('userId', '==', queryOptions.userId));
    }

    const direction = queryOptions?.orderDirection || 'desc';
    constraints.push(orderBy('timestamp', direction));

    if (queryOptions?.limit) {
        constraints.push(limit(queryOptions.limit));
    }

    const q = constraints.length > 0
        ? query(auditsQuery, ...constraints)
        : query(auditsQuery, orderBy('timestamp', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            let entries = snapshot.docs
                .map((docSnap) => {
                    const pathParts = docSnap.ref.path.split('/');
                    const groupsIndex = pathParts.indexOf('groups');
                    const groupId = groupsIndex >= 0 && pathParts.length > groupsIndex + 1
                        ? pathParts[groupsIndex + 1]
                        : '';
                    return docToAuditEntry(docSnap, groupId);
                })
                .filter((entry): entry is AuditEntry => entry !== null);

            // Apply date filters client-side
            if (queryOptions?.startDate) {
                const startTime = new Date(queryOptions.startDate).getTime();
                entries = entries.filter((entry) => new Date(entry.timestamp).getTime() >= startTime);
            }
            if (queryOptions?.endDate) {
                const endTime = new Date(queryOptions.endDate).getTime();
                entries = entries.filter((entry) => new Date(entry.timestamp).getTime() <= endTime);
            }

            options.onData(entries);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('All audits listener error:', error);
            }
        }
    );
}
