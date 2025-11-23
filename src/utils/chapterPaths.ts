import type { ChapterStage } from '../types/chapter';
import { sanitizeFilename } from './firebase/storage/common';

export interface ChapterPathContext {
    department: string;
    course: string;
    groupId: string;
    stage: ChapterStage;
    chapterId: number;
    chapterTitle?: string;
}

const PATH_SANITIZE_REGEX = /[/#?%]+/g;

const fallbackValue = (value: string | undefined, fallback: string): string => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const sanitizeChapterPathSegment = (value: string): string => fallbackValue(value, 'unknown').replace(PATH_SANITIZE_REGEX, '-');

export const buildChapterFolderLabel = (chapterId: number, chapterTitle?: string): string => {
    const trimmedTitle = chapterTitle?.trim();
    return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : `Chapter ${chapterId}`;
};

export const buildChapterStoragePath = (context: ChapterPathContext, filename: string): string => {
    const folderSegments = [
        sanitizeChapterPathSegment(context.department),
        sanitizeChapterPathSegment(context.course),
        sanitizeChapterPathSegment(context.groupId),
        sanitizeChapterPathSegment(context.stage),
        sanitizeChapterPathSegment(buildChapterFolderLabel(context.chapterId, context.chapterTitle)),
    ];

    return `${folderSegments.join('/')}/${sanitizeFilename(filename)}`;
};

export const buildChapterFirestoreDocSegments = (context: ChapterPathContext, filename: string): string[] => {
    const folderLabel = sanitizeChapterPathSegment(buildChapterFolderLabel(context.chapterId, context.chapterTitle));
    return [
        'files',
        sanitizeChapterPathSegment(context.department),
        sanitizeChapterPathSegment(context.course),
        sanitizeChapterPathSegment(context.groupId),
        sanitizeChapterPathSegment(context.stage),
        folderLabel,
        sanitizeFilename(filename),
    ];
};

export const buildChapterFirestoreFilesCollectionSegments = (context: ChapterPathContext): string[] => {
    const folderLabel = sanitizeChapterPathSegment(buildChapterFolderLabel(context.chapterId, context.chapterTitle));
    return [
        'files',
        sanitizeChapterPathSegment(context.department),
        sanitizeChapterPathSegment(context.course),
        sanitizeChapterPathSegment(context.groupId),
        sanitizeChapterPathSegment(context.stage),
        folderLabel,
    ];
};

export const buildChapterFileDisplayPath = (context: ChapterPathContext, filename: string): string => {
    const folderSegments = [
        context.department,
        context.course,
        context.groupId,
        context.stage,
        buildChapterFolderLabel(context.chapterId, context.chapterTitle),
        filename,
    ];
    return folderSegments.map((segment) => segment.trim()).join('/');
};
