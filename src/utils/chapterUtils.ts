import type { ChapterTemplate, ChapterStage } from '../types/chapter';
import { CHAPTER_STAGE_OPTIONS } from '../types/chapter';

const ALLOWED_STAGE_SET = new Set<ChapterStage>(CHAPTER_STAGE_OPTIONS);

export const normalizeChapterStages = (stages?: ChapterStage[]): ChapterStage[] => {
    if (!stages?.length) {
        return [];
    }

    const seen = new Set<ChapterStage>();

    return stages.filter((stage) => {
        if (!ALLOWED_STAGE_SET.has(stage) || seen.has(stage)) {
            return false;
        }

        seen.add(stage);
        return true;
    });
};

/**
 * Creates a normalized copy of the provided chapters array with sequential IDs starting at 1.
 */
export function normalizeChapterOrder(chapters: ChapterTemplate[]): ChapterTemplate[] {
    return chapters.map((chapter, index) => ({
        ...chapter,
        id: index + 1,
        stages: normalizeChapterStages(chapter.stages),
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
        stages: [],
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
