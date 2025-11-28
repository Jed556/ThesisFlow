/**
 * Firebase Firestore - Expert Requests (Mentor Requests)
 * CRUD operations for Expert Request documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/expertRequests/{requestId}
 */

import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    writeBatch,
    type QueryConstraint,
    type DocumentReference,
    type DocumentSnapshot,
    type QueryDocumentSnapshot,
    type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { createTimestamp, normalizeTimestamp } from '../../dateUtils';
import type { ExpertRequest } from '../../../types/expertRequest';
import type { UserRole } from '../../../types/profile';
import type { ThesisStatus } from '../../../types/thesis';
import {
    buildExpertRequestsCollectionPath,
    buildExpertRequestDocPath,
    EXPERT_REQUESTS_SUBCOLLECTION,
} from '../../../config/firestore';

// ============================================================================
// Types
// ============================================================================

export type ExpertRequestRecord = ExpertRequest & { id: string };

export interface ExpertRequestContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

export interface ExpertRequestListenerOptions {
    onData: (requests: ExpertRequestRecord[]) => void;
    onError?: (error: Error) => void;
}

export interface CreateExpertRequestPayload {
    expertUid: string;
    role: UserRole;
    requestedBy: string;
    message?: string;
}

export interface RespondToExpertRequestOptions {
    responseNote?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

type ExpertRequestSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

/**
 * Convert Firestore document data to ExpertRequestRecord
 */
function docToExpertRequest(docSnap: ExpertRequestSnapshot): ExpertRequestRecord | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data() ?? {};

