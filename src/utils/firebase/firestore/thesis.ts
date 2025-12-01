/**
 * Firebase Firestore - Thesis
 * CRUD operations for Thesis documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}
 * 
 * Related modules:
 * - stages.ts: Stage operations under thesis
 * - chapters.ts: Chapter operations under stages  
 * - submissions.ts: Submission operations under chapters
 * - chat.ts: Chat operations under submissions
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy,
    serverTimestamp, writeBatch, onSnapshot, type QueryConstraint, type DocumentReference, type DocumentSnapshot
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { findUserById, findUsersByIds } from './user';
import { getGroup } from './groups';
import type { ThesisData } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import { THESIS_SUBCOLLECTION, GROUPS_SUBCOLLECTION, DEFAULT_YEAR } from '../../../config/firestore';
import { buildThesisCollectionPath, buildThesisDocPath, extractPathParams } from './paths';

// Re-export from specialized modules for backward compatibility
export * from './stages';
export * from './chapters';
export * from './submissions';
export * from './chat';

// ============================================================================
// Types
// ============================================================================

export type ThesisRecord = ThesisData & { id: string };

/** Base context for thesis operations */
export interface ThesisContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

/** Reviewer role type */
export type ReviewerRole = 'adviser' | 'editor' | 'statistician';

/** Reviewer assignment data */
export interface ReviewerAssignment {
    id: string;
    thesisId: string;
    thesisTitle: string;
    role: ReviewerRole;
    stage: string;
    progress: number;
    dueDate?: string;
    assignedTo: string[];
    priority: 'high' | 'medium' | 'low';
    lastUpdated: string;
    studentEmails: string[];
}

/** Thesis with embedded group context from collectionGroup query */
export interface ThesisWithGroupContext extends ThesisData {
    /** Group ID extracted from the document path */
    groupId?: string;
    /** Year extracted from the document path */
    year?: string;
    /** Department extracted from the document path */
    department?: string;
    /** Course extracted from the document path */
    course?: string;
    /** Group leader UID */
    leader?: string;
    /** Group member UIDs (excluding leader) */
    members?: string[];
    /** Adviser UID */
    adviser?: string;
    /** Editor UID */
    editor?: string;
    /** Statistician UID */
    statistician?: string;
    /** Panel member UIDs */
    panels?: string[];
}

export interface ThesisListenerOptions {
    onData: (theses: ThesisRecord[]) => void;
    onError?: (error: Error) => void;
}

export interface ReviewerAssignmentsListenerOptions {
    onData: (assignments: ReviewerAssignment[]) => void;
    onError?: (error: Error) => void;
}

/** Context for a specific thesis document */
export interface ThesisDocumentContext extends ThesisContext {
    thesisId: string;
}

/** Listener options for a thesis document */
export interface ThesisDocumentListenerOptions {
    onData: (thesis: ThesisData | null) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore document data to ThesisData
 */
function docToThesisData(docSnap: DocumentSnapshot): ThesisData | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
        id: docSnap.id,
        title: data.title || '',
        submissionDate: data.submissionDate?.toDate?.() || new Date(),
        lastUpdated: data.lastUpdated?.toDate?.() || new Date(),
        stages: data.stages || [],
        chapters: data.chapters,
    } as ThesisData;
}

/**
 * Determine priority based on progress and last update
 */
function determinePriority(progressRatio: number, lastUpdated?: Date): ReviewerAssignment['priority'] {
    if (progressRatio <= 0.4) return 'high';
    if (progressRatio <= 0.75) return 'medium';

    if (lastUpdated) {
        const diffDays = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 21) return 'medium';
    }

    return 'low';
}

// ============================================================================
// Thesis CRUD Operations
// ============================================================================

/**
 * Create a new thesis document
 * @param ctx - Thesis context containing path information
 * @param data - Thesis data (without id)
 * @returns Created thesis document ID
 */
