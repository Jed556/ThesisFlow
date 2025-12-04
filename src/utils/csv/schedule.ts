/**
 * CSV import/export for Schedule Events
 */

import type {
    ScheduleEvent, EventParticipant, EventLocation, ParticipantRole, ParticipantStatus, EventStatus,
    CalendarLevel, CalendarPathContext,
} from '../../types/schedule';
import {
    parseCsvText, normalizeHeader, mapHeaderIndexes, splitArrayField, parseBoolean, generateCsvText
} from './parser';

const parseCalendarLevel = (value?: string): CalendarLevel => {
    const normalized = value?.toLowerCase() as CalendarLevel | undefined;
    const allowed: CalendarLevel[] = ['global', 'department', 'course', 'group', 'personal'];
    return normalized && allowed.includes(normalized) ? normalized : 'personal';
};

/**
 * Parse CalendarPathContext from JSON string
 */
const parseCalendarPathContext = (jsonStr?: string): CalendarPathContext | undefined => {
    if (!jsonStr) return undefined;
    try {
        return JSON.parse(jsonStr) as CalendarPathContext;
    } catch {
        return undefined;
    }
};

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

/**
 * Import schedule events from CSV text
 * @param csvText - CSV text to parse
 * @param defaultCalendarLevel - Default calendar level if not specified in CSV
 * @param defaultCalendarPathContext - Default calendar path context if not specified in CSV
 */
export function importScheduleFromCsv(
    csvText: string,
    defaultCalendarLevel: CalendarLevel = 'personal',
    defaultCalendarPathContext?: CalendarPathContext
): { parsed: ScheduleEvent[]; errors: string[] } {
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
            // Format: uid:role:status
            const parts = p.split(':').map(s => s.trim());
            const uid = parts[0] || '';
            const role = parseParticipantRole(parts[1]);
            const status = parseParticipantStatus(parts[2]);
            return { uid, role, status };
        }).filter(pp => pp.uid);

        const isAllDay = parseBoolean(get('allDay') || get('isAllDay'));

        // Parse calendarLevel and calendarPathContext from CSV, or use defaults
        const calendarLevel = parseCalendarLevel(get('calendarLevel') || get('calendar_level')) || defaultCalendarLevel;
        const calendarPathContextStr = get('calendarPathContext') || get('calendar_path_context');
        const calendarPathContext = parseCalendarPathContext(calendarPathContextStr) ?? defaultCalendarPathContext;

        // Build year from path context or use current year
        const year = calendarPathContext?.year ?? new Date().getFullYear().toString();

        const event: ScheduleEvent = {
            id,
            title,
            description: get('description') || undefined,
            calendarLevel,
            calendarPathContext: calendarPathContext ?? { year },
            status: parseEventStatus(get('status')),
            startDate,
            endDate,
            isAllDay,
            organizer: get('organizer') || (participants.length ? participants[0].uid : ''),
            participants,
            location: (get('location_address') || get('location_room') || get('location_url')) ? ({
                type: (get('location_url') && get('location_address')) ? 'hybrid' :
                    (get('location_url') ? 'virtual' : 'physical'),
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
            createdBy: get('createdBy') || get('created_by') || '',
            createdAt: get('createdDate') || get('createdAt') || get('created_at') || new Date().toISOString(),
            lastModified: get('lastModified') || get('last_modified') || new Date().toISOString(),
            lastModifiedBy: get('lastModifiedBy') || get('last_modified_by') || get('createdBy') || get('created_by') || '',
        };

        parsed.push(event);
    });

    return { parsed, errors };
}

/**
 * Export schedule events to CSV text
 */
export function exportScheduleToCsv(events: ScheduleEvent[]): string {
    const headers = [
        'id',
        'title',
        'description',
        'calendarLevel',
        'calendarPathContext',
        'status',
        'startDate',
        'endDate',
        'isAllDay',
        'organizer',
        'participants',
        'location_address',
        'location_room',
        'location_url',
        'location_platform',
        'tags',
        'color',
        'createdBy',
        'createdAt',
    ];

    const rows: string[][] = events.map(event => [
        event.id,
        event.title,
        event.description ?? '',
        event.calendarLevel,
        event.calendarPathContext ? JSON.stringify(event.calendarPathContext) : '',
        event.status,
        event.startDate,
        event.endDate,
        event.isAllDay ? 'true' : 'false',
        event.organizer,
        event.participants.map(p => `${p.uid}:${p.role}:${p.status}`).join(';'),
        event.location?.address ?? '',
        event.location?.room ?? '',
        event.location?.url ?? '',
        event.location?.platform ?? '',
        event.tags?.join(';') ?? '',
        event.color ?? '',
        event.createdBy,
        event.createdAt,
    ]);

    return generateCsvText(headers, rows);
}
