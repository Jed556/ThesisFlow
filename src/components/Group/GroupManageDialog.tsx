import {
    Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import type { ThesisGroupFormData } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { GROUP_STATUS_OPTIONS, formatGroupStatus } from './constants';
import { GrowTransition } from '../Animate';
import { formatProfileLabel } from '../../utils/profileUtils';

export type GroupFormErrorKey = keyof ThesisGroupFormData | 'members' | 'general';

interface GroupManageDialogProps {
    open: boolean;
    editMode: boolean;
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
    onNext: () => void | Promise<void>;
    onBack: () => void;
    onSubmit: () => void | Promise<void>;
    formatUserLabel: (email: string | null | undefined) => string;
}

/**
 * Renders the multi-step dialog used for creating or editing groups.
 * All stateful logic is orchestrated by the parent page component.
 */
export default function GroupManageDialog({
    open,
    editMode,
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
}: GroupManageDialogProps) {
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
                                value={formData.name}
                                onChange={(event) => onFieldChange({ name: event.target.value })}
                                error={!!formErrors.name}
                                helperText={formErrors.name}
                                required
                                fullWidth
                            />

                            <TextField
                                label="Description"
                                value={formData.description || ''}
                                onChange={(event) => onFieldChange({ description: event.target.value })}
                                multiline
                                rows={2}
                                fullWidth
                            />

                            <TextField
                                label="Thesis Title"
                                value={formData.thesisTitle || ''}
                                onChange={(event) => onFieldChange({ thesisTitle: event.target.value })}
                                fullWidth
                            />

                            <Autocomplete
                                freeSolo
                                options={departmentOptions}
                                value={formData.department || ''}
                                onChange={(_, newValue) => onFieldChange({ department: newValue || '' })}
                                inputValue={formData.department || ''}
                                onInputChange={(_, newInputValue) => onFieldChange({ department: newInputValue })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Department"
                                        error={!!formErrors.department}
                                        helperText={
                                            formErrors.department || 'Select an existing department or type a new one'
                                        }
                                        required
                                    />
                                )}
                            />

                            <TextField
                                select
                                label="Status"
                                value={formData.status}
                                onChange={(event) =>
                                    onFieldChange({ status: event.target.value as ThesisGroupFormData['status'] })
                                }
                                slotProps={{ select: { native: true } }}
                                fullWidth
                            >
                                {GROUP_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {formatGroupStatus(status)}
                                    </option>
                                ))}
                            </TextField>
                        </Stack>
                    )}

                    {activeStep === 1 && (
                        <Stack spacing={2.5}>
                            <Autocomplete
                                options={students}
                                loading={studentLoading}
                                getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                value={students.find((profile) => profile.email === formData.leader) || null}
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

                            <Autocomplete
                                multiple
                                options={students.filter((student) => student.email !== formData.leader)}
                                loading={studentLoading}
                                getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                value={students.filter((profile) => formData.members.includes(profile.email))}
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

                            <Autocomplete
                                options={advisers}
                                getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                value={advisers.find((profile) => profile.email === formData.adviser) || null}
                                onChange={(_, newValue) => onFieldChange({ adviser: newValue?.email || '' })}
                                renderInput={(params) => <TextField {...params} label="Adviser (Optional)" />}
                            />

                            <Autocomplete
                                options={editors}
                                getOptionLabel={(option) => formatProfileLabel(option) || option.email}
                                value={editors.find((profile) => profile.email === formData.editor) || null}
                                onChange={(_, newValue) => onFieldChange({ editor: newValue?.email || '' })}
                                renderInput={(params) => <TextField {...params} label="Editor (Optional)" />}
                            />
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
                                    <Typography>
                                        <strong>Department:</strong> {formData.department || '—'}
                                    </Typography>
                                    <Typography>
                                        <strong>Status:</strong> {formatGroupStatus(formData.status)}
                                    </Typography>
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
                                    <Typography>
                                        <strong>Adviser:</strong> {formatUserLabel(formData.adviser)}
                                    </Typography>
                                    <Typography>
                                        <strong>Editor:</strong> {formatUserLabel(formData.editor)}
                                    </Typography>
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
                        onClick={() => {
                            void onNext();
                        }}
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
