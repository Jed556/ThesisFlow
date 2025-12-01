/**
 * Firestore utilities for Terminal Requirements
 * 
 * Terminal requirements are stored under the thesis stage hierarchy:
 * year/{year}/departments/{department}/courses/{course}/groups/{group}/thesis/{thesis}/stages/{stage}/terminal/{requirement}
 * 
 * Course template documents are stored at:
 * year/{year}/departments/{department}/courses/{course}/templates/terminalRequirements
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
    query, orderBy, where, writeBatch, type DocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import {
    THESIS_STAGE_SLUGS,
    TERMINAL_SUBCOLLECTION,
    DEFAULT_YEAR,
    DEFAULT_DEPARTMENT_SEGMENT,
    DEFAULT_COURSE_SEGMENT,
    COURSE_TEMPLATES_SUBCOLLECTION,
    TERMINAL_REQUIREMENTS_KEY,
    TERMINAL_REQUIREMENT_ENTRIES_SUBCOLLECTION,
} from '../../../config/firestore';
import {
    buildTerminalCollectionPath,
    buildTerminalDocPath,
    buildCourseTerminalTemplateDocPath,
    buildTerminalRequirementEntriesCollectionPath,
    buildTerminalRequirementEntryDocPath,
    extractPathParams,
    sanitizePathSegment,
} from './paths';
import {
    ensureCourseHierarchyExists,
    normalizeCourseTemplateContext,
    type CourseTemplateContextInput,
    type NormalizedCourseTemplateContext,
} from './courseTemplateHelpers';
import type { ThesisStageName } from '../../../types/thesis';
import type { TerminalRequirement, TerminalRequirementProgress, TerminalRequirementStatus } from '../../../types/terminalRequirement';
import type {
    TerminalRequirementConfigDocument,
    TerminalRequirementConfigEntry,
    TerminalRequirementStageTemplates,
} from '../../../types/terminalRequirementTemplate';
import type {
    TerminalRequirementApprovalRole, TerminalRequirementApprovalState, TerminalRequirementApprovalStatus,
    TerminalRequirementApproverAssignments, TerminalRequirementSubmissionHistoryEntry,
    TerminalRequirementSubmissionRecord, TerminalRequirementSubmissionStatus,
} from '../../../types/terminalRequirementSubmission';

// ============================================================================
// Constants
// ============================================================================

const APPROVAL_FLOW: TerminalRequirementApprovalRole[] = [
    'panel', 'adviser', 'editor', 'statistician'
];
const MAX_HISTORY_ENTRIES = 50;

// ============================================================================
// Context Interface
// ============================================================================

/**
 * Context for terminal requirement operations
 */
