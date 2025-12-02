import * as React from 'react';
import {
    Autocomplete, FormControl, InputLabel, MenuItem,
    Select, Skeleton, Stack, TextField, Typography
} from '@mui/material';
import type { SxProps, Theme, SelectChangeEvent } from '@mui/material';
import type { ThesisGroup } from '../../types/group';

/**
 * Props for the GroupFilter component
 */
export interface GroupFilterProps {
    /** Currently selected group ID or full group object */
    value: string | ThesisGroup | null;
    /** Available groups to select from */
    groups: ThesisGroup[];
    /** Callback when selection changes - receives group ID */
    onChange: (groupId: string) => void;
    /** Callback when selection changes - receives full group object */
    onGroupChange?: (group: ThesisGroup | null) => void;
    /** Label for the filter */
    label?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether groups are loading */
    loading?: boolean;
    /** Whether the filter is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: 'small' | 'medium';
    /** Whether to use Autocomplete (true) or Select (false) */
    variant?: 'autocomplete' | 'select';
    /** Whether to show "All Groups" option (for select variant) */
    showAllOption?: boolean;
    /** Label for "All" option */
    allLabel?: string;
    /** Value for "All" option */
    allValue?: string;
    /** Message when no groups are available */
    emptyMessage?: string;
    /** Whether the filter should take full width */
    fullWidth?: boolean;
    /** Minimum width */
    minWidth?: number | string;
    /** Custom styles */
    sx?: SxProps<Theme>;
    /** Whether this filter is required */
    required?: boolean;
    /** Error state */
    error?: boolean;
    /** Helper text shown below the filter */
    helperText?: string;
    /** Whether to show department info in options */
    showDepartment?: boolean;
}

/**
 * Formats a group for display as option label
 */
function formatGroupLabel(group: ThesisGroup): string {
    return group.name || group.id;
}

/**
 * A reusable group selection filter that supports both Autocomplete and Select variants.
 * Commonly used throughout the application for selecting thesis groups.
 *
 * @example
 * ```tsx
 * // Autocomplete variant
 * <GroupFilter
 *     value={selectedGroup}
 *     groups={availableGroups}
 *     onChange={(id) => setSelectedGroupId(id)}
 *     onGroupChange={(group) => setSelectedGroup(group)}
 *     variant="autocomplete"
 *     loading={groupsLoading}
 * />
 *
 * // Select variant with "All Groups" option
 * <GroupFilter
 *     value={selectedGroupId}
 *     groups={groups}
 *     onChange={setSelectedGroupId}
 *     variant="select"
 *     showAllOption
 *     allLabel="All Groups"
 * />
 * ```
 */
export function GroupFilter({
    value,
    groups,
    onChange,
    onGroupChange,
    label = 'Group',
    placeholder,
    loading = false,
    disabled = false,
    size = 'small',
    variant = 'autocomplete',
    showAllOption = false,
    allLabel = 'All Groups',
    allValue = '',
    emptyMessage = 'No groups available',
    fullWidth = true,
    minWidth,
    sx,
    required = false,
    error = false,
    helperText,
    showDepartment = false,
}: GroupFilterProps): React.ReactElement {
    // Get the selected group object
    const selectedGroup = React.useMemo(() => {
        if (!value) return null;
        if (typeof value === 'object') return value;
        return groups.find((g) => g.id === value) ?? null;
    }, [value, groups]);

    // Get the selected group ID
    const selectedId = React.useMemo(() => {
        if (!value) return allValue;
        if (typeof value === 'string') return value;
        return value.id;
    }, [value, allValue]);

    const effectivePlaceholder = React.useMemo(() => {
        if (placeholder) return placeholder;
        if (loading) return 'Loading groups…';
        return `Search ${label.toLowerCase()}`;
    }, [placeholder, loading, label]);

    const combinedSx: SxProps<Theme> = React.useMemo(
        () => ({
            minWidth: minWidth ?? 200,
            ...sx,
        }),
        [minWidth, sx]
    );

    const handleAutocompleteChange = React.useCallback(
        (_: React.SyntheticEvent, newValue: ThesisGroup | null) => {
            onChange(newValue?.id ?? allValue);
            onGroupChange?.(newValue);
        },
        [onChange, onGroupChange, allValue]
    );

    const handleSelectChange = React.useCallback(
        (event: SelectChangeEvent<string>) => {
            const newId = event.target.value;
            onChange(newId);
            const group = groups.find((g) => g.id === newId) ?? null;
            onGroupChange?.(group);
        },
        [onChange, onGroupChange, groups]
    );

    if (loading) {
        return (
            <FormControl size={size} fullWidth={fullWidth} sx={combinedSx}>
                <Skeleton variant="rectangular" height={size === 'small' ? 40 : 56} />
            </FormControl>
        );
    }

    if (variant === 'autocomplete') {
        return (
            <Autocomplete
                options={groups}
                value={selectedGroup}
                onChange={handleAutocompleteChange}
                getOptionLabel={formatGroupLabel}
                loading={loading}
                disabled={disabled}
                fullWidth={fullWidth}
                size={size}
                sx={combinedSx}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <span>{formatGroupLabel(option)}</span>
                            {showDepartment && option.department && (
                                <Typography variant="caption" color="text.secondary">
                                    ({option.department})
                                </Typography>
                            )}
                        </Stack>
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder={effectivePlaceholder}
                        required={required}
                        error={error}
                        helperText={helperText}
                    />
                )}
                noOptionsText={emptyMessage}
            />
        );
    }

    // Select variant
    const labelId = 'group-filter-select-label';

    return (
        <FormControl
            size={size}
            fullWidth={fullWidth}
            disabled={disabled}
            required={required}
            error={error}
            sx={combinedSx}
        >
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select
                labelId={labelId}
                value={selectedId}
                label={label}
                onChange={handleSelectChange}
            >
                {showAllOption && (
                    <MenuItem value={allValue}>
                        {effectivePlaceholder || allLabel}
                    </MenuItem>
                )}
                {groups.length === 0 ? (
                    <MenuItem value="" disabled>
                        {emptyMessage}
                    </MenuItem>
                ) : (
                    groups.map((group) => (
                        <MenuItem key={group.id} value={group.id}>
                            {formatGroupLabel(group)}
                            {showDepartment && group.department && (
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
    );
}

export default GroupFilter;
