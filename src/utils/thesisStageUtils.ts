import type { ThesisChapter, ThesisStage } from '../types/thesis';

export interface ThesisStageMeta {
    value: ThesisStage;
    label: string;
    helper?: string;
}

export const THESIS_STAGE_METADATA: readonly ThesisStageMeta[] = [
    { value: 'Pre-Proposal', label: 'Pre-Proposal' },
    { value: 'Post-Proposal', label: 'Post-Proposal' },
    { value: 'Pre-Defense', label: 'Pre Defense' },
    { value: 'Post-Defense', label: 'Post Defense' },
];

const DEFAULT_STAGE: ThesisStage = THESIS_STAGE_METADATA[0]?.value ?? 'Pre-Proposal';

/**
 * Returns the normalized stage assigned to a thesis chapter.
 */
export function resolveChapterStage(chapter?: ThesisChapter | null): ThesisStage {
    return chapter?.stage ?? DEFAULT_STAGE;
}

export interface StageCompletionOptions {
    treatEmptyAsComplete?: boolean;
}

/**
 * Builds a map describing whether each thesis stage has all chapters approved.
 */
export function buildStageCompletionMap(
    chapters: ThesisChapter[] | undefined,
    options?: StageCompletionOptions,
): Record<ThesisStage, boolean> {
    const source = chapters ?? [];
    const { treatEmptyAsComplete = false } = options ?? {};
    return THESIS_STAGE_METADATA.reduce<Record<ThesisStage, boolean>>((acc, stageMeta) => {
        const stageChapters = filterChaptersByStage(source, stageMeta.value);
        if (stageChapters.length === 0) {
            acc[stageMeta.value] = treatEmptyAsComplete;
        } else {
            acc[stageMeta.value] = stageChapters.every((chapter) => chapter.status === 'approved');
        }
        return acc;
    }, {} as Record<ThesisStage, boolean>);
}

/**
 * Builds a lock map where each stage is locked until the previous stage is complete.
 */
export function buildSequentialStageLockMap(
    completionMap: Record<ThesisStage, boolean>
): Record<ThesisStage, boolean> {
    return THESIS_STAGE_METADATA.reduce<Record<ThesisStage, boolean>>((acc, stageMeta, index) => {
        if (index === 0) {
            acc[stageMeta.value] = false;
        } else {
            const previousStage = THESIS_STAGE_METADATA[index - 1].value;
            acc[stageMeta.value] = !(completionMap[previousStage] ?? false);
        }
        return acc;
    }, {} as Record<ThesisStage, boolean>);
}

/**
 * Returns all chapters assigned to the provided stage value.
 */
export function filterChaptersByStage(
    chapters: ThesisChapter[] | undefined,
    stage: ThesisStage,
): ThesisChapter[] {
    if (!chapters || chapters.length === 0) {
        return [];
    }
    return chapters.filter((chapter) => resolveChapterStage(chapter) === stage);
}