export interface TerminalContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: ThesisStageName;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function normalizeStageKey(stage: ThesisStageName): string {
    return THESIS_STAGE_SLUGS[stage] ?? stage.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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

function sanitizeAssignments(
    assignments?: TerminalRequirementApproverAssignments
): TerminalRequirementApproverAssignments {
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
    return roles.reduce<
        Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>
    >((acc, role) => {
        const previous = existing?.[role];
        if (previous && previous.status === 'approved') {
            acc[role] = { ...previous, role };
        } else {
            acc[role] = { role, status: 'pending' };
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
    return APPROVAL_FLOW.reduce<
        Partial<Record<TerminalRequirementApprovalRole, TerminalRequirementApprovalState>>
    >((acc, role) => {
        const entry = raw[role];
        if (entry) {
            const status: TerminalRequirementApprovalStatus = (
                entry.status === 'approved' || entry.status === 'returned'
            ) ? entry.status : 'pending';
            const approval: TerminalRequirementApprovalState = { role, status };
            if (entry.decidedAt) approval.decidedAt = entry.decidedAt;
            if (entry.decidedBy) approval.decidedBy = entry.decidedBy;
            if (entry.note) approval.note = entry.note;
            acc[role] = approval;
        }
        return acc;
    }, {});
}

// ============================================================================
// Submission Data Mapping
// ============================================================================

/**
 * Terminal requirement submission document stored at:
 * .../stages/{stage}/terminal/{requirementId}
 */
interface TerminalRequirementDocument extends Omit<TerminalRequirementSubmissionRecord, 'id'> {
    /** Requirement definition (cached from config) */
    definition?: TerminalRequirement;
    /** File attachments */
    files?: string[];
}

function mapSnapshotToSubmission(
    snapshot: DocumentSnapshot,
    stage: ThesisStageName,
): TerminalRequirementSubmissionRecord | null {
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() as Omit<TerminalRequirementDocument, 'id'> & {
        approvals?: Record<string, Partial<TerminalRequirementApprovalState>>;
    };
    const stageKey = normalizeStageKey(stage);

    return {
        id: snapshot.id,
        thesisId: data.thesisId,
        groupId: data.groupId,
        stage: data.stage ?? stage,
        stageKey: data.stageKey ?? stageKey,
        requirementIds: data.requirementIds ?? [snapshot.id],
        status: data.status ?? 'draft',
        submittedAt: data.submittedAt,
        submittedBy: data.submittedBy,
        locked: Boolean(data.locked),
        approvals: mapApprovalsRecord(data.approvals),
        assignedApprovers: data.assignedApprovers,
        currentRole: data.currentRole ?? null,
        returnNote: data.returnNote,
        returnedAt: data.returnedAt,
        returnedBy: data.returnedBy,
        resubmissionCount: data.resubmissionCount ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: data.completedAt,
        history: Array.isArray(data.history) ? trimHistory(data.history) : undefined,
    };
}

// ============================================================================
// Terminal Requirement CRUD (Per Stage/Requirement)
// ============================================================================

/**
 * Get a terminal requirement submission by ID
 */
export async function getTerminalRequirement(
    ctx: TerminalContext,
    requirementId: string,
): Promise<TerminalRequirementSubmissionRecord | null> {
    const { year, department, course, groupId, thesisId, stage } = ctx;
    const path = buildTerminalDocPath(
        year, department, course, groupId, thesisId, normalizeStageKey(stage), requirementId
    );
    const ref = doc(firebaseFirestore, path);
    const snapshot = await getDoc(ref);
    return mapSnapshotToSubmission(snapshot, stage);
}

/**
 * Get all terminal requirements for a stage
 */
export async function getTerminalRequirementsByStage(
    ctx: TerminalContext,
): Promise<TerminalRequirementSubmissionRecord[]> {
    const { year, department, course, groupId, thesisId, stage } = ctx;
    const path = buildTerminalCollectionPath(
        year, department, course, groupId, thesisId, normalizeStageKey(stage)
    );
    const collRef = collection(firebaseFirestore, path);
    const q = query(collRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => mapSnapshotToSubmission(docSnap, stage))
        .filter((r): r is TerminalRequirementSubmissionRecord => r !== null);
}

/**
 * Listen to a terminal requirement submission
 */
export function listenTerminalRequirement(
    ctx: TerminalContext,
    requirementId: string,
    onData: (record: TerminalRequirementSubmissionRecord | null) => void,
    onError?: (error: Error) => void,
): () => void {
    const { year, department, course, groupId, thesisId, stage } = ctx;
    const path = buildTerminalDocPath(
        year, department, course, groupId, thesisId, normalizeStageKey(stage), requirementId
    );
    const ref = doc(firebaseFirestore, path);

    return onSnapshot(
        ref,
        (snapshot) => onData(mapSnapshotToSubmission(snapshot, stage)),
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Terminal requirement listener error:', error);
            }
        },
    );
}

/**
 * Listen to all terminal requirements for a stage
 */
export function listenTerminalRequirementsByStage(
    ctx: TerminalContext,
    onData: (records: TerminalRequirementSubmissionRecord[]) => void,
    onError?: (error: Error) => void,
): () => void {
    const { year, department, course, groupId, thesisId, stage } = ctx;
    const path = buildTerminalCollectionPath(
        year, department, course, groupId, thesisId, normalizeStageKey(stage)
    );
    const collRef = collection(firebaseFirestore, path);
    const q = query(collRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const records = snapshot.docs
                .map((docSnap) => mapSnapshotToSubmission(docSnap, stage))
                .filter((r): r is TerminalRequirementSubmissionRecord => r !== null);
            onData(records);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Terminal requirements listener error:', error);
            }
        },
    );
}

// ============================================================================
// Submit / Decision Operations
// ============================================================================

export interface SubmitTerminalRequirementPayload {
    ctx: TerminalContext;
    requirementId: string;
    submittedBy: string;
    files?: string[];
    assignments?: TerminalRequirementApproverAssignments;
    definition?: TerminalRequirement;
}

/**
 * Submit a terminal requirement for approval
 */
