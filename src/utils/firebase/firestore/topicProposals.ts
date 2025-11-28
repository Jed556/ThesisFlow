/**
 * Firebase Firestore - Topic Proposals
 * CRUD operations for Topic Proposal documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/proposals/{proposalId}
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
    orderBy,
    serverTimestamp,
    onSnapshot,
    writeBatch,
    type QueryConstraint,
    type DocumentReference,
    type DocumentSnapshot,
    type QueryDocumentSnapshot,
    type DocumentData,
    type Timestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type {
    TopicProposalEntry,
    TopicProposalSet,
    TopicProposalReviewEvent,
} from '../../../types/proposal';
import type { ThesisStatus } from '../../../types/thesis';
import {
    buildProposalsCollectionPath,
    buildProposalDocPath,
    PROPOSALS_SUBCOLLECTION,
} from '../../../config/firestore';

// ============================================================================
// Types
// ============================================================================

export type TopicProposalSetRecord = TopicProposalSet & { id: string };

export interface ProposalContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

export interface TopicProposalListenerOptions {
    onData: (records: TopicProposalSetRecord[]) => void;
    onError?: (error: Error) => void;
}

export interface CreateTopicProposalSetPayload {
    createdBy: string;
    set?: number;
}

export interface SubmitTopicProposalPayload {
    submittedBy: string;
}

export interface ProposalDecisionPayload {
    proposalId: string;
    entryId: string;
    reviewerUid: string;
    decision: 'approved' | 'rejected';
    notes?: string;
}

export interface UseTopicPayload {
    proposalId: string;
    entryId: string;
    requestedBy: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

type TopicProposalSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

/**
 * Convert Firestore document data to TopicProposalSetRecord
 */
function docToProposalSet(docSnap: TopicProposalSnapshot): TopicProposalSetRecord | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data() ?? {};

    const entriesRaw = Array.isArray(data.entries) ? data.entries : [];
    const entries: TopicProposalEntry[] = entriesRaw.map((entry: Record<string, unknown>) => ({
        id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
        title: typeof entry.title === 'string' ? entry.title : 'Untitled Topic',
        description: typeof entry.description === 'string' ? entry.description : '',
        agenda: entry.agenda as TopicProposalEntry['agenda'],
        ESG: entry.ESG as TopicProposalEntry['ESG'],
        proposedBy: typeof entry.proposedBy === 'string' ? entry.proposedBy : '',
        createdAt: (entry.createdAt as Timestamp)?.toDate?.() || new Date(),
        updatedAt: (entry.updatedAt as Timestamp)?.toDate?.() || new Date(),
        status: entry.status as TopicProposalEntry['status'],
    }));

    const auditsRaw = Array.isArray(data.audits) ? data.audits : [];
    const audits: TopicProposalReviewEvent[] = auditsRaw.map((audit: Record<string, unknown>) => ({
        stage: audit.stage as 'moderator' | 'head',
        status: audit.status as 'approved' | 'rejected',
        reviewerUid: typeof audit.reviewerUid === 'string' ? audit.reviewerUid : '',
        proposalId: typeof audit.proposalId === 'string' ? audit.proposalId : '',
        notes: typeof audit.notes === 'string' ? audit.notes : undefined,
        reviewedAt: (audit.reviewedAt as Timestamp)?.toDate?.() || new Date(),
    }));

    return {
        id: docSnap.id,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate?.() || new Date(),
        entries,
        submittedBy: data.submittedBy?.toDate?.(),
        submittedAt: data.submittedAt?.toDate?.(),
        usedAsThesisAt: typeof data.usedAsThesisAt === 'string' ? data.usedAsThesisAt : undefined,
        audits,
    };
}

/**
 * Remove undefined values from an object recursively
 */
