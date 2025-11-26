import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { applyChapterUpdate } from './chapterMutations';
import { THESES_COLLECTION } from './constants';
import type { ThesisComment, ThesisData } from '../../../types/thesis';

function generateCommentId(): string {
    const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
    if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID();
    }
    return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface AppendChapterCommentInput {
    thesisId: string;
    chapterId: number;
    comment: Omit<ThesisComment, 'id' | 'date'> & { id?: string; date?: string };
}

export async function appendChapterComment({ thesisId, chapterId, comment }: AppendChapterCommentInput): Promise<ThesisComment> {
    if (!thesisId) {
        throw new Error('thesisId is required to append a chapter comment');
    }

    const ref = doc(firebaseFirestore, THESES_COLLECTION, thesisId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    const persistedComment: ThesisComment = {
        id: comment.id ?? generateCommentId(),
        date: comment.date ?? new Date().toISOString(),
        author: comment.author,
        comment: comment.comment,
        attachments: comment.attachments,
        version: comment.version,
    };

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => ({
        ...chapter,
        comments: [...(chapter.comments ?? []), persistedComment],
    }));

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: new Date().toISOString(),
    }, { merge: true });

    return persistedComment;
}

export interface UpdateChapterCommentInput {
    thesisId: string;
    chapterId: number;
    commentId: string;
    updates: Partial<Omit<ThesisComment, 'id' | 'author' | 'date'>> & { comment?: string; attachments?: ThesisComment['attachments'] };
}

export async function updateChapterComment({ thesisId, chapterId, commentId, updates }: UpdateChapterCommentInput): Promise<ThesisComment> {
    if (!thesisId) {
        throw new Error('thesisId is required to update a chapter comment');
    }

    const ref = doc(firebaseFirestore, THESES_COLLECTION, thesisId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
        throw new Error(`Thesis ${thesisId} not found`);
    }

    const thesis = snapshot.data() as ThesisData;
    let updatedComment: ThesisComment | null = null;

    const nextChapters = applyChapterUpdate(thesis, chapterId, (chapter) => {
        const comments = [...(chapter.comments ?? [])];
        const index = comments.findIndex((item) => item.id === commentId);
        if (index === -1) {
            throw new Error(`Comment ${commentId} not found in chapter ${chapterId}`);
        }
        const current = comments[index];
        const nextComment: ThesisComment = {
            ...current,
            ...updates,
            comment: updates.comment ?? current.comment,
            attachments: updates.attachments ?? current.attachments,
            isEdited: true,
            date: new Date().toISOString(),
        };
        comments[index] = nextComment;
        updatedComment = nextComment;
        return { ...chapter, comments };
    });

    await setDoc(ref, {
        chapters: nextChapters,
        lastUpdated: new Date().toISOString(),
    }, { merge: true });

    if (!updatedComment) {
        throw new Error('Failed to update comment. Updated comment is undefined.');
    }

    return updatedComment;
}
