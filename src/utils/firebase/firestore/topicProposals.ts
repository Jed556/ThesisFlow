import {
    collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
    type DocumentData, type DocumentSnapshot, type QueryDocumentSnapshot
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { getGroupById, updateGroup } from './groups';
import { getChapterConfigByCourse } from './chapter';
import { setThesis } from './thesis';
import { buildDefaultThesisChapters, templatesToThesisChapters } from '../../thesisChapterTemplates';
import type {
    TopicProposalEntry, TopicProposalEntryStatus, TopicProposalReviewEvent,
    TopicProposalReviewerDecision, TopicProposalSetRecord
} from '../../../types/topicProposal';
import type { ThesisGroup } from '../../../types/group';
import type { ThesisChapter, ThesisData } from '../../../types/thesis';
import { MAX_TOPIC_PROPOSALS } from '../../../config/proposals';
import { canEditProposalSet, summarizeProposalEntries } from '../../topicProposalUtils';

const COLLECTION_NAME = 'topicProposals';

type TopicProposalSnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

type ListenerCallback = (records: TopicProposalSetRecord[]) => void;

export interface TopicProposalListenerOptions {
    onData: ListenerCallback;
    onError?: (error: Error) => void;
}

export interface CreateTopicProposalSetPayload {
    groupId: string;
    createdBy: string;
    set?: number;
}

export interface SubmitTopicProposalPayload {
    setId: string;
    submittedBy: string;
}

export interface ProposalDecisionPayload {
    setId: string;
    proposalId: string;
    reviewerUid: string;
    decision: 'approved' | 'rejected';
    notes?: string;
}

export interface UseTopicPayload {
    setId: string;
    proposalId: string;
    groupId: string;
    requestedBy: string;
}

async function buildInitialChaptersForGroup(group: ThesisGroup): Promise<ThesisChapter[]> {
    if (group.department && group.course) {
        try {
            const config = await getChapterConfigByCourse(group.department, group.course);
            if (config?.chapters?.length) {
                return templatesToThesisChapters(config.chapters);
            }
        } catch (error) {
            console.error(`Failed to load chapter config for ${group.department}/${group.course}:`, error);
        }
    }
    return buildDefaultThesisChapters();
}

function buildThesisPayload(group: ThesisGroup, title: string, chapters: ThesisChapter[]): ThesisData {
    const uniqueMembers = Array.from(new Set(
        (group.members.members ?? []).filter((uid): uid is string => Boolean(uid))
    ));
    const now = new Date().toISOString();

    return {
        title,
        groupId: group.id,
        leader: group.members.leader,
        members: uniqueMembers,
        adviser: group.members.adviser,
        editor: group.members.editor,
        statistician: group.members.statistician,
        submissionDate: now,
        lastUpdated: now,
        overallStatus: 'not_submitted',
        chapters,
    } satisfies ThesisData;
}


/**
 * Converts raw Firestore keyword arrays into trimmed string arrays.
 */
function normalizeKeywords(rawKeywords: unknown): string[] | undefined {
    if (!Array.isArray(rawKeywords)) {
        return undefined;
    }

    const keywords = rawKeywords
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);

    return keywords.length > 0 ? keywords : undefined;
}

/**
 * Remove undefined values from an object or array recursively.
 * Firestore rejects objects that contain `undefined` values.
 */
function stripUndefined<T>(value: T): T {
    if (value === undefined) {
        return value;
    }
    if (value === null) {
        // keep null values
        return value;
    }
    if (Array.isArray(value)) {
        return value
            .map((v) => stripUndefined(v as unknown as T))
            .filter((v) => v !== undefined) as unknown as T;
    }

    if (typeof value === 'object' && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as unknown as Record<string, unknown>)) {
            if (v === undefined) continue;
            const cleaned = stripUndefined(v as unknown as T);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out as unknown as T;
    }

    return value;
}

/**
 * Builds a strongly typed topic proposal entry from Firestore data.
 */
function mapDecision(raw: unknown): TopicProposalReviewerDecision | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }

    const payload = raw as Record<string, unknown>;
    const reviewerUid = typeof payload.reviewerUid === 'string' ? payload.reviewerUid : '';
    const decision = payload.decision === 'approved'
        ? 'approved'
        : payload.decision === 'rejected'
            ? 'rejected'
            : undefined;

    if (!reviewerUid || !decision) {
        return undefined;
    }

    return {
        reviewerUid,
        decision,
        decidedAt: normalizeTimestamp(payload.decidedAt, true),
        notes: typeof payload.notes === 'string' ? payload.notes : undefined,
    } satisfies TopicProposalReviewerDecision;
}

