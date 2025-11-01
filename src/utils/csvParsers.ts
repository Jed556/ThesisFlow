/**
 * Shared CSV parsing utilities for ThesisFlow
 * - parseCsvText: low-level CSV -> headers + rows
 * - convenience converters: parseUsers, parseEvents, parseFiles, parseAcademicCalendarEntries, parseTheses
 *
 * Note: These converters aim to be forgiving with common CSV shapes.
 * - Header names are normalized (trim, lower-case, remove non-alphanum)
 * - Arrays may be provided as semicolon- or pipe-separated values
 * - Participants for events may be provided as `email` or `email:role:status`
 *
 * Assumptions made when fields are missing are documented in each parser.
 */

import type { UserProfile, UserRole } from '../types/profile';
import type {
    ScheduleEvent, EventParticipant, EventLocation, ParticipantRole, ParticipantStatus, EventStatus
} from '../types/schedule';
import type { FileAttachment } from '../types/file';
import type { ThesisData, ThesisChapter } from '../types/thesis';

// --- low level CSV parsing ---
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
            // if CRLF sequence, skip the LF
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
    // push last
    if (field !== '' || current.length > 0) {
        current.push(field);
        rows.push(current);
    }

    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).map(r => r.map(c => c.trim()));
    return { headers, rows: dataRows };
}

function normalizeHeader(h?: string): string {
    if (!h) return '';
    return h
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function splitArrayField(raw?: string): string[] {
    if (!raw) return [];
    // Support semicolon, pipe, or comma inside a single cell
    return raw
        .split(/[;|\u007C]/)
        .map(s => s.trim())
        .filter(Boolean);
}

function parseBoolean(raw?: string): boolean {
    if (!raw) return false;
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 't';
}

const parseParticipantRole = (value?: string): ParticipantRole => {
    const normalized = value?.toLowerCase() as ParticipantRole | undefined;
    const allowed: ParticipantRole[] = ['organizer', 'required', 'optional', 'observer'];
    return normalized && allowed.includes(normalized) ? normalized : 'required';
};

const parseParticipantStatus = (value?: string): ParticipantStatus => {
    const normalized = value?.toLowerCase() as ParticipantStatus | undefined;
    const allowed: ParticipantStatus[] = ['pending', 'accepted', 'declined', 'tentative'];
    return normalized && allowed.includes(normalized) ? normalized : 'pending';
};

const parseEventStatus = (value?: string): EventStatus => {
    const normalized = value?.toLowerCase() as EventStatus | undefined;
    const allowed: EventStatus[] = ['scheduled', 'confirmed', 'cancelled', 'completed', 'rescheduled'];
    return normalized && allowed.includes(normalized) ? normalized : 'scheduled';
};

const parseFileCategory = (value?: string): FileAttachment['category'] | undefined => {
    const normalized = value?.toLowerCase();
    return normalized === 'submission' || normalized === 'attachment' ? normalized : undefined;
};

// helper to map headers to column index
function mapHeaderIndexes(headers: string[]) {
    const map: Record<string, number> = {};
    headers.forEach((h, i) => (map[normalizeHeader(h)] = i));
    return map;
}

// --- user parser ---
type ParsedCsvUser = UserProfile & { password?: string };

export function parseUsers(csvText: string): { parsed: ParsedCsvUser[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ParsedCsvUser[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';
        const email = (get('email') || get('e-mail') || get('user_email')).trim();
        const firstName = get('firstName') || get('first_name') || get('firstname') || get('given_name');
        const lastName = get('lastName') || get('last_name') || get('lastname') || get('family_name');
        const roleRaw = (get('role') || 'student').toLowerCase() as UserRole;
        const idRaw = get('id') || '';
        const password = get('password') || get('pass'); // Optional password field for CSV import

        if (!email) {
            errors.push(`row ${idx + 2}: missing email`);
            return;
        }

        const id = idRaw ? Number(idRaw) || Date.now() + idx : Date.now() + idx;

        const user: UserProfile = {
            id,
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            role: (['student', 'editor', 'adviser', 'admin', 'developer'].includes(roleRaw) ? (roleRaw as UserRole) : 'student'),
            prefix: get('prefix') || undefined,
            middleName: get('middleName') || get('middle_name') || undefined,
            suffix: get('suffix') || undefined,
            department: get('department') || undefined,
            avatar: get('avatar') || undefined,
        };

        parsed.push(password ? { ...user, password } : user);
    });

    // require at least one admin (useful for seeding flows)
    if (!parsed.some(p => p.role === 'admin')) {
        errors.push('no admin user found; at least one admin is required');
    }

    return { parsed, errors };
}

// --- event parser ---
export function parseEvents(csvText: string): { parsed: ScheduleEvent[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ScheduleEvent[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';
        const title = get('title') || get('name');
        const id = get('id') || `evt_${Date.now()}_${idx}`;
        const startDate = get('start') || get('startDate') || get('start_date');
        const endDate = get('end') || get('endDate') || get('end_date');
        if (!title || !startDate || !endDate) {
            errors.push(`row ${idx + 2}: missing required title/start/end`);
            return;
        }

        const participantsRaw = get('participants') || get('attendees') || '';
        const participants: EventParticipant[] = splitArrayField(participantsRaw).map(p => {
            // support 'email:role:status' or just email
            const parts = p.split(':').map(s => s.trim());
            const email = parts[0] || '';
            const role = parseParticipantRole(parts[1]);
            const status = parseParticipantStatus(parts[2]);
            return { email, role, status };
        }).filter(pp => pp.email);

        const isAllDay = parseBoolean(get('allDay') || get('isAllDay'));

        const event: ScheduleEvent = {
            id,
            title,
            description: get('description') || undefined,
            calendarId: get('calendarId') || get('calendar_id') || 'default',
            status: parseEventStatus(get('status')),
            startDate,
            endDate,
            isAllDay,
            organizer: get('organizer') || (participants.length ? participants[0].email : ''),
            participants,
            location: (get('location_address') || get('location_room') || get('location_url')) ? ({
                type: (get('location_url') && get('location_address')) ? 'hybrid' as const :
                    (get('location_url') ? 'virtual' as const : 'physical' as const),
                address: get('location_address') || undefined,
                room: get('location_room') || undefined,
                url: get('location_url') || undefined,
                platform: get('location_platform') || undefined,
            } as EventLocation) : undefined,
            tags: splitArrayField(get('tags')).filter(Boolean),
            color: get('color') || undefined,
            attachments: splitArrayField(get('attachments')).filter(Boolean),
            recurrence: undefined,
            reminders: undefined,
            createdBy: get('createdBy') || '',
            createdAt: get('createdDate') || get('createdAt') || new Date().toISOString(),
            lastModified: get('lastModified') || new Date().toISOString(),
            lastModifiedBy: get('lastModifiedBy') || get('createdBy') || '',
        };

        parsed.push(event);
    });

    return { parsed, errors };
}

// --- files parser ---
export function parseFiles(csvText: string): { parsed: FileAttachment[]; errors: string[] } {
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
            name,
            type: get('type') || 'unknown',
            size: get('size') || '0',
            url,
            mimeType: get('mime') || get('mimeType') || undefined,
            thumbnail: get('thumbnail') || undefined,
            duration: get('duration') || undefined,
            uploadDate: get('uploadDate') || new Date().toISOString(),
            metadata: undefined,
            author: author || '',
            category: parseFileCategory(get('category')),
        };

        parsed.push(file);
    });

    return { parsed, errors };
}