export async function createThesis(
    ctx: ThesisContext,
    data: Omit<ThesisData, 'id'>
): Promise<string> {
    const collectionPath = buildThesisCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const thesisRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(thesisRef);

    const cleanedData = cleanData({
        ...data,
        id: newDocRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, 'create');

    await setDoc(newDocRef, cleanedData);
    return newDocRef.id;
}

/**
 * Create a thesis with a specific ID
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @param data - Thesis data (without id)
 */
export async function createThesisWithId(
    ctx: ThesisContext,
    thesisId: string,
    data: Omit<ThesisData, 'id'>
): Promise<void> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = cleanData({
        ...data,
        id: thesisId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, 'create');

    await setDoc(docRef, cleanedData);
}

/**
 * Get a thesis by ID
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @returns Thesis data or null if not found
 */
export async function getThesisById(ctx: ThesisContext, thesisId: string): Promise<ThesisData | null> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToThesisData(docSnap);
}

/**
 * Get thesis document reference
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @returns Firestore document reference
 */
export function getThesisDocRef(ctx: ThesisContext, thesisId: string): DocumentReference {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    return doc(firebaseFirestore, docPath);
}

/**
 * Get all theses for a group
 * @param ctx - Thesis context containing path information
 * @returns Array of thesis records ordered by creation time (descending)
 */
export async function getThesesForGroup(ctx: ThesisContext): Promise<ThesisRecord[]> {
    const collectionPath = buildThesisCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const thesisRef = collection(firebaseFirestore, collectionPath);
    const q = query(thesisRef, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => {
            const data = docToThesisData(docSnap);
            return data ? { ...data, id: docSnap.id } as ThesisRecord : null;
        })
        .filter((t): t is ThesisRecord => t !== null);
}

/**
 * Get the most recent thesis for a group
 * @param ctx - Thesis context containing path information
 * @returns Most recent thesis data or null if no theses exist
 */
export async function getLatestThesisForGroup(ctx: ThesisContext): Promise<ThesisData | null> {
    const theses = await getThesesForGroup(ctx);
    if (theses.length === 0) return null;

    const parseSequenceNumber = (docId: string): number => {
        const match = docId.match(/-T(\d+)$/i);
        return match ? Number(match[1]) || 0 : 0;
    };

    return theses.reduce((best, candidate) => {
        const bestSeq = parseSequenceNumber(best.id);
        const candidateSeq = parseSequenceNumber(candidate.id);

        if (candidateSeq > bestSeq) return candidate;
        if (candidateSeq < bestSeq) return best;

        const bestUpdated = new Date(best.lastUpdated).getTime();
        const candidateUpdated = new Date(candidate.lastUpdated).getTime();
        return candidateUpdated > bestUpdated ? candidate : best;
    }, theses[0]);
}

/**
 * Get all theses across all groups using collectionGroup query
 * @param constraints - Optional query constraints
 * @returns Array of all thesis records
 */
export async function getAllTheses(constraints?: QueryConstraint[]): Promise<ThesisRecord[]> {
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(thesisQuery, ...constraints)
        : query(thesisQuery, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const data = docToThesisData(docSnap);
        if (!data) return null;
        return {
            ...data,
            id: docSnap.id,
        } as ThesisRecord;
    }).filter((t): t is ThesisRecord => t !== null);
}

/**
 * Update a thesis document
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @param data - Partial thesis data to update
 */
export async function updateThesis(
    ctx: ThesisContext,
    thesisId: string,
    data: Partial<ThesisData>
): Promise<void> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = cleanData({
        ...data,
        updatedAt: serverTimestamp(),
    }, 'update');

    await updateDoc(docRef, cleanedData);
}

/**
 * Set a thesis document with merge (upsert)
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @param data - Partial thesis data to set
 */
export async function setThesis(
    ctx: ThesisContext,
    thesisId: string,
    data: Partial<ThesisData>
): Promise<void> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = cleanData({
        ...data,
        updatedAt: serverTimestamp(),
    }, 'update');

    await setDoc(docRef, cleanedData, { merge: true });
}

