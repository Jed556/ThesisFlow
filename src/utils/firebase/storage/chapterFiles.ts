import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { writeBatch, doc } from 'firebase/firestore';
import type { FileAttachment } from '../../../types/file';
import { firebaseStorage, firebaseFirestore } from '../firebaseConfig';
import { deleteFileFromStorage, sanitizeFilename } from './common';
import { getFileExtension, validateFile } from '../../fileUtils';
import {
    buildChapterFileDisplayPath, buildChapterFirestoreDocSegments,
    buildChapterStoragePath, type ChapterPathContext,
} from '../../chapterPaths';

export interface ChapterFileUploadProgress {
    fileName: string;
    progress: number;
}

export interface ChapterFileUploadResult {
    attachment: FileAttachment;
    firestorePath: string;
    storagePath: string;
    displayPath: string;
}

export interface UploadChapterFilesOptions extends ChapterPathContext {
    files: File[];
    authorUid: string;
    category?: 'submission' | 'attachment';
    validator?: (file: File) => { isValid: boolean; error?: string };
    onProgress?: (update: ChapterFileUploadProgress) => void;
    metadata?: Record<string, string>;
}

const trackUpload = (
    fileRef: ReturnType<typeof ref>,
    file: File,
    metadata: Record<string, string> | undefined,
    onProgress?: (update: ChapterFileUploadProgress) => void,
): Promise<void> => new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
        customMetadata: metadata,
    });

    uploadTask.on(
        'state_changed',
        (snapshot) => {
            const progress = snapshot.totalBytes === 0
                ? 0
                : Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress?.({ fileName: file.name, progress });
        },
        (error) => {
            reject(error);
        },
        () => {
            onProgress?.({ fileName: file.name, progress: 100 });
            resolve();
        },
    );
});

/**
 * Uploads one or more chapter files to the required storage + Firestore locations.
 */
export async function uploadChapterFiles(options: UploadChapterFilesOptions): Promise<ChapterFileUploadResult[]> {
    if (!options.files.length) {
        return [];
    }

    const validator = options.validator ?? validateFile;
    const category = options.category ?? 'submission';

    const uploaded: ChapterFileUploadResult[] = [];

    for (const file of options.files) {
        const validation = validator(file);
        if (!validation.isValid) {
            throw new Error(validation.error ?? 'File validation failed');
        }

        const storagePath = buildChapterStoragePath(options, file.name);
        const storageRef = ref(firebaseStorage, storagePath);
        const customMetadata = {
            uploadedBy: options.authorUid,
            stage: options.stage,
            chapterId: options.chapterId.toString(),
            chapterTitle: options.chapterTitle ?? `Chapter ${options.chapterId}`,
            ...options.metadata,
        } satisfies Record<string, string>;

        await trackUpload(storageRef, file, customMetadata, options.onProgress);
        const downloadURL = await getDownloadURL(storageRef);

        const extension = getFileExtension(file.name);
        const sanitizedName = sanitizeFilename(file.name);
        const attachment: FileAttachment = {
            id: sanitizedName,
            name: file.name,
            type: extension,
            size: `${file.size}`,
            url: downloadURL,
            mimeType: file.type,
            uploadDate: new Date().toISOString(),
            author: options.authorUid,
            category,
        };

        uploaded.push({
            attachment,
            firestorePath: buildChapterFirestoreDocSegments(options, file.name).join('/'),
            storagePath,
            displayPath: buildChapterFileDisplayPath(options, file.name),
        });
    }

    const batch = writeBatch(firebaseFirestore);
    uploaded.forEach((entry) => {
        const docRef = doc(firebaseFirestore, entry.firestorePath);
        batch.set(docRef, entry.attachment);
    });

    try {
        await batch.commit();
    } catch (error) {
        await Promise.all(uploaded.map(async (entry) => {
            try {
                await deleteFileFromStorage(entry.storagePath);
            } catch {
                // Swallow cleanup errors to surface original failure
            }
        }));
        throw error;
    }

    return uploaded;
}
