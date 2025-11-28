import type { ChapterTemplate } from '../types/chapter';
import type { ThesisChapter, ThesisStageName } from '../types/thesis';
import { DEFAULT_CHAPTER_STAGE, normalizeChapterOrder } from './chapterUtils';
import { THESIS_STAGE_METADATA } from './thesisStageUtils';

const DEFAULT_CHAPTER_TITLES = [
    'Introduction',
    'Review of Related Literature',
    'Methodology',
    'Results and Discussion',
    'Conclusion and Recommendations',
];

const STAGE_SEQUENCE = THESIS_STAGE_METADATA.map((stage) => stage.value);

function resolveDefaultStage(index: number): ThesisStageName {
    if (STAGE_SEQUENCE.length === 0) {
        return DEFAULT_CHAPTER_STAGE;
    }

    const bucketSize = Math.max(1, Math.ceil(DEFAULT_CHAPTER_TITLES.length / STAGE_SEQUENCE.length));
    const stageIndex = Math.min(STAGE_SEQUENCE.length - 1, Math.floor(index / bucketSize));
    return STAGE_SEQUENCE[stageIndex] ?? DEFAULT_CHAPTER_STAGE;
}

export function buildDefaultChapterTemplates(): ChapterTemplate[] {
    const seeded = DEFAULT_CHAPTER_TITLES.map((title, index) => ({
        id: index + 1,
        title,
        description: '',
        stage: resolveDefaultStage(index),
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
        stage: template.stage ?? DEFAULT_CHAPTER_STAGE,
    }));
}

export function buildDefaultThesisChapters(): ThesisChapter[] {
    return templatesToThesisChapters(buildDefaultChapterTemplates());
}
