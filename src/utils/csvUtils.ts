import type { ThesisGroup } from '../types/group';
import type { FormTemplate, FormField } from '../types/forms';

/**
 * Convert groups to CSV format
 */
export function groupsToCSV(groups: ThesisGroup[]): string {
    const headers = [
        'ID',
        'Name',
        'Description',
        'Leader',
        'Members',
        'Advisers',
        'Editors',
        'Status',
        'Created At',
        'Updated At',
    ];

    const rows = groups.map((group) => [
        group.id,
        group.name,
        group.description || '',
        group.leader,
        (group.members || []).join(';'),
        group.adviser,
        group.editor,
        group.status,
        group.createdAt,
        group.updatedAt,
    ]);

    return [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
}

/**
 * Parse CSV to groups
 */
export function csvToGroups(csv: string): Omit<ThesisGroup, 'id'>[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    const groups: Omit<ThesisGroup, 'id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length < 10) {
            continue; // Skip invalid rows
        }

        groups.push({
            name: values[1],
            description: values[2] || undefined,
            leader: values[3],
            members: values[4] ? values[4].split(';').filter(Boolean) : [],
            adviser: values[5],
            editor: values[6],
            status: (values[7] as ThesisGroup['status']) || 'active',
            createdAt: values[8] || new Date().toISOString(),
            updatedAt: values[9] || new Date().toISOString(),
        });
    }

    return groups;
}

/**
 * Convert form templates to CSV format
 */
export function formTemplatesToCSV(forms: FormTemplate[]): string {
    const headers = [
        'ID',
        'Title',
        'Description',
        'Version',
        'Audience',
        'Status',
        'Created At',
        'Updated At',
        'Created By',
        'Tags',
        'Due In Days',
        'Reviewer Notes',
        'Fields (JSON)',
        'Workflow (JSON)',
        'Available To Groups',
    ];

    const rows = forms.map((form) => [
        form.id,
        form.title,
        form.description || '',
        form.version,
        form.audience,
        form.status,
        form.createdAt,
        form.updatedAt,
        form.createdBy,
        (form.tags || []).join(';'),
        form.dueInDays?.toString() || '',
        form.reviewerNotes || '',
        JSON.stringify(form.fields),
        JSON.stringify(form.workflow || []),
        (form.availableToGroups || []).join(';'),
    ]);

    return [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
}

/**
 * Parse CSV to form templates
 */
export function csvToFormTemplates(csv: string): Omit<FormTemplate, 'id'>[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    const forms: Omit<FormTemplate, 'id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length < 15) {
            continue; // Skip invalid rows
        }

        let fields: FormField[] = [];
        try {
            fields = JSON.parse(values[12]) as FormField[];
        } catch (error) {
            console.error('Failed to parse fields JSON:', error);
        }

        let workflow = [];
        try {
            workflow = JSON.parse(values[13]);
        } catch (error) {
            console.error('Failed to parse workflow JSON:', error);
        }

        forms.push({
            title: values[1],
            description: values[2] || undefined,
            version: values[3],
            audience: (values[4] as FormTemplate['audience']) || 'student',
            fields,
            status: (values[5] as FormTemplate['status']) || 'draft',
            createdAt: values[6] || new Date().toISOString(),
            updatedAt: values[7] || new Date().toISOString(),
            createdBy: values[8],
            tags: values[9] ? values[9].split(';').filter(Boolean) : undefined,
            dueInDays: values[10] ? parseInt(values[10], 10) : undefined,
            reviewerNotes: values[11] || undefined,
            workflow,
            availableToGroups: values[14] ? values[14].split(';').filter(Boolean) : undefined,
        });
    }

    return forms;
}

/**
 * Parse a single CSV line, handling quoted values with commas and escaped quotes
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Add last field
    result.push(current);

    return result;
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Read CSV file from input
 */
export function readCSVFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
                resolve(content);
            } else {
                reject(new Error('Failed to read file content'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}
