/**
 * Navigation Mapping Utilities
 * 
 * SINGLE SOURCE OF TRUTH for audit category → navigation path mappings.
 * This module centralizes all navigation mappings to ensure consistency
 * across drawer badges, audit notifications, and "View Details" navigation.
 */

import type { AuditCategory, UserAuditEntry } from '../types/audit';
import type { UserRole } from '../types/profile';

// ============================================================================
// Centralized Navigation Configuration
// ============================================================================

/**
 * Navigation info for a category, with role-specific paths
 */
export interface CategoryNavigationConfig {
    /** Default path (fallback) */
    defaultPath: string;
    /** Default segment for drawer badges */
    defaultSegment: string;
    /** Role-specific paths (overrides defaultPath for specific roles) */
    roleSpecificPaths?: Partial<Record<UserRole, string>>;
    /** Role-specific segments (overrides defaultSegment for specific roles) */
    roleSpecificSegments?: Partial<Record<UserRole, string>>;
    /** Roles that have access to this category's pages */
    allowedRoles: UserRole[];
}

/**
 * MASTER NAVIGATION CONFIG - Single source of truth for all category mappings
 * 
 * When adding new categories or changing paths:
 * 1. Update this config
 * 2. Everything else (badges, navigation, segments) will automatically sync
 */
export const CATEGORY_NAVIGATION_CONFIG: Record<AuditCategory, CategoryNavigationConfig> = {
    group: {
        defaultPath: '/group',
        defaultSegment: 'group',
        allowedRoles: ['student'],
    },
    thesis: {
        defaultPath: '/thesis',
        defaultSegment: 'thesis',
        allowedRoles: ['student'],
    },
    submission: {
        defaultPath: '/student-thesis-workspace',
        defaultSegment: 'student-thesis-workspace',
        roleSpecificPaths: {
            adviser: '/adviser-thesis-overview',
            editor: '/editor-thesis-overview',
            statistician: '/statistician-thesis-overview',
            moderator: '/moderator-thesis-overview',
        },
        roleSpecificSegments: {
            adviser: 'adviser-thesis-overview',
            editor: 'editor-thesis-overview',
            statistician: 'statistician-thesis-overview',
            moderator: 'moderator-thesis-overview',
        },
        allowedRoles: ['student', 'adviser', 'editor', 'statistician', 'moderator'],
    },
    chapter: {
        defaultPath: '/student-thesis-workspace',
        defaultSegment: 'student-thesis-workspace',
        allowedRoles: ['student', 'adviser', 'editor', 'statistician', 'moderator'],
    },
    proposal: {
        defaultPath: '/topic-proposals',
        defaultSegment: 'topic-proposals',
        roleSpecificPaths: {
            moderator: '/mod-topic-proposals',
            head: '/head-topic-proposals',
        },
        roleSpecificSegments: {
            moderator: 'mod-topic-proposals',
            head: 'head-topic-proposals',
        },
        allowedRoles: ['student', 'moderator', 'head'],
    },
    terminal: {
        defaultPath: '/terminal-requirements',
        defaultSegment: 'terminal-requirements',
        roleSpecificPaths: {
            adviser: '/adviser-terminal-requirements',
            editor: '/editor-terminal-requirements',
            statistician: '/statistician-terminal-requirements',
            panel: '/panel-terminal-requirements',
        },
        roleSpecificSegments: {
            adviser: 'adviser-terminal-requirements',
            editor: 'editor-terminal-requirements',
            statistician: 'statistician-terminal-requirements',
            panel: 'panel-terminal-requirements',
        },
        allowedRoles: ['student', 'adviser', 'editor', 'statistician', 'panel'],
    },
    panel: {
        defaultPath: '/panel-comments',
        defaultSegment: 'panel-comments',
        roleSpecificPaths: {
            panel: '/panel-feedback',
        },
        roleSpecificSegments: {
            panel: 'panel-feedback',
        },
        allowedRoles: ['student', 'panel'],
    },
    expert: {
        defaultPath: '/recommendation',
        defaultSegment: 'recommendation',
        roleSpecificPaths: {
            adviser: '/adviser-requests',
            editor: '/editor-requests',
            statistician: '/statistician-requests',
        },
        roleSpecificSegments: {
            adviser: 'adviser-requests',
            editor: 'editor-requests',
            statistician: 'statistician-requests',
        },
        allowedRoles: ['student', 'adviser', 'editor', 'statistician'],
    },
    member: {
        defaultPath: '/group',
        defaultSegment: 'group',
        allowedRoles: ['student'],
    },
    comment: {
        defaultPath: '/student-thesis-workspace',
        defaultSegment: 'student-thesis-workspace',
        allowedRoles: ['student', 'adviser', 'editor', 'statistician', 'moderator'],
    },
    file: {
        defaultPath: '/student-thesis-workspace',
        defaultSegment: 'student-thesis-workspace',
        allowedRoles: ['student', 'adviser', 'editor', 'statistician'],
    },
    stage: {
        defaultPath: '/thesis',
        defaultSegment: 'thesis',
        allowedRoles: ['student', 'admin'],
    },
    template: {
        defaultPath: '/audits',
        defaultSegment: 'audits',
        allowedRoles: [],
    },
    account: {
        defaultPath: '/settings',
        defaultSegment: 'settings',
        allowedRoles: [],
    },
    notification: {
        defaultPath: '/audits',
        defaultSegment: 'audits',
        allowedRoles: [],
    },
    other: {
        defaultPath: '/audits',
        defaultSegment: 'audits',
        allowedRoles: [],
    },
};

