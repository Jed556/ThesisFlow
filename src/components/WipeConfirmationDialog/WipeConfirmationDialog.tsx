import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, InputLabel, MenuItem, Select, TextField, Typography, Alert,
    Stack, Chip, CircularProgress
} from '@mui/material';
import {
    Warning as WarningIcon,
    DeleteForever as DeleteIcon,
} from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';

/**
 * Wipe category definition
 */
export interface WipeCategory {
    id: string;
    label: string;
    description: string;
    category: string;
}

/**
 * Scope level for filtering wipe operations
 */
export type WipeScopeLevel = 'all' | 'department' | 'course';

/**
 * Scope filter for wipe operations
 */
export interface WipeScope {
    level: WipeScopeLevel;
    year?: string;
    department?: string;
    course?: string;
}

/**
 * Props for the WipeConfirmationDialog component
 */
export interface WipeConfirmationDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback to close the dialog */
    onClose: () => void;
    /** The wipe action being confirmed */
    action: WipeCategory | null;
    /** Callback when user confirms the wipe */
    onConfirm: (scope: WipeScope) => void;
    /** Whether a wipe operation is currently in progress */
    isLoading?: boolean;
    /** List of available departments for filtering */
    departments?: string[];
    /** Map of department to courses for filtering */
    departmentCourses?: Record<string, string[]>;
    /** Current academic year */
    currentYear?: string;
}

/**
 * Confirmation dialog for destructive wipe operations.
 * Requires users to type a confirmation phrase and select a scope level.
 * 
 * @param props - Component properties
 * @returns WipeConfirmationDialog component
 */
