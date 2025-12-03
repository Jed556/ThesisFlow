/**
 * CSV import/export utilities for calendar records.
 * Provides helpers for converting between Calendar objects and CSV text.
 */

import type { Calendar, CalendarPermission } from '../../types/schedule';
import {
    parseCsvText,
    normalizeHeader,
    mapHeaderIndexes,
    splitArrayField,
    parseBoolean,
    generateCsvText,
} from './parser';

/** Delimiter used when serializing calendar permissions within CSV cells. */
const PERMISSION_DELIMITER = '|';

/**
 * Represents a calendar row parsed from CSV content.
 * The structure mirrors {@link Calendar} but keeps optional fields optional
 * so that validation can be applied after parsing.
 */
export interface ImportedCalendarRecord extends Partial<Calendar> {
    id?: string;
    permissions?: CalendarPermission[];
}

/**
 * Parse a serialized calendar permission entry from CSV.
 * Expected format: `uid|role|groupId|canView|canEdit|canDelete`.
 */
function parsePermissionEntry(entry: string): CalendarPermission | null {
    const trimmed = entry.trim();
    if (!trimmed) {
        return null;
    }

    const parseBool = (value: unknown, fallback: boolean): boolean => {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            return parseBoolean(value);
        }
        return fallback;
    };

    // Support legacy JSON-serialized permission entries
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const permission: CalendarPermission = {
                canView: parseBool(parsed.canView, true),
                canEdit: parseBool(parsed.canEdit, false),
                canDelete: parseBool(parsed.canDelete, false),
            };

            if (typeof parsed.uid === 'string' && parsed.uid.trim()) {
                permission.uid = parsed.uid.trim();
            }
            if (typeof parsed.role === 'string' && parsed.role.trim()) {
                permission.role = parsed.role.trim();
            }
            if (typeof parsed.groupId === 'string' && parsed.groupId.trim()) {
                permission.groupId = parsed.groupId.trim();
            }

            if (permission.uid || permission.role || permission.groupId) {
                return permission;
            }
        } catch (error) {
            console.warn('Failed to parse calendar permission JSON entry:', error, trimmed);
        }
    }

    const parts = trimmed.split(PERMISSION_DELIMITER).map(part => part.trim());
    const [uid, role, groupId, canViewStr, canEditStr, canDeleteStr] = parts;

    const permission: CalendarPermission = {
        canView: parseBoolean(canViewStr ?? 'true'),
        canEdit: parseBoolean(canEditStr ?? 'false'),
        canDelete: parseBoolean(canDeleteStr ?? 'false'),
    };

    if (uid) {
        permission.uid = uid;
    }
    if (role) {
        permission.role = role;
    }
    if (groupId) {
        permission.groupId = groupId;
    }

    // Require at least one identifier to keep the permission meaningful
    if (!permission.uid && !permission.role && !permission.groupId) {
        return null;
    }

    return permission;
}

/**
 * Serialize a calendar permission entry for CSV export.
 * Mirrors the {@link parsePermissionEntry} format.
 */
function serializePermissionEntry(permission: CalendarPermission): string {
    const parts = [
        permission.uid ?? '',
        permission.role ?? '',
        permission.groupId ?? '',
        permission.canView ? 'true' : 'false',
        permission.canEdit ? 'true' : 'false',
        permission.canDelete ? 'true' : 'false',
    ];

    return parts.join(PERMISSION_DELIMITER);
}

/**
 * Import calendars from CSV text.
 * Returns parsed calendar objects alongside any validation errors encountered.
 */
