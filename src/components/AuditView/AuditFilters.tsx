import * as React from 'react';
import {
    FormControl, InputLabel, MenuItem, Paper, Select, Skeleton,
    Stack, TextField, Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { AuditCategory } from '../../types/audit';
import type { ThesisGroup } from '../../types/group';
import type { AuditScope, AuditFilterConfig } from './types';
import { getScopeLabel, DEFAULT_FILTER_CONFIG } from './types';
import { getScopeIcon } from './icons';
import { getAuditCategoryLabel } from '../../utils/auditUtils';

interface AuditFiltersProps {
    /** Current scope */
    scope: AuditScope;
    /** Available scopes */
    availableScopes: AuditScope[];
    /** Scope change handler */
    onScopeChange: (scope: AuditScope) => void;
    /** Whether to show scope selector */
    showScopeSelector?: boolean;

    /** Selected department */
    selectedDepartment: string;
    /** Available departments */
    departments: string[];
    /** Department change handler */
    onDepartmentChange: (department: string) => void;

    /** Selected course */
    selectedCourse: string;
    /** Available courses */
    courses: string[];
    /** Course change handler */
    onCourseChange: (course: string) => void;

    /** Selected group ID */
    selectedGroupId: string;
    /** Available groups to select from */
    groups: ThesisGroup[];
    /** Whether groups are loading */
    groupsLoading?: boolean;
    /** Group change handler */
    onGroupChange: (groupId: string) => void;

    /** Category filter value */
    categoryFilter: AuditCategory | '';
    /** Category change handler */
    onCategoryChange: (category: AuditCategory | '') => void;

    /** Start date filter */
    startDate: Date | null;
    /** Start date change handler */
    onStartDateChange: (date: Date | null) => void;

    /** End date filter */
    endDate: Date | null;
    /** End date change handler */
    onEndDateChange: (date: Date | null) => void;

    /** Search term */
    searchTerm: string;
    /** Search term change handler */
    onSearchChange: (term: string) => void;

    /** Filter configuration */
    config?: AuditFilterConfig;
}

/**
 * Audit filters component with scope, department, course, group, category, date, and search
 */
export function AuditFilters({
    scope,
    availableScopes,
    onScopeChange,
    showScopeSelector = true,
    selectedDepartment,
    departments,
    onDepartmentChange,
    selectedCourse,
    courses,
    onCourseChange,
    selectedGroupId,
    groups,
    groupsLoading = false,
    onGroupChange,
    categoryFilter,
    onCategoryChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    searchTerm,
    onSearchChange,
    config = {},
}: AuditFiltersProps): React.ReactElement {
    const mergedConfig = { ...DEFAULT_FILTER_CONFIG, ...config };
    const {
        showCategoryFilter,
        showDateFilter,
        showSearch,
        showDepartmentFilter,
        showGroupSelector,
        allowedCategories,
    } = mergedConfig;

    // Show department filter for departmental/admin scope
    const shouldShowDepartmentFilter =
        showDepartmentFilter && (scope === 'departmental' || scope === 'admin');

    return (
        <Stack spacing={2}>
            {/* Scope and Hierarchical Filters */}
            <Paper sx={{ p: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                >
                    {/* Scope Selector */}
                    {showScopeSelector && availableScopes.length > 1 && (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel id="scope-select-label">Audit Scope</InputLabel>
                            <Select
                                labelId="scope-select-label"
                                value={scope}
                                label="Audit Scope"
                                onChange={(e) => onScopeChange(e.target.value as AuditScope)}
                            >
                                {availableScopes.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {getScopeIcon(s)}
                                            <span>{getScopeLabel(s)}</span>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Department Filter */}
                    {shouldShowDepartmentFilter && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel id="department-select-label">Department</InputLabel>
                            <Select
                                labelId="department-select-label"
                                value={selectedDepartment}
                                label="Department"
                                onChange={(e) => onDepartmentChange(e.target.value)}
                            >
                                <MenuItem value="">All Departments</MenuItem>
                                {departments.map((dept) => (
                                    <MenuItem key={dept} value={dept}>
                                        {dept}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Course Filter */}
                    {shouldShowDepartmentFilter &&
                        selectedDepartment &&
                        courses.length > 0 && (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel id="course-select-label">Course</InputLabel>
                                <Select
                                    labelId="course-select-label"
                                    value={selectedCourse}
                                    label="Course"
                                    onChange={(e) => onCourseChange(e.target.value)}
                                >
                                    <MenuItem value="">All Courses</MenuItem>
                                    {courses.map((course) => (
                                        <MenuItem key={course} value={course}>
                                            {course}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                    {/* Group Selector */}
                    {showGroupSelector && (
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel id="group-select-label">Group</InputLabel>
                            <Select
                                labelId="group-select-label"
                                value={selectedGroupId}
                                label="Group"
                                onChange={(e) => onGroupChange(e.target.value)}
                                disabled={groupsLoading}
                            >
                                <MenuItem value="">
                                    {scope === 'admin' || scope === 'departmental'
                                        ? 'All Groups'
                                        : 'Select a Group'}
                                </MenuItem>
                                {groupsLoading ? (
                                    <MenuItem value="" disabled>
                                        <Skeleton width={150} />
                                    </MenuItem>
                                ) : groups.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        No groups available
                                    </MenuItem>
                                ) : (
                                    groups.map((group) => (
                                        <MenuItem key={group.id} value={group.id}>
                                            {group.name}
                                            {(scope === 'admin' || scope === 'departmental') &&
                                                !selectedDepartment && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ ml: 1 }}
                                                    >
                                                        ({group.department})
                                                    </Typography>
                                                )}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    )}
                </Stack>
            </Paper>

            {/* Category, Date, and Search Filters */}
            {(showCategoryFilter || showDateFilter || showSearch) && (
                <Paper sx={{ p: 2 }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                    >
                        {/* Category Filter */}
                        {showCategoryFilter && (
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel id="category-filter-label">Category</InputLabel>
                                <Select
                                    labelId="category-filter-label"
                                    value={categoryFilter}
                                    label="Category"
                                    onChange={(e) => {
                                        onCategoryChange(e.target.value as AuditCategory | '');
                                    }}
                                >
                                    <MenuItem value="">All Categories</MenuItem>
                                    {allowedCategories.map((cat) => (
                                        <MenuItem key={cat} value={cat}>
                                            {getAuditCategoryLabel(cat)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Date Range */}
                        {showDateFilter && (
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={onStartDateChange}
                                    slotProps={{
                                        textField: { size: 'small', sx: { minWidth: 150 } },
                                    }}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={onEndDateChange}
                                    slotProps={{
                                        textField: { size: 'small', sx: { minWidth: 150 } },
                                    }}
                                />
                            </LocalizationProvider>
                        )}

                        {/* Search */}
                        {showSearch && (
                            <TextField
                                size="small"
                                placeholder="Search audits..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                sx={{ minWidth: 200, flexGrow: 1 }}
                            />
                        )}
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
}

export default AuditFilters;
