import {
    addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where,
    type DocumentData, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { buildPanelCommentEntriesCollectionPath, buildPanelCommentEntryDocPath, buildPanelCommentDocPath } from './paths';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentApprovalStatus, type PanelCommentEntry, type PanelCommentEntryInput,
    type PanelCommentEntryUpdate, type PanelCommentReleaseMap, type PanelCommentStage, type PanelCommentStudentUpdate,
    type PanelCommentTableReleaseMap,
} from '../../../types/panelComment';

// ============================================================================
// Context Interface for Hierarchical Paths
// ============================================================================

/**
 * Context required to locate panel comments in the hierarchical structure
 */
export interface PanelCommentContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

// ============================================================================
// Internal Helpers
// ============================================================================

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
    approvalStatus?: PanelCommentApprovalStatus;
    approvalUpdatedAt?: unknown;
    approvalUpdatedBy?: string;
}

interface PanelCommentTableReleaseSnapshot {
    sent?: boolean;
    sentAt?: unknown;
    sentBy?: string;
    readyForReview?: boolean;
    readyAt?: unknown;
    readyBy?: string;
}

interface PanelCommentReleaseSnapshot {
    release?: Record<string, {
        sent?: boolean;
        sentAt?: unknown;
        sentBy?: string;
        tables?: Record<string, PanelCommentTableReleaseSnapshot>;
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
        approvalStatus: data.approvalStatus,
        approvalUpdatedAt: normalizeTimestamp(data.approvalUpdatedAt) || undefined,
        approvalUpdatedBy: data.approvalUpdatedBy,
    };
}

type FirestoreReleaseState = {
    sent?: boolean;
    sentAt?: unknown;
    sentBy?: string;
    tables?: Record<string, PanelCommentTableReleaseSnapshot>;
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

function mapTableReleases(tables: Record<string, PanelCommentTableReleaseSnapshot> | undefined): PanelCommentTableReleaseMap | undefined {
    if (!tables) return undefined;
    const result: PanelCommentTableReleaseMap = {};
    for (const [panelUid, tableState] of Object.entries(tables)) {
        result[panelUid] = {
            sent: Boolean(tableState?.sent),
            sentAt: normalizeTimestamp(tableState?.sentAt) || undefined,
            sentBy: tableState?.sentBy,
            readyForReview: Boolean(tableState?.readyForReview),
            readyAt: normalizeTimestamp(tableState?.readyAt) || undefined,
            readyBy: tableState?.readyBy,
        };
    }
    return Object.keys(result).length > 0 ? result : undefined;
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
            tables: mapTableReleases(proposalState?.tables),
        },
        defense: {
            sent: Boolean(defenseState?.sent ?? base.defense.sent),
            sentAt: normalizeTimestamp(defenseState?.sentAt) || undefined,
            sentBy: defenseState?.sentBy,
            tables: mapTableReleases(defenseState?.tables),
        },
    };
}

/**
 * Get collection reference for panel comment entries using hierarchical path
 */
function getEntriesCollection(ctx: PanelCommentContext) {
    const path = buildPanelCommentEntriesCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    return collection(firebaseFirestore, path);
}

/**
 * Get document reference for a specific panel comment entry using hierarchical path
 */
function getEntryDoc(ctx: PanelCommentContext, entryId: string) {
    const path = buildPanelCommentEntryDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, entryId);
    return doc(firebaseFirestore, path);
}

/**
 * Get document reference for panel comment release state using hierarchical path
 */
function getReleaseDoc(ctx: PanelCommentContext) {
    const path = buildPanelCommentDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    return doc(firebaseFirestore, path);
}

