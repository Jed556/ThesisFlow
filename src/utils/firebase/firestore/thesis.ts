import {
    doc, setDoc, collection, getDocs, addDoc,
    getDoc, deleteDoc, type WithFieldValue,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { getUserById } from './user';

import type { ThesisData } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import type { ReviewerAssignment, ReviewerRole } from '../../../types/reviewer';

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
export async function getAllTheses(): Promise<(ThesisData & { id: string })[]> {
    const snap = await getDocs(collection(firebaseFirestore, THESES_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ThesisData & { id: string }));
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

    const deletePromises = ids.map(id => {
        const ref = doc(firebaseFirestore, THESES_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Get all thesis team members (leader, members, adviser, editor) with their profiles
 * @param thesisId - Thesis document ID
 * @returns Array of user profiles with thesis roles
 */
export async function getThesisTeamMembers(thesisId: string): Promise<(UserProfile & { thesisRole: string })[]> {
    const thesis = await getThesisById(thesisId);
    if (!thesis) return [];
    const teamMembers: (UserProfile & { thesisRole: string })[] = [];

    // Add leader (student)
    if (thesis.leader) {
        const leader = await getUserById(thesis.leader);
        if (leader) {
            teamMembers.push({
                ...leader,
                thesisRole: 'Leader'
            });
        }
    }

    // Add other members (students)
    if (thesis.members && thesis.members.length > 0) {
        for (const memberUid of thesis.members) {
            const member = await getUserById(memberUid);
            if (member) {
                teamMembers.push({
                    ...member,
                    thesisRole: 'Member'
                });
            }
        }
    }

    // Add adviser
    if (thesis.adviser) {
        const adviser = await getUserById(thesis.adviser);
        if (adviser) {
            teamMembers.push({
                ...adviser,
                thesisRole: 'Adviser'
            });
        }
    }

    // Add editor
    if (thesis.editor) {
        const editor = await getUserById(thesis.editor);
        if (editor) {
            teamMembers.push({
                ...editor,
                thesisRole: 'Editor'
            });
        }
    }

    return teamMembers;
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

    const theses = await getAllTheses();
    const relevant = theses.filter((thesis) => (
        role === 'adviser' ? thesis.adviser === userUid : thesis.editor === userUid
    ));

    if (relevant.length === 0) {
        return [];
    }

    const userIds = new Set<string>();

    relevant.forEach((thesis) => {
        if (thesis.leader) userIds.add(thesis.leader);
        thesis.members?.forEach((member) => userIds.add(member));
        if (thesis.adviser) userIds.add(thesis.adviser);
        if (thesis.editor) userIds.add(thesis.editor);
    });

    const userProfiles = new Map<string, UserProfile>();
    await Promise.all(Array.from(userIds).map(async (uid) => {
        const profile = await getUserById(uid);
        if (profile) {
            userProfiles.set(uid, profile);
        }
    }));

    return relevant.map((thesis) => {
        const progressRatio = computeProgressRatio(thesis);
        const studentEmails = [thesis.leader, ...(thesis.members ?? [])]
            .map((uid) => userProfiles.get(uid)?.email)
            .filter((email): email is string => Boolean(email));

        const assignedUid = role === 'adviser' ? thesis.adviser : thesis.editor;
        const assignedEmail = assignedUid ? userProfiles.get(assignedUid)?.email : undefined;

        const counterpartUid = role === 'adviser' ? thesis.editor : thesis.adviser;
        const counterpartEmail = counterpartUid ? userProfiles.get(counterpartUid)?.email : undefined;

        const assignedTo = [assignedEmail, counterpartEmail].filter((email): email is string => Boolean(email));

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
