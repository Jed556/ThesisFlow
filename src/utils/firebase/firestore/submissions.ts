/**
 * Firebase Firestore - Chapter Submissions
 * CRUD operations for Submission documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}/stages/{stage}/chapters/{chapterId}/submissions/{submissionId}
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, onSnapshot, type QueryConstraint
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type {
    ChapterSubmission, ChapterSubmissionStatus, ExpertApprovalState, ExpertApproval, ExpertRole, ThesisStageName
} from '../../../types/thesis';
import type { WorkspaceChapterDecision } from '../../../types/workspace';
import { SUBMISSIONS_SUBCOLLECTION, THESIS_STAGE_SLUGS } from '../../../config/firestore';
import { buildSubmissionDocPath, buildSubmissionsCollectionPath } from './paths';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: ThesisStageName | string;
    chapterId: string;
}

// ============================================================================
// Path Helpers
// ============================================================================

function normalizeStageKey(stage: SubmissionContext['stage']): string {
    // Get the first stage slug as fallback from the THESIS_STAGE_SLUGS object
    const stageKeys = Object.keys(THESIS_STAGE_SLUGS) as ThesisStageName[];
    const fallback = stageKeys.length > 0 ? THESIS_STAGE_SLUGS[stageKeys[0]] : 'pre-proposal';
    if (typeof stage !== 'string' || stage.trim().length === 0) {
        return fallback;
    }
    const normalized = THESIS_STAGE_SLUGS[stage as ThesisStageName] ?? stage
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function resolveSubmissionsCollectionPath(ctx: SubmissionContext): string {
    return buildSubmissionsCollectionPath(
        ctx.year,
        ctx.department,
        ctx.course,
        ctx.groupId,
        ctx.thesisId,
        normalizeStageKey(ctx.stage),
        String(ctx.chapterId),
    );
}

function resolveSubmissionDocPath(ctx: SubmissionContext, submissionId: string): string {
    return buildSubmissionDocPath(
        ctx.year,
        ctx.department,
        ctx.course,
        ctx.groupId,
        ctx.thesisId,
        normalizeStageKey(ctx.stage),
        String(ctx.chapterId),
        submissionId,
    );
}

export interface SubmissionListenerOptions {
    onData: (submissions: ChapterSubmission[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Submission CRUD Operations
// ============================================================================

/**
 * Create a submission document under a chapter
 * @param ctx - Submission context containing path information
 * @param submissionData - Submission data (without id)
 * @returns Created submission document ID
 */
