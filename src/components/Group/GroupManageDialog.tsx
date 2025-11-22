import * as React from 'react';
import {
    Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import type { ThesisGroupFormData } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { GROUP_STATUS_OPTIONS, formatGroupStatus } from './constants';
import { GrowTransition } from '../Animate';
import { formatProfileLabel } from '../../utils/userUtils';

export type GroupFormErrorKey = keyof ThesisGroupFormData | 'members' | 'general';

interface GroupManageDialogProps {
    open: boolean;
    editMode: boolean;
    isAdmin?: boolean; // If false, hide admin-only fields (status, department override, adviser/editor assignment)
    activeStep: number;
    steps: readonly string[];
    formData: ThesisGroupFormData;
    formErrors: Partial<Record<GroupFormErrorKey, string>>;
    students: UserProfile[];
    advisers: UserProfile[];
    editors: UserProfile[];
    departmentOptions: string[];
    memberChipData: { email: string; label: string }[];
    reviewCourse: string;
    saving: boolean;
    studentLoading: boolean;
    onClose: () => void;
    onFieldChange: (changes: Partial<ThesisGroupFormData>) => void;
    onLeaderChange: (value: UserProfile | null) => void;
    onMembersChange: (value: UserProfile[]) => void;
    onNext: (pendingChanges?: Partial<ThesisGroupFormData>) => void | Promise<void>;
    onBack: () => void;
    onSubmit: () => void | Promise<void>;
    formatUserLabel: (email: string | null | undefined) => string;
    formatMemberOptionLabel?: (profile: UserProfile) => string;
}

/**
 * Renders the multi-step dialog used for creating or editing groups.
 * All stateful logic is orchestrated by the parent page component.
 */
export default function GroupManageDialog({
    open,
    editMode,
    isAdmin = true,
    activeStep,
    steps,
    formData,
    formErrors,
    students,
    advisers,
    editors,
    departmentOptions,
    memberChipData,
    reviewCourse,
    saving,
    studentLoading,
    onClose,
    onFieldChange,
    onLeaderChange,
    onMembersChange,
    onNext,
    onBack,
    onSubmit,
    formatUserLabel,
    formatMemberOptionLabel,
}: GroupManageDialogProps) {
    // Local state for Step 0 to prevent expensive parent state updates on every keystroke
    const [localFormDetails, setLocalFormDetails] = React.useState({
        name: formData.name,
        description: formData.description || '',
        thesisTitle: formData.thesisTitle || '',
        department: formData.department || '',
        status: formData.status,
    });

    // Sync local state when dialog opens/closes or formData changes from parent
    React.useEffect(() => {
        if (open) {
            setLocalFormDetails({
                name: formData.name,
                description: formData.description || '',
                thesisTitle: formData.thesisTitle || '',
                department: formData.department || '',
                status: formData.status,
            });
        }
    }, [open, formData.name, formData.description, formData.thesisTitle, formData.department, formData.status]);

    const handleNext = React.useCallback(() => {
        let pendingChanges: Partial<ThesisGroupFormData> | undefined;

        if (activeStep === 0) {
            pendingChanges = {
                name: localFormDetails.name,
                description: localFormDetails.description,
                thesisTitle: localFormDetails.thesisTitle,
                department: localFormDetails.department,
                status: localFormDetails.status,
            };

            onFieldChange(pendingChanges);
        }

        void onNext(pendingChanges);
    }, [activeStep, localFormDetails, onFieldChange, onNext]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slots={{ transition: GrowTransition }}>
            <DialogTitle>{editMode ? 'Edit Group' : 'Create New Group'}</DialogTitle>
            <DialogContent dividers sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                <Box sx={{ mt: 2, minHeight: { xs: 420, md: 520 }, display: 'flex', flexDirection: 'column' }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {activeStep === 0 && (
                        <Stack spacing={2.5}>
                            <TextField
                                label="Group Name"
                                value={localFormDetails.name}
                                onChange={(event) => setLocalFormDetails(prev => ({ ...prev, name: event.target.value }))}
                                error={!!formErrors.name}
                                helperText={formErrors.name}
                                required
                                fullWidth
                            />

                            <TextField
                                label="Description"
                                value={localFormDetails.description}
                                onChange={(event) => setLocalFormDetails(prev => ({ ...prev, description: event.target.value }))}
                                multiline
                                rows={2}
                                fullWidth
                            />

                            <TextField
                                label="Thesis Title"
                                value={localFormDetails.thesisTitle}
                                onChange={(event) => setLocalFormDetails(prev => ({ ...prev, thesisTitle: event.target.value }))}
                                fullWidth
                            />

                            {isAdmin && (
                                <Autocomplete
                                    freeSolo
                                    options={departmentOptions}
                                    value={localFormDetails.department}
                                    onChange={(_, newValue) =>
                                        setLocalFormDetails(prev => ({ ...prev, department: newValue || '' }))
                                    }
                                    inputValue={localFormDetails.department}
                                    onInputChange={(_, newInputValue) =>
                                        setLocalFormDetails(prev => ({ ...prev, department: newInputValue }))
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Department"
                                            error={!!formErrors.department}
                                            helperText={
                                                formErrors.department || 'Select an existing department or type a new one'
                                            }

                                        />
                                    )}
                                />
                            )}

                            {isAdmin && (
                                <TextField
                                    select
                                    label="Status"
                                    value={localFormDetails.status}
                                    onChange={(event) => {
                                        const newStatus = event.target.value as ThesisGroupFormData['status'];
                                        setLocalFormDetails(prev => ({ ...prev, status: newStatus }));
                                    }}
                                    slotProps={{ select: { native: true } }}
                                    fullWidth
                                >
                                    {GROUP_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {formatGroupStatus(status)}
                                        </option>
                                    ))}
                                </TextField>
                            )}
                        </Stack>
                    )}

                    {activeStep === 1 && (
                        <Stack spacing={2.5}>
                            {isAdmin ? (
                                <Autocomplete
                                    options={students}
                                    loading={studentLoading}
                                    getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                    value={students.find((profile) => profile.uid === formData.leader) || null}
                                    onChange={(_, newValue) => onLeaderChange(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Group Leader"
                                            required
                                            error={!!formErrors.leader}
                                            helperText={formErrors.leader || 'Select the primary contact for the group'}
                                        />
                                    )}
                                />
                            ) : (
                                <TextField
                                    label="Group Leader"
                                    value={formatUserLabel(formData.leader)}
                                    disabled
                                    helperText="You are the group leader"
                                    fullWidth
                                />
                            )}

                            <Autocomplete
                                multiple
                                options={students.filter((student) => student.uid !== formData.leader)}
                                loading={studentLoading}
                                getOptionLabel={(option) => (
                                    formatMemberOptionLabel ? formatMemberOptionLabel(option) : (formatProfileLabel(option) || option.email)
                                )}
                                value={students.filter((profile) => profile.uid && formData.members.includes(profile.uid))}
                                onChange={(_, selected) => onMembersChange(selected)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Members"
                                        error={!!formErrors.members}
                                        helperText={
                                            formErrors.members || 'Only students from the same course can join the group'
                                        }
                                    />
                                )}
                            />

                            {!isAdmin && (
                                <TextField
                                    label="Course"
                                    value={formData.course || ''}
                                    disabled
                                    helperText="Your course"
                                    fullWidth
                                />
                            )}

                            {isAdmin && (
                                <TextField
                                    label="Course"
                                    value={formData.course || ''}
                                    disabled
                                    helperText={
                                        formData.course
                                            ? 'Derived from the selected leader and members'
                                            : 'Select a leader and members to determine the course'
                                    }
                                    fullWidth
                                />
                            )}

                            {isAdmin && (
                                <Autocomplete
                                    options={advisers}
                                    getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                    value={advisers.find((profile) => profile.uid === formData.adviser) || null}
                                    onChange={(_, newValue) => onFieldChange({ adviser: newValue?.uid || '' })}
                                    renderInput={(params) => <TextField {...params} label="Adviser (Optional)" />}
                                />
                            )}

                            {isAdmin && (
                                <Autocomplete
                                    options={editors}
                                    getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                    value={editors.find((profile) => profile.uid === formData.editor) || null}
                                    onChange={(_, newValue) => onFieldChange({ editor: newValue?.uid || '' })}
                                    renderInput={(params) => <TextField {...params} label="Editor (Optional)" />}
                                />
                            )}
                        </Stack>
                    )}

                    {activeStep === 2 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Group Details
                                </Typography>
                                <Stack spacing={1}>
                                    <Typography>
                                        <strong>Name:</strong> {formData.name || '—'}
                                    </Typography>
                                    <Typography>
                                        <strong>Description:</strong> {formData.description || '—'}
                                    </Typography>
                                    <Typography>
                                        <strong>Thesis Title:</strong> {formData.thesisTitle || '—'}
                                    </Typography>
                                    {isAdmin && (
                                        <Typography>
                                            <strong>Department:</strong> {formData.department || '—'}
                                        </Typography>
                                    )}
                                    {isAdmin && (
                                        <Typography>
                                            <strong>Status:</strong> {formatGroupStatus(formData.status)}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>

                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Team
                                </Typography>
                                <Stack spacing={1.5}>
                                    <Typography>
                                        <strong>Leader:</strong> {formatUserLabel(formData.leader)}
                                    </Typography>
                                    <Typography>
                                        <strong>Course:</strong> {reviewCourse || '—'}
                                    </Typography>
                                    <Box>
                                        <Typography sx={{ mb: 1 }}>
                                            <strong>Members:</strong>
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {memberChipData.length > 0 ? (
                                                memberChipData.map((member) => (
                                                    <Chip key={member.email} label={member.label} sx={{ mb: 1 }} />
                                                ))
                                            ) : (
                                                <Typography color="text.secondary">No members selected</Typography>
                                            )}
                                        </Stack>
                                    </Box>
                                    {isAdmin && (
                                        <Typography>
                                            <strong>Adviser:</strong> {formatUserLabel(formData.adviser)}
                                        </Typography>
                                    )}
                                    {isAdmin && (
                                        <Typography>
                                            <strong>Editor:</strong> {formatUserLabel(formData.editor)}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                        </Stack>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                {activeStep > 0 && (
                    <Button onClick={onBack} disabled={saving}>
                        Back
                    </Button>
                )}
                {activeStep < steps.length - 1 ? (
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        startIcon={studentLoading ? <CircularProgress size={18} /> : undefined}
                        disabled={saving || studentLoading}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={() => {
                            void onSubmit();
                        }}
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={18} /> : undefined}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create Group'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
