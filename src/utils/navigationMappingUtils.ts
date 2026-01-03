/**
 * Navigation Mapping Utilities
 * 
 * Maps audit categories and paths to navigation segments for drawer badges.
 * This allows notifications to be distributed across relevant navigation items.
 */

import type { AuditCategory, UserAuditEntry } from '../types/audit';
import { getAuditNavigationInfo } from './auditNotificationUtils';

/**
 * Map of navigation paths to their corresponding drawer segments.
 * These segments must match the segment property in page metadata.
 */
const PATH_TO_SEGMENT_MAP: Record<string, string> = {
    // Main routes
    '/dashboard': 'dashboard',
    '/calendar': 'calendar',

    // Student routes
    '/group': 'group',
    '/thesis': 'thesis',
    '/student-thesis-workspace': 'student-thesis-workspace',
    '/topic-proposals': 'topic-proposals',
    '/terminal-requirements': 'terminal-requirements',
    '/panel-comments': 'panel-comments',
    '/recommendation': 'recommendation',

    // Expert routes
    '/expert-requests': 'expert-requests',
    '/adviser-expert-requests': 'adviser-expert-requests',
    '/editor-expert-requests': 'editor-expert-requests',
    '/statistician-requests': 'statistician-requests',

    // Panel routes
    '/panel-feedback': 'panel-feedback',
    '/panel-terminal-requirements': 'panel-terminal-requirements',

    // Moderator routes
    '/mod-topic-proposals': 'mod-topic-proposals',
    '/moderator-thesis-overview': 'moderator-thesis-overview',

    // Adviser routes
    '/adviser-thesis-overview': 'adviser-thesis-overview',
    '/adviser-terminal-requirements': 'adviser-terminal-requirements',

    // Editor routes
    '/editor-thesis-overview': 'editor-thesis-overview',
    '/editor-terminal-requirements': 'editor-terminal-requirements',

    // Statistician routes
    '/statistician-thesis-overview': 'statistician-thesis-overview',
    '/statistician-terminal-requirements': 'statistician-terminal-requirements',

    // Admin routes
    '/admin-dashboard': 'admin-dashboard',
    '/slot-increase': 'slot-increase',

    // Management routes
    '/audits': 'audits',
    '/settings': 'settings',
};

/**
 * Fallback segment for categories that don't have a direct path mapping
 */
const CATEGORY_FALLBACK_SEGMENT: Partial<Record<AuditCategory, string>> = {
    group: 'group',
    thesis: 'thesis',
    submission: 'student-thesis-workspace',
    chapter: 'student-thesis-workspace',
    panel: 'panel-feedback',
    proposal: 'topic-proposals',
    member: 'group',
    expert: 'expert-requests',
    comment: 'student-thesis-workspace',
    file: 'student-thesis-workspace',
    stage: 'thesis',
    terminal: 'terminal-requirements',
    template: 'audits',
    account: 'settings',
    notification: 'audits',
    other: 'audits',
};

/**
 * Get the navigation segment for a given path
 * @param path - The navigation path (e.g., '/group', '/thesis')
 * @returns The corresponding segment or 'audits' as fallback
 */
export function getSegmentFromPath(path: string): string {
    // Direct match
    if (PATH_TO_SEGMENT_MAP[path]) {
        return PATH_TO_SEGMENT_MAP[path];
    }

    // Try to find partial match (for paths with parameters)
    const basePath = path.split('/').slice(0, 2).join('/');
    if (PATH_TO_SEGMENT_MAP[basePath]) {
        return PATH_TO_SEGMENT_MAP[basePath];
    }

    return 'audits';
}

/**
 * Get the navigation segment for an audit entry based on its category and action
 * @param category - The audit category
 * @param action - The audit action
 * @param details - Optional audit details
 * @returns The navigation segment where this audit should show a badge
 */
export function getSegmentForAuditEntry(
    category: AuditCategory,
    action: string,
    details?: Record<string, unknown>
): string {
    // First try to get the navigation info for this audit
    const navInfo = getAuditNavigationInfo(category, action as never, details);

    if (navInfo?.path) {
        const segment = getSegmentFromPath(navInfo.path);
        if (segment !== 'audits') {
            return segment;
        }
    }

    // Fall back to category-based mapping
    return CATEGORY_FALLBACK_SEGMENT[category] ?? 'audits';
}

/**
 * Interface for segment-grouped audit counts
 */
export interface SegmentAuditCounts {
    /** Map of segment to unread count */
    counts: Map<string, number>;
    /** Total unread count across all segments */
    totalUnread: number;
}

/**
 * Group audit entries by their target navigation segment and count unread items
 * @param entries - Array of user audit entries
 * @returns Object with counts per segment and total unread
 */
export function groupAuditsBySegment(entries: UserAuditEntry[]): SegmentAuditCounts {
    const counts = new Map<string, number>();
    let totalUnread = 0;

    for (const entry of entries) {
        if (entry.read) {
            continue; // Skip read entries
        }

        totalUnread++;

        const segment = getSegmentForAuditEntry(
            entry.category,
            entry.action,
            entry.details
        );

        counts.set(segment, (counts.get(segment) ?? 0) + 1);
    }

    return { counts, totalUnread };
}

/**
 * List of all segments that can have notification badges
 */
export const BADGEABLE_SEGMENTS = [
    'audits',
    'group',
    'thesis',
    'student-thesis-workspace',
    'topic-proposals',
    'terminal-requirements',
    'panel-comments',
    'panel-feedback',
    'expert-requests',
    'adviser-expert-requests',
    'editor-expert-requests',
    'statistician-requests',
    'mod-topic-proposals',
    'recommendation',
] as const;

export type BadgeableSegment = typeof BADGEABLE_SEGMENTS[number];
