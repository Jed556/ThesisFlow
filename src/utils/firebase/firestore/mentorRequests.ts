import {
    addDoc, collection, doc, getDocs, limit, onSnapshot, query,
    updateDoc, where, type DocumentData, type QueryDocumentSnapshot
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { createTimestamp, normalizeTimestamp } from '../../dateUtils';
import type {
    MentorRequest, MentorRequestRole, MentorRequestStatus
} from '../../../types/mentorRequest';

const COLLECTION_NAME = 'mentorRequests';

function mapMentorRequest(docSnap: QueryDocumentSnapshot<DocumentData>): MentorRequest {
    const data = docSnap.data();

    return {
        id: docSnap.id,
        groupId: data.groupId,
        mentorUid: data.mentorUid,
        role: data.role,
        requestedBy: data.requestedBy,
        message: data.message,
        status: data.status,
        createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
        updatedAt: normalizeTimestamp(data.updatedAt) ?? new Date().toISOString(),
        respondedAt: normalizeTimestamp(data.respondedAt) ?? null,
        responseNote: data.responseNote ?? null,
    } satisfies MentorRequest;
}

export interface MentorRequestListenerOptions {
    onData: (requests: MentorRequest[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to mentor requests filtered by mentor UID and role.
 */
export function listenMentorRequestsByMentor(
    role: MentorRequestRole,
    mentorUid: string | null | undefined,
    options: MentorRequestListenerOptions,
): () => void {
    if (!mentorUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const requestsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const requestsQuery = query(
        requestsRef,
        where('mentorUid', '==', mentorUid),
        where('role', '==', role),
    );

    return onSnapshot(
        requestsQuery,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => mapMentorRequest(docSnap as QueryDocumentSnapshot<DocumentData>))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            options.onData(requests);
        },
        (error) => {
            if (options.onError) {
                options.onError(error as Error);
            } else {
                console.error('Mentor requests listener error:', error);
            }
        },
    );
}

/**
 * Listen to mentor requests submitted by a specific group, useful for tracking status from the student side.
 */
export function listenMentorRequestsByGroup(
    groupId: string | null | undefined,
    options: MentorRequestListenerOptions,
): () => void {
    if (!groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const requestsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const requestsQuery = query(
        requestsRef,
        where('groupId', '==', groupId),
    );

    return onSnapshot(
        requestsQuery,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => mapMentorRequest(docSnap as QueryDocumentSnapshot<DocumentData>))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            options.onData(requests);
        },
        (error) => {
            if (options.onError) {
                options.onError(error as Error);
            } else {
                console.error('Group mentor requests listener error:', error);
            }
        },
    );
}

export interface CreateMentorRequestPayload {
    groupId: string;
    mentorUid: string;
    role: MentorRequestRole;
    requestedBy: string;
    message?: string;
}

/**
 * Create a new mentor assignment request while preventing duplicate pending entries for the same group/role/mentor tuple.
 */
export async function createMentorRequest(payload: CreateMentorRequestPayload): Promise<void> {
    const {
        groupId, mentorUid, role,
        requestedBy, message,
    } = payload;

    if (!groupId || !mentorUid || !role || !requestedBy) {
        throw new Error('Incomplete request parameters.');
    }

    const requestsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const duplicateQuery = query(
        requestsRef,
        where('groupId', '==', groupId),
        where('mentorUid', '==', mentorUid),
        where('role', '==', role),
        where('status', '==', 'pending'),
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);
    if (!duplicateSnapshot.empty) {
        throw new Error('A pending request for this mentor already exists.');
    }

    const now = createTimestamp();
    await addDoc(requestsRef, {
        groupId,
        mentorUid,
        role,
        requestedBy,
        message: message ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        respondedAt: null,
        responseNote: null,
    });
}

/**
 * Retrieve the pending mentor request for a given group/mentor/role triple if it exists.
 */
export async function getPendingMentorRequest(
    groupId: string,
    mentorUid: string,
    role: MentorRequestRole,
): Promise<MentorRequest | null> {
    if (!groupId || !mentorUid || !role) {
        return null;
    }

    const requestsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const pendingQuery = query(
        requestsRef,
        where('groupId', '==', groupId),
        where('mentorUid', '==', mentorUid),
        where('role', '==', role),
        where('status', '==', 'pending'),
        limit(1),
    );
    const snapshot = await getDocs(pendingQuery);
    if (snapshot.empty) {
        return null;
    }
    const docSnap = snapshot.docs[0] as QueryDocumentSnapshot<DocumentData>;
    return mapMentorRequest(docSnap);
}

export interface RespondToMentorRequestOptions {
    responseNote?: string;
}

/**
 * Update the status of a mentor request (approve or reject) with audit metadata.
 */
export async function respondToMentorRequest(
    requestId: string,
    status: Extract<MentorRequestStatus, 'approved' | 'rejected'>,
    options: RespondToMentorRequestOptions,
): Promise<void> {
    if (!requestId) {
        throw new Error('Request ID is required.');
    }

    const docRef = doc(firebaseFirestore, COLLECTION_NAME, requestId);
    const decidedAt = createTimestamp();
    const payload = {
        status,
        responseNote: options.responseNote ?? null,
        respondedAt: decidedAt,
        updatedAt: decidedAt,
    };

    await updateDoc(docRef, payload);
}
