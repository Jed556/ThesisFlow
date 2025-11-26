import type { ThesisChapter, ThesisData } from '../../../types/thesis';

export type ChapterUpdater = (chapter: ThesisChapter) => ThesisChapter;

/**
 * Applies a transformation to a specific chapter within a thesis and returns the updated chapters array.
 * Throws when the requested chapter cannot be found to ensure upstream callers handle missing data early.
 */
export function applyChapterUpdate(
    thesis: ThesisData,
    chapterId: number,
    updater: ChapterUpdater
): ThesisChapter[] {
    const chapters = thesis.chapters ?? [];
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (index === -1) {
        throw new Error(`Chapter ${chapterId} not found for thesis ${thesis.id ?? '<unknown>'}`);
    }

    const updatedChapters = [...chapters];
    const current = chapters[index];
    updatedChapters[index] = updater({ ...current, comments: current.comments ?? [] });
    return updatedChapters;
}