function mapEntry(raw: unknown): TopicProposalEntry {
    const entry = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const description = typeof entry.description === 'string'
        ? entry.description
        : typeof entry.abstract === 'string'
            ? entry.abstract
            : '';
    return {
        id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
        title: typeof entry.title === 'string' ? entry.title : 'Untitled Topic',
        description,
        problemStatement: typeof entry.problemStatement === 'string' ? entry.problemStatement : undefined,
        expectedOutcome: typeof entry.expectedOutcome === 'string' ? entry.expectedOutcome : undefined,
        keywords: normalizeKeywords(entry.keywords),
        proposedBy: typeof entry.proposedBy === 'string' ? entry.proposedBy : '',
        createdAt: normalizeTimestamp(entry.createdAt, true),
        updatedAt: normalizeTimestamp(entry.updatedAt, true),
        status: (typeof entry.status === 'string' ? entry.status : 'draft') as TopicProposalEntryStatus,
        moderatorDecision: mapDecision(entry.moderatorDecision),
        headDecision: mapDecision(entry.headDecision),
    } satisfies TopicProposalEntry;
}

/**
 * Maps review events history from Firestore.
 */
function mapReviewHistory(raw: unknown): TopicProposalReviewEvent[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .map((event): TopicProposalReviewEvent | null => {
            if (!event || typeof event !== 'object') {
                return null;
            }

            const payload = event as Record<string, unknown>;
            const stage = payload.stage === 'head' ? 'head' : payload.stage === 'moderator' ? 'moderator' : null;
            const decision = payload.decision === 'approved' ? 'approved' : payload.decision === 'rejected' ? 'rejected' : null;
            if (!stage || !decision) {
                return null;
            }

            return {
                stage,
                decision,
                reviewerUid: typeof payload.reviewerUid === 'string' ? payload.reviewerUid : '',
                proposalId: typeof payload.proposalId === 'string' ? payload.proposalId : '',
                notes: typeof payload.notes === 'string' ? payload.notes : undefined,
                reviewedAt: normalizeTimestamp(payload.reviewedAt, true),
            } satisfies TopicProposalReviewEvent;
        })
        .filter((event): event is TopicProposalReviewEvent => Boolean(event));
}

/**
 * Transforms Firestore snapshot data into a typed topic proposal set record.
 */
function mapTopicProposalDocument(snapshot: TopicProposalSnapshot): TopicProposalSetRecord {
    const data = snapshot.data() ?? {};
    const entriesRaw = Array.isArray(data.entries) ? data.entries : [];

    return {
        id: snapshot.id,
        groupId: typeof data.groupId === 'string' ? data.groupId : '',
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        createdAt: normalizeTimestamp(data.createdAt, true),
        updatedAt: normalizeTimestamp(data.updatedAt, true),
        set: typeof data.set === 'number'
            ? data.set
            : typeof data.cycle === 'number'
                ? data.cycle
                : 1,
        entries: entriesRaw.map((entry) => mapEntry(entry)),
        awaitingModerator: Boolean(data.awaitingModerator),
        awaitingHead: Boolean(data.awaitingHead),
        submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : undefined,
        submittedAt: data.submittedAt ? normalizeTimestamp(data.submittedAt, true) : undefined,
        usedBy: typeof data.usedBy === 'string' ? data.usedBy : undefined,
        usedAsThesisAt: data.usedAsThesisAt ? normalizeTimestamp(data.usedAsThesisAt, true) : undefined,
        reviewHistory: mapReviewHistory(data.reviewHistory),
    } satisfies TopicProposalSetRecord;
}

/**
 * Fetches a topic proposal set by its Firestore document ID.
 */
export async function getTopicProposalSetById(setId: string): Promise<TopicProposalSetRecord | null> {
    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        return null;
    }
    return mapTopicProposalDocument(snapshot);
}

/**
 * Creates a new empty topic proposal set for the provided group.
 * Uses groupId as the document ID to ensure one active set per group.
 */
export async function createTopicProposalSet(payload: CreateTopicProposalSetPayload): Promise<string> {
    const { groupId, createdBy, set: setNumber = 1 } = payload;
    if (!groupId) {
        throw new Error('Group ID is required to create a topic proposal set.');
    }

    const ref = doc(firebaseFirestore, COLLECTION_NAME, groupId);
    const existingSnapshot = await getDoc(ref);

    if (existingSnapshot.exists()) {
        const existingRecord = mapTopicProposalDocument(existingSnapshot);
        const existingMeta = summarizeProposalEntries(existingRecord.entries);
        const activeWorkflow = existingMeta.workflowState === 'draft' || existingMeta.workflowState === 'under_review';
        if (activeWorkflow || existingRecord.awaitingModerator || existingRecord.awaitingHead) {
            throw new Error('An active topic proposal set already exists for this group.');
        }
    }

    const proposalData = {
        groupId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        set: setNumber,
        entries: [],
        awaitingModerator: false,
        awaitingHead: false,
        reviewHistory: [],
    };

    await setDoc(ref, proposalData, { merge: true });

    return groupId;
}

