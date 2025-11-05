/**
 * CSV import/export for File Attachments
 */

import type { FileAttachment } from '../../types/file';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, generateCsvText } from './parser';

const parseFileCategory = (value?: string): FileAttachment['category'] | undefined => {
    const normalized = value?.toLowerCase();
    return normalized === 'submission' || normalized === 'attachment' ? normalized : undefined;
};

/**
 * Import file attachments from CSV text
 */
export function importFilesFromCsv(csvText: string): { parsed: FileAttachment[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: FileAttachment[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const name = get('name') || get('filename') || get('file_name');
        const url = get('url') || get('file_url');
        const author = get('author') || get('uploader') || '';

        if (!name || !url) {
            errors.push(`row ${idx + 2}: missing name or url`);
            return;
        }

        const file: FileAttachment = {
            id: get('id') || `file_${Date.now()}_${idx}`,
            name,
            type: get('type') || 'unknown',
            size: get('size') || '0',
            url,
            mimeType: get('mime') || get('mimeType') || undefined,
            thumbnail: get('thumbnail') || undefined,
            duration: get('duration') || undefined,
            uploadDate: get('uploadDate') || get('upload_date') || new Date().toISOString(),
            metadata: undefined,
            author: author || '',
            category: parseFileCategory(get('category')),
        };

        parsed.push(file);
    });

    return { parsed, errors };
}

/**
 * Export file attachments to CSV text
 */
export function exportFilesToCsv(files: FileAttachment[]): string {
    const headers = [
        'id',
        'name',
        'type',
        'size',
        'url',
        'mimeType',
        'thumbnail',
        'duration',
        'uploadDate',
        'author',
        'category',
    ];

    const rows = files.map(file => [
        file.id || '',
        file.name,
        file.type,
        file.size,
        file.url,
        file.mimeType || '',
        file.thumbnail || '',
        file.duration || '',
        file.uploadDate,
        file.author,
        file.category || '',
    ]);

    return generateCsvText(headers, rows);
}