/**
 * Delete a thesis document
 * Note: Subcollections (stages, chapters, etc.) must be deleted separately
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 */
export async function deleteThesis(ctx: ThesisContext, thesisId: string): Promise<void> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Generate next thesis ID for a group using the pattern {groupId}-T{n}
 * @param ctx - Thesis context containing path information
 * @returns Next thesis ID
 */
export async function generateNextThesisIdForGroup(ctx: ThesisContext): Promise<string> {
    const theses = await getThesesForGroup(ctx);
    const pattern = new RegExp(`^${ctx.groupId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}-T(\\d+)$`);

    let maxN = 0;
    theses.forEach((thesis) => {
        const match = thesis.id.match(pattern);
        if (match?.[1]) {
            const n = Number(match[1]);
            if (!Number.isNaN(n) && n > maxN) maxN = n;
        }
    });

    return `${ctx.groupId}-T${maxN + 1}`;
}

/**
 * Create a new thesis for a group with auto-generated ID
 * @param ctx - Thesis context containing path information
 * @param data - Thesis data (without id)
 * @returns Created thesis ID
 */
export async function createThesisForGroup(ctx: ThesisContext, data: Omit<ThesisData, 'id'>): Promise<string> {
    const thesisId = await generateNextThesisIdForGroup(ctx);
    await createThesisWithId(ctx, thesisId, data);
    return thesisId;
}

// ============================================================================
// Progress Utilities
// ============================================================================

/**
 * Calculate thesis progress based on approved chapters
 * @param ctx - Thesis context containing path information
 * @param thesisId - Thesis document ID
 * @returns Progress percentage (0-100)
 */
export async function calculateThesisProgress(ctx: ThesisContext, thesisId: string): Promise<number> {
    const thesis = await getThesisById(ctx, thesisId);
    if (!thesis?.stages || thesis.stages.length === 0) return 0;

    let totalChapters = 0;
    let approvedChapters = 0;

    for (const stage of thesis.stages) {
        if (stage.chapters) {
            totalChapters += stage.chapters.length;
            approvedChapters += stage.chapters.filter((ch) => ch.status === 'approved').length;
        }
    }

    return totalChapters > 0 ? (approvedChapters / totalChapters) * 100 : 0;
}

/**
 * Compute thesis progress ratio (0-1)
 * @param thesis - Thesis data
 * @returns Progress ratio (0-1)
 */
export function computeThesisProgressRatio(thesis: ThesisData): number {
    if (!thesis.stages || thesis.stages.length === 0) return 0;

    let totalChapters = 0;
    let approvedChapters = 0;

    for (const stage of thesis.stages) {
        if (stage.chapters) {
            totalChapters += stage.chapters.length;
            approvedChapters += stage.chapters.filter((ch) => ch.status === 'approved').length;
        }
    }

    return totalChapters > 0 ? approvedChapters / totalChapters : 0;
}

// ============================================================================
// Team Member Utilities
// ============================================================================

/**
 * Get all thesis team members with their profiles
 * @param ctx - Thesis context containing path information
 * @returns Array of user profiles with their thesis roles
 */
export async function getThesisTeamMembers(
    ctx: ThesisContext
): Promise<(UserProfile & { thesisRole: string })[]> {
    const group = await getGroup(ctx.year, ctx.department, ctx.course, ctx.groupId);
    if (!group?.members) return [];

    const memberRoles: { uid: string; role: string }[] = [];

    if (group.members.leader) {
        memberRoles.push({ uid: group.members.leader, role: 'Leader' });
    }
    group.members.members?.forEach((memberUid: string) => {
        if (memberUid) {
            memberRoles.push({ uid: memberUid, role: 'Member' });
        }
    });
    if (group.members.adviser) {
        memberRoles.push({ uid: group.members.adviser, role: 'Adviser' });
    }
    if (group.members.editor) {
        memberRoles.push({ uid: group.members.editor, role: 'Editor' });
    }
    if (group.members.statistician) {
        memberRoles.push({ uid: group.members.statistician, role: 'Statistician' });
    }

    if (memberRoles.length === 0) return [];

    const profiles = await findUsersByIds(memberRoles.map((m) => m.uid));
    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((profile) => profileMap.set(profile.uid, profile));

    const remaining = memberRoles.filter((m) => !profileMap.has(m.uid)).map((m) => m.uid);
    if (remaining.length > 0) {
        const fallback = await Promise.all(remaining.map((uid) => findUserById(uid)));
        fallback.forEach((profile) => {
            if (profile) profileMap.set(profile.uid, profile);
        });
    }

    return memberRoles
        .map((m) => {
            const profile = profileMap.get(m.uid);
            return profile ? { ...profile, thesisRole: m.role } : null;
        })
        .filter((entry): entry is UserProfile & { thesisRole: string } => Boolean(entry));
}

