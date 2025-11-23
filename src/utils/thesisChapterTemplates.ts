import type { ChapterTemplate } from '../types/chapter';
import type { ThesisChapter } from '../types/thesis';
import { normalizeChapterOrder } from './chapterUtils';

const DEFAULT_CHAPTER_TITLES = [
    'Introduction',
    'Review of Related Literature',
    'Methodology',
    'Results and Discussion',
    'Conclusion and Recommendations',
];

export function buildDefaultChapterTemplates(): ChapterTemplate[] {
    const seeded = DEFAULT_CHAPTER_TITLES.map((title, index) => ({
        id: index + 1,
        title,
        description: '',
    }));

    return normalizeChapterOrder(seeded);
}

export function templatesToThesisChapters(templates: ChapterTemplate[]): ThesisChapter[] {
    const normalized = normalizeChapterOrder(templates);
    return normalized.map((template, index) => ({
        id: template.id ?? index + 1,
        title: template.title || `Chapter ${index + 1}`,
        status: 'not_submitted',
        submissionDate: null,
        lastModified: null,
        submissions: [],
        comments: [],
    }));
}

export function buildDefaultThesisChapters(): ThesisChapter[] {
    return templatesToThesisChapters(buildDefaultChapterTemplates());
}