export async function submitTerminalRequirement(
    payload: SubmitTerminalRequirementPayload,
): Promise<TerminalRequirementSubmissionRecord> {
    const { ctx, requirementId, submittedBy, files, assignments, definition } = payload;
    const { year, department, course, groupId, thesisId, stage } = ctx;

    if (!thesisId || !groupId) {
        throw new Error('thesisId and groupId are required.');
    }
    if (!submittedBy) {
        throw new Error('submittedBy is required.');
    }

    const stageKey = normalizeStageKey(stage);
    const path = buildTerminalDocPath(
        year, department, course, groupId, thesisId, stageKey, requirementId
    );
    const ref = doc(firebaseFirestore, path);
    const snapshot = await getDoc(ref);
    const existing = mapSnapshotToSubmission(snapshot, stage);

    const normalizedAssignments = sanitizeAssignments(assignments);
    const orderedRoles = APPROVAL_FLOW.filter((role) => Boolean(normalizedAssignments[role]));
    const now = new Date().toISOString();

    const approvals = normalizeApprovals(orderedRoles, existing?.approvals);
    let history = trimHistory([
        ...(existing?.history ?? []),
        createHistoryEntry('submitted', submittedBy, 'student')
    ]);

    let status: TerminalRequirementSubmissionStatus = 'in_review';
    let currentRole = determineCurrentRole(approvals, orderedRoles);
    let completedAt: string | undefined;

    if (orderedRoles.length === 0) {
        status = 'approved';
        currentRole = null;
        completedAt = now;
        history = trimHistory([
            ...history,
            createHistoryEntry('approved', 'system', 'system', 'Auto-approved (no reviewers).')
        ]);
    }

    const documentPayload: Omit<TerminalRequirementDocument, 'id'> = {
        thesisId,
        groupId,
        stage,
        stageKey,
        requirementIds: [requirementId],
        status,
        submittedAt: now,
        submittedBy,
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
        completedAt: completedAt ?? existing?.completedAt,
        history,
        definition,
        files,
    };

    await setDoc(
        ref,
        cleanData(documentPayload, existing ? 'update' : 'create'),
        { merge: true }
    );

    const updatedSnapshot = await getDoc(ref);
    const result = mapSnapshotToSubmission(updatedSnapshot, stage);
    if (!result) {
        throw new Error('Failed to persist terminal requirement.');
    }
    return result;
}

export interface TerminalRequirementDecisionPayload {
    ctx: TerminalContext;
    requirementId: string;
    role: TerminalRequirementApprovalRole;
    approverUid: string;
    action: 'approve' | 'return';
    note?: string;
}

/**
 * Record an approval or return decision on a terminal requirement
 */
export async function recordTerminalRequirementDecision(
    payload: TerminalRequirementDecisionPayload,
): Promise<TerminalRequirementSubmissionRecord> {
    const { ctx, requirementId, role, approverUid, action, note } = payload;
    const { year, department, course, groupId, thesisId, stage } = ctx;

    const stageKey = normalizeStageKey(stage);
    const path = buildTerminalDocPath(
        year, department, course, groupId, thesisId, stageKey, requirementId
    );
    const ref = doc(firebaseFirestore, path);
    const snapshot = await getDoc(ref);
    const existing = mapSnapshotToSubmission(snapshot, stage);

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

    const orderedRoles = APPROVAL_FLOW.filter((r) => allowedRoles.includes(r));
    const targetIndex = orderedRoles.indexOf(role);

    if (targetIndex > 0) {
        const blockingRole = orderedRoles
            .slice(0, targetIndex)
            .find((r) => existing.approvals[r]?.status !== 'approved');
        if (blockingRole) {
            throw new Error('Awaiting previous approvals.');
        }
    }

    const assigned = existing.assignedApprovers?.[role];
    if (assigned && assigned.length > 0 && !assigned.includes(approverUid)) {
        throw new Error('You are not assigned to approve this requirement.');
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
        if (note) approvalEntry.note = note;
        approvals[role] = approvalEntry;
        history = trimHistory([
            ...history,
            createHistoryEntry('approved', approverUid, role, note)
        ]);

        const allApproved = orderedRoles.every((r) => approvals[r]?.status === 'approved');
        const payloadToSet: Partial<TerminalRequirementDocument> = {
            approvals,
            status: allApproved ? 'approved' : 'in_review',
            currentRole: determineCurrentRole(approvals, orderedRoles),
            locked: true,
            completedAt: allApproved ? now : existing.completedAt,
            updatedAt: now,
            history,
        };
        await setDoc(ref, cleanData(payloadToSet, 'update'), { merge: true });
    } else {
        const approvalEntry: TerminalRequirementApprovalState = {
            role,
            status: 'returned',
            decidedAt: now,
            decidedBy: approverUid,
        };
        if (note) approvalEntry.note = note;
        approvals[role] = approvalEntry;
        history = trimHistory([
            ...history,
            createHistoryEntry('returned', approverUid, role, note)
        ]);

        const payloadToSet: Partial<TerminalRequirementDocument> = {
            approvals,
            status: 'returned',
            currentRole: role,
            locked: false,
            returnNote: note ?? 'Changes requested.',
            returnedAt: now,
            returnedBy: role,
            updatedAt: now,
            history,
        };
        await setDoc(ref, cleanData(payloadToSet, 'update'), { merge: true });
    }

    const updatedSnapshot = await getDoc(ref);
    const result = mapSnapshotToSubmission(updatedSnapshot, stage);
    if (!result) {
        throw new Error('Failed to update submission status.');
    }
    return result;
}

