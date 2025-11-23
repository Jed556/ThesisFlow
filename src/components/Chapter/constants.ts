import type { ChapterTemplate } from '../../types/chapter';
import { getDefaultStagesForChapter } from '../../config/chapters';
import { normalizeChapterOrder } from '../../utils/chapterUtils';

/** Number of chapter names to preview in the management card. */
export const CHAPTER_CARD_PREVIEW_LIMIT = 3;

/** Default chapter labels used when seeding a new template. */
const DEFAULT_CHAPTER_TITLES = [
    'Introduction',
    'Review of Related Literature',
    'Methodology',
    'Results and Discussion',
    'Conclusion and Recommendations',
];

/**
 * Builds the default chapter template list used when creating a new course requirement.
 */
export function buildDefaultChapters(): ChapterTemplate[] {
    const seeded = DEFAULT_CHAPTER_TITLES.map((title, index) => ({
        id: index + 1,
        title,
        description: '',
        stages: getDefaultStagesForChapter(index + 1),
    }));

    return normalizeChapterOrder(seeded);
}

/**
 * Formats a single chapter label for chips and summaries.
 */
export function formatChapterLabel(chapter: ChapterTemplate): string {
    return chapter.title || `Chapter ${chapter.id}`;
}
