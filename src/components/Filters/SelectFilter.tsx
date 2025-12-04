import * as React from 'react';
import {
    FormControl, InputLabel, MenuItem, Select, Skeleton, Typography
} from '@mui/material';
import type { SelectChangeEvent, SxProps, Theme } from '@mui/material';

/**
 * Represents an option in the SelectFilter dropdown
 */
export interface SelectFilterOption<T extends string = string> {
    /** The value to be used when this option is selected */
    value: T;
    /** The display label for this option */
    label: string;
    /** Optional description shown as secondary text */
    description?: string;
    /** Whether this option is disabled */
    disabled?: boolean;
}

/**
 * Props for the SelectFilter component
 */
export interface SelectFilterProps<T extends string = string> {
    /** Unique identifier for the filter */
    id: string;
    /** Label displayed above the select */
    label: string;
    /** Currently selected value */
    value: T;
    /** Available options to choose from */
    options: SelectFilterOption<T>[];
    /** Callback when selection changes */
    onChange: (value: T) => void;
    /** Placeholder shown as first option when value is empty or matches allValue */
    placeholder?: string;
    /** Value that represents "All" selection (shown as placeholder) */
    allValue?: T;
    /** Display label for the "All" option */
    allLabel?: string;
    /** Whether to show the "All" option */
    showAllOption?: boolean;
    /** Whether the filter is disabled */
    disabled?: boolean;
    /** Whether the filter is in loading state */
    loading?: boolean;
    /** Size variant of the filter */
    size?: 'small' | 'medium';
    /** Whether the filter should take full width */
    fullWidth?: boolean;
    /** Minimum width of the filter */
    minWidth?: number | string;
    /** Custom styles */
    sx?: SxProps<Theme>;
    /** Whether this filter is required */
    required?: boolean;
    /** Error state */
    error?: boolean;
    /** Helper text shown below the filter */
    helperText?: string;
}

/**
 * A reusable select dropdown filter component that standardizes the common
 * FormControl + InputLabel + Select + MenuItem pattern used throughout the application.
 *
 * @example
 * ```tsx
 * <SelectFilter
 *     id="department"
 *     label="Department"
 *     value={departmentFilter}
 *     options={departments.map(d => ({ value: d, label: d }))}
 *     onChange={setDepartmentFilter}
 *     allValue=""
 *     allLabel="All Departments"
 *     showAllOption
 *     size="small"
 *     fullWidth
 * />
 * ```
 */
export function SelectFilter<T extends string = string>({
    id,
    label,
    value,
    options,
    onChange,
    placeholder,
    allValue = '' as T,
    allLabel = `All ${label}s`,
    showAllOption = true,
    disabled = false,
    loading = false,
    size = 'small',
    fullWidth = false,
    minWidth,
    sx,
    required = false,
    error = false,
}: SelectFilterProps<T>): React.ReactElement {
    const labelId = `${id}-select-label`;

    const handleChange = React.useCallback(
        (event: SelectChangeEvent<T>) => {
            onChange(event.target.value as T);
        },
        [onChange]
    );

    const effectivePlaceholder = React.useMemo(() => {
        if (placeholder) return placeholder;
        if (disabled && !loading) return `Select ${label.toLowerCase()} first`;
        return allLabel;
    }, [placeholder, disabled, loading, label, allLabel]);

    const combinedSx: SxProps<Theme> = React.useMemo(
        () => ({
            minWidth: minWidth ?? 150,
            ...sx,
        }),
        [minWidth, sx]
    );

    if (loading) {
        return (
            <FormControl size={size} fullWidth={fullWidth} sx={combinedSx}>
                <Skeleton variant="rectangular" height={size === 'small' ? 40 : 56} />
            </FormControl>
        );
    }

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
            <Select<T>
                labelId={labelId}
                id={id}
                value={value}
                label={label}
                onChange={handleChange}
            >
                {showAllOption && (
                    <MenuItem value={allValue}>
                        {effectivePlaceholder}
                    </MenuItem>
                )}
                {options.map((option) => (
                    <MenuItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                        {option.description && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 1 }}
                            >
                                ({option.description})
                            </Typography>
                        )}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

export default SelectFilter;