/**
 * Delete a terminal requirement submission
 */
export async function deleteTerminalRequirement(
    ctx: TerminalContext,
    requirementId: string,
): Promise<void> {
    const { year, department, course, groupId, thesisId, stage } = ctx;
    const path = buildTerminalDocPath(
        year, department, course, groupId, thesisId, normalizeStageKey(stage), requirementId
    );
    const ref = doc(firebaseFirestore, path);
    await deleteDoc(ref);
}

// ============================================================================
// Progress Helpers
// ============================================================================

/**
 * Get progress summary for all terminal requirements in a stage
 */
export async function getTerminalRequirementProgress(
    ctx: TerminalContext,
): Promise<TerminalRequirementProgress[]> {
    const records = await getTerminalRequirementsByStage(ctx);
    return records.map((record) => ({
        requirementId: record.id,
        stage: record.stage,
        status: deriveStatus(record),
        fileCount: record.requirementIds?.length ?? 0,
        updatedAt: record.updatedAt,
    }));
}

function deriveStatus(record: TerminalRequirementSubmissionRecord): TerminalRequirementStatus {
    if (record.status === 'approved' || record.status === 'in_review') {
        return 'submitted';
    }
    return 'pending';
}

// ============================================================================
// Course-Level Configuration CRUD (templates)
// ============================================================================

function getTerminalTemplateDocRef(context: NormalizedCourseTemplateContext) {
    return doc(
        firebaseFirestore,
        buildCourseTerminalTemplateDocPath(context.year, context.department, context.course)
    );
}

function getTerminalEntriesCollectionRef(context: NormalizedCourseTemplateContext) {
    return collection(
        firebaseFirestore,
        buildTerminalRequirementEntriesCollectionPath(context.year, context.department, context.course)
    );
}

function getTerminalEntryDocRef(context: NormalizedCourseTemplateContext, requirementId: string) {
    return doc(
        firebaseFirestore,
        buildTerminalRequirementEntryDocPath(context.year, context.department, context.course, requirementId)
    );
}

function normalizeConfigEntry(entry: TerminalRequirementConfigEntry): TerminalRequirementConfigEntry {
    const cleanEntry: TerminalRequirementConfigEntry = {
        stage: entry.stage,
        requirementId: entry.requirementId,
        required: Boolean(entry.required),
    };
    if (entry.title?.trim()) {
        cleanEntry.title = entry.title.trim();
    }
    if (entry.description?.trim()) {
        cleanEntry.description = entry.description.trim();
    }
    if (entry.requireAttachment !== undefined) {
        cleanEntry.requireAttachment = entry.requireAttachment;
    }
    if (entry.fileTemplate) {
        cleanEntry.fileTemplate = { ...entry.fileTemplate };
    }
    return cleanEntry;
}

function normalizeConfigEntries(
    entries: TerminalRequirementConfigEntry[]
): TerminalRequirementConfigEntry[] {
    const normalized = new Map<string, TerminalRequirementConfigEntry>();
    entries.forEach((entry) => {
        if (!entry.requirementId) return;
        normalized.set(entry.requirementId, normalizeConfigEntry(entry));
    });
    return Array.from(normalized.values());
}

