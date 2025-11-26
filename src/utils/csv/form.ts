/**
 * CSV import/export for Form Templates
 */

import type { FormTemplate, FormField, FormWorkflowStep } from '../../types/forms';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, splitArrayField, generateCsvText } from './parser';

/**
 * Import form templates from CSV text
 */
export function importFormsFromCsv(csvText: string): { parsed: FormTemplate[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: FormTemplate[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const title = get('title') || get('name');
        const id = get('id') || `form_${Date.now()}_${idx}`;
        const version = get('version') || '1.0.0';
        const audience = get('audience') || get('target_audience');

        if (!title) {
            errors.push(`row ${idx + 2}: missing title`);
            return;
        }

        if (!audience || !['student', 'adviser', 'editor'].includes(audience)) {
            errors.push(`row ${idx + 2}: invalid or missing audience (must be student, adviser, or editor)`);
            return;
        }

        const statusRaw = (get('status') || 'draft').toLowerCase() as FormTemplate['status'];
        const createdBy = get('createdBy') || get('created_by') || get('author') || '';

        // Parse fields from JSON string
        let fields: FormField[] = [];
        const fieldsRaw = get('fields');
        if (fieldsRaw) {
            try {
                const parsed = JSON.parse(fieldsRaw);
                if (Array.isArray(parsed)) {
                    fields = parsed;
                }
            } catch (error) {
                errors.push(`row ${idx + 2}: invalid fields JSON - ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }

        // Parse workflow from JSON string
        let workflow: FormWorkflowStep[] | undefined = undefined;
        const workflowRaw = get('workflow');
        if (workflowRaw) {
            try {
                const parsed = JSON.parse(workflowRaw);
                if (Array.isArray(parsed)) {
                    workflow = parsed;
                }
            } catch (error) {
                errors.push(`row ${idx + 2}: invalid workflow JSON - ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }

        const form: FormTemplate = {
            id,
            title,
            description: get('description') || undefined,
            version,
            audience: audience as FormTemplate['audience'],
            fields,
            status: (['draft', 'active', 'archived'].includes(statusRaw) ? statusRaw : 'draft'),
            createdAt: get('createdAt') || get('created_at') || new Date().toISOString(),
            updatedAt: get('updatedAt') || get('updated_at') || new Date().toISOString(),
            createdBy,
            tags: splitArrayField(get('tags')),
            reviewerNotes: get('reviewerNotes') || get('reviewer_notes') || undefined,
            dueInDays: get('dueInDays') || get('due_in_days') ? parseInt(get('dueInDays') || get('due_in_days')) : undefined,
            attachments: undefined, // File attachments need special handling
            workflow,
            availableToGroups: splitArrayField(get('availableToGroups') || get('available_to_groups')),
        };

        parsed.push(form);
    });

    return { parsed, errors };
}

/**
 * Export form templates to CSV text
 */
export function exportFormsToCsv(forms: FormTemplate[]): string {
    const headers = [
        'id',
        'title',
        'description',
        'version',
        'audience',
        'status',
        'createdAt',
        'updatedAt',
        'createdBy',
        'tags',
        'reviewerNotes',
        'dueInDays',
        'fields',
        'workflow',
        'availableToGroups',
    ];

    const rows = forms.map(form => [
        form.id,
        form.title,
        form.description || '',
        form.version,
        form.audience,
        form.status,
        form.createdAt,
        form.updatedAt,
        form.createdBy,
        form.tags?.join(';') || '',
        form.reviewerNotes || '',
        form.dueInDays?.toString() || '',
        JSON.stringify(form.fields),
        form.workflow ? JSON.stringify(form.workflow) : '',
        form.availableToGroups?.join(';') || '',
    ]);

    return generateCsvText(headers, rows);
}
