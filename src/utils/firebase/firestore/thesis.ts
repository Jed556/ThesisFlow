/**
 * Firebase Firestore - Thesis
 * CRUD operations for Thesis documents using hierarchical structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{groupId}/thesis/{thesisId}
 *   └── stages/{stage}/chapters/{chapterId}
 *       └── submissions/{submissionId}/chats/{chatId}
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
    where,
    orderBy,
    serverTimestamp,
    writeBatch,
    onSnapshot,
    type QueryConstraint,
    type DocumentReference,
    type DocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { cleanData } from './firestore';
import { getUserById, getUsersByIds } from './user';
import { getGroup } from './groups';
import type { ThesisData, ThesisChapter, ChapterSubmission, ThesisComment, ThesisStageName } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import type { ThesisGroupMembers } from '../../../types/group';
import {
    buildThesisCollectionPath,
    buildThesisDocPath,
    buildStagesCollectionPath,
    buildStageDocPath,
    buildChaptersCollectionPath,
    buildChapterDocPath,
    buildSubmissionsCollectionPath,
    buildSubmissionDocPath,
    buildChatsCollectionPath,
    buildChatDocPath,
    THESIS_SUBCOLLECTION,
    CHAPTERS_SUBCOLLECTION,
    SUBMISSIONS_SUBCOLLECTION,
    CHATS_SUBCOLLECTION,
    GROUPS_SUBCOLLECTION,
    extractPathParams,
    DEFAULT_YEAR,
    THESIS_STAGE_SLUGS,
    type ThesisStageSlug,
} from '../../../config/firestore';

// ============================================================================
// Types
// ============================================================================

export type ThesisRecord = ThesisData & { id: string };

export interface ThesisContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
}

export interface ChapterContext extends ThesisContext {
    thesisId: string;
    stage: string;
}

export interface SubmissionContext extends ChapterContext {
    chapterId: string;
}

export interface ChatContext extends SubmissionContext {
    submissionId: string;
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
        proposals: data.proposals,
    } as ThesisData;
}

/**
 * Get stage slug from stage name
 */
export function getStageSlug(stageName: ThesisStageName): ThesisStageSlug {
    return THESIS_STAGE_SLUGS[stageName] || 'pre-proposal';
}

// ============================================================================
// Thesis CRUD Operations
// ============================================================================

/**
 * Create a new thesis document
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, 'create');

    await setDoc(newDocRef, cleanedData);
    return newDocRef.id;
}

/**
 * Create a thesis with a specific ID
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, 'create');

    await setDoc(docRef, cleanedData);
}

/**
 * Get a thesis by ID
 */
export async function getThesisById(ctx: ThesisContext, thesisId: string): Promise<ThesisData | null> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToThesisData(docSnap);
}

/**
 * Get thesis document reference
 */
export function getThesisDocRef(ctx: ThesisContext, thesisId: string): DocumentReference {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    return doc(firebaseFirestore, docPath);
}

/**
 * Get all theses for a group
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
 */
