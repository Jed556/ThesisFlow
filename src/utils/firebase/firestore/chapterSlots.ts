/**
 * Firestore helpers for managing chapter slot reservations.
 */

import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    type DocumentData,
    type DocumentSnapshot,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { DEFAULT_YEAR } from '../../../config/firestore';
import { cleanData } from './firestore';
import { buildChapterSlotsCollectionPath, buildChapterSlotDocPath } from './paths';
import type {
    ChapterSlotAdjustment,
    ChapterSlotRecord,
    ChapterSlotScheduleUpdate,
    ChapterSlotStatus,
} from '../../../types/chapterSlot';
import type { ThesisStageName } from '../../../types/thesis';

function docToChapterSlot(
    snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
    year: string,
): ChapterSlotRecord | null {
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() ?? {};
    const status = typeof data.status === 'string' ? data.status as ChapterSlotStatus : 'pending';

    return {
        id: snapshot.id,
        year,
        department: data.department ?? undefined,
        course: data.course ?? undefined,
        groupId: data.groupId ?? '',
        groupName: data.groupName ?? undefined,
        thesisId: data.thesisId ?? undefined,
        stage: data.stage as ThesisStageName,
        requestedBy: data.requestedBy ?? '',
        requestedByName: data.requestedByName ?? undefined,
        requestedAt: data.requestedAt ?? new Date().toISOString(),
        preferredStart: data.preferredStart ?? undefined,
        preferredEnd: data.preferredEnd ?? undefined,
        notes: data.notes ?? undefined,
        status,
        scheduledStart: data.scheduledStart ?? undefined,
        scheduledEnd: data.scheduledEnd ?? undefined,
        venue: data.venue ?? undefined,
        panelistUids: Array.isArray(data.panelistUids) ? data.panelistUids : undefined,
        panelistNames: Array.isArray(data.panelistNames) ? data.panelistNames : undefined,
        approverUid: data.approverUid ?? undefined,
        approvedAt: data.approvedAt ?? undefined,
        lastUpdatedAt: data.lastUpdatedAt ?? undefined,
        adjustments: Array.isArray(data.adjustments) ? data.adjustments as ChapterSlotAdjustment[] : undefined,
    } satisfies ChapterSlotRecord;
}

export interface ChapterSlotFilters {
    status?: ChapterSlotStatus | ChapterSlotStatus[];
    department?: string;
    stage?: ThesisStageName;
    groupId?: string;
}

export interface ChapterSlotListenerOptions {
    onData: (slots: ChapterSlotRecord[]) => void;
    onError?: (error: Error) => void;
}

function buildSlotQuery(
    year: string,
    filters?: ChapterSlotFilters,
): [ReturnType<typeof collection>, QueryConstraint[]] {
    const collPath = buildChapterSlotsCollectionPath(year);
    const collRef = collection(firebaseFirestore, collPath);
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
        if (Array.isArray(filters.status)) {
            const statuses = filters.status.filter(Boolean);
            if (statuses.length > 0) {
                constraints.push(where('status', 'in', statuses));
            }
        } else {
            constraints.push(where('status', '==', filters.status));
        }
    }

    if (filters?.department) {
        constraints.push(where('department', '==', filters.department));
    }

    if (filters?.stage) {
        constraints.push(where('stage', '==', filters.stage));
    }

    if (filters?.groupId) {
        constraints.push(where('groupId', '==', filters.groupId));
    }

    constraints.push(orderBy('requestedAt', 'desc'));

    return [collRef, constraints];
}

export async function getChapterSlots(
    filters?: ChapterSlotFilters,
    year: string = DEFAULT_YEAR,
): Promise<ChapterSlotRecord[]> {
    const [collRef, constraints] = buildSlotQuery(year, filters);
    const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => docToChapterSlot(docSnap, year))
        .filter((slot): slot is ChapterSlotRecord => slot !== null);
}

export async function getChapterSlot(
    slotId: string,
    year: string = DEFAULT_YEAR,
): Promise<ChapterSlotRecord | null> {
    const docPath = buildChapterSlotDocPath(year, slotId);
    const ref = doc(firebaseFirestore, docPath);
    const snapshot = await getDoc(ref);
    return docToChapterSlot(snapshot, year);
}