function stripUndefined<T>(value: T): T {
    if (value === undefined) return value;
    if (value === null) return value;
    if (Array.isArray(value)) {
        return value
            .map((v) => stripUndefined(v))
            .filter((v) => v !== undefined) as unknown as T;
    }
    if (typeof value === 'object' && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (v === undefined) continue;
            const cleaned = stripUndefined(v);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out as unknown as T;
    }
    return value;
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new topic proposal set for a group
 */
export async function createProposalSet(
    ctx: ProposalContext,
    payload: CreateTopicProposalSetPayload
): Promise<string> {
    const collectionPath = buildProposalsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const proposalsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(proposalsRef);

    const proposalData = {
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        entries: [],
        audits: [],
    };

    await setDoc(newDocRef, proposalData);
    return newDocRef.id;
}

/**
 * Create a proposal set with a specific ID
 */
export async function createProposalSetWithId(
    ctx: ProposalContext,
    proposalId: string,
    payload: CreateTopicProposalSetPayload
): Promise<void> {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    const proposalData = {
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        entries: [],
        audits: [],
    };

    await setDoc(docRef, proposalData);
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a proposal set by ID
 */
export async function getProposalSet(
    ctx: ProposalContext,
    proposalId: string
): Promise<TopicProposalSetRecord | null> {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToProposalSet(docSnap);
}

/**
 * Get proposal document reference
 */
export function getProposalDocRef(ctx: ProposalContext, proposalId: string): DocumentReference {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    return doc(firebaseFirestore, docPath);
}

/**
 * Get all proposal sets for a group
 */
export async function getProposalsForGroup(ctx: ProposalContext): Promise<TopicProposalSetRecord[]> {
    const collectionPath = buildProposalsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const proposalsRef = collection(firebaseFirestore, collectionPath);
    const q = query(proposalsRef, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => docToProposalSet(docSnap))
        .filter((p): p is TopicProposalSetRecord => p !== null);
}

/**
 * Get all proposals across all groups using collectionGroup query
 */
export async function getAllProposals(constraints?: QueryConstraint[]): Promise<TopicProposalSetRecord[]> {
    const proposalsQuery = collectionGroup(firebaseFirestore, PROPOSALS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(proposalsQuery, ...constraints)
        : query(proposalsQuery, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const proposal = docToProposalSet(docSnap);
        return proposal;
    }).filter((p): p is TopicProposalSetRecord => p !== null);
}

/**
 * Get the active proposal set for a group (most recent with pending entries)
 */
export async function getActiveProposalForGroup(ctx: ProposalContext): Promise<TopicProposalSetRecord | null> {
    const proposals = await getProposalsForGroup(ctx);
    if (proposals.length === 0) return null;

    // Return the most recent proposal set that hasn't been used for thesis
    return proposals.find((p) => !p.usedAsThesisAt) || proposals[0];
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update a proposal set
 */
export async function updateProposalSet(
    ctx: ProposalContext,
    proposalId: string,
    data: Partial<TopicProposalSet>
): Promise<void> {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = stripUndefined({
        ...data,
        updatedAt: serverTimestamp(),
    });

    await updateDoc(docRef, cleanedData);
}

/**
 * Update draft entries in a proposal set
 */
export async function updateProposalEntries(
    ctx: ProposalContext,
    proposalId: string,
    entries: TopicProposalEntry[]
): Promise<void> {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    const sanitizedEntries = entries.map((entry) => stripUndefined({
        ...entry,
        updatedAt: entry.updatedAt || new Date(),
        createdAt: entry.createdAt || new Date(),
    }));

    await updateDoc(docRef, {
        entries: sanitizedEntries,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Submit a proposal set for review
 */
export async function submitProposalSet(
    ctx: ProposalContext,
    proposalId: string,
    payload: SubmitTopicProposalPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, proposalId);
    if (!proposal) throw new Error('Proposal set not found.');
    if (proposal.entries.length === 0) throw new Error('Add at least one topic proposal before submitting.');

    const now = new Date();
    const updatedEntries = proposal.entries.map((entry) => ({
        ...entry,
        status: {
            moderator: 'pending' as ThesisStatus,
            head: 'none' as ThesisStatus,
        },
        updatedAt: now,
    }));

    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    const sanitizedEntries = updatedEntries.map((e) => stripUndefined(e));
    await updateDoc(docRef, {
        entries: sanitizedEntries,
        submittedBy: payload.submittedBy,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Record a moderator decision on a proposal entry
 */
export async function recordModeratorDecision(
    ctx: ProposalContext,
    payload: ProposalDecisionPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entryIndex = proposal.entries.findIndex((e) => e.id === payload.entryId);
    if (entryIndex === -1) throw new Error('Proposal entry not found.');

    const entry = proposal.entries[entryIndex];
    const now = new Date();

    const updatedEntries = [...proposal.entries];
    updatedEntries[entryIndex] = {
        ...entry,
        status: {
            moderator: payload.decision as ThesisStatus,
            head: payload.decision === 'approved' ? 'pending' as ThesisStatus : 'none' as ThesisStatus,
        },
        updatedAt: now,
    };

    const newAudit: TopicProposalReviewEvent = {
        stage: 'moderator',
        status: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.entryId,
        notes: payload.notes,
        reviewedAt: now,
    };

    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        entries: updatedEntries.map((e) => stripUndefined(e)),
        audits: [...proposal.audits, newAudit],
        updatedAt: serverTimestamp(),
    });
}

/**
 * Record a head decision on a proposal entry
 */
export async function recordHeadDecision(
    ctx: ProposalContext,
    payload: ProposalDecisionPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entryIndex = proposal.entries.findIndex((e) => e.id === payload.entryId);
    if (entryIndex === -1) throw new Error('Proposal entry not found.');

    const entry = proposal.entries[entryIndex];
    const now = new Date();

    const updatedEntries = [...proposal.entries];
    updatedEntries[entryIndex] = {
        ...entry,
        status: {
            moderator: entry.status?.moderator || 'approved' as ThesisStatus,
            head: payload.decision as ThesisStatus,
        },
        updatedAt: now,
    };

    const newAudit: TopicProposalReviewEvent = {
        stage: 'head',
        status: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.entryId,
        notes: payload.notes,
        reviewedAt: now,
    };

    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        entries: updatedEntries.map((e) => stripUndefined(e)),
        audits: [...proposal.audits, newAudit],
        updatedAt: serverTimestamp(),
    });
}

/**
 * Mark a proposal entry as being used for thesis
 */
export async function markProposalAsThesis(
    ctx: ProposalContext,
    payload: UseTopicPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entry = proposal.entries.find((e) => e.id === payload.entryId);
    if (!entry) throw new Error('Proposal entry not found.');
    if (entry.status?.head !== 'approved') {
        throw new Error('Only head-approved proposals can be used as thesis topic.');
    }

    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        usedAsThesisAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
    });
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a proposal set
 */
export async function deleteProposalSet(ctx: ProposalContext, proposalId: string): Promise<void> {
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Delete multiple proposal sets in a batch
 */
export async function bulkDeleteProposals(
    proposals: { ctx: ProposalContext; proposalId: string }[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const { ctx, proposalId } of proposals) {
        const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, proposalId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to proposal sets for a specific group
 */
export function listenProposalsForGroup(
    ctx: ProposalContext,
    options: TopicProposalListenerOptions
): () => void {
    const collectionPath = buildProposalsCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const proposalsRef = collection(firebaseFirestore, collectionPath);
    const q = query(proposalsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const proposals = snapshot.docs
                .map((docSnap) => docToProposalSet(docSnap))
                .filter((p): p is TopicProposalSetRecord => p !== null);
            options.onData(proposals);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Proposal listener error:', error);
        }
    );
}

/**
 * Listen to all proposals across all groups (collectionGroup)
 */
export function listenAllProposals(
    constraints: QueryConstraint[] | undefined,
    options: TopicProposalListenerOptions
): () => void {
    const proposalsQuery = collectionGroup(firebaseFirestore, PROPOSALS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(proposalsQuery, ...constraints)
        : proposalsQuery;

    return onSnapshot(
        q,
        (snapshot) => {
            const proposals = snapshot.docs
                .map((docSnap) => docToProposalSet(docSnap))
                .filter((p): p is TopicProposalSetRecord => p !== null);
            options.onData(proposals);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Proposal listener error:', error);
        }
    );
}

/**
 * Listen to proposals awaiting moderator review
 */
export function listenProposalsAwaitingModerator(
    options: TopicProposalListenerOptions
): () => void {
    // This requires a custom field or query approach
    // For now, we'll listen to all and filter client-side
    return listenAllProposals(undefined, {
        onData: (proposals) => {
            const awaiting = proposals.filter((p) =>
                p.entries.some((e) => e.status?.moderator === 'pending')
            );
            options.onData(awaiting);
        },
        onError: options.onError,
    });
}

/**
 * Listen to proposals awaiting head review
 */
export function listenProposalsAwaitingHead(
    options: TopicProposalListenerOptions
): () => void {
    return listenAllProposals(undefined, {
        onData: (proposals) => {
            const awaiting = proposals.filter((p) =>
                p.entries.some((e) =>
                    e.status?.moderator === 'approved' && e.status?.head === 'pending'
                )
            );
            options.onData(awaiting);
        },
        onError: options.onError,
    });
}

// ============================================================================
// Alias Functions
// ============================================================================

/**
 * Alias for createProposalSet - creates a new topic proposal set.
 *
 * @param ctx Proposal context
 * @param data Proposal set data
 * @returns Proposal set ID
 */
export async function createTopicProposalSet(
    ctx: ProposalContext,
    data: CreateTopicProposalSetPayload
): Promise<string> {
    return createProposalSet(ctx, data);
}