// --- academic calendar parser (as schedule events) ---
export function parseAcademicCalendarEntries(csvText: string): { parsed: ScheduleEvent[]; errors: string[] } {
    // reuse parseEvents but allow some academic-focused aliases
    return parseEvents(csvText);
}

// --- thesis parser ---
export function parseTheses(csvText: string): { parsed: ThesisData[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ThesisData[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';
        const title = get('title');
        if (!title) {
            errors.push(`row ${idx + 2}: missing title`);
            return;
        }

        const members = splitArrayField(get('members') || get('team') || get('group'));

        const chaptersRaw = get('chapters') || '';
        let chapters: ThesisChapter[] = [];
        try {
            if (chaptersRaw.trim().startsWith('[') || chaptersRaw.trim().startsWith('{')) {
                // try parse JSON
                const parsedJson = JSON.parse(chaptersRaw);
                if (Array.isArray(parsedJson)) {
                    chapters = parsedJson.map((entry, i) => {
                        const chapter = (typeof entry === 'object' && entry !== null ? entry : {}) as Partial<ThesisChapter>;
                        return {
                            id: typeof chapter.id === 'number' ? chapter.id : i + 1,
                            title: typeof chapter.title === 'string' ? chapter.title : `Chapter ${i + 1}`,
                            status: typeof chapter.status === 'string' ? chapter.status : 'not_submitted',
                            submissionDate: typeof chapter.submissionDate === 'string' ? chapter.submissionDate : null,
                            lastModified: typeof chapter.lastModified === 'string' ? chapter.lastModified : null,
                            submissions: Array.isArray(chapter.submissions)
                                ? chapter.submissions.map(item => String(item))
                                : [],
                            comments: Array.isArray(chapter.comments)
                                ? (chapter.comments as ThesisChapter['comments'])
                                : [],
                        } satisfies ThesisChapter;
                    });
                }
            } else if (chaptersRaw) {
                // semi-colon separated chapter titles
                chapters = splitArrayField(chaptersRaw).map((t, i) => ({
                    id: i + 1,
                    title: t,
                    status: 'not_submitted',
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

        const thesis: ThesisData = {
            title,
            leader: get('leader') || '',
            members,
            adviser: get('adviser') || '',
            editor: get('editor') || '',
            submissionDate: get('submissionDate') || new Date().toISOString(),
            lastUpdated: get('lastUpdated') || new Date().toISOString(),
            overallStatus: get('overallStatus') || 'not_submitted',
            chapters,
        };

        parsed.push(thesis);
    });

    return { parsed, errors };
}

export default {
    parseCsvText,
    parseUsers,
    parseEvents,
    parseFiles,
    parseAcademicCalendarEntries,
    parseTheses,
};
