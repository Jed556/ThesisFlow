import type { ChapterStage } from '../types/chapter';

export const CHAPTER_STAGE_PRESETS: Record<'proposal' | 'defense', ChapterStage[]> = {
    proposal: ['Pre-Proposal', 'Post-Proposal'],
    defense: ['Pre Defense', 'Post Defense'],
};

/**
 * Computes the default stage visibility for a chapter number following
 * ThesisFlow's standard staging rules.
 */
export const getDefaultStagesForChapter = (chapterNumber: number): ChapterStage[] => {
    const stages = new Set<ChapterStage>();

    if (chapterNumber <= 3) {
        CHAPTER_STAGE_PRESETS.proposal.forEach((stage) => stages.add(stage));
    }

    if (chapterNumber <= 5) {
        CHAPTER_STAGE_PRESETS.defense.forEach((stage) => stages.add(stage));
    }

    return Array.from(stages);
};