export async function createSubmission(
    ctx: SubmissionContext,
    submissionData: Omit<ChapterSubmission, 'id'>
): Promise<string> {
    const collectionPath = resolveSubmissionsCollectionPath(ctx);
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(submissionsRef);

    await setDoc(newDocRef, {
        ...submissionData,
        // Store submissionStatus for 'draft' detection (derived status otherwise)
        submissionStatus: submissionData.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Get a submission document by ID
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 * @returns Submission data or null if not found
 */
export async function getSubmission(ctx: SubmissionContext, submissionId: string): Promise<ChapterSubmission | null> {
    const docPath = resolveSubmissionDocPath(ctx, submissionId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ChapterSubmission;
}

/**
 * Get all submissions for a chapter
 * @param ctx - Submission context containing path information
 * @returns Array of submissions ordered by creation time (descending)
 */
export async function getSubmissionsForChapter(ctx: SubmissionContext): Promise<ChapterSubmission[]> {
    const collectionPath = resolveSubmissionsCollectionPath(ctx);
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ChapterSubmission));
}

/**
 * Get all submissions across all chapters using collectionGroup query
 * @param constraints - Optional query constraints
 * @returns Array of all submissions
 */
export async function getAllSubmissions(constraints?: QueryConstraint[]): Promise<ChapterSubmission[]> {
    const submissionsQuery = collectionGroup(firebaseFirestore, SUBMISSIONS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(submissionsQuery, ...constraints)
        : submissionsQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ChapterSubmission));
}

/**
 * Update a submission document
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 * @param data - Partial submission data to update
 */
export async function updateSubmission(
    ctx: SubmissionContext,
    submissionId: string,
    data: Partial<ChapterSubmission>
): Promise<void> {
    const docPath = resolveSubmissionDocPath(ctx, submissionId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a submission document
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 */
export async function deleteSubmission(ctx: SubmissionContext, submissionId: string): Promise<void> {
    const docPath = resolveSubmissionDocPath(ctx, submissionId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Submit a draft submission for review
 * Changes status from 'draft' to 'under_review'
 * @param ctx - Submission context containing path information
 * @param submissionId - Submission document ID
 */
export async function submitDraftSubmission(ctx: SubmissionContext, submissionId: string): Promise<void> {
    const docPath = resolveSubmissionDocPath(ctx, submissionId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        status: 'under_review',
        submissionStatus: 'under_review',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

// ============================================================================
// Decision Operations
// ============================================================================

export interface UpdateSubmissionDecisionInput {
    ctx: SubmissionContext;
    submissionId: string;
    decision: WorkspaceChapterDecision;
    role: ExpertRole;
    /** Required expert roles for this thesis (determines if statistician is needed) */
    requiredRoles?: ExpertRole[];
}

export interface SubmissionDecisionResult {
    status: ChapterSubmissionStatus;
    expertApprovals: ExpertApprovalState;
}

/** Approval flow order: Statistician (if exists) → Adviser → Editor */
const APPROVAL_ORDER: ExpertRole[] = ['statistician', 'adviser', 'editor'];

/**
 * Check if a role has approved in the expertApprovals array
 * Only returns true if decision is 'approved' (or undefined for backward compatibility)
 */
function hasRoleApproved(expertApprovals: ExpertApprovalState, role: ExpertRole): boolean {
    return expertApprovals.some((approval) =>
        approval.role === role && (approval.decision === 'approved' || approval.decision === undefined)
    );
}

/**
 * Get the next approver in the sequence
 * @param expertApprovals - Current approvals
 * @param requiredRoles - Roles that need to approve (based on thesis assignment)
 * @returns Next role that needs to approve, or null if all approved
 */
export function getNextApproverInSequence(
    expertApprovals: ExpertApprovalState,
    requiredRoles: ExpertRole[]
): ExpertRole | null {
    for (const role of APPROVAL_ORDER) {
        if (requiredRoles.includes(role) && !hasRoleApproved(expertApprovals, role)) {
            return role;
        }
    }
    return null; // All required roles have approved
}

/**
 * Check if a role can approve (it's their turn in the sequence)
 * Returns true if:
 * 1. The role is the next approver in sequence, OR
 * 2. The role hasn't approved yet AND all prior roles in the sequence have approved
 */
export function canRoleApprove(
    role: ExpertRole,
    expertApprovals: ExpertApprovalState,
    requiredRoles: ExpertRole[]
): boolean {
    // If role is not in the required roles, they can't approve
    if (!requiredRoles.includes(role)) {
        return false;
    }

    // If role has already approved, they can't approve again
    if (hasRoleApproved(expertApprovals, role)) {
        return false;
    }

    // Check if it's this role's turn - all prior roles in APPROVAL_ORDER must have approved
    for (const priorRole of APPROVAL_ORDER) {
        if (priorRole === role) {
            // Reached our role - all prior required roles have approved
            return true;
        }
        // If a prior role is required and hasn't approved, it's not our turn
        if (requiredRoles.includes(priorRole) && !hasRoleApproved(expertApprovals, priorRole)) {
            return false;
        }
    }

    return true;
}

/**
 * Derive submission status from expertApprovals array
 * This is the source of truth - status is not stored separately
 * @param expertApprovals - Array of expert approvals/decisions
 * @param requiredRoles - Roles that need to approve (defaults to adviser + editor)
 * @returns Derived status
 */
export function deriveStatusFromApprovals(
    expertApprovals: ExpertApprovalState | undefined,
    requiredRoles: ExpertRole[] = ['adviser', 'editor']
): ChapterSubmissionStatus {
    if (!expertApprovals || !Array.isArray(expertApprovals) || expertApprovals.length === 0) {
        return 'under_review';
    }

    // Check if any role requested revision
    const hasRevisionRequest = expertApprovals.some((a) => a.decision === 'revision_required');
    if (hasRevisionRequest) {
        return 'revision_required';
    }

    // Check if all required roles have approved
    const allApproved = requiredRoles.every((role) =>
        expertApprovals.some((a) =>
            a.role === role && (a.decision === 'approved' || a.decision === undefined)
        )
    );
    if (allApproved) {
        return 'approved';
    }

    return 'under_review';
}

/**
 * Calculate overall status from expert approvals and decision
 * @param expertApprovals - Array of expert approvals
 * @param requiredRoles - Roles that need to approve
 * @param currentDecision - The current decision being made
 */
function calculateSubmissionStatus(
    expertApprovals: ExpertApprovalState,
    requiredRoles: ExpertRole[],
    currentDecision: WorkspaceChapterDecision
): ChapterSubmissionStatus {
    if (currentDecision === 'revision_required') {
        return 'revision_required';
    }

    // Check if all required roles have approved
    const allApproved = requiredRoles.every((role) => hasRoleApproved(expertApprovals, role));
    if (allApproved) {
        return 'approved';
    }

    return 'under_review';
}

/**
 * Update submission decision (status and expert approvals)
 * This is the new pattern - decisions are stored per-submission, not per-chapter.
 * Approval flow: Statistician (if exists) → Adviser → Editor
 * @param input - Submission context, ID, decision, and role
 * @returns Decision result with updated status and approvals
 */
export async function updateSubmissionDecision(
    input: UpdateSubmissionDecisionInput
): Promise<SubmissionDecisionResult> {
    const { ctx, submissionId, decision, role } = input;
    // Use provided requiredRoles, but fall back to default if empty or not provided
    const requiredRoles = input.requiredRoles?.length ? input.requiredRoles : ['adviser', 'editor'] as ExpertRole[];

    const docPath = resolveSubmissionDocPath(ctx, submissionId);
    const docRef = doc(firebaseFirestore, docPath);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
        throw new Error(`Submission ${submissionId} not found`);
    }

    const submission = snapshot.data() as ChapterSubmission;
    const decidedAt = new Date().toISOString();

    // Get current approvals (ensure it's an array)
    const currentApprovals: ExpertApprovalState = Array.isArray(submission.expertApprovals)
        ? submission.expertApprovals
        : [];

    // Check if it's this role's turn to approve
    if (decision === 'approved' && !canRoleApprove(role, currentApprovals, requiredRoles)) {
        // Provide a descriptive error message
        if (!requiredRoles.includes(role)) {
            throw new Error(`Cannot approve: ${role} is not assigned to this thesis`);
        }
        if (hasRoleApproved(currentApprovals, role)) {
            throw new Error(`Cannot approve: ${role} has already approved this submission`);
        }
        const nextApprover = getNextApproverInSequence(currentApprovals, requiredRoles);
        if (nextApprover) {
            throw new Error(`Cannot approve: waiting for ${nextApprover} approval first`);
        }
        throw new Error(`Cannot approve: approval sequence error for ${role}`);
    }

    let expertApprovals: ExpertApprovalState;

    if (decision === 'approved') {
        // Add approval to the array
        const newApproval: ExpertApproval = { role, decidedAt, decision: 'approved' };
        expertApprovals = [...currentApprovals.filter((a) => a.role !== role), newApproval];
    } else {
        // For revision_required, keep previous approvals but add the revision request
        // This allows us to know who approved before AND who requested revision
        const newEntry: ExpertApproval = { role, decidedAt, decision: 'revision_required' };
        expertApprovals = [...currentApprovals.filter((a) => a.role !== role), newEntry];
    }

    // Calculate overall status (derived, not stored)
    const status = calculateSubmissionStatus(expertApprovals, requiredRoles, decision);

    // Save to Firestore - only expertApprovals, status is derived
    await updateDoc(docRef, {
        expertApprovals,
        updatedAt: serverTimestamp(),
    });

    return { status, expertApprovals };
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to submissions for a specific chapter
 * @param ctx - Submission context containing path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenSubmissionsForChapter(
    ctx: SubmissionContext,
    options: SubmissionListenerOptions
): () => void {
    const collectionPath = resolveSubmissionsCollectionPath(ctx);
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const submissions = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as ChapterSubmission));
            options.onData(submissions);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Submission listener error:', error);
        }
    );
}
