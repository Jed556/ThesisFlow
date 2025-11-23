import type { ChapterTemplate } from '../../types/chapter';
import { buildDefaultChapterTemplates } from '../../utils/thesisChapterTemplates';

/** Number of chapter names to preview in the management card. */
export const CHAPTER_CARD_PREVIEW_LIMIT = 3;

export const buildDefaultChapters = buildDefaultChapterTemplates;

/**
 * Formats a single chapter label for chips and summaries.
 */
export function formatChapterLabel(chapter: ChapterTemplate): string {
    return chapter.title || `Chapter ${chapter.id}`;
}
