/**
 * Firebase Firestore - Topic Proposals
 * CRUD operations for Topic Proposal documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/proposals/{proposalId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy,
    serverTimestamp, onSnapshot, writeBatch, type QueryConstraint, type DocumentReference,
    type DocumentSnapshot, type QueryDocumentSnapshot, type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { TopicProposalEntry, TopicProposalBatch, TopicProposalReviewEvent } from '../../../types/proposal';
import type { ESG, SDG, ThesisAgenda } from '../../../types/thesis';
import { PROPOSALS_SUBCOLLECTION, GROUPS_SUBCOLLECTION } from '../../../config/firestore';
import { buildProposalsCollectionPath, buildProposalDocPath, extractPathParams } from './paths';


// ============================================================================
// Types
// ============================================================================

export type TopicProposalSetRecord = TopicProposalBatch & { id: string };

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

/**
 * Extended decision payload for moderator approval with agenda and sustainability classification
 */
export interface ModeratorDecisionPayload extends ProposalDecisionPayload {
    agenda?: ThesisAgenda;
    ESG?: ESG;
    SDG?: SDG;
}

/**
 * Extended decision payload for chair approval with agenda and sustainability classification
 */
export interface ChairDecisionPayload extends ProposalDecisionPayload {
    agenda?: ThesisAgenda;
    ESG?: ESG;
    SDG?: SDG;
}

/**
 * Extended decision payload for head approval with agenda and sustainability classification
 */
export interface HeadDecisionPayload extends ProposalDecisionPayload {
    agenda?: ThesisAgenda;
    ESG?: ESG;
    SDG?: SDG;
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
    const entries: TopicProposalEntry[] = entriesRaw.map((entry: Record<string, unknown>) => {
        const baseEntry: TopicProposalEntry = {
            id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
            title: typeof entry.title === 'string' ? entry.title : 'Untitled Topic',
            description: typeof entry.description === 'string' ? entry.description : '',
            proposedBy: typeof entry.proposedBy === 'string' ? entry.proposedBy : '',
            createdAt: (entry.createdAt as Timestamp)?.toDate?.() || new Date(),
            updatedAt: (entry.updatedAt as Timestamp)?.toDate?.() || new Date(),
        };

        // Only add optional fields if they have values
        if (entry.agenda) {
            baseEntry.agenda = entry.agenda as TopicProposalEntry['agenda'];
        }
        if (entry.ESG) {
            baseEntry.ESG = entry.ESG as TopicProposalEntry['ESG'];
        }
        if (entry.SDG) {
            baseEntry.SDG = entry.SDG as TopicProposalEntry['SDG'];
        }
        if (typeof entry.problemStatement === 'string' && entry.problemStatement) {
            baseEntry.problemStatement = entry.problemStatement;
        }
        if (typeof entry.expectedOutcome === 'string' && entry.expectedOutcome) {
            baseEntry.expectedOutcome = entry.expectedOutcome;
        }
        if (Array.isArray(entry.keywords) && entry.keywords.length > 0) {
            baseEntry.keywords = entry.keywords as string[];
        }
        if (entry.status) {
            baseEntry.status = entry.status as TopicProposalEntry['status'];
        }
        if (typeof entry.usedAsThesis === 'boolean') {
            baseEntry.usedAsThesis = entry.usedAsThesis;
        }

        return baseEntry;
    });

    const auditsRaw = Array.isArray(data.audits) ? data.audits : [];
    const audits: TopicProposalReviewEvent[] = auditsRaw.map((audit: Record<string, unknown>) => {
        const baseAudit: TopicProposalReviewEvent = {
            stage: audit.stage as 'moderator' | 'chair' | 'head',
            status: audit.status as 'approved' | 'rejected',
            reviewerUid: typeof audit.reviewerUid === 'string' ? audit.reviewerUid : '',
            proposalId: typeof audit.proposalId === 'string' ? audit.proposalId : '',
            reviewedAt: (audit.reviewedAt as Timestamp)?.toDate?.() || new Date(),
        };

        // Only add notes if present
        if (typeof audit.notes === 'string' && audit.notes) {
            baseAudit.notes = audit.notes;
        }

        return baseAudit;
    });

    // Compute awaiting flags
    const awaitingModerator = entries.some((e) => e.status === 'submitted');
    const awaitingChair = entries.some((e) => e.status === 'chair_review');
    const awaitingHead = entries.some((e) => e.status === 'head_review');

