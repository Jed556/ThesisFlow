import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where,
    type DocumentData,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { PANEL_COMMENTS_COLLECTION } from './constants';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentEntry, type PanelCommentEntryInput,
    type PanelCommentEntryUpdate, type PanelCommentReleaseMap, type PanelCommentStage, type PanelCommentStudentUpdate,
} from '../../../types/panelComment';

const ENTRIES_SUBCOLLECTION = 'entries';

interface PanelCommentSnapshot {
    groupId: string;
    stage: PanelCommentStage;
    comment: string;
    reference?: string;
    createdBy: string;
    createdAt?: unknown;
    updatedAt?: unknown;
    updatedBy?: string;
    studentPage?: string;
    studentStatus?: string;
    studentUpdatedAt?: unknown;
    studentUpdatedBy?: string;
    panelUid?: string;
}

interface PanelCommentReleaseSnapshot {
    release?: Record<string, {
        sent?: boolean;
        sentAt?: unknown;
        sentBy?: string;
    }>;
}

function mapEntry(docSnap: QueryDocumentSnapshot<DocumentData>): PanelCommentEntry {
    const data = docSnap.data() as PanelCommentSnapshot;
    return {
        id: docSnap.id,
        groupId: data.groupId ?? docSnap.ref.parent.parent?.id ?? '',
        stage: data.stage,
        comment: data.comment ?? '',
        reference: data.reference ?? undefined,
        createdBy: data.createdBy,
        createdAt: normalizeTimestamp(data.createdAt, true),
        panelUid: data.panelUid ?? data.createdBy,
        updatedAt: normalizeTimestamp(data.updatedAt) || undefined,
        updatedBy: data.updatedBy,
        studentPage: data.studentPage,
        studentStatus: data.studentStatus,
        studentUpdatedAt: normalizeTimestamp(data.studentUpdatedAt) || undefined,
        studentUpdatedBy: data.studentUpdatedBy,
    };
}

type FirestoreReleaseState = {
    sent?: boolean;
    sentAt?: unknown;
    sentBy?: string;
};

function readReleaseState(
    data: PanelCommentReleaseSnapshot | undefined,
    stage: PanelCommentStage,
): FirestoreReleaseState | undefined {
    if (data?.release?.[stage]) {
        return data.release[stage];
    }

    const flattenedKey = `release.${stage}`;
    const flattenedValue = (data as Record<string, unknown> | undefined)?.[flattenedKey];
    if (flattenedValue && typeof flattenedValue === 'object') {
        return flattenedValue as FirestoreReleaseState;
    }

    return undefined;
}

function mapRelease(data: PanelCommentReleaseSnapshot | undefined): PanelCommentReleaseMap {
    const base = createDefaultPanelCommentReleaseMap();
    const proposalState = readReleaseState(data, 'proposal');
    const defenseState = readReleaseState(data, 'defense');

    return {
        proposal: {
            sent: Boolean(proposalState?.sent ?? base.proposal.sent),
            sentAt: normalizeTimestamp(proposalState?.sentAt) || undefined,
            sentBy: proposalState?.sentBy,
        },
        defense: {
            sent: Boolean(defenseState?.sent ?? base.defense.sent),
            sentAt: normalizeTimestamp(defenseState?.sentAt) || undefined,
            sentBy: defenseState?.sentBy,
        },
    };
}

function getEntriesCollection(groupId: string) {
    return collection(firebaseFirestore, PANEL_COMMENTS_COLLECTION, groupId, ENTRIES_SUBCOLLECTION);
}

function getEntryDoc(groupId: string, entryId: string) {
    return doc(firebaseFirestore, PANEL_COMMENTS_COLLECTION, groupId, ENTRIES_SUBCOLLECTION, entryId);
}

