/**
 * Firebase Firestore - Slot Requests
 * CRUD operations for Slot Request documents using hierarchical structure:
 * year/{year}/slotRequests/{requestId}
 */

import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, onSnapshot, writeBatch,
    type QueryConstraint, type DocumentSnapshot,
    type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { DEFAULT_YEAR } from '../../../config/firestore';
import { buildSlotRequestsCollectionPath, buildSlotRequestDocPath } from './paths';
import { findUserById, updateUserProfile } from './user';
import { validateExpertSkillRatings } from './skillTemplates';
import type { SlotRequest, SlotRequestRecord, SlotRequestStatus } from '../../../types/slotRequest';
import type { UserRole } from '../../../types/profile';

// Re-export the default max expert slots constant
export { DEFAULT_MAX_EXPERT_SLOTS } from '../../../types/slotRequest';

// ============================================================================
// Types
// ============================================================================

export interface SlotRequestListenerOptions {
    onData: (requests: SlotRequestRecord[]) => void;
    onError?: (error: Error) => void;
}

export interface CreateSlotRequestPayload {
    expertUid: string;
    expertRole: UserRole;
    currentSlots: number;
    requestedSlots: number;
    reason?: string;
    department?: string;
}

export interface RespondToSlotRequestOptions {
    responseNote?: string;
    respondedBy: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

type SlotRequestSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

/**
 * Convert Firestore document data to SlotRequestRecord
 */
function docToSlotRequest(docSnap: SlotRequestSnapshot): SlotRequestRecord | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data() ?? {};

    // Validate status is a valid SlotRequestStatus
    const rawStatus = data.status as string | undefined;
    const status: SlotRequestStatus =
        rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';