export function listenChapterSlots(
    options: ChapterSlotListenerOptions,
    filters?: ChapterSlotFilters,
    year: string = DEFAULT_YEAR,
): () => void {
    const { onData, onError } = options;
    const [collRef, constraints] = buildSlotQuery(year, filters);
    const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;

    return onSnapshot(
        q,
        (snapshot) => {
            const slots = snapshot.docs
                .map((docSnap) => docToChapterSlot(docSnap, year))
                .filter((slot): slot is ChapterSlotRecord => slot !== null);
            onData(slots);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Chapter slots listener error:', error);
            }
        }
    );
}

function createAdjustmentEntry(
    actorUid: string,
    updates: ChapterSlotScheduleUpdate,
    note?: string,
): ChapterSlotAdjustment {
    const adjustmentId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    return cleanData({
        id: adjustmentId,
        adjustedBy: actorUid,
        adjustedAt: new Date().toISOString(),
        note,
        scheduledStart: updates.scheduledStart,
        scheduledEnd: updates.scheduledEnd,
        venue: updates.venue,
    }, 'create') as ChapterSlotAdjustment;
}

export interface AdjustChapterSlotSchedulePayload {
    slotId: string;
    actorUid: string;
    updates: ChapterSlotScheduleUpdate;
    status?: ChapterSlotStatus;
    note?: string;
    approverUid?: string;
    approvedAt?: string;
}

export async function adjustChapterSlotSchedule(
    payload: AdjustChapterSlotSchedulePayload,
    year: string = DEFAULT_YEAR,
): Promise<void> {
    const { slotId, actorUid, updates, status, note, approverUid } = payload;
    const docPath = buildChapterSlotDocPath(year, slotId);
    const ref = doc(firebaseFirestore, docPath);

    const updateData = cleanData({
        scheduledStart: updates.scheduledStart,
        scheduledEnd: updates.scheduledEnd,
        venue: updates.venue,
        panelistUids: updates.panelistUids,
        status,
        approverUid,
        approvedAt: approverUid ? (payload.approvedAt ?? new Date().toISOString()) : undefined,
        lastUpdatedAt: new Date().toISOString(),
    }, 'update');

    await updateDoc(ref, {
        ...updateData,
        adjustments: arrayUnion(createAdjustmentEntry(actorUid, updates, note)),
        updatedAt: serverTimestamp(),
    });
}

export interface ApproveChapterSlotPayload {
    slotId: string;
    approverUid: string;
    schedule: ChapterSlotScheduleUpdate;
    note?: string;
    overrideStatus?: ChapterSlotStatus;
}

export async function approveChapterSlotRequest(
    payload: ApproveChapterSlotPayload,
    year: string = DEFAULT_YEAR,
): Promise<void> {
    const status: ChapterSlotStatus = payload.overrideStatus
        ?? (payload.schedule.scheduledStart ? 'scheduled' : 'approved');
    await adjustChapterSlotSchedule({
        slotId: payload.slotId,
        actorUid: payload.approverUid,
        approverUid: payload.approverUid,
        updates: payload.schedule,
        status,
        note: payload.note,
    }, year);
}

export interface UpdateChapterSlotStatusPayload {
    slotId: string;
    status: ChapterSlotStatus;
    actorUid: string;
    note?: string;
}

export async function updateChapterSlotStatus(
    payload: UpdateChapterSlotStatusPayload,
    year: string = DEFAULT_YEAR,
): Promise<void> {
    const docPath = buildChapterSlotDocPath(year, payload.slotId);
    const ref = doc(firebaseFirestore, docPath);
    const statusUpdate = cleanData({
        status: payload.status,
        lastUpdatedAt: new Date().toISOString(),
    }, 'update');
    const adjustmentUpdate = payload.note
        ? { adjustments: arrayUnion(createAdjustmentEntry(payload.actorUid, {}, payload.note)) }
        : {};
    await updateDoc(ref, {
        ...statusUpdate,
        ...adjustmentUpdate,
        updatedAt: serverTimestamp(),
    });
}