/**
 * Get thesis team members by thesis ID (context-free version).
 * Uses collectionGroup to find the thesis and its group context.
 *
 * @param thesisId - Thesis document ID
 * @returns Array of user profiles with their thesis roles
 */
export async function getThesisTeamMembersById(
    thesisId: string
): Promise<(UserProfile & { thesisRole: string })[]> {
    // Find thesis to get context
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const tSnap = await getDocs(thesisQuery);

    for (const docSnap of tSnap.docs) {
        if (docSnap.id === thesisId) {
            const params = extractPathParams(docSnap.ref.path);
            if (params.year && params.department && params.course && params.groupId) {
                return getThesisTeamMembers({
                    year: params.year,
                    department: params.department,
                    course: params.course,
                    groupId: params.groupId,
                });
            }
        }
    }

    return [];
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to theses for a specific group
 * @param ctx - Thesis context containing path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesesForGroup(
    ctx: ThesisContext,
    options: ThesisListenerOptions
): () => void {
    const collectionPath = buildThesisCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId);
    const thesisRef = collection(firebaseFirestore, collectionPath);
    const q = query(thesisRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const theses = snapshot.docs.map((docSnap) => {
                const data = docToThesisData(docSnap);
                return data ? { ...data, id: docSnap.id } as ThesisRecord : null;
            }).filter((t): t is ThesisRecord => t !== null);
            options.onData(theses);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis listener error:', error);
        }
    );
}