    return {
        id: docSnap.id,
        expertUid: typeof data.expertUid === 'string' ? data.expertUid : '',
        expertRole: data.expertRole as UserRole,
        currentSlots: typeof data.currentSlots === 'number' ? data.currentSlots : 5,
        requestedSlots: typeof data.requestedSlots === 'number' ? data.requestedSlots : 5,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        status,
        createdAt: normalizeTimestamp(data.createdAt) ?? new Date().toISOString(),
        updatedAt: normalizeTimestamp(data.updatedAt) ?? new Date().toISOString(),
        respondedAt: normalizeTimestamp(data.respondedAt) ?? null,
        respondedBy: typeof data.respondedBy === 'string' ? data.respondedBy : null,
        responseNote: typeof data.responseNote === 'string' ? data.responseNote : null,
        department: typeof data.department === 'string' ? data.department : undefined,
    };
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new slot request
 * Validates that experts have rated their skills when increasing from 0 slots
 */
export async function createSlotRequest(
    payload: CreateSlotRequestPayload,
    year: string = DEFAULT_YEAR
): Promise<string> {
    const { expertUid, expertRole, currentSlots, requestedSlots, reason, department } = payload;

    if (!expertUid || !expertRole) {
        throw new Error('Incomplete request parameters.');
    }

    if (requestedSlots <= currentSlots) {
        throw new Error('Requested slots must be greater than current slots.');
    }

    // Check if there's already a pending request from this expert
    const existingPending = await getPendingSlotRequestByExpert(expertUid, year);
    if (existingPending) {
        throw new Error('You already have a pending slot request. Please wait for admin response.');
    }

    // When increasing from 0 slots, require skill ratings
    if (currentSlots === 0 && department) {
        const user = await findUserById(expertUid);
        const skillValidation = await validateExpertSkillRatings(
            year,
            department,
            user?.skillRatings
        );

        if (!skillValidation.isComplete && skillValidation.totalSkills > 0) {
            const unratedNames = skillValidation.unratedSkillNames.slice(0, 3).join(', ');
            const moreCount = skillValidation.unratedSkillNames.length - 3;
            const moreText = moreCount > 0 ? ` and ${moreCount} more` : '';
            throw new Error(
                `You must rate all your skills before requesting slots. ` +
                `Missing ratings for: ${unratedNames}${moreText}. ` +
                `Please complete your skill ratings in your profile settings.`
            );
        }
    }

    const collPath = buildSlotRequestsCollectionPath(year);
    const collRef = collection(firebaseFirestore, collPath);
    const docRef = doc(collRef);

    const now = new Date().toISOString();
    const requestData: SlotRequest = {
        id: docRef.id,
        expertUid,
        expertRole,
        currentSlots,
        requestedSlots,
        reason: reason || undefined,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        department,
    };

    await setDoc(docRef, {
        ...requestData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return docRef.id;
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a slot request by ID
 */
export async function getSlotRequest(
    requestId: string,
    year: string = DEFAULT_YEAR
): Promise<SlotRequestRecord | null> {
    const docPath = buildSlotRequestDocPath(year, requestId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToSlotRequest(docSnap);
}

/**
 * Get all slot requests with optional filters
 */
export async function getSlotRequests(
    filters?: {
        status?: SlotRequestStatus;
        expertUid?: string;
        department?: string;
    },
    year: string = DEFAULT_YEAR
): Promise<SlotRequestRecord[]> {
    const collPath = buildSlotRequestsCollectionPath(year);
    const collRef = collection(firebaseFirestore, collPath);

    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
    }

    if (filters?.expertUid) {
        constraints.push(where('expertUid', '==', filters.expertUid));
    }

    if (filters?.department) {
        constraints.push(where('department', '==', filters.department));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collRef, ...constraints);
    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => docToSlotRequest(docSnap))
        .filter((request): request is SlotRequestRecord => request !== null);
}

/**
 * Get all pending slot requests
 */
export async function getPendingSlotRequests(
    year: string = DEFAULT_YEAR
): Promise<SlotRequestRecord[]> {
    return getSlotRequests({ status: 'pending' }, year);
}

/**
 * Get pending slot request by expert UID
 */
export async function getPendingSlotRequestByExpert(
    expertUid: string,
    year: string = DEFAULT_YEAR
): Promise<SlotRequestRecord | null> {
    const requests = await getSlotRequests({ status: 'pending', expertUid }, year);
    return requests.length > 0 ? requests[0] : null;
}

/**
 * Get slot requests by expert UID (all statuses)
 */
export async function getSlotRequestsByExpert(
    expertUid: string,
    year: string = DEFAULT_YEAR
): Promise<SlotRequestRecord[]> {
    return getSlotRequests({ expertUid }, year);
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Approve a slot request and update the expert's maxExpertSlots
 */
export async function approveSlotRequest(
    requestId: string,
    options: RespondToSlotRequestOptions,
    year: string = DEFAULT_YEAR
): Promise<void> {
    const request = await getSlotRequest(requestId, year);
    if (!request) {
        throw new Error('Slot request not found.');
    }

    if (request.status !== 'pending') {
        throw new Error('This request has already been processed.');
    }

    const docPath = buildSlotRequestDocPath(year, requestId);
    const docRef = doc(firebaseFirestore, docPath);

    const batch = writeBatch(firebaseFirestore);

    // Update the request status
    batch.update(docRef, {
        status: 'approved',
        respondedAt: serverTimestamp(),
        respondedBy: options.respondedBy,
        responseNote: options.responseNote || null,
        updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Update the expert's maxSlots
    await updateUserProfile(request.expertUid, {
        maxSlots: request.requestedSlots,
    });
}

/**
 * Reject a slot request
 */
export async function rejectSlotRequest(
    requestId: string,
    options: RespondToSlotRequestOptions,
    year: string = DEFAULT_YEAR
): Promise<void> {
    const request = await getSlotRequest(requestId, year);
    if (!request) {
        throw new Error('Slot request not found.');
    }

    if (request.status !== 'pending') {
        throw new Error('This request has already been processed.');
    }

    const docPath = buildSlotRequestDocPath(year, requestId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        status: 'rejected',
        respondedAt: serverTimestamp(),
        respondedBy: options.respondedBy,
        responseNote: options.responseNote || null,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a slot request (typically only for pending requests)
 */
export async function deleteSlotRequest(
    requestId: string,
    year: string = DEFAULT_YEAR
): Promise<void> {
    const docPath = buildSlotRequestDocPath(year, requestId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Subscribe to slot requests with optional filters
 */
export function listenSlotRequests(
    options: SlotRequestListenerOptions,
    filters?: {
        status?: SlotRequestStatus;
        expertUid?: string;
        department?: string;
    },
    year: string = DEFAULT_YEAR
): () => void {
    const { onData, onError } = options;
    const collPath = buildSlotRequestsCollectionPath(year);
    const collRef = collection(firebaseFirestore, collPath);

    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
    }

    if (filters?.expertUid) {
        constraints.push(where('expertUid', '==', filters.expertUid));
    }

    if (filters?.department) {
        constraints.push(where('department', '==', filters.department));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collRef, ...constraints);

    return onSnapshot(
        q,
        (snapshot) => {
            const requests = snapshot.docs
                .map((docSnap) => docToSlotRequest(docSnap))
                .filter((request): request is SlotRequestRecord => request !== null);
            onData(requests);
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Slot requests listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to pending slot requests
 */
export function listenPendingSlotRequests(
    options: SlotRequestListenerOptions,
    year: string = DEFAULT_YEAR
): () => void {
    return listenSlotRequests(options, { status: 'pending' }, year);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the effective max slots for a expert
 * Returns the user's maxSlots or DEFAULT_MAX_EXPERT_SLOTS if not set
 */
export async function getExpertMaxSlots(expertUid: string): Promise<number> {
    const { DEFAULT_MAX_EXPERT_SLOTS } = await import('../../../types/slotRequest');
    const user = await findUserById(expertUid);
    if (!user) {
        return DEFAULT_MAX_EXPERT_SLOTS;
    }
    return user.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS;
}

/**
 * Check if a expert can accept more advisees
 * @param expertUid - The expert's UID
 * @param currentCount - Current number of active advisees/groups
 * @returns true if the expert has available slots
 */
export async function canExpertAcceptMore(
    expertUid: string,
    currentCount: number
): Promise<boolean> {
    const maxSlots = await getExpertMaxSlots(expertUid);
    return currentCount < maxSlots;
}
