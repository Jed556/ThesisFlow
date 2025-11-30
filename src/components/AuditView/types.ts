import type { AuditCategory } from '../../types/audit';
import type { ThesisGroup } from '../../types/group';
import type { UserRole } from '../../types/profile';

/**
 * Audit scope levels based on user privileges
 */
export type AuditScope = 'personal' | 'group' | 'departmental' | 'admin';

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
 */
export function getAvailableScopes(role: UserRole | undefined): AuditScope[] {
    const scopes: AuditScope[] = ['personal', 'group'];

    if (role === 'moderator' || role === 'head') {
        scopes.push('departmental');
    }

    if (role === 'admin' || role === 'developer') {
        scopes.push('departmental', 'admin');
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
        departmental: 'Departmental',
        admin: 'Admin',
    };
    return labels[scope];
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
        'proposal', 'member', 'expert', 'comment', 'file', 'stage', 'terminal', 'other'
    ],
};

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
