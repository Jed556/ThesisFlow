import { doc, getDoc, onSnapshot, setDoc, type DocumentSnapshot } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { TERMINAL_REQUIREMENT_SUBMISSIONS_COLLECTION } from './constants';
import type { ThesisData, ThesisStage } from '../../../types/thesis';
import type {
    TerminalRequirementApprovalRole,
    TerminalRequirementApprovalState,
    TerminalRequirementApproverAssignments,
    TerminalRequirementSubmissionHistoryEntry,
    TerminalRequirementSubmissionRecord,
} from '../../../types/terminalRequirementSubmission';

const APPROVAL_FLOW: TerminalRequirementApprovalRole[] = ['panel', 'adviser', 'editor', 'statistician'];
const MAX_HISTORY_ENTRIES = 50;
const THESES_COLLECTION = 'theses';

const STAGE_SLUGS: Record<ThesisStage, string> = {
    'Pre-Proposal': 'pre-proposal',
    'Post-Proposal': 'post-proposal',
    'Pre-Defense': 'pre-defense',
    'Post-Defense': 'post-defense',
};

export interface TerminalRequirementSubmissionListenerOptions {
    onData: (record: TerminalRequirementSubmissionRecord | null) => void;
    onError?: (error: Error) => void;
}

export interface SubmitTerminalRequirementStagePayload {
    thesisId: string;
    groupId: string;
    stage: ThesisStage;
    requirementIds: string[];
    submittedBy: string;
    assignments?: TerminalRequirementApproverAssignments;
}

export interface TerminalRequirementDecisionPayload {
    thesisId: string;
    stage: ThesisStage;
    role: TerminalRequirementApprovalRole;
    approverUid: string;
    action: 'approve' | 'return';
    note?: string;
}

function normalizeStageKey(stage: ThesisStage): string {
    return STAGE_SLUGS[stage] ?? stage.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function buildTerminalRequirementSubmissionId(thesisId: string, stage: ThesisStage): string {
    if (!thesisId) {
        throw new Error('thesisId is required');
    }
    return `${thesisId}_${normalizeStageKey(stage)}`;
}

function getSubmissionRef(thesisId: string, stage: ThesisStage) {
    const docId = buildTerminalRequirementSubmissionId(thesisId, stage);
    return doc(firebaseFirestore, TERMINAL_REQUIREMENT_SUBMISSIONS_COLLECTION, docId);
}

function createHistoryId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createHistoryEntry(
    action: TerminalRequirementSubmissionHistoryEntry['action'],
    actorUid: string,
    actorRole: TerminalRequirementSubmissionHistoryEntry['actorRole'],
    message?: string,
): TerminalRequirementSubmissionHistoryEntry {
    const entry: TerminalRequirementSubmissionHistoryEntry = {
        id: createHistoryId(),
        timestamp: new Date().toISOString(),
        actorUid,
        actorRole,
        action,
    };

    if (message) {
        entry.message = message;
    }

    return entry;
}

function trimHistory(
    entries: TerminalRequirementSubmissionHistoryEntry[],
): TerminalRequirementSubmissionHistoryEntry[] {
    if (entries.length <= MAX_HISTORY_ENTRIES) {
        return entries;
    }
    return entries.slice(entries.length - MAX_HISTORY_ENTRIES);
}

function sanitizeAssignments(assignments?: TerminalRequirementApproverAssignments): TerminalRequirementApproverAssignments {
    if (!assignments) {
        return {};
    }
    return APPROVAL_FLOW.reduce<TerminalRequirementApproverAssignments>((acc, role) => {
        const raw = assignments[role]?.filter(Boolean) ?? [];
        if (raw.length > 0) {
            acc[role] = Array.from(new Set(raw));
        }
        return acc;
    }, {});
}

function normalizeApprovals(
    roles: TerminalRequirementApprovalRole[],
    existing?: Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>,
): Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>> {
    return roles.reduce<Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>>((acc, role) => {
        const previous = existing?.[role];
        if (previous && previous.status === 'approved') {
            acc[role] = { ...previous, role };
        } else {
            acc[role] = {
                role,
                status: 'pending',
            };
        }
        return acc;
    }, {});
}

function determineCurrentRole(
    approvals: Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>,
    orderedRoles: TerminalRequirementApprovalRole[]
): TerminalRequirementApprovalRole | null {
    for (const role of orderedRoles) {
        if (approvals[role]?.status !== 'approved') {
            return role;
        }
    }
    return null;
}

function mapApprovalsRecord(
    raw?: Record<string, Partial<TerminalRequirementApprovalState>>,
): Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>> {
    if (!raw) {
        return {};
    }
    return APPROVAL_FLOW.reduce<Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>>((acc, role) => {
        const entry = raw[role];
        if (entry) {
            const status = entry.status === 'approved' || entry.status === 'returned'
                ? entry.status
                : 'pending';
            const approval: TerminalRequirementApprovalState = {
                role,
                status,
            };

            if (entry.decidedAt) {
                approval.decidedAt = entry.decidedAt;
            }
            if (entry.decidedBy) {
                approval.decidedBy = entry.decidedBy;
            }
            if (entry.note) {
                approval.note = entry.note;
            }

            acc[role] = approval;
        }
        return acc;
    }, {});
}

function mapSnapshotToSubmission(
    snapshot: DocumentSnapshot,
): TerminalRequirementSubmissionRecord | null {
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() as Omit<TerminalRequirementSubmissionRecord, 'id' | 'approvals'> & {
        approvals?: Record<string, Partial<TerminalRequirementApprovalState>>;
    };

    return {
        id: snapshot.id,
        thesisId: data.thesisId,
        groupId: data.groupId,
        stage: data.stage,
        stageKey: data.stageKey ?? normalizeStageKey(data.stage),
        requirementIds: data.requirementIds ?? [],
        status: data.status ?? 'draft',
        submittedAt: data.submittedAt ?? undefined,
        submittedBy: data.submittedBy ?? undefined,
        locked: Boolean(data.locked),
        approvals: mapApprovalsRecord(data.approvals),
        assignedApprovers: data.assignedApprovers,
        currentRole: data.currentRole ?? null,
        returnNote: data.returnNote ?? undefined,
        returnedAt: data.returnedAt ?? undefined,
        returnedBy: data.returnedBy ?? undefined,
        resubmissionCount: data.resubmissionCount ?? 0,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
        completedAt: data.completedAt ?? undefined,
        history: Array.isArray(data.history)
            ? trimHistory(data.history as TerminalRequirementSubmissionHistoryEntry[])
            : undefined,
    };
}

export async function getTerminalRequirementSubmission(
    thesisId: string,
    stage: ThesisStage,
): Promise<TerminalRequirementSubmissionRecord | null> {
    if (!thesisId) {
        return null;
    }
    const ref = getSubmissionRef(thesisId, stage);
    const snapshot = await getDoc(ref);
    return mapSnapshotToSubmission(snapshot);
}

export function listenTerminalRequirementSubmission(
    thesisId: string | null | undefined,
    stage: ThesisStage,
    options: TerminalRequirementSubmissionListenerOptions,
): () => void {
    const { onData, onError } = options;
    if (!thesisId) {
        onData(null);
        return () => { /* no-op */ };
    }
    const ref = getSubmissionRef(thesisId, stage);
    return onSnapshot(
        ref,
        (snapshot) => {
            onData(mapSnapshotToSubmission(snapshot));
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Terminal requirement submission listener error:', error);
            }
        },
    );
}