/**
 * Listen to all theses across all groups (collectionGroup)
 * @param constraints - Optional query constraints
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenAllTheses(
    constraints: QueryConstraint[] | undefined,
    options: ThesisListenerOptions
): () => void {
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(thesisQuery, ...constraints)
        : thesisQuery;

    return onSnapshot(
        q,
        (snapshot) => {
            const theses = snapshot.docs.map((docSnap) => {
                const data = docToThesisData(docSnap);
                return data ? { ...data, id: docSnap.id } as ThesisRecord : null;
            }).filter((t): t is ThesisRecord => t !== null);
            options.onData(theses);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis listener error:', error);
        }
    );
}

/**
 * Listen to all theses across all years/departments/courses.
 * Alias for listenAllTheses with simplified interface.
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenTheses(
    options: ThesisListenerOptions
): () => void {
    return listenAllTheses(undefined, options);
}

/**
 * Listen to theses where the user is a participant (leader or member).
 * 
 * Note: This listener avoids async operations inside onSnapshot to prevent
 * Firestore internal assertion errors. Instead, it filters groups synchronously
 * and fetches thesis data in a separate async operation that's debounced.
 * 
 * @param userId - User ID to filter by
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesesForParticipant(
    userId: string,
    options: ThesisListenerOptions
): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

    let fetchInProgress = false;
    let pendingGroupIds: { groupId: string; params: ReturnType<typeof extractPathParams> }[] = [];

    const fetchTheses = async (groups: typeof pendingGroupIds) => {
        if (fetchInProgress) return;
        fetchInProgress = true;

        try {
            const theses: ThesisRecord[] = [];

            for (const { groupId, params } of groups) {
                const thesisColPath = buildThesisCollectionPath(
                    params.year || DEFAULT_YEAR,
                    params.department || '',
                    params.course || '',
                    groupId
                );
                const thesisRef = collection(firebaseFirestore, thesisColPath);
                const thesisSnap = await getDocs(query(thesisRef, orderBy('createdAt', 'desc')));

                for (const thesisDoc of thesisSnap.docs) {
                    const thesisData = docToThesisData(thesisDoc);
                    if (thesisData) {
                        theses.push({ ...thesisData, id: thesisDoc.id });
                    }
                }
            }

            options.onData(theses);
        } catch (error) {
            if (options.onError) options.onError(error as Error);
            else console.error('Thesis participant fetch error:', error);
        } finally {
            fetchInProgress = false;
        }
    };

    return onSnapshot(
        groupsQuery,
        (snapshot) => {
            // Synchronously filter groups - no async operations here
            pendingGroupIds = [];

            for (const groupDoc of snapshot.docs) {
                const groupData = groupDoc.data();
                const isParticipant =
                    groupData.members?.leader === userId ||
                    (groupData.members?.members || []).includes(userId);

                if (isParticipant) {
                    pendingGroupIds.push({
                        groupId: groupDoc.id,
                        params: extractPathParams(groupDoc.ref.path),
                    });
                }
            }

            // Trigger async fetch outside the snapshot callback
            // Using setTimeout to ensure we're outside the snapshot handler
            setTimeout(() => fetchTheses(pendingGroupIds), 0);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis participant listener error:', error);
        }
    );
}

/**
 * Listen to theses where the user is a expert (adviser, editor, statistician, or panel).
 * 
 * Note: This listener avoids async operations inside onSnapshot to prevent
 * Firestore internal assertion errors. Instead, it filters groups synchronously
 * and fetches thesis data in a separate async operation.
 * 
 * @param userId - User ID to filter by
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesesForExpert(
    userId: string,
    options: ThesisListenerOptions
): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

    let fetchInProgress = false;
    let pendingGroupIds: { groupId: string; params: ReturnType<typeof extractPathParams> }[] = [];

    const fetchTheses = async (groups: typeof pendingGroupIds) => {
        if (fetchInProgress) return;
        fetchInProgress = true;

        try {
            const theses: ThesisRecord[] = [];

            for (const { groupId, params } of groups) {
                const thesisColPath = buildThesisCollectionPath(
                    params.year || DEFAULT_YEAR,
                    params.department || '',
                    params.course || '',
                    groupId
                );
                const thesisRef = collection(firebaseFirestore, thesisColPath);
                const thesisSnap = await getDocs(query(thesisRef, orderBy('createdAt', 'desc')));

                for (const thesisDoc of thesisSnap.docs) {
                    const thesisData = docToThesisData(thesisDoc);
                    if (thesisData) {
                        theses.push({ ...thesisData, id: thesisDoc.id });
                    }
                }
            }

            options.onData(theses);
        } catch (error) {
            if (options.onError) options.onError(error as Error);
            else console.error('Thesis expert fetch error:', error);
        } finally {
            fetchInProgress = false;
        }
    };

    return onSnapshot(
        groupsQuery,
        (snapshot) => {
            // Synchronously filter groups - no async operations here
            pendingGroupIds = [];

            for (const groupDoc of snapshot.docs) {
                const groupData = groupDoc.data();
                const isExpert =
                    groupData.members?.adviser === userId ||
                    groupData.members?.editor === userId ||
                    groupData.members?.statistician === userId ||
                    (groupData.members?.panels || []).includes(userId);

                if (isExpert) {
                    pendingGroupIds.push({
                        groupId: groupDoc.id,
                        params: extractPathParams(groupDoc.ref.path),
                    });
                }
            }

            // Trigger async fetch outside the snapshot callback
            setTimeout(() => fetchTheses(pendingGroupIds), 0);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis expert listener error:', error);
        }
    );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Delete multiple theses in a batch
 * @param theses - Array of thesis contexts and IDs to delete
 */
