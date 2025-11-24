import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { THESES_COLLECTION } from './constants';
import { applyChapterUpdate } from './chapterMutations';
import type { ThesisData } from '../../../types/thesis';

export interface AppendChapterSubmissionInput {
    thesisId: string;
    chapterId: number;
    submissionId: string;
    submittedAt?: string;
}

export interface AppendChapterSubmissionResult {
    submissionId: string;
    submittedAt: string;
}

/**
 * Appends a submission identifier to the specified chapter and updates its metadata.
 */
export async function appendChapterSubmission({
    thesisId,
    chapterId,
    submissionId,
    submittedAt,
}: AppendChapterSubmissionInput): Promise<AppendChapterSubmissionResult> {
    if (!thesisId) {
        throw new Error('thesisId is required to append a chapter submission');
    }

    const ref = doc(firebaseFirestore, THESES_COLLECTION, thesisId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    const timestamp = submittedAt ?? new Date().toISOString();

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => {
        const submissions = [...(chapter.submissions ?? [])];
        submissions.push(submissionId);
        return {
            ...chapter,
            submissions,
            submissionDate: timestamp,
            lastModified: timestamp,
            status: chapter.status === 'approved' ? 'revision_required' : 'under_review',
        };
    });

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: timestamp,
    }, { merge: true });

    return {
        submissionId,
        submittedAt: timestamp,
    };
}
