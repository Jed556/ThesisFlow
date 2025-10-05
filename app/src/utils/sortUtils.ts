/**
 * General-purpose sorting utility functions
 * Provides reusable sorting logic for various data types
 */

import type {
    SortOrder,
    SortConfig,
    MultiSortConfig,
    SortFunction,
    ComparatorOptions,
    SortableValue,
    SortResult
} from '../types/sort';

/**
 * Get nested property value from object using dot notation
 * @param obj - Object to extract value from
 * @param path - Property path (e.g., 'user.profile.name')
 * @returns Property value or undefined
 */
export const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Compare two sortable values
 * @param a - First value
 * @param b - Second value
 * @param options - Comparator options
 * @returns Comparison result (-1, 0, 1)
 */
export const compareValues = (
    a: SortableValue,
    b: SortableValue,
    options: ComparatorOptions = {}
): number => {
    const { order = 'asc', nullsLast = true, caseSensitive = false } = options;

    // Handle null/undefined
    if (a == null && b == null) return 0;
    if (a == null) return nullsLast ? 1 : -1;
    if (b == null) return nullsLast ? -1 : 1;

    // Convert dates to timestamps
    const aValue = a instanceof Date ? a.getTime() : a;
    const bValue = b instanceof Date ? b.getTime() : b;

    // Handle strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aStr = caseSensitive ? aValue : aValue.toLowerCase();
        const bStr = caseSensitive ? bValue : bValue.toLowerCase();
        const result = aStr.localeCompare(bStr);
        return order === 'asc' ? result : -result;
    }

    // Handle numbers and booleans
    let result = 0;
    if (aValue < bValue) result = -1;
    else if (aValue > bValue) result = 1;

    return order === 'asc' ? result : -result;
};

/**
 * Sort by string field
 * @param a - First item
 * @param b - Second item
 * @param field - Field name or path
 * @param order - Sort order
 * @param caseSensitive - Whether comparison is case-sensitive
 * @returns Comparison result
 */
export const sortByString = <T>(
    a: T,
    b: T,
    field: keyof T | string,
    order: SortOrder = 'asc',
    caseSensitive: boolean = false
): number => {
    const aValue = getNestedValue(a, field as string);
    const bValue = getNestedValue(b, field as string);
    return compareValues(aValue, bValue, { order, caseSensitive });
};

/**
 * Sort by number field
 * @param a - First item
 * @param b - Second item
 * @param field - Field name or path
 * @param order - Sort order
 * @returns Comparison result
 */
export const sortByNumber = <T>(
    a: T,
    b: T,
    field: keyof T | string,
    order: SortOrder = 'asc'
): number => {
    const aValue = getNestedValue(a, field as string);
    const bValue = getNestedValue(b, field as string);
    return compareValues(aValue, bValue, { order });
};

/**
 * Sort by date field
 * @param a - First item
 * @param b - Second item
 * @param field - Field name or path
 * @param order - Sort order
 * @returns Comparison result
 */
export const sortByDate = <T>(
    a: T,
    b: T,
    field: keyof T | string,
    order: SortOrder = 'asc'
): number => {
    const aValue = getNestedValue(a, field as string);
    const bValue = getNestedValue(b, field as string);

    // Convert to Date if string or timestamp
    const aDate = aValue instanceof Date ? aValue : new Date(aValue);
    const bDate = bValue instanceof Date ? bValue : new Date(bValue);

    return compareValues(aDate, bDate, { order });
};

/**
 * Sort by boolean field
 * @param a - First item
 * @param b - Second item
 * @param field - Field name or path
 * @param order - Sort order
 * @returns Comparison result
 */
export const sortByBoolean = <T>(
    a: T,
    b: T,
    field: keyof T | string,
    order: SortOrder = 'asc'
): number => {
    const aValue = getNestedValue(a, field as string);
    const bValue = getNestedValue(b, field as string);
    return compareValues(aValue ? 1 : 0, bValue ? 1 : 0, { order });
};

/**
 * Sort by any field (auto-detects type)
 * @param a - First item
 * @param b - Second item
 * @param field - Field name or path
 * @param order - Sort order
 * @param caseSensitive - Whether string comparison is case-sensitive
 * @returns Comparison result
 */