export interface PanelCommentListenerOptions {
    onData: (entries: PanelCommentEntry[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to panel comment entries for a specific group and stage.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param stage - The panel comment stage to filter by
 * @param options - Callback options for data and errors
 * @param panelUid - Optional panel member UID to filter by
 * @returns Unsubscribe function
 */
export function listenPanelCommentEntries(
    ctx: PanelCommentContext | null | undefined,
    stage: PanelCommentStage,
    options: PanelCommentListenerOptions,
    panelUid?: string,
): () => void {
    if (!ctx?.groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const filters: QueryConstraint[] = [where('stage', '==', stage)];
    if (panelUid) {
        filters.push(where('panelUid', '==', panelUid));
    }

    const entriesQuery = query(getEntriesCollection(ctx), ...filters);

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
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param options - Callback options for data and errors
 * @returns Unsubscribe function
 */
export function listenPanelCommentRelease(
    ctx: PanelCommentContext | null | undefined,
    options: PanelCommentReleaseListenerOptions,
): () => void {
    if (!ctx?.groupId) {
        options.onData(createDefaultPanelCommentReleaseMap());
        return () => { /* no-op */ };
    }

    const docRef = getReleaseDoc(ctx);
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
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param payload - Panel comment entry data
 * @returns The ID of the created entry
 */
export async function addPanelCommentEntry(
    ctx: PanelCommentContext,
    payload: Omit<PanelCommentEntryInput, 'groupId'>,
): Promise<string> {
    if (!ctx.groupId) {
        throw new Error('Group ID is required to add panel comments.');
    }
    const docRef = await addDoc(getEntriesCollection(ctx), {
        groupId: ctx.groupId,
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
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param entryId - The entry ID to update
 * @param update - The fields to update
 */
export async function updatePanelCommentEntry(
    ctx: PanelCommentContext,
    entryId: string,
    update: PanelCommentEntryUpdate,
): Promise<void> {
    if (!ctx.groupId || !entryId) {
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

    await setDoc(getEntryDoc(ctx, entryId), payload, { merge: true });
}

/**
 * Remove an existing entry.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param entryId - The entry ID to delete
 */
export async function deletePanelCommentEntry(ctx: PanelCommentContext, entryId: string): Promise<void> {
    if (!ctx.groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to delete panel comments.');
    }
    await deleteDoc(getEntryDoc(ctx, entryId));
}

/**
 * Update student-owned fields (page/status) for an entry.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param entryId - The entry ID to update
 * @param update - The student fields to update
 */
export async function updatePanelCommentStudentFields(
    ctx: PanelCommentContext,
    entryId: string,
    update: PanelCommentStudentUpdate,
): Promise<void> {
    if (!ctx.groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to update student fields.');
    }

    const payload: Record<string, unknown> = {
        studentUpdatedAt: serverTimestamp(),
        studentUpdatedBy: update.studentUpdatedBy,
    };

    if (update.studentPage !== undefined) {
        payload.studentPage = update.studentPage || null;
    }

    if (update.studentStatus !== undefined) {
        payload.studentStatus = update.studentStatus || null;
    }

    await setDoc(getEntryDoc(ctx, entryId), payload, { merge: true });
}

/**
 * Toggle whether students can view a stage's comments.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param stage - The panel comment stage
 * @param sent - Whether comments are released to students
 * @param userUid - The user ID performing the action
 */
export async function setPanelCommentReleaseState(
    ctx: PanelCommentContext,
    stage: PanelCommentStage,
    sent: boolean,
    userUid?: string | null,
): Promise<void> {
    if (!ctx.groupId) {
        throw new Error('Group ID is required to update release state.');
    }
    const releaseDocRef = getReleaseDoc(ctx);
    await setDoc(releaseDocRef, {
        groupId: ctx.groupId,
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

/**
 * Toggle whether students can view a specific panelist's comment table for a stage.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param stage - The panel comment stage
 * @param panelUid - The panelist's UID whose table is being released
 * @param sent - Whether comments are released to students
 * @param userUid - The user ID performing the action
 */
export async function setPanelCommentTableReleaseState(
    ctx: PanelCommentContext,
    stage: PanelCommentStage,
    panelUid: string,
    sent: boolean,
    userUid?: string | null,
): Promise<void> {
    if (!ctx.groupId) {
        throw new Error('Group ID is required to update release state.');
    }
    if (!panelUid) {
        throw new Error('Panel UID is required to update table release state.');
    }
    const releaseDocRef = getReleaseDoc(ctx);
    await setDoc(releaseDocRef, {
        groupId: ctx.groupId,
        release: {
            [stage]: {
                tables: {
                    [panelUid]: {
                        sent,
                        sentBy: sent ? userUid ?? null : null,
                        sentAt: sent ? serverTimestamp() : null,
                    },
                },
            },
        },
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Mark a panelist's comment table as ready for admin review.
 * This notifies the admin that the panelist has finished their comments and they are ready to be released.
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param stage - The panel comment stage
 * @param panelUid - The panelist's UID whose table is being marked as ready
 * @param ready - Whether comments are ready for review
 * @param userUid - The user ID performing the action (should be the panelist)
 */
export async function setPanelCommentTableReadyState(
    ctx: PanelCommentContext,
    stage: PanelCommentStage,
    panelUid: string,
    ready: boolean,
    userUid?: string | null,
): Promise<void> {
    if (!ctx.groupId) {
        throw new Error('Group ID is required to update ready state.');
    }
    if (!panelUid) {
        throw new Error('Panel UID is required to update table ready state.');
    }
    const releaseDocRef = getReleaseDoc(ctx);
    await setDoc(releaseDocRef, {
        groupId: ctx.groupId,
        release: {
            [stage]: {
                tables: {
                    [panelUid]: {
                        readyForReview: ready,
                        readyBy: ready ? userUid ?? null : null,
                        readyAt: ready ? serverTimestamp() : null,
                    },
                },
            },
        },
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Check if a specific panelist's table is marked as ready for review.
 * @param releaseMap - The release map for the group
 * @param stage - The panel comment stage
 * @param panelUid - The panelist's UID
 * @returns Whether the table is ready for review
 */
export function isPanelTableReadyForReview(
    releaseMap: PanelCommentReleaseMap | undefined,
    stage: PanelCommentStage,
    panelUid: string,
): boolean {
    if (!releaseMap) return false;
    const stageRelease = releaseMap[stage];
    if (!stageRelease) return false;
    const tableRelease = stageRelease.tables?.[panelUid];
    return tableRelease?.readyForReview === true;
}

/**
 * Check if a specific panelist's table has been released for a stage.
 * @param releaseMap - The release map for the group
 * @param stage - The panel comment stage
 * @param panelUid - The panelist's UID
 * @returns Whether the table has been released
 */
export function isPanelTableReleased(
    releaseMap: PanelCommentReleaseMap | undefined,
    stage: PanelCommentStage,
    panelUid: string,
): boolean {
    if (!releaseMap) return false;
    const stageRelease = releaseMap[stage];
    // Check per-table release first
    if (stageRelease?.tables?.[panelUid]?.sent) {
        return true;
    }
    // Fall back to stage-level release (legacy behavior)
    return Boolean(stageRelease?.sent);
}

/**
 * Update approval status for a panel comment entry.
 * @param ctx - Panel comment context
 * @param entryId - The entry ID to update
 * @param status - The new approval status
 * @param userUid - The user ID performing the action
 */
export async function updatePanelCommentApprovalStatus(
    ctx: PanelCommentContext,
    entryId: string,
    status: PanelCommentApprovalStatus,
    userUid: string,
): Promise<void> {
    if (!ctx.groupId || !entryId) {
        throw new Error('Group ID and entry ID are required to update approval status.');
    }

    await setDoc(getEntryDoc(ctx, entryId), {
        approvalStatus: status,
        approvalUpdatedAt: serverTimestamp(),
        approvalUpdatedBy: userUid,
    }, { merge: true });
}

/**
 * Options for panel comment completion listener.
 */
export interface PanelCommentCompletionListenerOptions {
    onData: (isComplete: boolean, entries: PanelCommentEntry[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to all panel comment entries for a stage and determine if they are all approved.
 * Panel comments are considered "complete" when:
 * 1. At least one entry exists for the stage
 * 2. ALL entries have approvalStatus === 'approved'
 * 
 * @param ctx - Panel comment context with year, department, course, groupId
 * @param stage - The panel comment stage to check
 * @param options - Callback options for completion status
 * @returns Unsubscribe function
 */
export function listenPanelCommentCompletion(
    ctx: PanelCommentContext | null | undefined,
    stage: PanelCommentStage,
    options: PanelCommentCompletionListenerOptions,
): () => void {
    if (!ctx?.groupId) {
        options.onData(false, []);
        return () => { /* no-op */ };
    }

    const entriesQuery = query(
        getEntriesCollection(ctx),
        where('stage', '==', stage)
    );

    return onSnapshot(entriesQuery, (snapshot) => {
        const entries = snapshot.docs
            .map((docSnap) => mapEntry(docSnap))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        // Complete if at least one entry exists and ALL are approved
        const isComplete = entries.length > 0 &&
            entries.every((entry) => entry.approvalStatus === 'approved');

        options.onData(isComplete, entries);
    }, (error) => {
        if (options.onError) {
            options.onError(error as Error);
        } else {
            console.error('Panel comments completion listener error:', error);
        }
    });
}