    const result: TopicProposalSetRecord = {
        id: docSnap.id,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate?.() || new Date(),
        entries,
        audits,
        awaitingHead,
        awaitingChair,
        awaitingModerator,
    };

    // Only add optional fields if they have values
    if (data.submittedBy?.toDate?.()) {
        result.submittedBy = data.submittedBy.toDate();
    }
    if (data.submittedAt?.toDate?.()) {
        result.submittedAt = data.submittedAt.toDate();
    }
    if (typeof data.usedAsThesisAt === 'string' && data.usedAsThesisAt) {
        result.usedAsThesisAt = data.usedAsThesisAt;
    }
    if (typeof data.set === 'number') {
        result.batch = data.set;
    }

    return result;
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

    const proposalData: Record<string, unknown> = {
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        entries: [],
        audits: [],
    };

    // Include set number if provided
    if (typeof payload.set === 'number') {
        proposalData.set = payload.set;
    }

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

    const proposalData: Record<string, unknown> = {
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        entries: [],
        audits: [],
    };

    // Include set number if provided
    if (typeof payload.set === 'number') {
        proposalData.set = payload.set;
    }

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
    data: Partial<TopicProposalBatch>
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
        status: 'submitted' as TopicProposalEntry['status'],
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
 * Record a moderator decision on a proposal entry (context-required version)
 * Flow: moderator approval sends to chair_review, rejection sends to moderator_rejected
 */
async function recordModeratorDecisionWithContext(
    ctx: ProposalContext,
    payload: ModeratorDecisionPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entryIndex = proposal.entries.findIndex((e) => e.id === payload.entryId);
    if (entryIndex === -1) throw new Error('Proposal entry not found.');

    const entry = proposal.entries[entryIndex];
    const now = new Date();

    const updatedEntries = [...proposal.entries];
    // Update status: approval goes to chair_review (not head_review)
    const newStatus: TopicProposalEntry['status'] = payload.decision === 'approved'
        ? 'chair_review'
        : 'moderator_rejected';

    // Build updated entry with optional agenda, ESG, and SDG fields (set by moderator)
    const updatedEntry: TopicProposalEntry = {
        ...entry,
        status: newStatus,
        updatedAt: now,
    };

    // Add agenda if provided (for approval)
    if (payload.agenda) {
        updatedEntry.agenda = payload.agenda;
    }
    // Add ESG if provided (for approval)
    if (payload.ESG) {
        updatedEntry.ESG = payload.ESG;
    }
    // Add SDG if provided (for approval)
    if (payload.SDG) {
        updatedEntry.SDG = payload.SDG;
    }

    updatedEntries[entryIndex] = updatedEntry;

    const newAudit: TopicProposalReviewEvent = {
        stage: 'moderator',
        status: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.entryId,
        reviewedAt: now,
    };
    // Only add notes if provided
    if (payload.notes) {
        newAudit.notes = payload.notes;
    }

    const docPath = buildProposalDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId
    );
    const docRef = doc(firebaseFirestore, docPath);

    // Strip undefined from all entries and audits before saving
    const cleanedEntries = updatedEntries.map((e) => stripUndefined(e));
    const cleanedAudits = [...proposal.audits, newAudit].map((a) => stripUndefined(a));

