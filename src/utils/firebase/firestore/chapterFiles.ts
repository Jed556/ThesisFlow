import { collection, doc, getDocs, deleteDoc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import type { FileAttachment } from '../../../types/file';
import { firebaseFirestore } from '../firebaseConfig';
import {
    buildChapterFirestoreDocSegments, buildChapterFirestoreFilesCollectionSegments,
    buildChapterFolderLabel, type ChapterPathContext, sanitizeChapterPathSegment,
} from '../../../utils/chapterPaths';

export type ChapterFilesCollectionRef = CollectionReference<FileAttachment>;
export type ChapterFileDocRef = DocumentReference<FileAttachment>;

export const getChapterFilesCollectionRef = (context: ChapterPathContext): ChapterFilesCollectionRef => {
    const segments = buildChapterFirestoreFilesCollectionSegments(context);
    return collection(firebaseFirestore, segments.join('/')) as ChapterFilesCollectionRef;
};

export const getChapterFileDocRef = (context: ChapterPathContext, filename: string): ChapterFileDocRef => {
    const segments = buildChapterFirestoreDocSegments(context, filename);
    return doc(firebaseFirestore, segments.join('/')) as ChapterFileDocRef;
};

export type ChapterFilesListParams = ChapterPathContext;

export async function listChapterFiles(params: ChapterFilesListParams): Promise<FileAttachment[]> {
    const collectionRef = getChapterFilesCollectionRef(params);
    const snapshot = await getDocs(collectionRef);
    return snapshot.docs.map((docSnap) => docSnap.data());
}

export async function deleteChapterFile(params: ChapterFilesListParams & { filename: string }): Promise<void> {
    const docRef = getChapterFileDocRef(params, params.filename);
    await deleteDoc(docRef);
}

export const buildChapterDocumentId = (filename: string): string => sanitizeChapterPathSegment(filename);
export const buildChapterFolderName = (
    chapterId: number,
    chapterTitle?: string,
): string => buildChapterFolderLabel(chapterId, chapterTitle);