export function WipeConfirmationDialog({
    open,
    onClose,
    action,
    onConfirm,
    isLoading = false,
    departments = [],
    departmentCourses = {},
    currentYear,
}: WipeConfirmationDialogProps) {
    const [confirmText, setConfirmText] = React.useState('');
    const [scopeLevel, setScopeLevel] = React.useState<WipeScopeLevel>('all');
    const [selectedDepartment, setSelectedDepartment] = React.useState<string>('');
    const [selectedCourse, setSelectedCourse] = React.useState<string>('');

    // Confirmation phrase user must type
    const CONFIRMATION_PHRASE = 'DELETE';

    // Available courses based on selected department
    const availableCourses = React.useMemo(() => {
        if (!selectedDepartment || !departmentCourses[selectedDepartment]) {
            return [];
        }
        return departmentCourses[selectedDepartment];
    }, [selectedDepartment, departmentCourses]);

    // Reset state when dialog opens/closes or action changes
    React.useEffect(() => {
        if (open) {
            setConfirmText('');
            setScopeLevel('all');
            setSelectedDepartment('');
            setSelectedCourse('');
        }
    }, [open, action]);

    // Reset course when department changes
    React.useEffect(() => {
        setSelectedCourse('');
    }, [selectedDepartment]);

    // Reset department when scope level changes to 'all'
    React.useEffect(() => {
        if (scopeLevel === 'all') {
            setSelectedDepartment('');
            setSelectedCourse('');
        }
    }, [scopeLevel]);

    /**
     * Handle scope level change
     */
    const handleScopeLevelChange = (event: SelectChangeEvent<WipeScopeLevel>) => {
        setScopeLevel(event.target.value as WipeScopeLevel);
    };

    /**
     * Handle department selection
     */
    const handleDepartmentChange = (event: SelectChangeEvent<string>) => {
        setSelectedDepartment(event.target.value);
    };

    /**
     * Handle course selection
     */
    const handleCourseChange = (event: SelectChangeEvent<string>) => {
        setSelectedCourse(event.target.value);
    };

    /**
     * Validate if the form is complete and confirmation is correct
     */
    const isValid = React.useMemo(() => {
        if (confirmText !== CONFIRMATION_PHRASE) {
            return false;
        }
        if (scopeLevel === 'department' && !selectedDepartment) {
            return false;
        }
        if (scopeLevel === 'course' && (!selectedDepartment || !selectedCourse)) {
            return false;
        }
        return true;
    }, [confirmText, scopeLevel, selectedDepartment, selectedCourse]);

    /**
     * Handle confirmation
     */
    const handleConfirm = () => {
        if (!isValid || !action) return;

        const scope: WipeScope = {
            level: scopeLevel,
            year: currentYear,
            department: scopeLevel !== 'all' ? selectedDepartment : undefined,
            course: scopeLevel === 'course' ? selectedCourse : undefined,
        };

        onConfirm(scope);
    };

    /**
     * Get scope description for display
     */
    const getScopeDescription = (): string => {
        switch (scopeLevel) {
            case 'all':
                return 'All data (institution-wide)';
            case 'department':
                return selectedDepartment
                    ? `Department: ${selectedDepartment}`
                    : 'Select a department';
            case 'course':
                if (!selectedDepartment) return 'Select a department first';
                if (!selectedCourse) return 'Select a course';
                return `${selectedDepartment} / ${selectedCourse}`;
            default:
                return '';
        }
    };

    if (!action) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onClose={isLoading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderTop: 4,
                        borderColor: 'error.main',
                    },
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="error" />
                <Typography variant="h6" component="span">
                    Confirm Destructive Action
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {/* Action details */}
                    <Alert severity="error" icon={<DeleteIcon />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {action.label}
                        </Typography>
                        <Typography variant="body2">
                            {action.description}
                        </Typography>
                    </Alert>

                    {/* Scope selection */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>
                            Deletion Scope
                        </Typography>
                        <FormControl fullWidth size="small">
                            <InputLabel id="scope-level-label">Scope Level</InputLabel>
                            <Select
                                labelId="scope-level-label"
                                value={scopeLevel}
                                label="Scope Level"
                                onChange={handleScopeLevelChange}
                                disabled={isLoading}
                            >
                                <MenuItem value="all">
                                    All (Institution-wide)
                                </MenuItem>
                                <MenuItem value="department" disabled={departments.length === 0}>
                                    Department
                                </MenuItem>
                                <MenuItem value="course" disabled={departments.length === 0}>
                                    Course
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Department selection (when scope is department or course) */}
                    {scopeLevel !== 'all' && (
                        <FormControl fullWidth size="small">
                            <InputLabel id="department-label">Department</InputLabel>
                            <Select
                                labelId="department-label"
                                value={selectedDepartment}
                                label="Department"
                                onChange={handleDepartmentChange}
                                disabled={isLoading || departments.length === 0}
                            >
                                {departments.map((dept) => (
                                    <MenuItem key={dept} value={dept}>
                                        {dept}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Course selection (when scope is course) */}
                    {scopeLevel === 'course' && selectedDepartment && (
                        <FormControl fullWidth size="small">
                            <InputLabel id="course-label">Course</InputLabel>
                            <Select
                                labelId="course-label"
                                value={selectedCourse}
                                label="Course"
                                onChange={handleCourseChange}
                                disabled={isLoading || availableCourses.length === 0}
                            >
                                {availableCourses.map((course) => (
                                    <MenuItem key={course} value={course}>
                                        {course}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Scope preview */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Target:
                        </Typography>
                        <Chip
                            label={getScopeDescription()}
                            size="small"
                            color={scopeLevel === 'all' ? 'error' : 'warning'}
                            variant="outlined"
                        />
                    </Box>

                    {/* Confirmation input */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>
                            Type <strong>{CONFIRMATION_PHRASE}</strong> to confirm
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={CONFIRMATION_PHRASE}
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            disabled={isLoading}
                            error={confirmText.length > 0 && confirmText !== CONFIRMATION_PHRASE}
                            helperText={
                                confirmText.length > 0 && confirmText !== CONFIRMATION_PHRASE
                                    ? 'Text does not match'
                                    : undefined
                            }
                            autoComplete="off"
                        />
                    </Box>

                    {/* Warning message */}
                    <Alert severity="warning">
                        <Typography variant="body2">
                            This action is <strong>irreversible</strong>. All data within the selected scope
                            will be permanently deleted. Make sure you have backups if needed.
                        </Typography>
                    </Alert>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={onClose}
                    disabled={isLoading}
                    color="inherit"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={!isValid || isLoading}
                    variant="contained"
                    color="error"
                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                >
                    {isLoading ? 'Wiping...' : 'Wipe Data'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default WipeConfirmationDialog;