export async function getLatestThesisForGroup(ctx: ThesisContext): Promise<ThesisData | null> {
    const theses = await getThesesForGroup(ctx);
    if (theses.length === 0) return null;

    // Return the most recent by sequence number or lastUpdated
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
 * Delete a thesis document
 * Note: Subcollections (stages, chapters, etc.) must be deleted separately
 */
export async function deleteThesis(ctx: ThesisContext, thesisId: string): Promise<void> {
    const docPath = buildThesisDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Generate next thesis ID for a group using the pattern {groupId}-T{n}
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
 */
export async function createThesisForGroup(ctx: ThesisContext, data: Omit<ThesisData, 'id'>): Promise<string> {
    const thesisId = await generateNextThesisIdForGroup(ctx);
    await createThesisWithId(ctx, thesisId, data);
    return thesisId;
}

// ============================================================================
// Stage CRUD Operations
// ============================================================================

/**
 * Create a stage document under a thesis
 */
export async function createStage(
    ctx: ThesisContext,
    thesisId: string,
    stageName: ThesisStageName,
    data: Record<string, unknown>
): Promise<string> {
    const stageSlug = getStageSlug(stageName);
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId, stageSlug);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        name: stageName,
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return stageSlug;
}

/**
 * Get a stage document
 */
export async function getStage(
    ctx: ThesisContext,
    thesisId: string,
    stage: string
): Promise<Record<string, unknown> | null> {
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId, stage);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/**
 * Get all stages for a thesis
 */
export async function getStagesForThesis(
    ctx: ThesisContext,
    thesisId: string
): Promise<Record<string, unknown>[]> {
    const collectionPath = buildStagesCollectionPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId);
    const stagesRef = collection(firebaseFirestore, collectionPath);
    const snapshot = await getDocs(stagesRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

/**
 * Update a stage document
 */
export async function updateStage(
    ctx: ThesisContext,
    thesisId: string,
    stage: string,
    data: Record<string, unknown>
): Promise<void> {
    const docPath = buildStageDocPath(ctx.year, ctx.department, ctx.course, ctx.groupId, thesisId, stage);
    const docRef = doc(firebaseFirestore, docPath);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// ============================================================================
// Chapter CRUD Operations
// ============================================================================

/**
 * Create a chapter document under a stage
 */
export async function createChapter(
    ctx: ChapterContext,
    chapterData: Omit<ThesisChapter, 'id'>
): Promise<string> {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(chaptersRef);

    await setDoc(newDocRef, {
        ...chapterData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Create a chapter with a specific ID
 */
export async function createChapterWithId(
    ctx: ChapterContext,
    chapterId: string,
    chapterData: Omit<ThesisChapter, 'id'>
): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, {
        ...chapterData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Get a chapter document
 */
export async function getChapter(ctx: ChapterContext, chapterId: string): Promise<ThesisChapter | null> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: Number(docSnap.id), ...docSnap.data() } as unknown as ThesisChapter;
}

/**
 * Get all chapters for a stage
 */
export async function getChaptersForStage(ctx: ChapterContext): Promise<ThesisChapter[]> {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const q = query(chaptersRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: Number(docSnap.id) || 0,
        ...docSnap.data(),
    } as unknown as ThesisChapter));
}

/**
 * Get all chapters across all stages using collectionGroup
 */
export async function getAllChapters(constraints?: QueryConstraint[]): Promise<ThesisChapter[]> {
    const chaptersQuery = collectionGroup(firebaseFirestore, CHAPTERS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(chaptersQuery, ...constraints)
        : chaptersQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: Number(docSnap.id) || 0,
        ...docSnap.data(),
    } as unknown as ThesisChapter));
}

/**
 * Update a chapter document
 */
export async function updateChapter(
    ctx: ChapterContext,
    chapterId: string,
    data: Partial<ThesisChapter>
): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a chapter document
 */
export async function deleteChapter(ctx: ChapterContext, chapterId: string): Promise<void> {
    const docPath = buildChapterDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Submission CRUD Operations
// ============================================================================

/**
 * Create a submission document under a chapter
 */
export async function createSubmission(
    ctx: SubmissionContext,
    submissionData: Omit<ChapterSubmission, 'id'>
): Promise<string> {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(submissionsRef);

    await setDoc(newDocRef, {
        ...submissionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Get a submission document
 */
export async function getSubmission(ctx: SubmissionContext, submissionId: string): Promise<ChapterSubmission | null> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ChapterSubmission;
}

/**
 * Get all submissions for a chapter
 */
export async function getSubmissionsForChapter(ctx: SubmissionContext): Promise<ChapterSubmission[]> {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
    const submissionsRef = collection(firebaseFirestore, collectionPath);
    const q = query(submissionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ChapterSubmission));
}

/**
 * Get all submissions across all chapters using collectionGroup
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
 */
export async function updateSubmission(
    ctx: SubmissionContext,
    submissionId: string,
    data: Partial<ChapterSubmission>
): Promise<void> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a submission document
 */
export async function deleteSubmission(ctx: SubmissionContext, submissionId: string): Promise<void> {
    const docPath = buildSubmissionDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, submissionId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Chat CRUD Operations
// ============================================================================

/**
 * Create a chat message under a submission
 */
export async function createChat(ctx: ChatContext, chatData: Omit<ThesisComment, 'id'>): Promise<string> {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(chatsRef);

    await setDoc(newDocRef, {
        ...chatData,
        createdAt: serverTimestamp(),
    });

    return newDocRef.id;
}

/**
 * Get a chat message
 */
export async function getChat(ctx: ChatContext, chatId: string): Promise<ThesisComment | null> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ThesisComment;
}

/**
 * Get all chats for a submission
 */
export async function getChatsForSubmission(ctx: ChatContext): Promise<ThesisComment[]> {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const q = query(chatsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ThesisComment));
}

/**
 * Get all chats across all submissions using collectionGroup
 */
export async function getAllChats(constraints?: QueryConstraint[]): Promise<ThesisComment[]> {
    const chatsQuery = collectionGroup(firebaseFirestore, CHATS_SUBCOLLECTION);
    const q = constraints?.length
        ? query(chatsQuery, ...constraints)
        : chatsQuery;

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    } as ThesisComment));
}