/**
 * Ensures draft entries remain within the allowed count and persists them.
 */
export async function updateTopicProposalDraftEntries(setId: string, entries: TopicProposalEntry[]): Promise<void> {
    const record = await getTopicProposalSetById(setId);
    if (!record) {
        throw new Error('Topic proposal set not found.');
    }

    if (!canEditProposalSet(record)) {
        throw new Error('Only draft topic proposal sets can be edited.');
    }

    if (entries.length > MAX_TOPIC_PROPOSALS) {
        throw new Error(`You can only add up to ${MAX_TOPIC_PROPOSALS} topic proposals per cycle.`);
    }

    const normalizedEntries = entries.map((entry) => ({
        ...entry,
        keywords: entry.keywords?.map((keyword) => keyword.trim()).filter(Boolean),
        description: entry.description.trim(),
        problemStatement: entry.problemStatement?.trim() || undefined,
        expectedOutcome: entry.expectedOutcome?.trim() || undefined,
        updatedAt: entry.updatedAt || new Date().toISOString(),
        createdAt: entry.createdAt || new Date().toISOString(),
    } satisfies TopicProposalEntry));

    // sanitize to avoid writing undefined into Firestore
    const sanitized = normalizedEntries.map((e) => stripUndefined(e));
    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);
    await setDoc(ref, {
        entries: sanitized,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Submits the current draft for moderator review.
 */
export async function submitTopicProposalSet(payload: SubmitTopicProposalPayload): Promise<void> {
    const { setId, submittedBy } = payload;
    const record = await getTopicProposalSetById(setId);
    if (!record) {
        throw new Error('Topic proposal set not found.');
    }

    if (!canEditProposalSet(record)) {
        throw new Error('Only draft topic proposal sets can be submitted.');
    }

    if (record.entries.length === 0) {
        throw new Error('Add at least one topic proposal before submitting.');
    }

    const now = new Date().toISOString();
    const updatedEntries = record.entries.map((entry) => ({
        ...entry,
        status: 'submitted' as TopicProposalEntryStatus,
        updatedAt: now,
    } satisfies TopicProposalEntry));

    const meta = summarizeProposalEntries(updatedEntries);
    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);
    const cleaned = updatedEntries.map((e) => stripUndefined(e));
    await updateDoc(ref, {
        entries: cleaned,
        awaitingModerator: meta.awaitingModerator,
        awaitingHead: meta.awaitingHead,
        submittedBy,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

function buildReviewEvent(payload: ProposalDecisionPayload, stage: TopicProposalReviewEvent['stage']): TopicProposalReviewEvent {
    return {
        stage,
        decision: payload.decision,
        reviewerUid: payload.reviewerUid,
        proposalId: payload.proposalId,
        notes: payload.notes,
        reviewedAt: new Date().toISOString(),
    } satisfies TopicProposalReviewEvent;
}

/**
 * Records a moderator decision and, when approved, escalates to head reviewers.
 */
export async function recordModeratorDecision(payload: ProposalDecisionPayload): Promise<void> {
    const { setId, proposalId } = payload;
    const record = await getTopicProposalSetById(setId);
    if (!record) {
        throw new Error('Topic proposal set not found.');
    }

    const entryIndex = record.entries.findIndex((entry) => entry.id === proposalId);
    if (entryIndex === -1) {
        throw new Error('Topic proposal not found.');
    }

    const targetEntry = record.entries[entryIndex];
    if (targetEntry.status !== 'submitted') {
        throw new Error('Only proposals awaiting moderator review can be decided.');
    }

    const decidedAt = new Date().toISOString();
    const nextEntries = [...record.entries];
    nextEntries[entryIndex] = {
        ...targetEntry,
        status: payload.decision === 'approved' ? 'head_review' : 'moderator_rejected',
        updatedAt: decidedAt,
        moderatorDecision: {
            reviewerUid: payload.reviewerUid,
            decision: payload.decision,
            decidedAt,
            notes: payload.notes,
        },
    } satisfies TopicProposalEntry;

    const meta = summarizeProposalEntries(nextEntries);
    const sanitizedEntries = nextEntries.map((e) => stripUndefined(e));
    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);
    await updateDoc(ref, {
        entries: sanitizedEntries,
        awaitingModerator: meta.awaitingModerator,
        awaitingHead: meta.awaitingHead,
        updatedAt: serverTimestamp(),
        reviewHistory: [...record.reviewHistory, buildReviewEvent(payload, 'moderator')],
    });
}

/**
 * Records the head decision for a proposal, finalising approvals or rejections.
 */
export async function recordHeadDecision(payload: ProposalDecisionPayload): Promise<void> {
    const { setId, proposalId } = payload;
    const record = await getTopicProposalSetById(setId);
    if (!record) {
        throw new Error('Topic proposal set not found.');
    }

    const entryIndex = record.entries.findIndex((entry) => entry.id === proposalId);
    if (entryIndex === -1) {
        throw new Error('Topic proposal not found.');
    }

    const targetEntry = record.entries[entryIndex];
    if (targetEntry.status !== 'head_review') {
        throw new Error('Only proposals awaiting head review can be decided.');
    }

    const decidedAt = new Date().toISOString();
    const approved = payload.decision === 'approved';
    const nextEntries = [...record.entries];
    nextEntries[entryIndex] = {
        ...targetEntry,
        status: approved ? 'head_approved' : 'head_rejected',
        updatedAt: decidedAt,
        headDecision: {
            reviewerUid: payload.reviewerUid,
            decision: payload.decision,
            decidedAt,
            notes: payload.notes,
        },
    } satisfies TopicProposalEntry;

    const meta = summarizeProposalEntries(nextEntries);
    const sanitizedEntries = nextEntries.map((e) => stripUndefined(e));
    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);

    await updateDoc(ref, {
        entries: sanitizedEntries,
        awaitingHead: meta.awaitingHead,
        awaitingModerator: meta.awaitingModerator,
        updatedAt: serverTimestamp(),
        reviewHistory: [...record.reviewHistory, buildReviewEvent(payload, 'head')],
    });
}

/**
 * Subscribes to topic proposal sets for a specific group.
 * Now uses groupId as the document ID for direct lookup.
 */
export function listenTopicProposalSetsByGroup(
    groupId: string | null | undefined,
    options: TopicProposalListenerOptions,
): () => void {
    if (!groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const docRef = doc(firebaseFirestore, COLLECTION_NAME, groupId);

    return onSnapshot(
        docRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const record = mapTopicProposalDocument(snapshot);
                options.onData([record]);
            } else {
                options.onData([]);
            }
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('Topic proposal listener error:', error);
            }
        },
    );
}