export async function submitTerminalRequirementStage(
    payload: SubmitTerminalRequirementStagePayload,
): Promise<TerminalRequirementSubmissionRecord> {
    const {
        thesisId,
        groupId,
        stage,
        requirementIds,
        submittedBy,
        assignments,
    } = payload;

    if (!thesisId || !groupId) {
        throw new Error('thesisId and groupId are required to submit terminal requirements.');
    }
    if (!submittedBy) {
        throw new Error('submittedBy is required to submit terminal requirements.');
    }

    const ref = getSubmissionRef(thesisId, stage);
    const snapshot = await getDoc(ref);
    const existing = mapSnapshotToSubmission(snapshot);

    const normalizedAssignments = sanitizeAssignments(assignments);

    const needsAdviser = !normalizedAssignments.adviser || normalizedAssignments.adviser.length === 0;
    const needsEditor = !normalizedAssignments.editor || normalizedAssignments.editor.length === 0;

    if ((needsAdviser || needsEditor)) {
        try {
            const thesisRef = doc(firebaseFirestore, THESES_COLLECTION, thesisId);
            const thesisSnapshot = await getDoc(thesisRef);
            if (thesisSnapshot.exists()) {
                const thesisData = thesisSnapshot.data() as ThesisData;
                if (needsAdviser && thesisData.adviser) {
                    normalizedAssignments.adviser = [thesisData.adviser];
                }
                if (needsEditor && thesisData.editor) {
                    normalizedAssignments.editor = [thesisData.editor];
                }
            }
        } catch (error) {
            console.error('Failed to hydrate mentor assignments for terminal requirements:', error);
        }
    }

    const orderedRoles = APPROVAL_FLOW.filter((role) => Boolean(normalizedAssignments[role]));
    const now = new Date().toISOString();

    const approvals = normalizeApprovals(orderedRoles, existing?.approvals);
    let history = trimHistory([...(existing?.history ?? []), createHistoryEntry('submitted', submittedBy, 'student')]);

    let status: TerminalRequirementSubmissionRecord['status'] = 'in_review';
    let currentRole = determineCurrentRole(approvals, orderedRoles);
    let completedAt: string | undefined;

    if (orderedRoles.length === 0) {
        status = 'approved';
        currentRole = null;
        completedAt = now;
        history = trimHistory([...history,
        createHistoryEntry('approved', 'system', 'system', 'Auto-approved (no assigned reviewers).')]);
    }

    const basePayload = {
        thesisId,
        groupId,
        stage,
        stageKey: normalizeStageKey(stage),
        requirementIds: Array.from(new Set(requirementIds)),
        status,
        submittedAt: now,
        submittedBy,
        // Submissions are locked for editing once submitted or approved; only a 'returned' status
        // would unlock them. In this creation flow the status can only be 'in_review' or
        // 'approved', so default to locked = true.
        locked: true,
        approvals,
        assignedApprovers: normalizedAssignments,
        currentRole,
        returnNote: undefined,
        returnedAt: undefined,
        returnedBy: undefined,
        resubmissionCount: existing ? (existing.resubmissionCount ?? 0) + 1 : 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        completedAt: completedAt ?? existing?.completedAt ?? undefined,
        history,
    } satisfies Omit<TerminalRequirementSubmissionRecord, 'id'>;

    await setDoc(ref, cleanData(basePayload, existing ? 'update' : 'create'), { merge: true });
    const updatedSnapshot = await getDoc(ref);
    const result = mapSnapshotToSubmission(updatedSnapshot);
    if (!result) {
        throw new Error('Failed to persist terminal requirement submission.');
    }
    return result;
}

