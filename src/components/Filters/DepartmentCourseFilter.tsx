import * as React from 'react';
import { Stack } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { SelectFilter } from './SelectFilter';
import type { SelectFilterOption } from './SelectFilter';

/**
 * Props for the DepartmentCourseFilter component
 */
export interface DepartmentCourseFilterProps {
    /** Selected department value */
    department: string;
    /** Available departments */
    departments: string[];
    /** Callback when department changes */
    onDepartmentChange: (department: string) => void;
    /** Selected course value */
    course: string;
    /** Available courses for the selected department */
    courses: string[];
    /** Callback when course changes */
    onCourseChange: (course: string) => void;
    /** Value representing "All" selection */
    allValue?: string;
    /** Label for "All Departments" option */
    allDepartmentsLabel?: string;
    /** Label for "All Courses" option */
    allCoursesLabel?: string;
    /** Placeholder when no department is selected */
    noDepartmentPlaceholder?: string;
    /** Whether departments are loading */
    departmentsLoading?: boolean;
    /** Whether courses are loading */
    coursesLoading?: boolean;
    /** Size variant */
    size?: 'small' | 'medium';
    /** Direction of the filter layout */
    direction?: 'row' | 'column';
    /** Spacing between filters */
    spacing?: number;
    /** Custom styles */
    sx?: SxProps<Theme>;
    /** Whether to show "All" options */
    showAllOptions?: boolean;
    /** Whether both filters should take full width */
    fullWidth?: boolean;
    /** Min width for each filter */
    minWidth?: number | string;
}

/**
 * A combined department and course filter component that handles the common pattern
 * of selecting a department first, then filtering available courses based on the selection.
 *
 * @example
 * ```tsx
 * <DepartmentCourseFilter
 *     department={departmentFilter}
 *     departments={availableDepartments}
 *     onDepartmentChange={(dept) => {
 *         setDepartmentFilter(dept);
 *         setCourseFilter('');
 *     }}
 *     course={courseFilter}
 *     courses={availableCourses}
 *     onCourseChange={setCourseFilter}
 *     allValue=""
 *     size="small"
 *     direction="row"
 *     spacing={2}
 * />
 * ```
 */
export function DepartmentCourseFilter({
    department,
    departments,
    onDepartmentChange,
    course,
    courses,
    onCourseChange,
    allValue = '',
    allDepartmentsLabel = 'All Departments',
    allCoursesLabel = 'All Courses',
    noDepartmentPlaceholder = 'Select a department first',
    departmentsLoading = false,
    coursesLoading = false,
    size = 'small',
    direction = 'row',
    spacing = 2,
    sx,
    showAllOptions = true,
    fullWidth = false,
    minWidth,
}: DepartmentCourseFilterProps): React.ReactElement {
    const isAllDepartments = department === allValue;

    const departmentOptions: SelectFilterOption[] = React.useMemo(
        () => departments.map((dept) => ({ value: dept, label: dept })),
        [departments]
    );

    const courseOptions: SelectFilterOption[] = React.useMemo(
        () => courses.map((c) => ({ value: c, label: c })),
        [courses]
    );

    const courseAllLabel = React.useMemo(
        () => (isAllDepartments ? noDepartmentPlaceholder : allCoursesLabel),
        [isAllDepartments, noDepartmentPlaceholder, allCoursesLabel]
    );

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            onDepartmentChange(value);
            // Reset course when department changes
            if (value !== department) {
                onCourseChange(allValue);
            }
        },
        [onDepartmentChange, onCourseChange, department, allValue]
    );

    return (
        <Stack direction={direction} spacing={spacing} sx={sx}>
            <SelectFilter
                id="department-filter"
                label="Department"
                value={department}
                options={departmentOptions}
                onChange={handleDepartmentChange}
                allValue={allValue}
                allLabel={allDepartmentsLabel}
                showAllOption={showAllOptions}
                loading={departmentsLoading}
                size={size}
                fullWidth={fullWidth}
                minWidth={minWidth}
            />
            <SelectFilter
                id="course-filter"
                label="Course"
                value={course}
                options={courseOptions}
                onChange={onCourseChange}
                allValue={allValue}
                allLabel={courseAllLabel}
                showAllOption={showAllOptions}
                disabled={isAllDepartments}
                loading={coursesLoading}
                size={size}
                fullWidth={fullWidth}
                minWidth={minWidth}
            />
        </Stack>
    );
}

export default DepartmentCourseFilter;
