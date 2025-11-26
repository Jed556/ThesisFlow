import {
    doc, setDoc, collection, getDocs, addDoc, getDoc, deleteDoc, query, where, onSnapshot, writeBatch,
    type WithFieldValue, type QueryConstraint, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { normalizeTimestamp } from '../../dateUtils';
import { cleanData } from './firestore';
import { getUserById, getUsersByIds } from './user';
import { getGroupById } from './groups';
import { getChapterConfigByCourse } from './chapter';
import { buildDefaultThesisChapters, templatesToThesisChapters } from '../../thesisChapterTemplates';

import type { ThesisChapter, ThesisData } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import type { ReviewerAssignment, ReviewerRole } from '../../../types/reviewer';
import type { ThesisGroupMembers } from '../../../types/group';

export type ThesisRecord = ThesisData & { id: string };

/** Firestore collection name used for user documents */
const THESES_COLLECTION = 'theses';

/**
 * Get a thesis data by id
 * @param id - thesis id
 */
export async function getThesisById(id: string): Promise<ThesisData | null> {
    const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as ThesisData;
}

/**
 * Get the most recent thesis document associated with a group.
 * When multiple thesis records exist, preference is given to the document
 * whose ID has the highest sequential suffix (e.g., GROUP-T3 over GROUP-T2).
 * @param groupId - Thesis group ID
 */
export async function getThesisByGroupId(groupId: string): Promise<ThesisData | null> {
    if (!groupId) {
        return null;
    }

    const groupQuery = query(
        collection(firebaseFirestore, THESES_COLLECTION),
        where('groupId', '==', groupId)
    );
    const snapshot = await getDocs(groupQuery);

    if (snapshot.empty) {
        return null;
    }

    const parseSequenceNumber = (docId: string): number => {
        const match = docId.match(/-T(\d+)$/i);
        if (!match) {
            return 0;
        }
        const sequence = Number(match[1]);
        return Number.isNaN(sequence) ? 0 : sequence;
    };

    const bestDoc = snapshot.docs.reduce((currentBest, candidate) => {
        const currentSequence = parseSequenceNumber(currentBest.id);
        const candidateSequence = parseSequenceNumber(candidate.id);

        if (candidateSequence > currentSequence) {
            return candidate;
        }

        if (candidateSequence < currentSequence) {
            return currentBest;
        }

        const currentUpdated = Date.parse(((currentBest.data() as ThesisData).lastUpdated) ?? '');
        const candidateUpdated = Date.parse(((candidate.data() as ThesisData).lastUpdated) ?? '');

        if (Number.isNaN(currentUpdated) && Number.isNaN(candidateUpdated)) {
            return currentBest;
        }

        if (Number.isNaN(currentUpdated)) {
            return candidate;
        }

        if (Number.isNaN(candidateUpdated)) {
            return currentBest;
        }

        return candidateUpdated > currentUpdated ? candidate : currentBest;
    }, snapshot.docs[0]);

    const thesis = bestDoc.data() as ThesisData;
    return {
        ...thesis,
        id: bestDoc.id,
    };
}

/**
 * Get all theses
 * @returns Array of ThesisData with their Firestore document IDs
 */
export async function getAllTheses(): Promise<ThesisRecord[]> {
    const snap = await getDocs(collection(firebaseFirestore, THESES_COLLECTION));
    return snap.docs.map((docSnap) => {
        const data = docSnap.data() as ThesisData;
        const { id: _ignored, ...rest } = data;
        void _ignored;
        return {
            id: docSnap.id,
            ...(rest as Omit<ThesisData, 'id'>),
        } as ThesisRecord;
    });
}

/**
 * Create or update a thesis document
 */
export async function setThesis(id: string | null, data: ThesisData): Promise<string> {
    if (id) {
        // Update existing: use 'update' mode to keep null values (for field deletion)
        const cleanedData = cleanData(data, 'update');
        const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        // Create new: use 'create' mode to remove null/undefined/empty values
        const cleanedData = cleanData(data, 'create');
        const ref = await addDoc(
            collection(firebaseFirestore, THESES_COLLECTION),
            cleanedData as WithFieldValue<ThesisData>
        );
        return ref.id;
    }
}

/**
 * Generate a thesis document ID for the provided group using the pattern {groupId}-T{n}.
 * This queries existing theses for the group and picks the next available number.
 */
export async function generateNextThesisIdForGroup(groupId: string): Promise<string> {
    if (!groupId) throw new Error('groupId is required');
    const q = query(collection(firebaseFirestore, THESES_COLLECTION), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);

    const pattern = new RegExp(`^${groupId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}-T(\\d+)$`);

    let maxN = 0;
    snapshot.docs.forEach((docSnap) => {
        const id = docSnap.id;
        const m = id.match(pattern);
        if (m && m[1]) {
            const n = Number(m[1]);
            if (!Number.isNaN(n) && n > maxN) maxN = n;
        }
    });

    return `${groupId}-T${maxN + 1}`;
}

/**
 * Create a new thesis document using the group-based ID format and return the assigned id.
 */
export async function createThesisForGroup(groupId: string, data: ThesisData): Promise<string> {
    const nextId = await generateNextThesisIdForGroup(groupId);
    await setThesis(nextId, data);
    return nextId;
}

/**
 * Ensure that a thesis document has chapter entries seeded from the admin-defined template.
 * Falls back to the default template if no custom configuration exists for the group's course.
 * @param thesis - Thesis record that needs chapter data
 * @returns Array of thesis chapters guaranteed to be present on the document
 */
export async function ensureThesisChaptersForGroup(thesis: ThesisRecord): Promise<ThesisChapter[]> {
    if (thesis.chapters && thesis.chapters.length > 0) {
        return thesis.chapters;
    }

    if (!thesis.id) {
        throw new Error('Cannot seed thesis chapters without a document id.');
    }

    if (!thesis.groupId) {
        throw new Error('Cannot seed thesis chapters without an associated group.');
    }

    let nextChapters: ThesisChapter[] = [];

    try {
        const group = await getGroupById(thesis.groupId);
        if (group?.department && group?.course) {
            const config = await getChapterConfigByCourse(group.department, group.course);
            if (config?.chapters?.length) {
                nextChapters = templatesToThesisChapters(config.chapters);
            }
        }
    } catch (error) {
        console.error('Failed to resolve chapter template for thesis:', thesis.id, error);
    }

    if (nextChapters.length === 0) {
        nextChapters = buildDefaultThesisChapters();
    }

    const ref = doc(firebaseFirestore, THESES_COLLECTION, thesis.id);
    const payload = cleanData({
        chapters: nextChapters,
        lastUpdated: new Date().toISOString(),
    }, 'update');

    await setDoc(ref, payload, { merge: true });

    return nextChapters;
}

/**
 * Delete a thesis by id
 * @param id - Thesis document ID
 */
export async function deleteThesis(id: string): Promise<void> {
    if (!id) throw new Error('Thesis ID required');
    const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple theses by their IDs
 * @param ids - Array of thesis document IDs to delete
 */
export async function bulkDeleteTheses(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Thesis IDs required');
    const batch = writeBatch(firebaseFirestore);

    ids.forEach((id) => {
        const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
        batch.delete(ref);
    });

    await batch.commit();
}

/**
 * Ensure user profile data needed for thesis assignments is present in cache.
 * Fetches missing users in batched queries before falling back to individual lookups.
 * @param uids - Collection of user UIDs required for assignment hydration
 * @param cache - In-memory map storing already resolved profiles
 */
async function hydrateUserProfiles(
    uids: Set<string>,
    cache: Map<string, UserProfile>
): Promise<void> {
    const missingIds = Array.from(uids).filter((uid) => !cache.has(uid));
    if (missingIds.length === 0) {
        return;
    }

    try {
        const fetchedProfiles = await getUsersByIds(missingIds);
        fetchedProfiles.forEach((profile) => {
            cache.set(profile.uid, profile);
        });

        const remaining = missingIds.filter((uid) => !cache.has(uid));
        if (remaining.length === 0) {
            return;
        }

        const resolvedProfiles = await Promise.all(remaining.map(async (uid) => {
            const profile = await getUserById(uid);
            return profile ?? null;
        }));

        resolvedProfiles.forEach((profile) => {
            if (profile) {
                cache.set(profile.uid, profile);
            }
        });
    } catch (error) {
        console.error('Failed to hydrate user profiles for theses:', error);
        throw error;
    }
}

async function hydrateThesisGroups(
    theses: ThesisData[],
    cache: Map<string, ThesisGroupMembers>
): Promise<void> {
    const missingGroupIds = theses
        .map((thesis) => thesis.groupId)
        .filter((groupId): groupId is string => Boolean(groupId) && !cache.has(groupId));

    if (missingGroupIds.length === 0) {
        return;
    }

    const uniqueIds = Array.from(new Set(missingGroupIds));
    const fetchedGroups = await Promise.all(uniqueIds.map(async (groupId) => {
        try {
            return await getGroupById(groupId);
        } catch (error) {
            console.error(`Failed to fetch group ${groupId} for thesis hydration:`, error);
            return null;
        }
    }));

    fetchedGroups.forEach((group, index) => {
        if (group) {
            cache.set(uniqueIds[index], group.members);
        }
    });
}

function collectGroupMemberIds(members: ThesisGroupMembers | undefined): Set<string> {
    const uids = new Set<string>();
    if (!members) {
        return uids;
    }

    if (members.leader) {
        uids.add(members.leader);
    }

    members.members.forEach((uid) => {
        if (uid) {
            uids.add(uid);
        }
    });

    if (members.adviser) {
        uids.add(members.adviser);
    }

    if (members.editor) {
        uids.add(members.editor);
    }

    return uids;
}

/**
 * Extract all participant UIDs (students, adviser, editor) from a thesis document.
 * @param thesis - Thesis data source containing membership fields
 * @returns Set of UIDs participating in the thesis
 */
/**
 * Transform thesis documents into reviewer assignment models while reusing cached profiles.
 * @param theses - Thesis records that belong to the reviewer role
 * @param role - Reviewer role generating the view (adviser/editor/statistician)
 * @param profileCache - Map tracking hydrated user profiles to avoid duplicate reads
 * @returns Reviewer assignment rows derived from the provided theses
 */
async function buildReviewerAssignments(
    theses: ThesisRecord[],
    role: ReviewerRole,
    profileCache: Map<string, UserProfile>,
    groupCache: Map<string, ThesisGroupMembers>
): Promise<ReviewerAssignment[]> {
    await hydrateThesisGroups(theses, groupCache);

    const userIds = new Set<string>();
    theses.forEach((thesis) => {
        const members = groupCache.get(thesis.groupId);
        collectGroupMemberIds(members).forEach((uid) => userIds.add(uid));
    });

    if (userIds.size > 0) {
        await hydrateUserProfiles(userIds, profileCache);
    }

    return theses.map((thesis) => {
        const members = groupCache.get(thesis.groupId);
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
        if (role === 'adviser') {
            assignedUid = adviserUid;
        } else if (role === 'editor') {
            assignedUid = editorUid;
        } else {
            assignedUid = statisticianUid;
        }

        const mentorUids = [adviserUid, editorUid, statisticianUid]
            .filter((uid): uid is string => Boolean(uid));
        const assignedEmail = assignedUid ? profileCache.get(assignedUid)?.email : undefined;
        const peerEmails = mentorUids
            .filter((uid) => uid !== assignedUid)
            .map((uid) => profileCache.get(uid)?.email)
            .filter((email): email is string => Boolean(email));
        const assignedTo = Array.from(new Set([assignedEmail, ...peerEmails].filter((email): email is string => Boolean(email))));

        return {
            id: thesis.id,
            thesisId: thesis.id,
            thesisTitle: thesis.title,
            role,
            stage: thesis.overallStatus ?? 'In Progress',
            progress: progressRatio,
            dueDate: undefined,
            assignedTo,
            priority: determinePriority(progressRatio, thesis.lastUpdated),
            lastUpdated: normalizeTimestamp(thesis.lastUpdated ?? thesis.submissionDate, true),
            studentEmails,
        } satisfies ReviewerAssignment;
    });
}

/**
 * Get all thesis team members (leader, members, adviser, editor) with their profiles
 * @param thesisId - Thesis document ID
 * @returns Array of user profiles with thesis roles
 */
export async function getThesisTeamMembers(thesisId: string): Promise<(UserProfile & { thesisRole: string })[]> {
    const thesis = await getThesisById(thesisId);
    if (!thesis) return [];
    const group = thesis.groupId ? await getGroupById(thesis.groupId) : null;
    const members = group?.members;
    if (!members) {
        return [];
    }

    const memberRoles: { uid: string; role: string }[] = [];

    if (members.leader) {
        memberRoles.push({ uid: members.leader, role: 'Leader' });
    }
    members.members.forEach((memberUid) => {
        if (memberUid) {
            memberRoles.push({ uid: memberUid, role: 'Member' });
        }
    });
    if (members.adviser) {
        memberRoles.push({ uid: members.adviser, role: 'Adviser' });
    }
    if (members.editor) {
        memberRoles.push({ uid: members.editor, role: 'Editor' });
    }

    if (memberRoles.length === 0) {
        return [];
    }

    const profiles = await getUsersByIds(memberRoles.map((member) => member.uid));
    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((profile) => {
        profileMap.set(profile.uid, profile);
    });

    const remaining = memberRoles
        .map((member) => member.uid)
        .filter((uid) => !profileMap.has(uid));
    if (remaining.length > 0) {
        const fallbackProfiles = await Promise.all(remaining.map(async (uid) => {
            const profile = await getUserById(uid);
            return profile ?? null;
        }));
        fallbackProfiles.forEach((profile) => {
            if (profile) {
                profileMap.set(profile.uid, profile);
            }
        });
    }

    return memberRoles
        .map((member) => {
            const profile = profileMap.get(member.uid);
            return profile ? { ...profile, thesisRole: member.role } : null;
        })
        .filter((entry): entry is UserProfile & { thesisRole: string } => Boolean(entry));
}

/**
 * Calculate thesis progress based on approved chapters
 * @param thesisId - Thesis document ID
 * @returns Progress percentage (0-100)
 */
export async function calculateThesisProgress(thesisId: string): Promise<number> {
    const thesis = await getThesisById(thesisId);
    if (!thesis || !thesis.chapters || thesis.chapters.length === 0) return 0;

    const total = thesis.chapters.length;
    const approved = thesis.chapters.filter(ch => ch.status === 'approved').length;
    return (approved / total) * 100;
}

export function computeThesisProgressRatio(thesis: ThesisData): number {
    if (!thesis.chapters || thesis.chapters.length === 0) {
        return 0;
    }
    const approved = thesis.chapters.filter(chapter => chapter.status === 'approved').length;
    return approved / thesis.chapters.length;
}

function determinePriority(progressRatio: number, lastUpdated?: string): ReviewerAssignment['priority'] {
    if (progressRatio <= 0.4) {
        return 'high';
    }
    if (progressRatio <= 0.75) {
        return 'medium';
    }
    if (lastUpdated) {
        const updatedDate = new Date(lastUpdated);
        if (!Number.isNaN(updatedDate.getTime())) {
            const diffDays = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 21) {
                return 'medium';
            }
        }
    }
    return 'low';
}


export async function getReviewerAssignmentsForUser(role: ReviewerRole, userUid?: string | null): Promise<ReviewerAssignment[]> {
    if (!userUid) {
        return [];
    }

    const roleFieldMap: Record<ReviewerRole, keyof ThesisData> = {
        adviser: 'adviser',
        editor: 'editor',
        statistician: 'statistician',
    };
    const roleField = roleFieldMap[role];
    const roleQuery = query(
        collection(firebaseFirestore, THESES_COLLECTION),
        where(roleField, '==', userUid)
    );
    const snapshot = await getDocs(roleQuery);
    if (snapshot.empty) {
        return [];
    }

    const theses = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...((): Omit<ThesisData, 'id'> => {
            const data = docSnap.data() as ThesisData;
            const { id: _ignored, ...rest } = data;
            void _ignored;
            return rest as Omit<ThesisData, 'id'>;
        })(),
    }));

    const profileCache = new Map<string, UserProfile>();
    const groupCache = new Map<string, ThesisGroupMembers>();
    return buildReviewerAssignments(theses, role, profileCache, groupCache);
}

