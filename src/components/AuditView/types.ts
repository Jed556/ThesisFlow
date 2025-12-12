import type { AuditCategory, AuditLocationType } from '../../types/audit';
import type { ThesisGroup } from '../../types/group';
import type { UserRole } from '../../types/profile';

/**
 * Audit scope levels based on user privileges
 * - 'personal': User's personal notifications (user audits only visible to the user)
 * - 'group': Audits for groups the user belongs to
 * - 'course': Audits for all groups in the user's course (moderator)
 * - 'departmental': Audits for all groups in the user's department (head/moderator)
 * - 'admin': Admin-level audits (template changes, system actions) - for admin only
 */
export type AuditScope = 'personal' | 'group' | 'course' | 'departmental' | 'admin';

/**
 * Audit data source type for filtering
 */
export type AuditDataSource = 'group' | 'user' | 'all';

/**
 * Configuration for available audit scopes
 */
export interface AuditScopeConfig {
    /** Available scopes for the current user */
    availableScopes: AuditScope[];
    /** Default scope to select initially */
    defaultScope?: AuditScope;
    /** Whether to show the scope selector */
    showScopeSelector?: boolean;
    /** Data source filter (group audits, user audits, or all) */
    dataSource?: AuditDataSource;
}

/**
 * Filter configuration for audit view
 */
export interface AuditFilterConfig {
    /** Whether to show the category filter */
    showCategoryFilter?: boolean;
    /** Whether to show the date range filter */
    showDateFilter?: boolean;
    /** Whether to show the search field */
    showSearch?: boolean;
    /** Whether to show the department filter (for departmental/admin scopes) */
    showDepartmentFilter?: boolean;
    /** Whether to show the group selector */
    showGroupSelector?: boolean;
    /** Default category to filter by */
    defaultCategory?: AuditCategory;
    /** Categories to include in the filter dropdown */
    allowedCategories?: AuditCategory[];
}

/**
 * Display configuration for audit view
 */
export interface AuditDisplayConfig {
    /** Number of items per page */
    itemsPerPage?: number;
    /** Whether to show user avatars */
    showAvatars?: boolean;
    /** Whether to show the group name in audit entries */
    showGroupName?: boolean;
    /** Whether to show the compact view */
    compact?: boolean;
    /** Title for the audit list */
    title?: string;
    /** Empty state message */
    emptyMessage?: string;
    /** Loading state message */
    loadingMessage?: string;
}

/**
 * Data source configuration for audit view
 */
export interface AuditDataConfig {
    /** Pre-selected group ID (bypasses group selector) */
    groupId?: string;
    /** Pre-selected groups to filter audits from */
    groups?: ThesisGroup[];
    /** Filter by specific user ID */
    userId?: string;
    /** Department to filter by */
    department?: string;
    /** Course to filter by */
    course?: string;
}

/**
 * Callback handlers for audit view
 */
export interface AuditViewCallbacks {
    /** Called when a filter changes */
    onFilterChange?: (filters: AuditFilterState) => void;
    /** Called when scope changes */
    onScopeChange?: (scope: AuditScope) => void;
    /** Called when group selection changes */
    onGroupChange?: (groupId: string | null) => void;
    /** Called when refresh is triggered */
    onRefresh?: () => void;
}

/**
 * Current state of audit filters
 */
export interface AuditFilterState {
    scope: AuditScope;
    groupId: string;
    department: string;
    course: string;
    category: AuditCategory | '';
    startDate: Date | null;
    endDate: Date | null;
    searchTerm: string;
}

/**
 * Props for the AuditView component
 */
export interface AuditViewProps {
    /** User role for determining available scopes */
    userRole?: UserRole;
    /** Current user's UID */
    userUid?: string | null;
    /** Scope configuration */
    scopeConfig?: AuditScopeConfig;
    /** Filter configuration */
    filterConfig?: AuditFilterConfig;
    /** Display configuration */
    displayConfig?: AuditDisplayConfig;
    /** Data source configuration */
    dataConfig?: AuditDataConfig;
    /** Callback handlers */
    callbacks?: AuditViewCallbacks;
    /** Custom header actions */
    headerActions?: React.ReactNode;
    /** Whether the component is embedded (no padding/card) */
    embedded?: boolean;
}

/**
 * Get available scopes based on user role
 * - 'group': Primary scope - group audit history (preferred default)
 * - 'personal': Always available - user's personal notifications
 * - 'course': For moderators - audits for all groups in their course
 * - 'departmental': For heads - audits for all groups in their department
 * - 'admin': For admins only - admin actions (template changes, etc.)
 */