export function importCalendarsFromCsv(csvText: string): { parsed: ImportedCalendarRecord[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ImportedCalendarRecord[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const id = get('id');
        const name = get('name');
        const typeRaw = (get('type') || 'custom').toLowerCase();
        const ownerUid = get('ownerUid') || get('owner_uid');

        if (!name) {
            errors.push(`row ${index + 2}: missing calendar name`);
            return;
        }
        if (!ownerUid) {
            errors.push(`row ${index + 2}: missing ownerUid`);
            return;
        }

        const allowedTypes: Calendar['type'][] = ['personal', 'group', 'custom'];
        const type = allowedTypes.includes(typeRaw as Calendar['type'])
            ? (typeRaw as Calendar['type'])
            : 'custom';

        const eventIds = splitArrayField(get('eventIds') || get('events')).filter(Boolean);

        // Helper to parse boolean values from various formats
        const parseBool = (value: unknown, fallback: boolean): boolean => {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value !== 0;
            if (typeof value === 'string' && value.trim() !== '') return parseBoolean(value);
            return fallback;
        };

        // Parse permissions with additional validation
        const rawPermissions = get('permissions');
        let permissionEntries: CalendarPermission[] = [];

        if (rawPermissions) {
            // First, try to parse as JSON array (legacy format or corrupted data)
            if (rawPermissions.trim().startsWith('[') && rawPermissions.trim().endsWith(']')) {
                try {
                    const jsonPermissions = JSON.parse(rawPermissions) as unknown[];
                    permissionEntries = jsonPermissions
                        .map(item => {
                            if (typeof item === 'object' && item !== null) {
                                const p = item as Record<string, unknown>;
                                const permission: CalendarPermission = {
                                    canView: parseBool(p.canView, true),
                                    canEdit: parseBool(p.canEdit, false),
                                    canDelete: parseBool(p.canDelete, false),
                                };
                                if (typeof p.uid === 'string' && p.uid.trim()) {
                                    permission.uid = p.uid.trim();
                                }
                                if (typeof p.role === 'string' && p.role.trim()) {
                                    permission.role = p.role.trim();
                                }
                                if (typeof p.groupId === 'string' && p.groupId.trim()) {
                                    permission.groupId = p.groupId.trim();
                                }
                                return permission;
                            }
                            return null;
                        })
                        .filter((p): p is CalendarPermission => p !== null && (!!p.uid || !!p.role || !!p.groupId));
                } catch (jsonError) {
                    console.warn('Failed to parse permissions as JSON array:', jsonError);
                    // Fall back to delimiter-based parsing
                }
            }

            // If JSON parsing didn't work or wasn't attempted, use delimiter-based parsing
            if (permissionEntries.length === 0) {
                permissionEntries = splitArrayField(rawPermissions)
                    .map(parsePermissionEntry)
                    .filter((permission): permission is CalendarPermission => permission !== null);
            }
        }

        const record: ImportedCalendarRecord = {
            id: id || undefined,
            name,
            description: get('description') || undefined,
            type,
            color: get('color') || '#4285F4',
            ownerUid,
            createdBy: get('createdBy') || get('created_by') || ownerUid,
            createdAt: get('createdAt') || get('created_at') || new Date().toISOString(),
            lastModified: get('lastModified') || get('last_modified') || new Date().toISOString(),
            groupId: get('groupId') || get('group_id') || undefined,
            groupName: get('groupName') || get('group_name') || undefined,
            isVisible: parseBoolean(get('isVisible') || 'true'),
            isDefault: get('isDefault') ? parseBoolean(get('isDefault')) : undefined,
            eventIds,
            permissions: permissionEntries.length > 0 ? permissionEntries : undefined,
        };

        parsed.push(record);
    });

    return { parsed, errors };
}

/**
 * Export the provided calendars to CSV text following the import schema.
 */
export function exportCalendarsToCsv(calendars: Calendar[]): string {
    const headers = [
        'id',
        'name',
        'description',
        'type',
        'color',
        'ownerUid',
        'createdBy',
        'createdAt',
        'lastModified',
        'groupId',
        'groupName',
        'isVisible',
        'isDefault',
        'eventIds',
        'permissions',
    ];

    const rows = calendars.map(calendar => {
        // Ensure permissions is actually an array
        let permissionsArray: CalendarPermission[] = [];
        if (Array.isArray(calendar.permissions)) {
            permissionsArray = calendar.permissions;
        } else if (calendar.permissions) {
            // If permissions is somehow a single object, wrap it in an array
            permissionsArray = [calendar.permissions as CalendarPermission];
        }

        // Serialize each permission properly
        const serializedPermissions = permissionsArray
            .map(permission => {
                // Ensure permission is an object with the right structure
                if (typeof permission === 'object' && permission !== null) {
                    return serializePermissionEntry(permission);
                }
                return '';
            })
            .filter(Boolean)
            .join(';');

        return [
            calendar.id || '',
            calendar.name,
            calendar.description ?? '',
            calendar.type ?? calendar.level ?? '',
            calendar.color,
            calendar.ownerUid,
            calendar.createdBy,
            calendar.createdAt,
            calendar.lastModified,
            calendar.groupId ?? '',
            calendar.groupName ?? '',
            calendar.isVisible ? 'true' : 'false',
            calendar.isDefault ? 'true' : 'false',
            (calendar.eventIds ?? []).join(';'),
            serializedPermissions,
        ] as string[];
    });

    return generateCsvText(headers, rows);
}
