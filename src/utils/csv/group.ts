/**
 * CSV import/export for Thesis Groups
 */

import type { ThesisGroup } from '../../types/group';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, splitArrayField, generateCsvText } from './parser';

/**
 * Import groups from CSV text
 */
export function importGroupsFromCsv(csvText: string): { parsed: ThesisGroup[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ThesisGroup[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const name = get('name') || get('group_name') || get('title');
        const leader = get('leader') || get('leader_uid');

        if (!name) {
            errors.push(`row ${idx + 2}: missing group name`);
            return;
        }

        if (!leader) {
            errors.push(`row ${idx + 2}: missing leader`);
            return;
        }

        const members = splitArrayField(get('members') || get('team') || get('students'));
        const statusRaw = (get('status') || 'active').toLowerCase() as ThesisGroup['status'];

        const adviser = get('adviser') || get('adviser_uid') || undefined;
        const editor = get('editor') || get('editor_uid') || undefined;
        const panels = splitArrayField(get('panels'));
        const courseSource = get('courses') || get('course');
        const normalizedCourse = splitArrayField(courseSource)[0] || courseSource || undefined;

        const group: ThesisGroup = {
            id: get('id') || `group_${Date.now()}_${idx}`,
            name,
            description: get('description') || undefined,
            members: {
                leader,
                members,
                adviser,
                editor,
                panels: panels.length > 0 ? panels : undefined,
            },
            status: (['active', 'inactive', 'completed', 'archived'].includes(statusRaw) ? statusRaw : 'active'),
            createdAt: get('createdAt') || get('created_at') || new Date().toISOString(),
            updatedAt: get('updatedAt') || get('updated_at') || new Date().toISOString(),
            thesisTitle: get('thesisTitle') || get('thesis_title') || undefined,
            department: get('department') || undefined,
            course: normalizedCourse,
        };

        parsed.push(group);
    });

    return { parsed, errors };
}

/**
 * Export groups to CSV text
 */
export function exportGroupsToCsv(groups: ThesisGroup[]): string {
    const headers = [
        'id',
        'name',
        'leader',
        'members',
        'adviser',
        'editor',
        'panels',
        'description',
        'status',
        'createdAt',
        'updatedAt',
        'thesisTitle',
        'department',
        'course',
    ];

    const rows = groups.map(group => [
        group.id,
        group.name,
        group.members.leader,
        group.members.members.join(';'),
        group.members.adviser || '',
        group.members.editor || '',
        group.members.panels?.join(';') || '',
        group.description || '',
        group.status,
        group.createdAt,
        group.updatedAt,
        group.thesisTitle || '',
        group.department || '',
        group.course || '',
    ]);

    return generateCsvText(headers, rows);
}
