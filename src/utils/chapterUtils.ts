import type { ChapterTemplate } from '../types/chapter';
import type { ThesisStage } from '../types/thesis';
import { THESIS_STAGE_METADATA } from './thesisStageUtils';

export const DEFAULT_CHAPTER_STAGE: ThesisStage = THESIS_STAGE_METADATA[0]?.value ?? 'Pre-Proposal';

function collapseStages(stages: ThesisStage[]): ThesisStage | ThesisStage[] {
    return stages.length === 1 ? stages[0] : stages;
}

/**
 * Returns a sanitized list of thesis stages for a chapter entry.
 */
export function coerceChapterStages(stage?: ThesisStage | ThesisStage[]): ThesisStage[] {
    const values = Array.isArray(stage) ? stage : stage ? [stage] : [];
    const filtered = values.filter((value): value is ThesisStage => Boolean(value));
    const unique = Array.from(new Set(filtered));
    return unique.length > 0 ? unique : [DEFAULT_CHAPTER_STAGE];
}

/**
 * Creates a normalized copy of the provided chapters array with sequential IDs starting at 1.
 */
export function normalizeChapterOrder(chapters: ChapterTemplate[]): ChapterTemplate[] {
    return chapters.map((chapter, index) => ({
        id: index + 1,
        title: chapter.title,
        description: chapter.description,
        stage: collapseStages(coerceChapterStages(chapter.stage)),
    }));
}

/**
 * Generates an empty chapter template with a deterministic ID.
 */
export function createEmptyChapterTemplate(order: number, stage: ThesisStage = DEFAULT_CHAPTER_STAGE): ChapterTemplate {
    return {
        id: order,
        title: '',
        description: '',
        stage,
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
