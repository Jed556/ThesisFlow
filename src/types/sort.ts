/**
 * Generic sorting type definitions
 * These types provide reusable sorting functionality across the application
 */

/**
 * Sort order direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort direction with additional options
 */
export type SortDirection = 'ascending' | 'descending' | 'asc' | 'desc';

/**
 * Sortable value types
 */
export type SortableValue = string | number | Date | boolean | null | undefined;

/**
 * Generic sort configuration
 */
export interface SortConfig<T = any> {
    /**
     * Field name to sort by (supports nested paths like 'user.name')
     */
    field: keyof T | string;
    /**
     * Sort order direction
     */
    order: SortOrder;
    /**
     * Optional custom comparator function
     */
    compareFn?: (a: T, b: T) => number;
    /**
     * Whether to treat null/undefined values as lowest
     * @default true
     */
    nullsLast?: boolean;
    /**
     * Whether sorting is case-sensitive (for strings)
     * @default false
     */
    caseSensitive?: boolean;
}

/**
 * Multi-field sort configuration
 */
export interface MultiSortConfig<T = any> {
    /**
     * Array of sort configurations applied in order
     */
    sorts: SortConfig<T>[];
}

/**
 * Sort function type
 */
export type SortFunction<T = any> = (a: T, b: T) => number;

/**
 * Comparator options
 */
export interface ComparatorOptions {
    /**
     * Sort order
     */
    order?: SortOrder;
    /**
     * Whether to treat null/undefined as lowest
     */
    nullsLast?: boolean;
    /**
     * Whether comparison is case-sensitive (for strings)
     */
    caseSensitive?: boolean;
}

/**
 * Sort result with metadata
 */
export interface SortResult<T = any> {
    /**
     * Sorted data
     */
    data: T[];
    /**
     * Applied sort configuration
     */
    config: SortConfig<T> | MultiSortConfig<T>;
    /**
     * Number of items sorted
     */
    count: number;
    /**
     * Time taken to sort (milliseconds)
     */
    duration?: number;
}

/**
 * Sortable collection interface
 */
export interface Sortable<T = any> {
    /**
     * Items to sort
     */
    items: T[];
    /**
     * Current sort configuration
     */
    sortConfig?: SortConfig<T>;
    /**
     * Apply sorting
     */
    sort: (config: SortConfig<T>) => T[];
}