export async function recordTerminalRequirementDecision(
    payload: TerminalRequirementDecisionPayload,
): Promise<TerminalRequirementSubmissionRecord> {
    const {
        thesisId,
        stage,
        role,
        approverUid,
        action,
        note,
    } = payload;

    if (!thesisId) {
        throw new Error('thesisId is required to record a decision.');
    }

    const ref = getSubmissionRef(thesisId, stage);
    const snapshot = await getDoc(ref);
    const existing = mapSnapshotToSubmission(snapshot);
    if (!existing) {
        throw new Error('Submission not found.');
    }

    if (existing.status !== 'in_review' || !existing.locked) {
        throw new Error('This submission is not ready for review.');
    }

    const allowedRoles = Object.keys(existing.approvals) as TerminalRequirementApprovalRole[];
    if (!allowedRoles.includes(role)) {
        throw new Error('This role is not part of the approval workflow.');
    }

    const orderedRoles = APPROVAL_FLOW.filter((entry) => allowedRoles.includes(entry));
    const targetIndex = orderedRoles.indexOf(role);
    if (targetIndex > 0) {
        const blockingRole = orderedRoles.slice(0, targetIndex)
            .find((entry) => existing.approvals[entry]?.status !== 'approved');
        if (blockingRole) {
            throw new Error('Awaiting previous approvals.');
        }
    }

    const assigned = existing.assignedApprovers?.[role];
    if (assigned && assigned.length > 0 && !assigned.includes(approverUid)) {
        throw new Error('You are not assigned to approve this stage.');
    }

    const now = new Date().toISOString();
    const approvals = { ...existing.approvals };
    let history = [...(existing.history ?? [])];

    if (action === 'approve') {
        const approvalEntry: TerminalRequirementApprovalState = {
            role,
            status: 'approved',
            decidedAt: now,
            decidedBy: approverUid,
        };
        if (note) {
            approvalEntry.note = note;
        }
        approvals[role] = approvalEntry;
        history = trimHistory([...history, createHistoryEntry('approved', approverUid, role, note)]);
        const allApproved = orderedRoles.every((entry) => approvals[entry]?.status === 'approved');
        const nextStatus = allApproved ? 'approved' : 'in_review';
        const payloadToSet = {
            approvals,
            status: nextStatus,
            currentRole: determineCurrentRole(approvals, orderedRoles),
            locked: true,
            completedAt: allApproved ? now : existing.completedAt ?? undefined,
            updatedAt: now,
            history,
        } as Partial<Omit<TerminalRequirementSubmissionRecord, 'id'>>;
        await setDoc(ref, cleanData(payloadToSet, 'update'), { merge: true });
    } else {
        const approvalEntry: TerminalRequirementApprovalState = {
            role,
            status: 'returned',
            decidedAt: now,
            decidedBy: approverUid,
        };
        if (note) {
            approvalEntry.note = note;
        }
        approvals[role] = approvalEntry;
        history = trimHistory([...history, createHistoryEntry('returned', approverUid, role, note)]);
        const payloadToSet = {
            approvals,
            status: 'returned',
            currentRole: role,
            locked: false,
            returnNote: note ?? 'Changes requested.',
            returnedAt: now,
            returnedBy: role,
            updatedAt: now,
            history,
        } as Partial<Omit<TerminalRequirementSubmissionRecord, 'id'>>;
        await setDoc(ref, cleanData(payloadToSet, 'update'), { merge: true });
    }

    const updatedSnapshot = await getDoc(ref);
    const result = mapSnapshotToSubmission(updatedSnapshot);
    if (!result) {
        throw new Error('Failed to update submission status.');
    }
    return result;
}
