import type { ChapterTemplate } from '../types/chapter';

/**
 * Creates a normalized copy of the provided chapters array with sequential IDs starting at 1.
 */
export function normalizeChapterOrder(chapters: ChapterTemplate[]): ChapterTemplate[] {
    return chapters.map((chapter, index) => ({
        id: index + 1,
        title: chapter.title,
        description: chapter.description,
    }));
}

/**
 * Generates an empty chapter template with a deterministic ID.
 */
export function createEmptyChapterTemplate(order: number): ChapterTemplate {
    return {
        id: order,
        title: '',
        description: '',
    };
}

/**
 * Moves a chapter entry to a new index while keeping IDs normalized.
 */
export function moveChapterTemplate(chapters: ChapterTemplate[], fromIndex: number, toIndex: number): ChapterTemplate[] {
    if (fromIndex === toIndex) {
        return normalizeChapterOrder(chapters);
    }

    const boundedToIndex = Math.max(0, Math.min(chapters.length - 1, toIndex));
    const next = [...chapters];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(boundedToIndex, 0, removed);
    return normalizeChapterOrder(next);
}