    return {
        id: docSnap.id,
        expertUid: typeof data.expertUid === 'string' ? data.expertUid : '',
        role: data.role as UserRole,
        requestedBy: typeof data.requestedBy === 'string' ? data.requestedBy : '',
        message: typeof data.message === 'string' ? data.message : undefined,
        status: (data.status as ThesisStatus) || 'pending',
        createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
        updatedAt: normalizeTimestamp(data.updatedAt) ?? new Date().toISOString(),
        respondedAt: normalizeTimestamp(data.respondedAt) ?? null,
        responseNote: typeof data.responseNote === 'string' ? data.responseNote : null,
    };
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new expert request
 */
export async function createExpertRequest(
    ctx: ExpertRequestContext,
    payload: CreateExpertRequestPayload
): Promise<string> {
    const { expertUid, role, requestedBy, message } = payload;

    if (!expertUid || !role || !requestedBy) {
        throw new Error('Incomplete request parameters.');
    }

    // Check for duplicate pending requests
    const existingRequests = await getExpertRequestsForGroup(ctx, [
        where('expertUid', '==', expertUid),
        where('role', '==', role),
        where('status', '==', 'pending'),
    ]);

    if (existingRequests.length > 0) {
        throw new Error('A pending request for this expert already exists.');
    }

    const collectionPath = buildExpertRequestsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const requestsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(requestsRef);

    const now = createTimestamp();
    const requestData = {
        expertUid,
        role,
        requestedBy,
        message: message ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        respondedAt: null,
        responseNote: null,
    };

    await setDoc(newDocRef, requestData);
    return newDocRef.id;
}

/**
 * Create an expert request with a specific ID
 */
export async function createExpertRequestWithId(
    ctx: ExpertRequestContext,
    requestId: string,
    payload: CreateExpertRequestPayload
): Promise<void> {
    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    const docRef = doc(firebaseFirestore, docPath);

    const now = createTimestamp();
    const requestData = {
        expertUid: payload.expertUid,
        role: payload.role,
        requestedBy: payload.requestedBy,
        message: payload.message ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        respondedAt: null,
        responseNote: null,
    };

    await setDoc(docRef, requestData);
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get an expert request by ID
 */
export async function getExpertRequest(
    ctx: ExpertRequestContext,
    requestId: string
): Promise<ExpertRequestRecord | null> {
    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToExpertRequest(docSnap);
}

/**
 * Get expert request document reference
 */
export function getExpertRequestDocRef(ctx: ExpertRequestContext, requestId: string): DocumentReference {
    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    return doc(firebaseFirestore, docPath);
}

/**
 * Get all expert requests for a group
 */
export async function getExpertRequestsForGroup(
    ctx: ExpertRequestContext,
    constraints?: QueryConstraint[]
): Promise<ExpertRequestRecord[]> {
    const collectionPath = buildExpertRequestsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const requestsRef = collection(firebaseFirestore, collectionPath);
    const q = constraints?.length
        ? query(requestsRef, ...constraints)
        : query(requestsRef, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => docToExpertRequest(docSnap))
        .filter((r): r is ExpertRequestRecord => r !== null);
}

/**
 * Get all expert requests across all groups using collectionGroup query
 */
export async function getAllExpertRequests(constraints?: QueryConstraint[]): Promise<ExpertRequestRecord[]> {
    const requestsQuery = collectionGroup(firebaseFirestore, EXPERT_REQUESTS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(requestsQuery, ...constraints)
        : query(requestsQuery, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => docToExpertRequest(docSnap))
        .filter((r): r is ExpertRequestRecord => r !== null);
}

/**
 * Get pending request for a specific expert/role combination
 */
export async function getPendingExpertRequest(
    ctx: ExpertRequestContext,
    expertUid: string,
    role: UserRole
): Promise<ExpertRequestRecord | null> {
    if (!expertUid || !role) return null;

    const requests = await getExpertRequestsForGroup(ctx, [
        where('expertUid', '==', expertUid),
        where('role', '==', role),
        where('status', '==', 'pending'),
        limit(1),
    ]);

    return requests.length > 0 ? requests[0] : null;
}

/**
 * Get expert requests by expert UID across all groups
 */
export async function getExpertRequestsByExpert(
    expertUid: string,
    role?: UserRole
): Promise<ExpertRequestRecord[]> {
    const constraints: QueryConstraint[] = [
        where('expertUid', '==', expertUid),
        orderBy('createdAt', 'desc'),
    ];

    if (role) {
        constraints.splice(1, 0, where('role', '==', role));
    }

    return getAllExpertRequests(constraints);
}

/**
 * Get pending expert requests for an expert
 */
export async function getPendingRequestsForExpert(
    expertUid: string,
    role?: UserRole
): Promise<ExpertRequestRecord[]> {
    const constraints: QueryConstraint[] = [
        where('expertUid', '==', expertUid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
    ];

    if (role) {
        constraints.splice(2, 0, where('role', '==', role));
    }

    return getAllExpertRequests(constraints);
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update an expert request
 */
export async function updateExpertRequest(
    ctx: ExpertRequestContext,
    requestId: string,
    data: Partial<ExpertRequest>
): Promise<void> {
    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Respond to an expert request (approve or reject)
 */
export async function respondToExpertRequest(
    ctx: ExpertRequestContext,
    requestId: string,
    status: 'approved' | 'rejected',
    options?: RespondToExpertRequestOptions
): Promise<void> {
    if (!requestId) {
        throw new Error('Request ID is required.');
    }

    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    const docRef = doc(firebaseFirestore, docPath);
    const decidedAt = createTimestamp();

    await updateDoc(docRef, {
        status,
        responseNote: options?.responseNote ?? null,
        respondedAt: decidedAt,
        updatedAt: decidedAt,
    });
}

/**
 * Approve an expert request
 */
export async function approveExpertRequest(
    ctx: ExpertRequestContext,
    requestId: string,
    responseNote?: string
): Promise<void> {
    return respondToExpertRequest(ctx, requestId, 'approved', { responseNote });
}

/**
 * Reject an expert request
 */
export async function rejectExpertRequest(
    ctx: ExpertRequestContext,
    requestId: string,
    responseNote?: string
): Promise<void> {
    return respondToExpertRequest(ctx, requestId, 'rejected', { responseNote });
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete an expert request
 */
export async function deleteExpertRequest(ctx: ExpertRequestContext, requestId: string): Promise<void> {
    const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Delete multiple expert requests in a batch
 */
export async function bulkDeleteExpertRequests(
    requests: { ctx: ExpertRequestContext; requestId: string }[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const { ctx, requestId } of requests) {
        const docPath = buildExpertRequestDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, requestId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to expert requests for a specific group
 */
export function listenExpertRequestsForGroup(
    ctx: ExpertRequestContext,
    options: ExpertRequestListenerOptions
): () => void {
    const collectionPath = buildExpertRequestsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const requestsRef = collection(firebaseFirestore, collectionPath);
    const q = query(requestsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => docToExpertRequest(docSnap))
                .filter((r): r is ExpertRequestRecord => r !== null);
            options.onData(requests);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Expert request listener error:', error);
        }
    );
}

/**
 * Listen to expert requests for a specific expert (across all groups)
 */
export function listenExpertRequestsByExpert(
    expertUid: string,
    role: UserRole | undefined,
    options: ExpertRequestListenerOptions
): () => void {
    if (!expertUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const requestsQuery = collectionGroup(firebaseFirestore, EXPERT_REQUESTS_SUBCOLLECTION);
    const constraints: QueryConstraint[] = [
        where('expertUid', '==', expertUid),
    ];

    if (role) {
        constraints.push(where('role', '==', role));
    }

    const q = query(requestsQuery, ...constraints);

    return onSnapshot(
        q,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => docToExpertRequest(docSnap))
                .filter((r): r is ExpertRequestRecord => r !== null)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            options.onData(requests);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Expert request listener error:', error);
        }
    );
}

/**
 * Listen to pending expert requests for a specific expert
 */
export function listenPendingRequestsForExpert(
    expertUid: string,
    role: UserRole | undefined,
    options: ExpertRequestListenerOptions
): () => void {
    if (!expertUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const requestsQuery = collectionGroup(firebaseFirestore, EXPERT_REQUESTS_SUBCOLLECTION);
    const constraints: QueryConstraint[] = [
        where('expertUid', '==', expertUid),
        where('status', '==', 'pending'),
    ];

    if (role) {
        constraints.push(where('role', '==', role));
    }

    const q = query(requestsQuery, ...constraints);

    return onSnapshot(
        q,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => docToExpertRequest(docSnap))
                .filter((r): r is ExpertRequestRecord => r !== null)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            options.onData(requests);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Pending expert request listener error:', error);
        }
    );
}

/**
 * Listen to all expert requests (collectionGroup)
 */
export function listenAllExpertRequests(
    constraints: QueryConstraint[] | undefined,
    options: ExpertRequestListenerOptions
): () => void {
    const requestsQuery = collectionGroup(firebaseFirestore, EXPERT_REQUESTS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(requestsQuery, ...constraints)
        : requestsQuery;

    return onSnapshot(
        q,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => docToExpertRequest(docSnap))
                .filter((r): r is ExpertRequestRecord => r !== null);
            options.onData(requests);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Expert request listener error:', error);
        }
    );
}

// ============================================================================
// Alias Functions (Mentor Request terminology)
// ============================================================================

/**
 * Alias for listenExpertRequestsByExpert - listens to mentor requests by mentor UID.
 *
 * @param mentorUid The mentor's user ID
 * @param role Optional role filter
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenMentorRequestsByMentor(
    mentorUid: string,
    role: UserRole | undefined,
    options: ExpertRequestListenerOptions
): () => void {
    return listenExpertRequestsByExpert(mentorUid, role, options);
}

/**
 * Alias for createExpertRequest - creates a mentor request.
 *
 * @param ctx Expert request context
 * @param payload Request payload
 * @returns Request ID
 */
export async function createMentorRequest(
    ctx: ExpertRequestContext,
    payload: CreateExpertRequestPayload
): Promise<string> {
    return createExpertRequest(ctx, payload);
}
