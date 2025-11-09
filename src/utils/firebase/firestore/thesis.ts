import {
    doc, setDoc, collection, getDocs, addDoc, getDoc, deleteDoc, query, where, onSnapshot, writeBatch,
    type WithFieldValue, type QueryConstraint, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { getUserById, getUsersByIds } from './user';

import type { ThesisData } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import type { ReviewerAssignment, ReviewerRole } from '../../../types/reviewer';

type ThesisRecord = ThesisData & { id: string };

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
 * Get all theses
 * @returns Array of ThesisData with their Firestore document IDs
 */
export async function getAllTheses(): Promise<ThesisRecord[]> {
    const snap = await getDocs(collection(firebaseFirestore, THESES_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ThesisRecord));
}

/**
 * Create or update a thesis document
 */
export async function setThesis(id: string | null, data: ThesisData): Promise<string> {
    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData(data);

    if (id) {
        const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        const ref = await addDoc(
            collection(firebaseFirestore, THESES_COLLECTION),
            cleanedData as WithFieldValue<ThesisData>
        );
        return ref.id;
    }
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

/**
 * Extract all participant UIDs (students, adviser, editor) from a thesis document.
 * @param thesis - Thesis data source containing membership fields
 * @returns Set of UIDs participating in the thesis
 */
function collectThesisUserIds(thesis: ThesisData): Set<string> {
    const members = new Set<string>();
    if (thesis.leader) {
        members.add(thesis.leader);
    }
    thesis.members?.forEach((uid) => members.add(uid));
    if (thesis.adviser) {
        members.add(thesis.adviser);
    }
    if (thesis.editor) {
        members.add(thesis.editor);
    }
    return members;
}

/**
 * Transform thesis documents into reviewer assignment models while reusing cached profiles.
 * @param theses - Thesis records that belong to the reviewer role
 * @param role - Reviewer role generating the view (adviser/editor)
 * @param profileCache - Map tracking hydrated user profiles to avoid duplicate reads
 * @returns Reviewer assignment rows derived from the provided theses
 */
async function buildReviewerAssignments(
    theses: ThesisRecord[],
    role: ReviewerRole,
    profileCache: Map<string, UserProfile>
): Promise<ReviewerAssignment[]> {
    const userIds = new Set<string>();
    theses.forEach((thesis) => {
        collectThesisUserIds(thesis).forEach((uid) => userIds.add(uid));
    });

    if (userIds.size > 0) {
        await hydrateUserProfiles(userIds, profileCache);
    }

    return theses.map((thesis) => {
        const progressRatio = computeProgressRatio(thesis);
        const studentEmails = [thesis.leader, ...(thesis.members ?? [])]
            .map((uid) => (uid ? profileCache.get(uid)?.email : undefined))
            .filter((email): email is string => Boolean(email));

        const assignedUid = role === 'adviser' ? thesis.adviser : thesis.editor;
        const counterpartUid = role === 'adviser' ? thesis.editor : thesis.adviser;

        const assignedEmail = assignedUid ? profileCache.get(assignedUid)?.email : undefined;
        const counterpartEmail = counterpartUid ? profileCache.get(counterpartUid)?.email : undefined;
        const assignedTo = [assignedEmail, counterpartEmail]
            .filter((email): email is string => Boolean(email));

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
            lastUpdated: normalizeTimestamp(thesis.lastUpdated ?? thesis.submissionDate),
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
    const memberRoles: { uid: string; role: string }[] = [];

    if (thesis.leader) {
        memberRoles.push({ uid: thesis.leader, role: 'Leader' });
    }
    thesis.members?.forEach((memberUid) => {
        memberRoles.push({ uid: memberUid, role: 'Member' });
    });
    if (thesis.adviser) {
        memberRoles.push({ uid: thesis.adviser, role: 'Adviser' });
    }
    if (thesis.editor) {
        memberRoles.push({ uid: thesis.editor, role: 'Editor' });
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

function computeProgressRatio(thesis: ThesisData): number {
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

function normalizeTimestamp(value?: string): string {
    if (!value) {
        return new Date().toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
}

export async function getReviewerAssignmentsForUser(role: ReviewerRole, userUid?: string | null): Promise<ReviewerAssignment[]> {
    if (!userUid) {
        return [];
    }

    const roleField = role === 'adviser' ? 'adviser' : 'editor';
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
        ...(docSnap.data() as ThesisData),
    }));

    const profileCache = new Map<string, UserProfile>();
    return buildReviewerAssignments(theses, role, profileCache);
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
                ...(docSnap.data() as ThesisData),
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

    const roleField = role === 'adviser' ? 'adviser' : 'editor';
    const roleQuery = query(
        collection(firebaseFirestore, THESES_COLLECTION),
        where(roleField, '==', userUid)
    );
    const profileCache = new Map<string, UserProfile>();

    return onSnapshot(
        roleQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const theses = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as ThesisData),
            }));

            void (async () => {
                try {
                    const assignments = await buildReviewerAssignments(theses, role, profileCache);
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
 * Subscribe to theses where the specified user serves as adviser or editor.
 * @param role - Mentor role to filter by (adviser/editor)
 * @param userUid - Firebase Auth UID of the mentor
 * @param options - Listener callbacks invoked on data updates or errors
 * @returns Unsubscribe handler to detach the listener
 */
export function listenThesesForMentor(
    role: 'adviser' | 'editor',
    userUid: string | null | undefined,
    options: ThesisListenerOptions
): () => void {
    if (!userUid) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const roleField = role === 'adviser' ? 'adviser' : 'editor';
    return listenTheses([
        where(roleField, '==', userUid),
    ], options);
}