function normalizeStageTemplatesMap(
    templates?: TerminalRequirementStageTemplates,
): TerminalRequirementStageTemplates | undefined {
    if (!templates) {
        return undefined;
    }

    const normalized = Object.entries(templates).reduce<TerminalRequirementStageTemplates>((acc, [stage, metadata]) => {
        if (!metadata) {
            return acc;
        }
        acc[stage as ThesisStageName] = { ...metadata };
        return acc;
    }, {});

    return Object.keys(normalized).length > 0 ? normalized : {};
}

interface TerminalRequirementTemplateDocument extends Omit<TerminalRequirementConfigDocument, 'id'> {
    templateType: typeof TERMINAL_REQUIREMENTS_KEY;
}

function generateTerminalRequirementConfigId(
    year: string,
    department: string,
    course: string,
): string {
    const yearKey = sanitizePathSegment(year, DEFAULT_YEAR);
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
    return `${yearKey}_${deptKey}_${courseKey}_terminal`;
}

function mapConfigSnapshot(
    data: Partial<TerminalRequirementTemplateDocument>,
    requirements: TerminalRequirementConfigEntry[],
    fallback?: NormalizedCourseTemplateContext,
): TerminalRequirementConfigDocument | null {
    const fallbackTimestamp = new Date().toISOString();
    const year = data.year ?? fallback?.year ?? DEFAULT_YEAR;
    const department = data.department ?? fallback?.department;
    const course = data.course ?? fallback?.course;

    if (!department || !course) {
        return null;
    }

    return {
        id: generateTerminalRequirementConfigId(year, department, course),
        year,
        name: data.name ?? `${department} - ${course}`,
        description: data.description,
        department,
        course,
        requirements: normalizeConfigEntries(requirements),
        stageTemplates: normalizeStageTemplatesMap(data.stageTemplates),
        createdAt: data.createdAt ?? fallbackTimestamp,
        updatedAt: data.updatedAt ?? fallbackTimestamp,
    };
}

export interface TerminalRequirementConfigQuery extends CourseTemplateContextInput { }

export interface SaveTerminalRequirementConfigPayload extends CourseTemplateContextInput {
    name?: string;
    description?: string;
    requirements: TerminalRequirementConfigEntry[];
    stageTemplates?: TerminalRequirementStageTemplates;
}

/**
 * Get a terminal requirement config scoped to a course for a given academic year.
 * Reads the parent document for metadata and the entries subcollection for requirements.
 */
export async function getTerminalRequirementConfig(
    contextInput: TerminalRequirementConfigQuery,
): Promise<TerminalRequirementConfigDocument | null> {
    const context = normalizeCourseTemplateContext(contextInput);
    const ref = getTerminalTemplateDocRef(context);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() as Partial<TerminalRequirementTemplateDocument>;

    // Fetch requirement entries from the subcollection
    const entriesRef = getTerminalEntriesCollectionRef(context);
    const entriesSnapshot = await getDocs(entriesRef);

    const requirements: TerminalRequirementConfigEntry[] = [];
    entriesSnapshot.forEach((entryDoc) => {
        const entryData = entryDoc.data() as TerminalRequirementConfigEntry;
        if (entryData.requirementId) {
            requirements.push(entryData);
        }
    });

    const config = mapConfigSnapshot(data, requirements, context);
    return config;
}

/**
 * Get all terminal requirement configs for a specific academic year.
 * Note: This only fetches parent metadata; use getTerminalRequirementConfig for full entries.
 */
export async function getAllTerminalRequirementConfigs(
    year: string = DEFAULT_YEAR,
): Promise<TerminalRequirementConfigDocument[]> {
    const templatesGroup = collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION);
    const configsQuery = query(
        templatesGroup,
        where('templateType', '==', TERMINAL_REQUIREMENTS_KEY),
        where('year', '==', year),
    );
    const snapshot = await getDocs(configsQuery);
    const configPromises: Promise<TerminalRequirementConfigDocument | null>[] = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<TerminalRequirementTemplateDocument>;
        const pathParams = extractPathParams(docSnap.ref.path);
        if (!pathParams.department || !pathParams.course) {
            return;
        }
        const context = normalizeCourseTemplateContext({
            year: pathParams.year ?? year,
            department: pathParams.department,
            course: pathParams.course,
        });

        // Fetch entries for each config
        const entriesRef = getTerminalEntriesCollectionRef(context);
        const entriesPromise = getDocs(entriesRef).then((entriesSnapshot) => {
            const requirements: TerminalRequirementConfigEntry[] = [];
            entriesSnapshot.forEach((entryDoc) => {
                const entryData = entryDoc.data() as TerminalRequirementConfigEntry;
                if (entryData.requirementId) {
                    requirements.push(entryData);
                }
            });
            return mapConfigSnapshot(data, requirements, context);
        });
        configPromises.push(entriesPromise);
    });

    const configs = await Promise.all(configPromises);
    return configs.filter((c): c is TerminalRequirementConfigDocument => c !== null);
}

