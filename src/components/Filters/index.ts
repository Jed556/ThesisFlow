/**
 * Reusable filter components for consistent filtering UI throughout the application.
 *
 * These components standardize the common FormControl + InputLabel + Select + MenuItem
 * pattern and reduce code duplication across pages.
 *
 * @module components/Filters
 */

// Base select filter component
export { SelectFilter } from './SelectFilter';
export type { SelectFilterProps, SelectFilterOption } from './SelectFilter';

// Combined department and course filter
export { DepartmentCourseFilter } from './DepartmentCourseFilter';
export type { DepartmentCourseFilterProps } from './DepartmentCourseFilter';

// Group selection filter (supports both Autocomplete and Select variants)
export { GroupFilter } from './GroupFilter';
export type { GroupFilterProps } from './GroupFilter';