export interface PanelCommentListenerOptions {
    onData: (entries: PanelCommentEntry[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to panel comment entries for a specific group and stage.
 */
export function listenPanelCommentEntries(
    groupId: string | null | undefined,
    stage: PanelCommentStage,
    options: PanelCommentListenerOptions,
    panelUid?: string,
): () => void {
    if (!groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const filters: QueryConstraint[] = [where('stage', '==', stage)];
    if (panelUid) {
        filters.push(where('panelUid', '==', panelUid));
    }

    const entriesQuery = query(getEntriesCollection(groupId), ...filters);

    return onSnapshot(entriesQuery, (snapshot) => {
        const entries = snapshot.docs
            .map((docSnap) => mapEntry(docSnap))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        options.onData(entries);
    }, (error) => {
        if (options.onError) {
            options.onError(error as Error);
        } else {
            console.error('Panel comments listener error:', error);
        }
    });
}

export interface PanelCommentReleaseListenerOptions {
    onData: (release: PanelCommentReleaseMap) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to release toggles for a group so tabs update in real time.
 */
export function listenPanelCommentRelease(
    groupId: string | null | undefined,
    options: PanelCommentReleaseListenerOptions,
): () => void {
    if (!groupId) {
        options.onData(createDefaultPanelCommentReleaseMap());
        return () => { /* no-op */ };
    }

    const docRef = doc(firebaseFirestore, PANEL_COMMENTS_COLLECTION, groupId);
    return onSnapshot(docRef, (snapshot) => {
        const releaseMap = mapRelease(snapshot.data() as PanelCommentReleaseSnapshot | undefined);
        options.onData(releaseMap);
    }, (error) => {
        if (options.onError) {
            options.onError(error as Error);
        } else {
            console.error('Panel comments release listener error:', error);
        }
    });
}

/**
 * Create a new panel comment entry for the provided stage.
 */
export async function addPanelCommentEntry(payload: PanelCommentEntryInput): Promise<string> {
    if (!payload.groupId) {
        throw new Error('Group ID is required to add panel comments.');
    }
    const docRef = await addDoc(getEntriesCollection(payload.groupId), {
        groupId: payload.groupId,
        stage: payload.stage,
        comment: payload.comment,
        reference: payload.reference ?? null,
        panelUid: payload.panelUid ?? payload.createdBy,
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

/**
 * Update panel-owned fields (comment/reference).
 */
export async function updatePanelCommentEntry(
    groupId: string,
    entryId: string,
    update: PanelCommentEntryUpdate,
): Promise<void> {
    if (!groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to update panel comments.');
    }

    const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        updatedBy: update.updatedBy,
    };

    if (update.comment !== undefined) {
        payload.comment = update.comment;
    }

    if (update.reference !== undefined) {
        payload.reference = update.reference ?? null;
    }

    await setDoc(getEntryDoc(groupId, entryId), payload, { merge: true });
}

/**
 * Remove an existing entry.
 */
export async function deletePanelCommentEntry(groupId: string, entryId: string): Promise<void> {
    if (!groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to delete panel comments.');
    }
    await deleteDoc(getEntryDoc(groupId, entryId));
}

/**
 * Update student-owned fields (page/status) for an entry.
 */
export async function updatePanelCommentStudentFields(
    groupId: string,
    entryId: string,
    update: PanelCommentStudentUpdate,
): Promise<void> {
    if (!groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to update student fields.');
    }

    const payload: Record<string, unknown> = {
        studentUpdatedAt: serverTimestamp(),
        studentUpdatedBy: update.updatedBy,
    };

    if (update.studentPage !== undefined) {
        payload.studentPage = update.studentPage || null;
    }

    if (update.studentStatus !== undefined) {
        payload.studentStatus = update.studentStatus || null;
    }

    await setDoc(getEntryDoc(groupId, entryId), payload, { merge: true });
}

/**
 * Toggle whether students can view a stage's comments.
 */
export async function setPanelCommentReleaseState(
    groupId: string,
    stage: PanelCommentStage,
    sent: boolean,
    userUid?: string | null,
): Promise<void> {
    if (!groupId) {
        throw new Error('Group ID is required to update release state.');
    }
    const releaseDoc = doc(firebaseFirestore, PANEL_COMMENTS_COLLECTION, groupId);
    await setDoc(releaseDoc, {
        groupId,
        release: {
            [stage]: {
                sent,
                sentBy: sent ? userUid ?? null : null,
                sentAt: sent ? serverTimestamp() : null,
            },
        },
        updatedAt: serverTimestamp(),
    }, { merge: true });
}