export async function bulkDeleteTheses(
    theses: { ctx: ThesisContext; thesisId: string }[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const { ctx, thesisId } of theses) {
        const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

// ============================================================================
// Context-Free Lookups (via collectionGroup)
// ============================================================================

/**
 * Find a thesis by ID across all groups (searches via collectionGroup).
 * Use when you don't have the full context path.
 * @param thesisId - Thesis document ID
 * @returns Thesis data with embedded context, or null if not found
 */
export async function findThesisById(thesisId: string): Promise<ThesisWithGroupContext | null> {
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);

    // First try to find by 'id' field
    const qById = query(thesisQuery, where('id', '==', thesisId));
    const snapshotById = await getDocs(qById);
    if (!snapshotById.empty) {
        const docSnap = snapshotById.docs[0];
        const data = docToThesisData(docSnap);
        if (!data) return null;
        const params = extractPathParams(docSnap.ref.path);

        // Fetch group to get member information
        let groupMembers: Pick<ThesisWithGroupContext, 'leader' | 'members' | 'adviser' | 'editor' | 'statistician' | 'panels'> = {};
        if (params.year && params.department && params.course && params.groupId) {
            try {
                const group = await getGroup(params.year, params.department, params.course, params.groupId);
                if (group) {
                    groupMembers = {
                        leader: group.members.leader,
                        members: group.members.members,
                        adviser: group.members.adviser,
                        editor: group.members.editor,
                        statistician: group.members.statistician,
                        panels: group.members.panels,
                    };
                }
            } catch (err) {
                console.warn(`Failed to fetch group ${params.groupId} for thesis ${thesisId}:`, err);
            }
        }

        return {
            ...data,
            groupId: params.groupId,
            year: params.year,
            department: params.department,
            course: params.course,
            ...groupMembers,
        };
    }

    // Fall back to fetching all and filtering by document ID
    console.warn(`Thesis with id '${thesisId}' not found via 'id' field. Falling back to document ID search.`);
    const allSnapshot = await getDocs(thesisQuery);
    const matchingDoc = allSnapshot.docs.find((docSnap) => docSnap.id === thesisId);
    if (!matchingDoc) return null;

    const data = docToThesisData(matchingDoc);
    if (!data) return null;
    const params = extractPathParams(matchingDoc.ref.path);

    // Fetch group to get member information
    let groupMembers: Pick<ThesisWithGroupContext, 'leader' | 'members' | 'adviser' | 'editor' | 'statistician' | 'panels'> = {};
    if (params.year && params.department && params.course && params.groupId) {
        try {
            const group = await getGroup(params.year, params.department, params.course, params.groupId);
            if (group) {
                groupMembers = {
                    leader: group.members.leader,
                    members: group.members.members,
                    adviser: group.members.adviser,
                    editor: group.members.editor,
                    statistician: group.members.statistician,
                    panels: group.members.panels,
                };
            }
        } catch (err) {
            console.warn(`Failed to fetch group ${params.groupId} for thesis ${thesisId}:`, err);
        }
    }

    return {
        ...data,
        groupId: params.groupId,
        year: params.year,
        department: params.department,
        course: params.course,
        ...groupMembers,
    };
}

/**
 * Delete a thesis by ID (context-free version).
 * Finds the thesis first to determine context.
 * @param thesisId - Thesis document ID
 */
export async function deleteThesisById(thesisId: string): Promise<void> {
    const thesis = await findThesisById(thesisId);
    if (!thesis) throw new Error('Thesis not found');
    if (!thesis.year || !thesis.department || !thesis.course || !thesis.groupId) {
        throw new Error('Cannot determine thesis context');
    }

    await deleteThesis({
        year: thesis.year,
        department: thesis.department,
        course: thesis.course,
        groupId: thesis.groupId,
    }, thesisId);
}

/**
 * Bulk delete theses by IDs (context-free version).
 * Finds each thesis to determine context before deleting.
 * @param thesisIds - Array of thesis document IDs
 */
export async function bulkDeleteThesesByIds(thesisIds: string[]): Promise<void> {
    const thesesWithContext = await Promise.all(
        thesisIds.map(async (id) => {
            const thesis = await findThesisById(id);
            return thesis ? { id, thesis } : null;
        })
    );

    const validTheses = thesesWithContext.filter(
        (t): t is { id: string; thesis: ThesisWithGroupContext } =>
            t !== null &&
            !!t.thesis.year &&
            !!t.thesis.department &&
            !!t.thesis.course &&
            !!t.thesis.groupId
    );

    if (validTheses.length === 0) return;

    await bulkDeleteTheses(
        validTheses.map(({ id, thesis }) => ({
            ctx: {
                year: thesis.year!,
                department: thesis.department!,
                course: thesis.course!,
                groupId: thesis.groupId!,
            },
            thesisId: id,
        }))
    );
}

/**
 * Create a thesis for a group by group ID (context-free version).
 * Finds group context first.
 * @param groupId - Group document ID
 * @param data - Thesis data
 * @returns Created thesis ID
 */
export async function createThesisForGroupById(
    groupId: string,
    data: Omit<ThesisData, 'id'>
): Promise<string> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const snapshot = await getDocs(groupsQuery);
    const groupDoc = snapshot.docs.find((d) => d.id === groupId);

    if (!groupDoc) throw new Error('Group not found');

    const pathParams = extractPathParams(groupDoc.ref.path);
    if (!pathParams.year || !pathParams.department || !pathParams.course) {
        throw new Error('Cannot determine group context');
    }

    const ctx: ThesisContext = {
        year: pathParams.year,
        department: pathParams.department,
        course: pathParams.course,
        groupId,
    };

    return createThesisForGroup(ctx, data);
}