/**
 * Save (create or update) a course-level terminal requirement config.
 * Writes the parent document for metadata and individual requirement entries to the subcollection.
 */
export async function setTerminalRequirementConfig(
    payload: SaveTerminalRequirementConfigPayload,
): Promise<string> {
    if (!payload.department.trim() || !payload.course.trim()) {
        throw new Error('Department and course are required to save terminal requirements.');
    }
    const context = normalizeCourseTemplateContext(payload);
    const now = new Date().toISOString();
    await ensureCourseHierarchyExists(context, now);

    const ref = getTerminalTemplateDocRef(context);
    const snapshot = await getDoc(ref);
    const existing = snapshot.exists()
        ? (snapshot.data() as TerminalRequirementTemplateDocument)
        : null;

    const normalizedStageTemplates = payload.stageTemplates !== undefined
        ? normalizeStageTemplatesMap(payload.stageTemplates)
        : undefined;

    // Parent document stores metadata (not the requirements array)
    const documentPayload = {
        templateType: TERMINAL_REQUIREMENTS_KEY,
        year: context.year,
        name: payload.name?.trim() || `${payload.department.trim()} - ${payload.course.trim()}`,
        description: payload.description?.trim(),
        department: payload.department.trim(),
        course: payload.course.trim(),
        ...(normalizedStageTemplates !== undefined ? { stageTemplates: normalizedStageTemplates } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    const cleaned = cleanData(documentPayload, existing ? 'update' : 'create');

    // Use a batch to write the parent document and all entries atomically
    const batch = writeBatch(firebaseFirestore);
    batch.set(ref, cleaned, { merge: true });

    // Get existing entries to determine which to delete
    const entriesRef = getTerminalEntriesCollectionRef(context);
    const existingEntriesSnapshot = await getDocs(entriesRef);
    const existingEntryIds = new Set<string>();
    existingEntriesSnapshot.forEach((entryDoc) => {
        existingEntryIds.add(entryDoc.id);
    });

    // Normalize and write new entries
    const normalizedEntries = normalizeConfigEntries(payload.requirements);
    const newEntryIds = new Set<string>();

    for (const entry of normalizedEntries) {
        const entryRef = getTerminalEntryDocRef(context, entry.requirementId);
        const entryPayload = {
            ...entry,
            updatedAt: now,
            createdAt: existingEntryIds.has(entry.requirementId) ? undefined : now,
        };
        const cleanedEntry = cleanData(entryPayload, existingEntryIds.has(entry.requirementId) ? 'update' : 'create');
        batch.set(entryRef, cleanedEntry, { merge: true });
        newEntryIds.add(entry.requirementId);
    }

    // Delete entries that are no longer in the payload
    for (const existingId of existingEntryIds) {
        if (!newEntryIds.has(existingId)) {
            const entryRef = getTerminalEntryDocRef(context, existingId);
            batch.delete(entryRef);
        }
    }

    await batch.commit();
    return generateTerminalRequirementConfigId(context.year, context.department, context.course);
}

/**
 * Delete a course-level terminal requirement config including all entries.
 */
export async function deleteTerminalRequirementConfig(
    contextInput: TerminalRequirementConfigQuery,
): Promise<void> {
    const context = normalizeCourseTemplateContext(contextInput);

    // Delete all entries first
    const entriesRef = getTerminalEntriesCollectionRef(context);
    const entriesSnapshot = await getDocs(entriesRef);

    const batch = writeBatch(firebaseFirestore);
    entriesSnapshot.forEach((entryDoc) => {
        batch.delete(entryDoc.ref);
    });

    // Delete the parent document
    const ref = getTerminalTemplateDocRef(context);
    batch.delete(ref);

    await batch.commit();
}

/**
 * Listen to all terminal requirement configs for a year.
 * Note: For performance, this listens to parent docs only. Use listenTerminalRequirementConfig for full entries.
 */
export function listenAllTerminalRequirementConfigs(
    onData: (configs: TerminalRequirementConfigDocument[]) => void,
    onError?: (error: unknown) => void,
    year: string = DEFAULT_YEAR,
): () => void {
    const templatesGroup = collectionGroup(firebaseFirestore, COURSE_TEMPLATES_SUBCOLLECTION);
    const configsQuery = query(
        templatesGroup,
        where('templateType', '==', TERMINAL_REQUIREMENTS_KEY),
        where('year', '==', year),
    );

    return onSnapshot(
        configsQuery,
        async (snapshot) => {
            const configPromises: Promise<TerminalRequirementConfigDocument | null>[] = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as Partial<TerminalRequirementTemplateDocument>;
                const pathParams = extractPathParams(docSnap.ref.path);
                if (!pathParams.department || !pathParams.course) {
                    return;
                }
                const context = normalizeCourseTemplateContext({
                    year: pathParams.year ?? year,
                    department: pathParams.department,
                    course: pathParams.course,
                });

                // Fetch entries for each config
                const entriesRef = getTerminalEntriesCollectionRef(context);
                const entriesPromise = getDocs(entriesRef).then((entriesSnapshot) => {
                    const requirements: TerminalRequirementConfigEntry[] = [];
                    entriesSnapshot.forEach((entryDoc) => {
                        const entryData = entryDoc.data() as TerminalRequirementConfigEntry;
                        if (entryData.requirementId) {
                            requirements.push(entryData);
                        }
                    });
                    return mapConfigSnapshot(data, requirements, context);
                });
                configPromises.push(entriesPromise);
            });

            try {
                const configs = await Promise.all(configPromises);
                onData(configs.filter((c): c is TerminalRequirementConfigDocument => c !== null));
            } catch (error) {
                if (onError) {
                    onError(error);
                } else {
                    console.error('Error fetching terminal requirement entries:', error);
                }
            }
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Terminal requirement configs listener error:', error);
            }
        }
    );
}