/**
 * Listens to proposal sets that await moderator or head action.
 */
export function listenTopicProposalReviewQueue(
    role: 'moderator' | 'head',
    options: TopicProposalListenerOptions,
): () => void {
    const field = role === 'moderator' ? 'awaitingModerator' : 'awaitingHead';
    const proposalsQuery = query(
        collection(firebaseFirestore, COLLECTION_NAME),
        where(field, '==', true),
        orderBy('submittedAt', 'asc'),
    );

    return onSnapshot(
        proposalsQuery,
        (snapshot) => {
            const records = snapshot.docs.map((docSnap) => mapTopicProposalDocument(docSnap));
            options.onData(records);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('Topic proposal review queue listener error:', error);
            }
        },
    );
}

/**
 * Locks the approved topic and updates the corresponding thesis group metadata.
 */
export async function markProposalAsThesis(payload: UseTopicPayload): Promise<void> {
    const { setId, proposalId, groupId, requestedBy } = payload;
    const record = await getTopicProposalSetById(setId);
    if (!record) {
        throw new Error('Topic proposal set not found.');
    }

    const entry = record.entries.find((item) => item.id === proposalId);
    if (!entry || entry.status !== 'head_approved') {
        throw new Error('Only head-approved proposals can be used as the thesis topic.');
    }

    const group = await getGroupById(groupId);
    if (!group) {
        throw new Error('Thesis group not found.');
    }
    if (!group.members?.leader) {
        throw new Error('Thesis group is missing a leader.');
    }
    // Handled in src\pages\Student\TopicProposals.tsx ensureGroupThesisReference (keep this comment in case)
    // if (group.thesisId) {
    //     throw new Error('A thesis has already been created for this group.');
    // }

    const chapters = await buildInitialChaptersForGroup(group);
    const thesisPayload = buildThesisPayload(group, entry.title, chapters);
    const thesisId = entry.id;
    await setThesis(thesisId, thesisPayload);

    const ref = doc(firebaseFirestore, COLLECTION_NAME, setId);
    await Promise.all([
        updateDoc(ref, {
            usedBy: requestedBy,
            usedAsThesisAt: serverTimestamp(),
        }),
        updateGroup(groupId, { thesisTitle: entry.title, thesisId }),
    ]);
}
