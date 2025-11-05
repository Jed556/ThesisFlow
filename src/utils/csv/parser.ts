/**
 * Core CSV parsing utilities
 * Low-level CSV text parsing and helper functions
 */

/**
 * Parse CSV text into headers and rows
 * Handles quoted fields, escaped quotes, and CRLF line endings
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: string[][] } {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i];
        const next = csvText[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                // escaped quote
                field += '"';
                i++; // skip next
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }

        if (!inQuotes && (ch === ',')) {
            current.push(field);
            field = '';
            continue;
        }

        if (!inQuotes && (ch === '\n' || ch === '\r')) {
            // handle CRLF
            if (ch === '\r' && next === '\n') {
                i++;
            }
            current.push(field);
            rows.push(current);
            current = [];
            field = '';
            continue;
        }

        field += ch;
    }

    // push last field/row
    if (field !== '' || current.length > 0) {
        current.push(field);
        rows.push(current);
    }

    if (rows.length === 0) return { headers: [], rows: [] };

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).map(r => r.map(c => c.trim()));

    return { headers, rows: dataRows };
}

/**
 * Normalize header name for matching
 * Converts to lowercase and replaces non-alphanumeric with underscore
 */
export function normalizeHeader(h?: string): string {
    if (!h) return '';
    return h
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Split a field containing array values
 * Supports semicolon, pipe, or comma separators
 */
export function splitArrayField(raw?: string): string[] {
    if (!raw) return [];
    return raw
        .split(/[;|\u007C]/)
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Parse boolean from string value
 */
export function parseBoolean(raw?: string): boolean {
    if (!raw) return false;
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 't';
}

/**
 * Create a header-to-index mapping for easy column access
 */
export function mapHeaderIndexes(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    headers.forEach((h, i) => (map[normalizeHeader(h)] = i));
    return map;
}

/**
 * Convert data to CSV text format
 */
export function generateCsvText(headers: string[], rows: string[][]): string {
    const escapeField = (field: string): string => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    };

    const headerLine = headers.map(escapeField).join(',');
    const dataLines = rows.map(row => row.map(escapeField).join(',')).join('\n');

    return `${headerLine}\n${dataLines}`;
}
