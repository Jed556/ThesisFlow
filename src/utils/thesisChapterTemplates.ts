import type { ChapterTemplate, ThesisChapterConfig } from '../types/chapter';
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
    return normalized.map((template, index) => {
        // Normalize stage to always be an array
        const templateStage = template.stage ?? DEFAULT_CHAPTER_STAGE;
        const stage = Array.isArray(templateStage) ? templateStage : [templateStage];
        return {
            id: template.id ?? index + 1,
            title: template.title || `Chapter ${index + 1}`,
            status: 'not_submitted',
            submissionDate: null,
            lastModified: null,
            submissions: [],
            comments: [],
            stage,
        };
    });
}

export function buildDefaultThesisChapters(): ThesisChapter[] {
    return templatesToThesisChapters(buildDefaultChapterTemplates());
}

// ============================================================================
// Course-specific Chapter Template Utilities
// These functions fetch chapter templates from Firestore configuration
// with fallback to default templates when no config exists.
// ============================================================================

/**
 * Get chapter templates for a course with fallback to default templates.
 * Loads from configuration/departments/{department}/courses/{course}/chapters/default
 * Falls back to buildDefaultChapterTemplates() if no config exists.
 * @param config - Chapter configuration or null
 * @returns Array of chapter templates
 */
export function getChapterTemplatesFromConfig(
    config: ThesisChapterConfig | null
): ChapterTemplate[] {
    if (config?.chapters && config.chapters.length > 0) {
        return config.chapters;
    }
    return buildDefaultChapterTemplates();
}

/**
 * Get thesis chapters from configuration (converted from templates).
 * Falls back to default chapters if no config exists.
 * @param config - Chapter configuration or null
 * @returns Array of thesis chapters
 */
export function getThesisChaptersFromConfig(
    config: ThesisChapterConfig | null
): ThesisChapter[] {
    const templates = getChapterTemplatesFromConfig(config);
    return templatesToThesisChapters(templates);
}