/**
 * Set thesis data by ID (context-free version).
 * Finds thesis context first.
 * @param thesisId - Thesis document ID
 * @param data - Thesis data to set
 */
export async function setThesisById(
    thesisId: string,
    data: Partial<ThesisData>
): Promise<void> {
    const thesis = await findThesisById(thesisId);
    if (!thesis) throw new Error('Thesis not found');
    if (!thesis.year || !thesis.department || !thesis.course || !thesis.groupId) {
        throw new Error('Cannot determine thesis context');
    }

    await setThesis(
        {
            year: thesis.year,
            department: thesis.department,
            course: thesis.course,
            groupId: thesis.groupId,
        },
        thesisId,
        data
    );
}

/**
 * Find the latest thesis for a group by group ID (searches via collectionGroup).
 * Use when you don't have the full context path.
 * @param groupId - Group document ID
 * @returns Thesis data with embedded context, or null if not found
 */
export async function findThesisByGroupId(
    groupId: string
): Promise<ThesisWithGroupContext | null> {
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const tSnap = await getDocs(query(thesisQuery, orderBy('createdAt', 'desc')));

    for (const docSnap of tSnap.docs) {
        const params = extractPathParams(docSnap.ref.path);
        if (params.groupId === groupId) {
            const data = docToThesisData(docSnap);
            if (data) {
                // Fetch group to get member information
                let groupMembers: Pick<ThesisWithGroupContext, 'leader' | 'members' | 'adviser' | 'editor' | 'statistician' | 'panels'> = {};
                if (params.year && params.department && params.course && params.groupId) {
                    try {
                        const group = await getGroup(params.year, params.department, params.course, params.groupId);
                        if (group) {
                            groupMembers = {
                                leader: group.members.leader,
                                members: group.members.members,
                                adviser: group.members.adviser,
                                editor: group.members.editor,
                                statistician: group.members.statistician,
                                panels: group.members.panels,
                            };
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch group ${params.groupId} for thesis:`, err);
                    }
                }

                return {
                    ...data,
                    groupId: params.groupId,
                    year: params.year,
                    department: params.department,
                    course: params.course,
                    ...groupMembers,
                };
            }
        }
    }

    return null;
}

/**
 * Get reviewer assignments for a user by role (adviser, editor, or statistician).
 * Uses collectionGroup queries to find all groups where the user has that role.
 * @param role - 'adviser' | 'editor' | 'statistician'
 * @param userId - Firebase user UID
 * @returns Array of reviewer assignments with embedded context
 */
export async function getReviewerAssignmentsForUser(
    role: ReviewerRole,
    userId: string
): Promise<ReviewerAssignment[]> {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);
    const q = query(groupsQuery, where(`members.${role}`, '==', userId));
    const groupSnapshot = await getDocs(q);

    const assignments: ReviewerAssignment[] = [];

    for (const groupDoc of groupSnapshot.docs) {
        const params = extractPathParams(groupDoc.ref.path);
        const groupData = groupDoc.data();
        const groupId = groupDoc.id;

        const thesisColPath = buildThesisCollectionPath(
            params.year || DEFAULT_YEAR,
            params.department || '',
            params.course || '',
            groupId
        );
        const thesisRef = collection(firebaseFirestore, thesisColPath);
        const thesisSnap = await getDocs(query(thesisRef, orderBy('createdAt', 'desc')));

        if (thesisSnap.empty) continue;

        const thesisDoc = thesisSnap.docs[0];
        const thesisData = docToThesisData(thesisDoc);
        if (!thesisData) continue;

        const studentEmails: string[] = [];

        const progress = thesisData.stages?.length
            ? Math.round((thesisData.stages.filter((s) =>
                s.completedAt !== undefined).length
                / thesisData.stages.length) * 100)
            : 0;

        const currentStage = thesisData.stages?.find((s) => !s.completedAt)
            || thesisData.stages?.[thesisData.stages.length - 1];

        assignments.push({
            id: thesisDoc.id,
            thesisId: thesisDoc.id,
            thesisTitle: thesisData.title || groupData.name || groupId,
            role,
            stage: currentStage?.name || 'Pre-Proposal',
            progress,
            assignedTo: [userId],
            priority: determinePriority(
                progress / 100,
                thesisData.lastUpdated ? new Date(thesisData.lastUpdated) : undefined
            ),
            lastUpdated: thesisData.lastUpdated?.toString() || new Date().toISOString(),
            studentEmails,
        });
    }

    return assignments;
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to a single thesis document for real-time updates
 */
export function listenThesisDocument(
    ctx: ThesisDocumentContext,
    options: ThesisDocumentListenerOptions,
): () => void {
    const { year, department, course, groupId, thesisId } = ctx;
    if (!thesisId) {
        options.onData(null);
        return () => { /* no-op */ };
    }

    const docPath = buildThesisDocPath(year, department, course, groupId, thesisId);
    const ref = doc(firebaseFirestore, docPath);

    return onSnapshot(
        ref,
        (snapshot) => {
            const thesisData = docToThesisData(snapshot);
            options.onData(thesisData);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('Thesis document listener error:', error);
            }
        },
    );
}

/**
 * Listen to thesis records for a specific group (context-free version).
 * Uses collectionGroup to find thesis documents for the given group ID.
 *
 * @param groupId - Group document ID
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesisByGroupId(
    groupId: string,
    options: ThesisListenerOptions
): () => void {
    if (!groupId) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);

    return onSnapshot(
        thesisQuery,
        (snapshot) => {
            const records: ThesisRecord[] = [];
            for (const docSnap of snapshot.docs) {
                const params = extractPathParams(docSnap.ref.path);
                if (params.groupId === groupId) {
                    const data = docToThesisData(docSnap);
                    if (data) {
                        records.push({ ...data, id: docSnap.id });
                    }
                }
            }
            // Sort by lastUpdated descending
            records.sort((a, b) => {
                const aDate = a.lastUpdated?.toString() ?? '';
                const bDate = b.lastUpdated?.toString() ?? '';
                return bDate.localeCompare(aDate);
            });
            options.onData(records);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis by group listener error:', error);
        }
    );
}