export const sortByField = <T>(
    a: T,
    b: T,
    field: keyof T | string,
    order: SortOrder = 'asc',
    caseSensitive: boolean = false
): number => {
    const aValue = getNestedValue(a, field as string);
    const bValue = getNestedValue(b, field as string);

    // Auto-detect type and sort accordingly
    if (aValue instanceof Date || bValue instanceof Date) {
        return sortByDate(a, b, field, order);
    }
    if (typeof aValue === 'number' || typeof bValue === 'number') {
        return sortByNumber(a, b, field, order);
    }
    if (typeof aValue === 'boolean' || typeof bValue === 'boolean') {
        return sortByBoolean(a, b, field, order);
    }
    return sortByString(a, b, field, order, caseSensitive);
};

/**
 * Create a comparator function from sort configuration
 * @param config - Sort configuration
 * @returns Comparator function
 */
export const createComparator = <T>(config: SortConfig<T>): SortFunction<T> => {
    return (a: T, b: T) => {
        if (config.compareFn) {
            return config.compareFn(a, b);
        }

        const aValue = getNestedValue(a, config.field as string);
        const bValue = getNestedValue(b, config.field as string);

        return compareValues(aValue, bValue, {
            order: config.order,
            nullsLast: config.nullsLast,
            caseSensitive: config.caseSensitive
        });
    };
};

/**
 * Sort array by single field
 * @param items - Array to sort
 * @param config - Sort configuration
 * @returns Sorted array
 */
export const sortArray = <T>(items: T[], config: SortConfig<T>): T[] => {
    const comparator = createComparator(config);
    return [...items].sort(comparator);
};

/**
 * Sort array by multiple fields
 * @param items - Array to sort
 * @param configs - Array of sort configurations (applied in order)
 * @returns Sorted array
 */
export const sortArrayMulti = <T>(items: T[], configs: SortConfig<T>[]): T[] => {
    return [...items].sort((a, b) => {
        for (const config of configs) {
            const comparator = createComparator(config);
            const result = comparator(a, b);
            if (result !== 0) return result;
        }
        return 0;
    });
};

/**
 * Sort with metadata and performance tracking
 * @param items - Array to sort
 * @param config - Sort configuration or multi-sort configuration
 * @returns Sort result with metadata
 */
export const sortWithMetadata = <T>(
    items: T[],
    config: SortConfig<T> | MultiSortConfig<T>
): SortResult<T> => {
    const startTime = performance.now();

    let sortedData: T[];
    if ('sorts' in config) {
        sortedData = sortArrayMulti(items, config.sorts);
    } else {
        sortedData = sortArray(items, config);
    }

    const duration = performance.now() - startTime;

    return {
        data: sortedData,
        config,
        count: sortedData.length,
        duration
    };
};

/**
 * Toggle sort order
 * @param currentOrder - Current sort order
 * @returns Toggled sort order
 */
export const toggleSortOrder = (currentOrder: SortOrder): SortOrder => {
    return currentOrder === 'asc' ? 'desc' : 'asc';
};

/**
 * Normalize sort direction to SortOrder
 * @param direction - Sort direction string
 * @returns Normalized sort order
 */
export const normalizeSortOrder = (direction: string): SortOrder => {
    const normalized = direction.toLowerCase();
    return normalized === 'descending' || normalized === 'desc' ? 'desc' : 'asc';
};

/**
 * Create a stable sort (maintains relative order of equal elements)
 * @param items - Array to sort
 * @param config - Sort configuration
 * @returns Stably sorted array
 */
export const stableSort = <T>(items: T[], config: SortConfig<T>): T[] => {
    const comparator = createComparator(config);
    const indexed = items.map((item, index) => ({ item, index }));

    indexed.sort((a, b) => {
        const result = comparator(a.item, b.item);
        return result !== 0 ? result : a.index - b.index;
    });

    return indexed.map(({ item }) => item);
};

/**
 * Check if array is sorted by given configuration
 * @param items - Array to check
 * @param config - Sort configuration
 * @returns True if array is sorted
 */
export const isSorted = <T>(items: T[], config: SortConfig<T>): boolean => {
    const comparator = createComparator(config);

    for (let i = 1; i < items.length; i++) {
        if (comparator(items[i - 1], items[i]) > 0) {
            return false;
        }
    }

    return true;
};