/**
 * Listen to a specific course-level terminal requirement config.
 * Listens to both the parent document and the entries subcollection.
 */
export function listenTerminalRequirementConfig(
    contextInput: TerminalRequirementConfigQuery,
    onData: (config: TerminalRequirementConfigDocument | null) => void,
    onError?: (error: unknown) => void,
): () => void {
    const context = normalizeCourseTemplateContext(contextInput);
    const ref = getTerminalTemplateDocRef(context);
    const entriesRef = getTerminalEntriesCollectionRef(context);

    let parentData: Partial<TerminalRequirementTemplateDocument> | null = null;
    let entriesData: TerminalRequirementConfigEntry[] = [];
    let parentLoaded = false;
    let entriesLoaded = false;

    const emitData = () => {
        if (!parentLoaded || !entriesLoaded) {
            return;
        }
        if (!parentData) {
            onData(null);
            return;
        }
        const config = mapConfigSnapshot(parentData, entriesData, context);
        onData(config);
    };

    const unsubParent = onSnapshot(
        ref,
        (snapshot) => {
            parentLoaded = true;
            if (!snapshot.exists()) {
                parentData = null;
            } else {
                parentData = snapshot.data() as Partial<TerminalRequirementTemplateDocument>;
            }
            emitData();
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Terminal requirement config parent listener error:', error);
            }
        }
    );

    const unsubEntries = onSnapshot(
        entriesRef,
        (snapshot) => {
            entriesLoaded = true;
            entriesData = [];
            snapshot.forEach((entryDoc) => {
                const entryData = entryDoc.data() as TerminalRequirementConfigEntry;
                if (entryData.requirementId) {
                    entriesData.push(entryData);
                }
            });
            emitData();
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Terminal requirement config entries listener error:', error);
            }
        }
    );

    return () => {
        unsubParent();
        unsubEntries();
    };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
    TerminalRequirement,
    TerminalRequirementProgress,
    TerminalRequirementStatus,
    TerminalRequirementConfigDocument,
    TerminalRequirementConfigEntry,
    TerminalRequirementApprovalRole,
    TerminalRequirementApprovalState,
    TerminalRequirementApprovalStatus,
    TerminalRequirementApproverAssignments,
    TerminalRequirementSubmissionHistoryEntry,
    TerminalRequirementSubmissionRecord,
    TerminalRequirementSubmissionStatus,
};