/**
 * Update a chat message
 */
export async function updateChat(ctx: ChatContext, chatId: string, data: Partial<ThesisComment>): Promise<void> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        isEdited: true,
    });
}

/**
 * Delete a chat message
 */
export async function deleteChat(ctx: ChatContext, chatId: string): Promise<void> {
    const docPath = buildChatDocPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId, chatId
    );
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Progress Utilities
// ============================================================================

/**
 * Calculate thesis progress based on approved chapters
 */
export async function calculateThesisProgress(ctx: ThesisContext, thesisId: string): Promise<number> {
    const thesis = await getThesisById(ctx, thesisId);
    if (!thesis?.stages || thesis.stages.length === 0) return 0;

    // Get all chapters across all stages
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

    const profiles = await getUsersByIds(memberRoles.map((m) => m.uid));
    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((profile) => profileMap.set(profile.uid, profile));

    const remaining = memberRoles.filter((m) => !profileMap.has(m.uid)).map((m) => m.uid);
    if (remaining.length > 0) {
        const fallback = await Promise.all(remaining.map((uid) => getUserById(uid)));
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

// ============================================================================
// Reviewer Assignment Utilities
// ============================================================================

function determinePriority(progressRatio: number, lastUpdated?: Date): ReviewerAssignment['priority'] {
    if (progressRatio <= 0.4) return 'high';
    if (progressRatio <= 0.75) return 'medium';

    if (lastUpdated) {
        const diffDays = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 21) return 'medium';
    }

    return 'low';
}

/**
 * Build reviewer assignments from theses
 * @internal Reserved for future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function buildReviewerAssignments(
    theses: ThesisRecord[],
    role: ReviewerRole,
    profileCache: Map<string, UserProfile>,
    groupCache: Map<string, ThesisGroupMembers>,
    contexts: Map<string, ThesisContext>
): Promise<ReviewerAssignment[]> {
    // Hydrate groups
    for (const thesis of theses) {
        const ctx = contexts.get(thesis.id);
        if (ctx && !groupCache.has(ctx.groupId)) {
            try {
                const group = await getGroup(ctx.year, ctx.department, ctx.course, ctx.groupId);
                if (group) groupCache.set(ctx.groupId, group.members);
            } catch (error) {
                console.error(`Failed to fetch group ${ctx.groupId}:`, error);
            }
        }
    }

    // Collect user IDs
    const userIds = new Set<string>();
    theses.forEach((thesis) => {
        const ctx = contexts.get(thesis.id);
        if (!ctx) return;
        const members = groupCache.get(ctx.groupId);
        if (!members) return;

        if (members.leader) userIds.add(members.leader);
        members.members?.forEach((uid) => uid && userIds.add(uid));
        if (members.adviser) userIds.add(members.adviser);
        if (members.editor) userIds.add(members.editor);
        if (members.statistician) userIds.add(members.statistician);
    });

    // Hydrate profiles
    const missingIds = Array.from(userIds).filter((uid) => !profileCache.has(uid));
    if (missingIds.length > 0) {
        const profiles = await getUsersByIds(missingIds);
        profiles.forEach((p) => profileCache.set(p.uid, p));

        const stillMissing = missingIds.filter((uid) => !profileCache.has(uid));
        const fallback = await Promise.all(stillMissing.map((uid) => getUserById(uid)));
        fallback.forEach((p) => p && profileCache.set(p.uid, p));
    }

    return theses.map((thesis) => {
        const ctx = contexts.get(thesis.id);
        const members = ctx ? groupCache.get(ctx.groupId) : undefined;

        const leaderUid = members?.leader ?? '';
        const memberUids = members?.members ?? [];
        const adviserUid = members?.adviser ?? '';
        const editorUid = members?.editor ?? '';
        const statisticianUid = members?.statistician ?? '';

        const progressRatio = computeThesisProgressRatio(thesis);
        const studentEmails = [leaderUid, ...memberUids]
            .map((uid) => (uid ? profileCache.get(uid)?.email : undefined))
            .filter((email): email is string => Boolean(email));

        let assignedUid = '';
        if (role === 'adviser') assignedUid = adviserUid;
        else if (role === 'editor') assignedUid = editorUid;
        else assignedUid = statisticianUid;

        const mentorUids = [adviserUid, editorUid, statisticianUid].filter(Boolean);
        const assignedEmail = assignedUid ? profileCache.get(assignedUid)?.email : undefined;
        const peerEmails = mentorUids
            .filter((uid) => uid !== assignedUid)
            .map((uid) => profileCache.get(uid)?.email)
            .filter((email): email is string => Boolean(email));

        const assignedTo = Array.from(new Set([assignedEmail, ...peerEmails].filter(Boolean))) as string[];

        const lastUpdatedDate = thesis.lastUpdated instanceof Date ? thesis.lastUpdated : new Date(thesis.lastUpdated);

        return {
            id: thesis.id,
            thesisId: thesis.id,
            thesisTitle: thesis.title,
            role,
            stage: 'In Progress',
            progress: progressRatio,
            dueDate: undefined,
            assignedTo,
            priority: determinePriority(progressRatio, lastUpdatedDate),
            lastUpdated: normalizeTimestamp(thesis.lastUpdated ?? thesis.submissionDate, true),
            studentEmails,
        } satisfies ReviewerAssignment;
    });
}

// ============================================================================
// Real-time Listeners
// ============================================================================

export interface ThesisListenerOptions {
    onData: (theses: ThesisRecord[]) => void;
    onError?: (error: Error) => void;
}

export interface ReviewerAssignmentsListenerOptions {
    onData: (assignments: ReviewerAssignment[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to theses for a specific group
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
 * Listen to chapters for a specific stage
 */
export function listenChaptersForStage(
    ctx: ChapterContext,
    options: { onData: (chapters: ThesisChapter[]) => void; onError?: (error: Error) => void }
): () => void {
    const collectionPath = buildChaptersCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage
    );
    const chaptersRef = collection(firebaseFirestore, collectionPath);
    const q = query(chaptersRef, orderBy('id', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const chapters = snapshot.docs.map((docSnap) => ({
                id: Number(docSnap.id) || 0,
                ...docSnap.data(),
            } as unknown as ThesisChapter));
            options.onData(chapters);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Chapter listener error:', error);
        }
    );
}