/**
 * Handlers invoked by the reviewer assignments real-time listener.
 */
export interface ReviewerAssignmentsListenerOptions {
    onData: (assignments: ReviewerAssignment[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Handlers accepted by the generic thesis listener utility.
 */
export interface ThesisListenerOptions {
    onData: (theses: ThesisRecord[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Subscribe to theses collection updates with optional query constraints.
 * @param constraints - Optional Firestore query constraints to narrow the listener scope
 * @param options - Listener callbacks invoked for data updates or errors
 * @returns Unsubscribe handler to detach the snapshot listener
 */
export function listenTheses(
    constraints: QueryConstraint[] | undefined,
    options: ThesisListenerOptions
): () => void {
    const { onData, onError } = options;
    const baseCollection = collection(firebaseFirestore, THESES_COLLECTION);
    const thesesQuery = constraints && constraints.length > 0
        ? query(baseCollection, ...constraints)
        : baseCollection;

    return onSnapshot(
        thesesQuery,
        (snapshot) => {
            const theses = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...((): Omit<ThesisData, 'id'> => {
                    const data = docSnap.data() as ThesisData;
                    const { id: _ignored, ...rest } = data;
                    void _ignored;
                    return rest as Omit<ThesisData, 'id'>;
                })(),
            }));
            onData(theses);
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Thesis listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to reviewer assignments with a role-targeted Firestore query.
 * Keeps adviser/editor dashboards in sync while minimizing read volume.
 * @param role - Reviewer role whose assignments should be monitored
 * @param userUid - Firebase Auth UID to filter the thesis collection by
 * @param options - Callbacks invoked for data updates or listener errors
 * @returns Unsubscribe handler to detach the listener
 */
export function listenReviewerAssignmentsForUser(
    role: ReviewerRole,
    userUid: string | null | undefined,
    options: ReviewerAssignmentsListenerOptions
): () => void {
    const { onData, onError } = options;

    if (!userUid) {
        onData([]);
        return () => { /* no-op */ };
    }

    const roleFieldMap: Record<ReviewerRole, keyof ThesisData> = {
        adviser: 'adviser',
        editor: 'editor',
        statistician: 'statistician',
    };
    const roleField = roleFieldMap[role];
    const roleQuery = query(
        collection(firebaseFirestore, THESES_COLLECTION),
        where(roleField, '==', userUid)
    );
    const profileCache = new Map<string, UserProfile>();
    const groupCache = new Map<string, ThesisGroupMembers>();

    return onSnapshot(
        roleQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const theses = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...((): Omit<ThesisData, 'id'> => {
                    const data = docSnap.data() as ThesisData;
                    const { id: _ignored, ...rest } = data;
                    void _ignored;
                    return rest as Omit<ThesisData, 'id'>;
                })(),
            }));

            void (async () => {
                try {
                    const assignments = await buildReviewerAssignments(theses, role, profileCache, groupCache);
                    onData(assignments);
                } catch (error) {
                    if (error instanceof Error) {
                        onError?.(error);
                    } else {
                        console.error('Failed to build reviewer assignments:', error);
                    }
                }
            })();
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Reviewer assignments listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to theses where a user is a leader or team member and get real-time updates.
 * @param userUid - Firebase Auth UID of the participant to monitor
 * @param options - Listener callbacks for combined thesis updates or errors
 * @returns Unsubscribe handler that stops both underlying listeners
 */
export function listenThesesForParticipant(
    userUid: string | null | undefined,
    options: ThesisListenerOptions
): () => void {
    const { onData, onError } = options;

    if (!userUid) {
        onData([]);
        return () => { /* no-op */ };
    }

    const leaderTheses = new Map<string, ThesisRecord>();
    const memberTheses = new Map<string, ThesisRecord>();

    const emit = () => {
        const combined: ThesisRecord[] = [];
        leaderTheses.forEach((record) => {
            combined.push(record);
        });
        memberTheses.forEach((record) => {
            if (!leaderTheses.has(record.id)) {
                combined.push(record);
            }
        });
        onData(combined);
    };

    const handleError = (error: Error) => {
        if (onError) {
            onError(error);
        } else {
            console.error('Thesis participant listener error:', error);
        }
    };

    const unsubscribeLeader = listenTheses([
        where('leader', '==', userUid),
    ], {
        onData: (records) => {
            leaderTheses.clear();
            records.forEach((record) => {
                leaderTheses.set(record.id, record);
            });
            emit();
        },
        onError: handleError,
    });

    const unsubscribeMembers = listenTheses([
        where('members', 'array-contains', userUid),
    ], {
        onData: (records) => {
            memberTheses.clear();
            records.forEach((record) => {
                memberTheses.set(record.id, record);
            });
            emit();
        },
        onError: handleError,
    });

    return () => {
        unsubscribeLeader();
        unsubscribeMembers();
    };
}

/**
 * Subscribe to theses where the specified user serves as adviser, editor, or statistician.
 * @param role - Mentor role to filter by (adviser/editor/statistician)
 * @param userUid - Firebase Auth UID of the mentor
 * @param options - Listener callbacks invoked on data updates or errors
 * @returns Unsubscribe handler to detach the listener
 */
export function listenThesesForMentor(
    role: 'adviser' | 'editor' | 'statistician',
    userUid: string | null | undefined,
    options: ThesisListenerOptions
): () => void {
    if (!userUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const roleField = role === 'adviser' ? 'adviser' : role === 'editor' ? 'editor' : 'statistician';
    return listenTheses([
        where(roleField, '==', userUid),
    ], options);
}
// manual test
