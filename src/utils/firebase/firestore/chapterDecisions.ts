import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { THESES_COLLECTION } from './constants';
import { applyChapterUpdate } from './chapterMutations';
import type { MentorApprovalState, MentorRole, ThesisChapter, ThesisData } from '../../../types/thesis';
import { createEmptyMentorApprovals, getAssignedMentorRoles, hydrateMentorApprovals } from '../../mentorUtils';
import { getLatestSubmissionIndex, normalizeChapterSubmissions, setSubmissionStatusAt } from '../../chapterSubmissionUtils';

export type ChapterDecision = Extract<ThesisChapter['status'], 'approved' | 'revision_required'>;

export interface UpdateChapterDecisionInput {
    thesisId: string;
    chapterId: number;
    decision: ChapterDecision;
    role: MentorRole;
    versionIndex?: number | null;
}

export interface UpdateChapterDecisionResult {
    status: ThesisChapter['status'];
    decidedAt: string;
    mentorApprovals?: MentorApprovalState;
    submissions?: ThesisChapter['submissions'];
}

type ChapterSnapshot = Pick<ThesisChapter, 'status' | 'mentorApprovals' | 'submissions'>;

/**
 * Persists the mentor's decision for a chapter, updating its status and last modified timestamp.
 */
export async function updateChapterDecision({
    thesisId,
    chapterId,
    decision,
    role,
    versionIndex,
}: UpdateChapterDecisionInput): Promise<UpdateChapterDecisionResult> {
    if (!thesisId) {
        throw new Error('thesisId is required to update a chapter decision.');
    }

    const ref = doc(firebaseFirestore, THESES_COLLECTION, thesisId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    const decidedAt = new Date().toISOString();

    const assignedRoles = getAssignedMentorRoles(thesis);
    let updatedChapter: ChapterSnapshot | null = null;

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => {
        const hydratedApprovals = hydrateMentorApprovals(thesis, chapter.mentorApprovals);
        const approvals: MentorApprovalState | undefined = hydratedApprovals
            ? { ...hydratedApprovals }
            : undefined;

        let nextApprovals: MentorApprovalState | undefined = approvals;
        let nextStatus: ThesisChapter['status'];
        const normalizedSubmissions = normalizeChapterSubmissions(chapter.submissions);
        const fallbackIndex = getLatestSubmissionIndex(chapter.submissions);
        const inRangeExplicitIndex = typeof versionIndex === 'number'
            && Number.isInteger(versionIndex)
            && versionIndex >= 0
            && versionIndex < normalizedSubmissions.length
            ? versionIndex
            : -1;
        const targetIndex = inRangeExplicitIndex >= 0 ? inRangeExplicitIndex : fallbackIndex;

        if (decision === 'revision_required') {
            nextApprovals = createEmptyMentorApprovals(thesis);
            nextStatus = 'revision_required';
        } else {
            nextApprovals = nextApprovals ?? createEmptyMentorApprovals(thesis) ?? {};
            nextApprovals[role] = true;
            const allApproved = assignedRoles.length
                ? assignedRoles.every((mentorRole) => Boolean(nextApprovals?.[mentorRole]))
                : true;
            nextStatus = allApproved ? 'approved' : 'under_review';
        }

        const resolvedSubmissionStatus = decision === 'revision_required'
            ? 'revision_required'
            : nextStatus === 'approved'
                ? 'approved'
                : 'under_review';

        let nextSubmissions: ThesisChapter['submissions'] = normalizedSubmissions;
        if (targetIndex >= 0 && normalizedSubmissions.length > 0) {
            nextSubmissions = setSubmissionStatusAt(
                chapter.submissions ?? [],
                targetIndex,
                resolvedSubmissionStatus,
                { decidedAt, decidedBy: role },
            );
        }

        const nextChapter: ThesisChapter = {
            ...chapter,
            status: nextStatus,
            lastModified: decidedAt,
            mentorApprovals: nextApprovals,
            submissions: nextSubmissions,
        };
        updatedChapter = {
            status: nextChapter.status,
            mentorApprovals: nextChapter.mentorApprovals,
            submissions: nextChapter.submissions,
        };
        return nextChapter;
    });

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: decidedAt,
    }, { merge: true });

    if (!updatedChapter) {
        throw new Error('Failed to determine updated chapter state.');
    }

    const chapterSnapshot: ChapterSnapshot = updatedChapter;

    return {
        status: chapterSnapshot.status,
        decidedAt,
        mentorApprovals: chapterSnapshot.mentorApprovals,
        submissions: chapterSnapshot.submissions,
    };
}