    await updateDoc(docRef, {
        entries: cleanedEntries,
        audits: cleanedAudits,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Record a chair decision on a proposal entry (context-required version)
 * Flow: chair approval sends to head_review, rejection sends to chair_rejected
 */
async function recordChairDecisionWithContext(
    ctx: ProposalContext,
    payload: ChairDecisionPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entryIndex = proposal.entries.findIndex((e) => e.id === payload.entryId);
    if (entryIndex === -1) throw new Error('Proposal entry not found.');

    const entry = proposal.entries[entryIndex];
    const now = new Date();

    const updatedEntries = [...proposal.entries];
    // Update status: approval goes to head_review, rejection to chair_rejected
    const newStatus: TopicProposalEntry['status'] = payload.decision === 'approved'
        ? 'head_review'
        : 'chair_rejected';

    // Build updated entry with optional agenda, ESG, and SDG fields
    const updatedEntry: TopicProposalEntry = {
        ...entry,
        status: newStatus,
        updatedAt: now,
    };

    // Add agenda if provided (for approval)
    if (payload.agenda) {
        updatedEntry.agenda = payload.agenda;
    }
    // Add ESG if provided (for approval)
    if (payload.ESG) {
        updatedEntry.ESG = payload.ESG;
    }
    // Add SDG if provided (for approval)
    if (payload.SDG) {
        updatedEntry.SDG = payload.SDG;
    }

    updatedEntries[entryIndex] = updatedEntry;

    const newAudit: TopicProposalReviewEvent = {
        stage: 'chair',
        status: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.entryId,
        reviewedAt: now,
    };
    // Only add notes if provided
    if (payload.notes) {
        newAudit.notes = payload.notes;
    }

    const docPath = buildProposalDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId
    );
    const docRef = doc(firebaseFirestore, docPath);

    // Strip undefined from all entries and audits before saving
    const cleanedEntries = updatedEntries.map((e) => stripUndefined(e));
    const cleanedAudits = [...proposal.audits, newAudit].map((a) => stripUndefined(a));

    await updateDoc(docRef, {
        entries: cleanedEntries,
        audits: cleanedAudits,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Record a head decision on a proposal entry (context-required version)
 */
async function recordHeadDecisionWithContext(
    ctx: ProposalContext,
    payload: HeadDecisionPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entryIndex = proposal.entries.findIndex((e) => e.id === payload.entryId);
    if (entryIndex === -1) throw new Error('Proposal entry not found.');

    const entry = proposal.entries[entryIndex];
    const now = new Date();

    const updatedEntries = [...proposal.entries];
    // Update status to string-based workflow state
    const newStatus: TopicProposalEntry['status'] = payload.decision === 'approved'
        ? 'head_approved'
        : 'head_rejected';

    // Build updated entry with optional agenda, ESG, and SDG fields
    const updatedEntry: TopicProposalEntry = {
        ...entry,
        status: newStatus,
        updatedAt: now,
    };

    // Add agenda if provided (for approval)
    if (payload.agenda) {
        updatedEntry.agenda = payload.agenda;
    }
    // Add ESG if provided (for approval)
    if (payload.ESG) {
        updatedEntry.ESG = payload.ESG;
    }
    // Add SDG if provided (for approval)
    if (payload.SDG) {
        updatedEntry.SDG = payload.SDG;
    }

    updatedEntries[entryIndex] = updatedEntry;

    // Build audit object without undefined values
    const newAudit: TopicProposalReviewEvent = {
        stage: 'head',
        status: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.entryId,
        reviewedAt: now,
    };
    // Only add notes if provided
    if (payload.notes) {
        newAudit.notes = payload.notes;
    }

    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    // Strip undefined from all entries and audits before saving
    const cleanedEntries = updatedEntries.map((e) => stripUndefined(e));
    const cleanedAudits = [...proposal.audits, newAudit].map((a) => stripUndefined(a));

    await updateDoc(docRef, {
        entries: cleanedEntries,
        audits: cleanedAudits,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Mark a proposal entry as being used for thesis.
 * This creates a thesis document and updates the group with the thesis reference.
 */
export async function markProposalAsThesis(
    ctx: ProposalContext,
    payload: UseTopicPayload
): Promise<void> {
    const proposal = await getProposalSet(ctx, payload.proposalId);
    if (!proposal) throw new Error('Proposal set not found.');

    const entry = proposal.entries.find((e) => e.id === payload.entryId);
    if (!entry) throw new Error('Proposal entry not found.');
    if (entry.status !== 'head_approved') {
        throw new Error('Only head-approved proposals can be used as thesis topic.');
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // Import thesis utilities dynamically to avoid circular dependencies
    const { createThesisForGroup } = await import('./thesis');
    const { seedAllChaptersForThesis } = await import('./chapters');
    const { getChapterConfigByCourse } = await import('./chapter');
    const { templatesToThesisChapters, buildDefaultThesisChapters } = await import('../../thesisChapterTemplates');

    // Get chapter templates for this course or use defaults
    let chapters;
    try {
        const chapterConfig = await getChapterConfigByCourse(ctx.department, ctx.course);
        chapters = chapterConfig?.chapters
            ? templatesToThesisChapters(chapterConfig.chapters)
            : buildDefaultThesisChapters();
    } catch (error) {
        console.warn('Failed to load chapter templates, using defaults:', error);
        chapters = buildDefaultThesisChapters();
    }

    // Create thesis document WITHOUT chapters (chapters stored in subcollection)
    // Build base thesis data
    const baseThesisData = {
        title: entry.title,
        submissionDate: nowISO,
        lastUpdated: nowISO,
        stages: [],
        // Note: chapters are NOT stored here - they are seeded to subcollection below
        groupId: ctx.groupId,
        overallStatus: 'draft' as const,
    };

    // Build extended thesis data with optional agenda, ESG, and SDG
    const thesisData = {
        ...baseThesisData,
        ...(entry.agenda && { agenda: entry.agenda }),
        ...(entry.ESG && { ESG: entry.ESG }),
        ...(entry.SDG && { SDG: entry.SDG }),
    };

    const thesisId = await createThesisForGroup(
        { year: ctx.year, department: ctx.department, course: ctx.course, groupId: ctx.groupId },
        thesisData
    );

    // Seed chapters to the hierarchical subcollection: stages/{stageSlug}/chapters/{chapterId}
    await seedAllChaptersForThesis(
        { year: ctx.year, department: ctx.department, course: ctx.course, groupId: ctx.groupId, thesisId },
        chapters
    );

    // Note: thesis is now stored as a separate document linked by groupId
    // No need to update group with thesis reference - the thesis document is found via the group path

    // Update entry with usedAsThesis flag
    const updatedEntries = proposal.entries.map((e) =>
        e.id === payload.entryId
            ? { ...e, usedAsThesis: true, updatedAt: now }
            : e
    );

    // Update proposal set with usedAsThesisAt, usedBy, and updated entries
    const docPath = buildProposalDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, payload.proposalId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        entries: updatedEntries.map((e) => stripUndefined(e)),
        usedAsThesisAt: nowISO,
        usedBy: payload.requestedBy,
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
    // Filter for entries with 'submitted' status (awaiting moderator)
    return listenAllProposals(undefined, {
        onData: (proposals) => {
            const awaiting = proposals.filter((p) =>
                p.entries.some((e) => e.status === 'submitted')
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
                p.entries.some((e) => e.status === 'head_review')
            );
            options.onData(awaiting);
        },
        onError: options.onError,
    });
}

/**
 * Listen to proposals awaiting chair review
 */
export function listenProposalsAwaitingChair(
    options: TopicProposalListenerOptions
): () => void {
    return listenAllProposals(undefined, {
        onData: (proposals) => {
            const awaiting = proposals.filter((p) =>
                p.entries.some((e) => e.status === 'chair_review')
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

/**
 * Listen to topic proposal sets for a specific group by group ID.
 * Uses collectionGroup query to find proposals regardless of path.
 *
 * @param groupId The group's document ID
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenTopicProposalSetsByGroup(
    groupId: string,
    options: TopicProposalListenerOptions
): () => void {
    if (!groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const proposalsQuery = collectionGroup(firebaseFirestore, PROPOSALS_SUBCOLLECTION);

    return onSnapshot(
        proposalsQuery,
        (snapshot) => {
            const proposals = snapshot.docs
                .filter((docSnap) => {
                    // Check if the parent path contains the groupId
                    const pathParts = docSnap.ref.path.split('/');
                    const groupsIndex = pathParts.indexOf(GROUPS_SUBCOLLECTION);
                    return groupsIndex >= 0 && pathParts[groupsIndex + 1] === groupId;
                })
                .map((docSnap) => docToProposalSet(docSnap))
                .filter((p): p is TopicProposalSetRecord => p !== null)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            options.onData(proposals);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Topic proposal by group listener error:', error);
        }
    );
}

/**
 * Alias for submitProposalSet
 */
export async function submitTopicProposalSet(
    ctx: ProposalContext,
    proposalId: string,
    payload: SubmitTopicProposalPayload
): Promise<void> {
    return submitProposalSet(ctx, proposalId, payload);
}

/**
 * Alias for updateProposalEntries
 */
export async function updateTopicProposalDraftEntries(
    ctx: ProposalContext,
    proposalId: string,
    entries: TopicProposalEntry[]
): Promise<void> {
    return updateProposalEntries(ctx, proposalId, entries);
}

/**
 * Alias for markProposalAsThesis
 */
export async function markTopicProposalAsThesis(
    ctx: ProposalContext,
    payload: UseTopicPayload
): Promise<void> {
    return markProposalAsThesis(ctx, payload);
}

// ============================================================================
// Context-Free Decision Functions
// ============================================================================

/**
 * Payload for context-free decision recording (used by pages)
 */
export interface ContextFreeDecisionPayload {
    /** The proposal set document ID */
    setId: string;
    /** The entry ID within the proposal set */
    proposalId: string;
    /** The reviewer's user ID */
    reviewerUid: string;
    /** The decision */
    decision: 'approved' | 'rejected';
    /** Optional notes */
    notes?: string;
}

/**
 * Extended payload for moderator approval with agenda, ESG, and SDG classification
 */
export interface ModeratorApprovalPayload extends ContextFreeDecisionPayload {
    /** Research agenda classification */
    agenda?: ThesisAgenda;
    /** ESG category */
    ESG?: ESG;
    /** Sustainable Development Goal */
    SDG?: SDG;
}

/**
 * Extended payload for chair approval with agenda, ESG, and SDG classification
 */
export interface ChairApprovalPayload extends ContextFreeDecisionPayload {
    /** Research agenda classification */
    agenda?: ThesisAgenda;
    /** ESG category */
    ESG?: ESG;
    /** Sustainable Development Goal */
    SDG?: SDG;
}

/**
 * Extended payload for head approval with agenda, ESG, and SDG classification
 */
export interface HeadApprovalPayload extends ContextFreeDecisionPayload {
    /** Research agenda classification */
    agenda?: ThesisAgenda;
    /** ESG category */
    ESG?: ESG;
    /** Sustainable Development Goal */
    SDG?: SDG;
}

/**
 * Find a proposal set by ID using collectionGroup and extract context from path.
 * @param setId The proposal set document ID
 * @returns The document snapshot and extracted context, or null if not found
 */
async function findProposalSetWithContext(
    setId: string
): Promise<{ docSnap: DocumentSnapshot<DocumentData>; ctx: ProposalContext } | null> {
    const proposalsQuery = collectionGroup(firebaseFirestore, PROPOSALS_SUBCOLLECTION);
    const snapshot = await getDocs(proposalsQuery);

    const docSnap = snapshot.docs.find((d) => d.id === setId);
    if (!docSnap) return null;

    const pathParams = extractPathParams(docSnap.ref.path);
    if (!pathParams.year || !pathParams.department || !pathParams.course || !pathParams.groupId) {
        throw new Error('Could not extract full context from proposal path');
    }

    return {
        docSnap,
        ctx: {
            year: pathParams.year,
            department: pathParams.department,
            course: pathParams.course,
            groupId: pathParams.groupId,
        },
    };
}

/**
 * Record a moderator decision on a proposal entry (context-free version).
 * Finds the proposal by setId using collectionGroup and extracts context from path.
 *
 * @param payload Decision payload with setId, proposalId (entry ID), reviewerUid, decision, notes, agenda, ESG, SDG
 */
export async function recordModeratorDecision(payload: ModeratorApprovalPayload): Promise<void> {
    const result = await findProposalSetWithContext(payload.setId);
    if (!result) throw new Error('Proposal set not found.');

    const { ctx } = result;

    // Build decision payload, only including defined values
    const decisionPayload: ModeratorDecisionPayload = {
        proposalId: payload.setId,
        entryId: payload.proposalId,
        reviewerUid: payload.reviewerUid,
        decision: payload.decision,
    };

    // Only add optional fields if they have values
    if (payload.notes !== undefined) {
        decisionPayload.notes = payload.notes;
    }
    if (payload.agenda?.agendaPath && payload.agenda.agendaPath.length > 0) {
        decisionPayload.agenda = payload.agenda;
    }
    if (payload.ESG) {
        decisionPayload.ESG = payload.ESG;
    }
    if (payload.SDG) {
        decisionPayload.SDG = payload.SDG;
    }

    return recordModeratorDecisionWithContext(ctx, decisionPayload);
}

/**
 * Record a chair decision on a proposal entry (context-free version).
 * Finds the proposal by setId using collectionGroup and extracts context from path.
 *
 * @param payload Decision payload with setId, proposalId (entry ID), reviewerUid, decision, notes, agenda, ESG, SDG
 */
export async function recordChairDecision(payload: ChairApprovalPayload): Promise<void> {
    const result = await findProposalSetWithContext(payload.setId);
    if (!result) throw new Error('Proposal set not found.');

    const { ctx } = result;

    // Build decision payload, only including defined values
    const decisionPayload: ChairDecisionPayload = {
        proposalId: payload.setId,
        entryId: payload.proposalId,
        reviewerUid: payload.reviewerUid,
        decision: payload.decision,
    };

    // Only add optional fields if they have values
    if (payload.notes !== undefined) {
        decisionPayload.notes = payload.notes;
    }
    if (payload.agenda?.agendaPath && payload.agenda.agendaPath.length > 0) {
        decisionPayload.agenda = payload.agenda;
    }
    if (payload.ESG) {
        decisionPayload.ESG = payload.ESG;
    }
    if (payload.SDG) {
        decisionPayload.SDG = payload.SDG;
    }

    return recordChairDecisionWithContext(ctx, decisionPayload);
}

/**
 * Record a head decision on a proposal entry (context-free version).
 * Finds the proposal by setId using collectionGroup and extracts context from path.
 *
 * @param payload Decision payload with setId, proposalId (entry ID), reviewerUid, decision, notes, agenda, ESG, SDG
 */
export async function recordHeadDecision(payload: HeadApprovalPayload): Promise<void> {
    const result = await findProposalSetWithContext(payload.setId);
    if (!result) throw new Error('Proposal set not found.');

    const { ctx } = result;

    // Build decision payload, only including defined values
    const decisionPayload: HeadDecisionPayload = {
        proposalId: payload.setId,
        entryId: payload.proposalId,
        reviewerUid: payload.reviewerUid,
        decision: payload.decision,
    };

    // Only add optional fields if they have values
    if (payload.notes !== undefined) {
        decisionPayload.notes = payload.notes;
    }
    if (payload.agenda?.agendaPath && payload.agenda.agendaPath.length > 0) {
        decisionPayload.agenda = payload.agenda;
    }
    if (payload.ESG) {
        decisionPayload.ESG = payload.ESG;
    }
    if (payload.SDG) {
        decisionPayload.SDG = payload.SDG;
    }

    return recordHeadDecisionWithContext(ctx, decisionPayload);
}

// ============================================================================
// More Context-Free Functions
// ============================================================================

/**
 * Create a new topic proposal set (context-free version).
 * Requires groupId to determine context.
 *
 * @param groupId Group document ID
 * @param payload Creation payload
 * @returns The new proposal set ID
 */
export async function createProposalSetByGroup(
    groupId: string,
    payload: CreateTopicProposalSetPayload
): Promise<string> {
    const ctx = await findContextByGroupId(groupId);
    if (!ctx) throw new Error('Cannot determine group context');

    return createProposalSet(ctx, payload);
}

/**
 * Update proposal draft entries (context-free version).
 * Finds context from the proposal set ID.
 *
 * @param setId Proposal set document ID
 * @param entries Updated entries array
 */
export async function updateDraftEntriesBySetId(
    setId: string,
    entries: TopicProposalEntry[]
): Promise<void> {
    const result = await findProposalSetWithContext(setId);
    if (!result) throw new Error('Proposal set not found.');

    return updateProposalEntries(result.ctx, setId, entries);
}

/**
 * Submit a topic proposal set (context-free version).
 * Finds context from the proposal set ID.
 *
 * @param setId Proposal set document ID
 * @param userUid Submitting user's ID
 */
export async function submitProposalSetBySetId(
    setId: string,
    userUid: string
): Promise<void> {
    const result = await findProposalSetWithContext(setId);
    if (!result) throw new Error('Proposal set not found.');

    return submitProposalSet(result.ctx, setId, { submittedBy: userUid });
}

/**
 * Mark a proposal as used for thesis (context-free version).
 * Finds context from the proposal set ID.
 *
 * @param payload Use topic payload with setId
 */
export async function markProposalAsThesisBySetId(
    payload: UseTopicPayload
): Promise<void> {
    const result = await findProposalSetWithContext(payload.proposalId);
    if (!result) throw new Error('Proposal set not found.');

    return markProposalAsThesis(result.ctx, payload);
}

/**
 * Helper to find context by group ID using collectionGroup.
 */
async function findContextByGroupId(groupId: string): Promise<ProposalContext | null> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const snapshot = await getDocs(groupsQuery);

    const groupDoc = snapshot.docs.find((d) => d.id === groupId);
    if (!groupDoc) return null;

    const pathParams = extractPathParams(groupDoc.ref.path);
    if (!pathParams.year || !pathParams.department || !pathParams.course) return null;

    return {
        year: pathParams.year,
        department: pathParams.department,
        course: pathParams.course,
        groupId,
    };
}