// ============================================================================
// Navigation Path Functions
// ============================================================================

/**
 * Get the navigation path for a category, optionally adjusted for user role
 * @param category - The audit category
 * @param userRole - Optional user role for role-specific paths
 * @returns The navigation path
 */
export function getNavigationPathForCategory(
    category: AuditCategory,
    userRole?: UserRole
): string {
    const config = CATEGORY_NAVIGATION_CONFIG[category];
    if (!config) return '/audits';

    // Check for role-specific path
    if (userRole && config.roleSpecificPaths?.[userRole]) {
        return config.roleSpecificPaths[userRole]!;
    }

    return config.defaultPath;
}

/**
 * Get the navigation segment for a category, optionally adjusted for user role
 * @param category - The audit category  
 * @param userRole - Optional user role for role-specific segments
 * @returns The navigation segment
 */
export function getNavigationSegmentForCategory(
    category: AuditCategory,
    userRole?: UserRole
): string {
    const config = CATEGORY_NAVIGATION_CONFIG[category];
    if (!config) return 'audits';

    // Check for role-specific segment
    if (userRole && config.roleSpecificSegments?.[userRole]) {
        return config.roleSpecificSegments[userRole]!;
    }

    return config.defaultSegment;
}

/**
 * Get allowed roles for a category
 * @param category - The audit category
 * @returns Array of allowed roles (empty means all roles)
 */
export function getAllowedRolesForCategory(category: AuditCategory): UserRole[] {
    return CATEGORY_NAVIGATION_CONFIG[category]?.allowedRoles ?? [];
}

// ============================================================================
// Path to Segment Mapping (for reverse lookups)
// ============================================================================

/**
 * Map of navigation paths to their corresponding drawer segments.
 * Auto-generated from CATEGORY_NAVIGATION_CONFIG for consistency.
 */
const PATH_TO_SEGMENT_MAP: Record<string, string> = {
    // Main routes
    '/dashboard': 'dashboard',
    '/calendar': 'calendar',
    '/audits': 'audits',
    '/settings': 'settings',
    '/sign-in': 'sign-in',

    // Student routes
    '/group': 'group',
    '/thesis': 'thesis',
    '/student-thesis-workspace': 'student-thesis-workspace',
    '/topic-proposals': 'topic-proposals',
    '/terminal-requirements': 'terminal-requirements',
    '/panel-comments': 'panel-comments',
    '/recommendation': 'recommendation',

    // Expert request routes
    '/adviser-requests': 'adviser-requests',
    '/editor-requests': 'editor-requests',
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

    // Head routes
    '/head-topic-proposals': 'head-topic-proposals',
    '/head-thesis-overview': 'head-thesis-overview',

    // Admin routes
    '/admin-dashboard': 'admin-dashboard',
    '/admin-thesis-overview': 'admin-thesis-overview',
    '/admin-terminal-requirements': 'admin-terminal-requirements',
    '/slot-increase': 'slot-increase',
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

// ============================================================================
// Audit Entry Functions
// ============================================================================

/**
 * Get the navigation segment for an audit entry based on its category and action
 * @param category - The audit category
 * @param action - The audit action
 * @param details - Optional audit details
 * @param userRole - Optional user role for role-specific segments
 * @returns The navigation segment where this audit should show a badge
 */
export function getSegmentForAuditEntry(
    category: AuditCategory,
    action: string,
    details?: Record<string, unknown>,
    userRole?: UserRole
): string {
    return getNavigationSegmentForCategory(category, userRole);
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
 * @param userRole - Optional user role for role-specific segment mapping
 * @returns Object with counts per segment and total unread
 */
export function groupAuditsBySegment(
    entries: UserAuditEntry[],
    userRole?: UserRole
): SegmentAuditCounts {
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
            entry.details,
            userRole
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
    'recommendation',
    'adviser-requests',
    'editor-requests',
    'statistician-requests',
    'mod-topic-proposals',
    'head-topic-proposals',
    'adviser-thesis-overview',
    'editor-thesis-overview',
    'statistician-thesis-overview',
    'moderator-thesis-overview',
    'adviser-terminal-requirements',
    'editor-terminal-requirements',
    'statistician-terminal-requirements',
    'panel-terminal-requirements',
] as const;

export type BadgeableSegment = typeof BADGEABLE_SEGMENTS[number];