// ============================================================================
// Context-Free Lookups (via collectionGroup)
// ============================================================================

/**
 * Find and listen to terminal requirement submissions for a thesis by ID.
 * Searches via collectionGroup when you don't have the full context path.
 *
 * @param thesisId Thesis document ID
 * @param stage Stage name
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function findAndListenTerminalRequirements(
    thesisId: string,
    stage: ThesisStageName,
    options: {
        onData: (records: TerminalRequirementSubmissionRecord[]) => void;
        onError?: (error: Error) => void;
    }
): () => void {
    const terminalQuery = collectionGroup(firebaseFirestore, TERMINAL_SUBCOLLECTION);
    const stageKey = normalizeStageKey(stage);

    return onSnapshot(
        terminalQuery,
        (snapshot) => {
            const records: TerminalRequirementSubmissionRecord[] = [];
            for (const docSnap of snapshot.docs) {
                const pathParts = docSnap.ref.path.split('/');
                const thesisIndex = pathParts.indexOf('thesis');
                const stagesIndex = pathParts.indexOf('stages');
                if (
                    thesisIndex !== -1 &&
                    stagesIndex !== -1 &&
                    pathParts[thesisIndex + 1] === thesisId &&
                    pathParts[stagesIndex + 1] === stageKey
                ) {
                    const record = mapSnapshotToSubmission(docSnap, stage);
                    if (record) {
                        records.push(record);
                    }
                }
            }
            options.onData(records);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('Terminal requirement listener error:', error);
            }
        }
    );
}


/**
 * Payload for recording a decision using thesis ID (context-free).
 */
export interface FindAndRecordDecisionPayload {
    thesisId: string;
    stage: ThesisStageName;
    role: TerminalRequirementApprovalRole;
    approverUid: string;
    action: 'approve' | 'return';
    note?: string;
}

/**
 * Find and record a decision on ALL terminal requirements for a stage by thesis ID.
 * Searches via collectionGroup when you don't have the full context path.
 * Processes ALL matching requirements in the stage to ensure consistent state.
 *
 * @param payload Decision payload with thesisId
 * @returns Array of updated submission records
 * @throws Error if no submissions found
 */
export async function findAndRecordTerminalRequirementDecision(
    payload: FindAndRecordDecisionPayload
): Promise<TerminalRequirementSubmissionRecord> {
    const { thesisId, stage, role, approverUid, action, note } = payload;

    const terminalQuery = collectionGroup(firebaseFirestore, TERMINAL_SUBCOLLECTION);
    const stageKey = normalizeStageKey(stage);
    const snapshot = await getDocs(terminalQuery);

    // Collect all matching documents for this thesis and stage
    const matchingDocs: { docSnap: typeof snapshot.docs[0]; ctx: TerminalContext }[] = [];

    for (const docSnap of snapshot.docs) {
        const pathParts = docSnap.ref.path.split('/');
        const thesisIndex = pathParts.indexOf('thesis');
        const stagesIndex = pathParts.indexOf('stages');
        if (
            thesisIndex !== -1 &&
            stagesIndex !== -1 &&
            pathParts[thesisIndex + 1] === thesisId &&
            pathParts[stagesIndex + 1] === stageKey
        ) {
            const params = extractPathParams(docSnap.ref.path);
            const ctx: TerminalContext = {
                year: params.year || DEFAULT_YEAR,
                department: params.department || '',
                course: params.course || '',
                groupId: params.groupId || '',
                thesisId: thesisId,
                stage: stage,
            };
            matchingDocs.push({ docSnap, ctx });
        }
    }

    if (matchingDocs.length === 0) {
        throw new Error('Terminal requirement submission not found.');
    }

    // Process ALL matching requirements
    const results: TerminalRequirementSubmissionRecord[] = [];
    for (const { docSnap, ctx } of matchingDocs) {
        try {
            const result = await recordTerminalRequirementDecision({
                ctx,
                requirementId: docSnap.id,
                role,
                approverUid,
                action,
                note,
            });
            results.push(result);
        } catch (error) {
            // Log but continue processing other requirements
            console.error(`Failed to record decision for requirement ${docSnap.id}:`, error);
        }
    }

    if (results.length === 0) {
        throw new Error('Failed to record decision on any terminal requirement.');
    }

    // Return the first result for backward compatibility
    return results[0];
}