export function getAvailableScopes(role: UserRole | undefined): AuditScope[] {
    // Group scope is preferred, with personal as fallback
    const scopes: AuditScope[] = ['group', 'personal'];

    if (role === 'moderator') {
        // Moderators can see course-level audits
        scopes.push('course');
    }

    if (role === 'head') {
        // Heads can see departmental audits
        scopes.push('departmental');
    }

    if (role === 'admin' || role === 'developer') {
        // Admins get all scopes including admin-level actions
        scopes.push('admin');
    }

    // Remove duplicates
    return [...new Set(scopes)];
}

/**
 * Get label for audit scope
 */
export function getScopeLabel(scope: AuditScope): string {
    const labels: Record<AuditScope, string> = {
        personal: 'Personal',
        group: 'Group',
        course: 'Course',
        departmental: 'Department',
        admin: 'Admin',
    };
    return labels[scope];
}

/**
 * Get description for audit scope
 */
export function getScopeDescription(scope: AuditScope): string {
    const descriptions: Record<AuditScope, string> = {
        personal: 'Your personal notifications and alerts',
        group: 'Activity history for your groups',
        course: 'Activity for all groups in your course',
        departmental: 'Activity for all groups in your department',
        admin: 'Admin actions and template changes',
    };
    return descriptions[scope];
}

/**
 * Default filter configuration
 */
export const DEFAULT_FILTER_CONFIG: Required<AuditFilterConfig> = {
    showCategoryFilter: true,
    showDateFilter: true,
    showSearch: true,
    showDepartmentFilter: true,
    showGroupSelector: true,
    defaultCategory: undefined as unknown as AuditCategory,
    allowedCategories: [
        'group', 'thesis', 'submission', 'chapter', 'panel',
        'proposal', 'member', 'expert', 'comment', 'file', 'stage',
        'terminal', 'account', 'notification', 'other'
    ],
};

/**
 * Categories relevant for personal (user) audits
 */
export const PERSONAL_AUDIT_CATEGORIES: AuditCategory[] = [
    'member', 'expert', 'notification', 'account', 'other'
];

/**
 * Categories relevant for group audits
 */
export const GROUP_AUDIT_CATEGORIES: AuditCategory[] = [
    'group', 'thesis', 'submission', 'chapter', 'panel',
    'proposal', 'member', 'expert', 'comment', 'file', 'stage', 'terminal', 'other'
];

/**
 * Categories relevant for course-level audits (moderator view)
 */
export const COURSE_AUDIT_CATEGORIES: AuditCategory[] = [
    'group', 'thesis', 'submission', 'chapter', 'proposal',
    'member', 'expert', 'comment', 'file', 'stage', 'terminal', 'other'
];

/**
 * Categories relevant for department-level audits (head view)
 */
export const DEPARTMENT_AUDIT_CATEGORIES: AuditCategory[] = [
    'group', 'thesis', 'submission', 'chapter', 'panel',
    'proposal', 'member', 'expert', 'comment', 'file', 'stage', 'terminal', 'other'
];

/**
 * Categories relevant for admin audits (admin actions, template changes)
 */
export const ADMIN_AUDIT_CATEGORIES: AuditCategory[] = [
    'template', 'chapter', 'stage', 'account', 'notification', 'other'
];

/**
 * Get relevant categories for a specific scope
 */
export function getCategoriesForScope(scope: AuditScope): AuditCategory[] {
    switch (scope) {
        case 'personal':
            return PERSONAL_AUDIT_CATEGORIES;
        case 'group':
            return GROUP_AUDIT_CATEGORIES;
        case 'course':
            return COURSE_AUDIT_CATEGORIES;
        case 'departmental':
            return DEPARTMENT_AUDIT_CATEGORIES;
        case 'admin':
            return ADMIN_AUDIT_CATEGORIES;
        default:
            return GROUP_AUDIT_CATEGORIES;
    }
}

/**
 * Default display configuration
 */
export const DEFAULT_DISPLAY_CONFIG: Required<AuditDisplayConfig> = {
    itemsPerPage: 20,
    showAvatars: true,
    showGroupName: true,
    compact: false,
    title: 'Audit History',
    emptyMessage: 'No audit history available yet.',
    loadingMessage: 'Loading audit history...',
};
