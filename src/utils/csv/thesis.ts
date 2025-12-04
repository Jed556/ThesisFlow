/**
 * CSV import/export for Thesis Data
 */

import type { ChapterSubmissionEntry, ThesisChapter } from '../../types/thesis';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, splitArrayField, generateCsvText } from './parser';

/**
 * Import theses from CSV text
 */
export interface ThesisCsvRow {
    title: string;
    groupId: string;
    leader: string;
    members: string[];
    adviser: string;
    editor: string;
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chapters: ThesisChapter[];
}

export function importThesesFromCsv(csvText: string): { parsed: ThesisCsvRow[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ThesisCsvRow[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const title = get('title');
        if (!title) {
            errors.push(`row ${idx + 2}: missing title`);
            return;
        }

        const groupId = get('groupId') || get('group_id');
        if (!groupId) {
            errors.push(`row ${idx + 2}: missing groupId`);
            return;
        }

        const members = splitArrayField(get('members') || get('team') || get('group'));

        const chaptersRaw = get('chapters') || '';
        let chapters: ThesisChapter[] = [];

        try {
            if (chaptersRaw.trim().startsWith('[') || chaptersRaw.trim().startsWith('{')) {
                // Try parse JSON
                const parsedJson = JSON.parse(chaptersRaw);
                if (Array.isArray(parsedJson)) {
                    chapters = parsedJson.map((entry, i) => {
                        const chapter = (typeof entry === 'object' && entry !== null ? entry : {}) as Partial<ThesisChapter>;
                        // Parse submissions as ChapterSubmissionEntry[]
                        const submissions: ChapterSubmissionEntry[] = Array.isArray(chapter.submissions)
                            ? chapter.submissions.map(item => {
                                if (typeof item === 'string') {
                                    return { id: item, status: 'under_review' } satisfies ChapterSubmissionEntry;
                                }
                                return {
                                    id: String((item as ChapterSubmissionEntry).id ?? `sub-${Date.now()}`),
                                    status: (item as ChapterSubmissionEntry).status ?? 'under_review',
                                } satisfies ChapterSubmissionEntry;
                            })
                            : [];
                        return {
                            id: typeof chapter.id === 'number' ? chapter.id : i + 1,
                            title: typeof chapter.title === 'string' ? chapter.title : `Chapter ${i + 1}`,
                            submissionDate: typeof chapter.submissionDate === 'string' ? chapter.submissionDate : null,
                            lastModified: typeof chapter.lastModified === 'string' ? chapter.lastModified : null,
                            submissions,
                            comments: Array.isArray(chapter.comments)
                                ? (chapter.comments as ThesisChapter['comments'])
                                : [],
                        } satisfies ThesisChapter;
                    });
                }
            } else if (chaptersRaw) {
                // Semi-colon separated chapter titles
                chapters = splitArrayField(chaptersRaw).map((t, i) => ({
                    id: i + 1,
                    title: t,
                    submissionDate: null,
                    lastModified: null,
                    submissions: [],
                    comments: [],
                }));
            }
        } catch (error) {
            const detail = error instanceof Error ? `: ${error.message}` : '';
            errors.push(`row ${idx + 2}: failed parsing chapters JSON${detail}`);
        }

        const thesis: ThesisCsvRow = {
            title,
            groupId,
            leader: get('leader') || '', // Firebase UID
            members, // Firebase UIDs
            adviser: get('adviser') || '', // Firebase UID
            editor: get('editor') || '', // Firebase UID
            submissionDate: get('submissionDate') || get('submission_date') || new Date().toISOString(),
            lastUpdated: get('lastUpdated') || get('last_updated') || new Date().toISOString(),
            overallStatus: get('overallStatus') || get('overall_status') || 'not_submitted',
            chapters,
        };

        parsed.push(thesis);
    });

    return { parsed, errors };
}

/**
 * Export theses to CSV text
 */
export function exportThesesToCsv(theses: ThesisCsvRow[]): string {
    const headers = [
        'title',
        'groupId',
        'leader',
        'members',
        'adviser',
        'editor',
        'submissionDate',
        'lastUpdated',
        'overallStatus',
        'chapters',
    ];

    const rows = theses.map(thesis => [
        thesis.title,
        thesis.groupId,
        thesis.leader,
        thesis.members.join(';'),
        thesis.adviser,
        thesis.editor,
        thesis.submissionDate,
        thesis.lastUpdated,
        thesis.overallStatus,
        JSON.stringify(thesis.chapters),
    ]);

    return generateCsvText(headers, rows);
}