/**
 * Listen to submissions for a specific chapter
 */
export function listenSubmissionsForChapter(
    ctx: SubmissionContext,
    options: { onData: (submissions: ChapterSubmission[]) => void; onError?: (error: Error) => void }
): () => void {
    const collectionPath = buildSubmissionsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId
    );
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

/**
 * Listen to chats for a specific submission
 */
export function listenChatsForSubmission(
    ctx: ChatContext,
    options: { onData: (chats: ThesisComment[]) => void; onError?: (error: Error) => void }
): () => void {
    const collectionPath = buildChatsCollectionPath(
        ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, ctx.chapterId, ctx.submissionId
    );
    const chatsRef = collection(firebaseFirestore, collectionPath);
    const q = query(chatsRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const chats = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as ThesisComment));
            options.onData(chats);
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Chat listener error:', error);
        }
    );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Delete multiple theses in a batch
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

/**
 * Seed chapters for a thesis stage from a template
 */
export async function seedChaptersFromTemplate(
    ctx: ChapterContext,
    chapters: Omit<ThesisChapter, 'id'>[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    chapters.forEach((chapterData, index) => {
        const chapterId = String(index + 1);
        const docPath = buildChapterDocPath(
            ctx.year, ctx.department, ctx.course, ctx.groupId, ctx.thesisId, ctx.stage, chapterId
        );
        const docRef = doc(firebaseFirestore, docPath);
        batch.set(docRef, {
            ...chapterData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();
}

// ============================================================================
// Context-Free Lookups (via collectionGroup)
// ============================================================================

/**
 * Thesis with embedded group context from collectionGroup query.
 */
export interface ThesisWithGroupContext extends ThesisData {
    /** Group ID extracted from the document path. */
    groupId?: string;
    /** Year extracted from the document path. */
    year?: string;
    /** Department extracted from the document path. */
    department?: string;
    /** Course extracted from the document path. */
    course?: string;
}

/**
 * Find a thesis by ID across all groups (searches via collectionGroup).
 * Use when you don't have the full context path.
 *
 * @param thesisId Thesis document ID
 * @returns Thesis data with embedded context, or null if not found
 */
export async function findThesisById(thesisId: string): Promise<ThesisWithGroupContext | null> {
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const q = query(thesisQuery, where('__name__', '==', thesisId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // Try to find by 'id' field as fallback
        const qById = query(
            collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION),
            where('id', '==', thesisId)
        );
        const snapshotById = await getDocs(qById);
        if (snapshotById.empty) return null;
        const docSnap = snapshotById.docs[0];
        const data = docToThesisData(docSnap);
        if (!data) return null;
        const params = extractPathParams(docSnap.ref.path);
        return {
            ...data,
            groupId: params.groupId,
            year: params.year,
            department: params.department,
            course: params.course,
        };
    }

    const docSnap = snapshot.docs[0];
    const data = docToThesisData(docSnap);
    if (!data) return null;
    const params = extractPathParams(docSnap.ref.path);
    return {
        ...data,
        groupId: params.groupId,
        year: params.year,
        department: params.department,
        course: params.course,
    };
}

/**
 * Find the latest thesis for a group by group ID (searches via collectionGroup).
 * Use when you don't have the full context path.
 *
 * @param groupId Group document ID
 * @returns Thesis data with embedded context, or null if not found
 */
export async function findThesisByGroupId(
    groupId: string
): Promise<ThesisWithGroupContext | null> {
    // Search for theses that belong to this group
    const thesisQuery = collectionGroup(firebaseFirestore, THESIS_SUBCOLLECTION);
    const tSnap = await getDocs(query(thesisQuery, orderBy('createdAt', 'desc')));

    for (const docSnap of tSnap.docs) {
        const params = extractPathParams(docSnap.ref.path);
        if (params.groupId === groupId) {
            const data = docToThesisData(docSnap);
            if (data) {
                return {
                    ...data,
                    groupId: params.groupId,
                    year: params.year,
                    department: params.department,
                    course: params.course,
                };
            }
        }
    }

    return null;
}

/**
 * Get reviewer assignments for a user by role (adviser, editor, or statistician).
 * Uses collectionGroup queries to find all groups where the user has that role.
 *
 * @param role 'adviser' | 'editor' | 'statistician'
 * @param userId Firebase user UID
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

        // Find the latest thesis for this group
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

        // Calculate progress
        const progress = thesisData.stages?.length
            ? Math.round((thesisData.stages.filter((s) =>
                s.completedAt !== undefined).length
                / thesisData.stages.length) * 100)
            : 0;

        // Get stage name for assignment
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
// Additional Real-time Listeners (collectionGroup-based)
// ============================================================================

/**
 * Listen to all theses across all years/departments/courses.
 * Alias for listenAllTheses with simplified interface.
 *
 * @param options Callbacks for data and errors
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
 * @param userId User ID to filter by
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesesForParticipant(
    userId: string,
    options: ThesisListenerOptions
): () => void {
    // We need to listen to groups where the user is a participant,
    // then get their theses
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

    // We'll listen to groups and then fetch their theses
    return onSnapshot(
        groupsQuery,
        async (snapshot) => {
            const theses: ThesisRecord[] = [];

            for (const groupDoc of snapshot.docs) {
                const groupData = groupDoc.data();
                const isParticipant =
                    groupData.members?.leader === userId ||
                    (groupData.members?.members || []).includes(userId);

                if (!isParticipant) continue;

                const params = extractPathParams(groupDoc.ref.path);
                const groupId = groupDoc.id;

                // Get theses for this group
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
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis participant listener error:', error);
        }
    );
}

/**
 * Listen to theses where the user is a mentor (adviser, editor, statistician, or panel).
 *
 * @param userId User ID to filter by
 * @param options Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenThesesForMentor(
    userId: string,
    options: ThesisListenerOptions
): () => void {
    const groupsQuery = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

    return onSnapshot(
        groupsQuery,
        async (snapshot) => {
            const theses: ThesisRecord[] = [];

            for (const groupDoc of snapshot.docs) {
                const groupData = groupDoc.data();
                const isMentor =
                    groupData.members?.adviser === userId ||
                    groupData.members?.editor === userId ||
                    groupData.members?.statistician === userId ||
                    (groupData.members?.panels || []).includes(userId);

                if (!isMentor) continue;

                const params = extractPathParams(groupDoc.ref.path);
                const groupId = groupDoc.id;

                // Get theses for this group
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
        },
        (error) => {
            if (options.onError) options.onError(error);
            else console.error('Thesis mentor listener error:', error);
        }
    );
}
