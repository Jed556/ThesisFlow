import * as React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';

export interface RequirementDialogData {
    title: string;
    description: string;
    required?: boolean;
}

export interface RequirementDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Called when the dialog should close */
    onClose: () => void;
    /** Called when the user confirms the action */
    onConfirm: (data: RequirementDialogData) => void;
    /** Dialog mode - 'add' shows required toggle, 'edit' hides it */
    mode: 'add' | 'edit';
    /** Initial values for the form fields */
    initialData?: Partial<RequirementDialogData>;
    /** Label for the stage (shown in add mode) */
    stageLabel?: string;
}

/**
 * Dialog component for adding or editing terminal requirements.
 * Manages its own internal state for form fields.
 */
export function RequirementDialog({
    open,
    onClose,
    onConfirm,
    mode,
    initialData,
    stageLabel,
}: RequirementDialogProps) {
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [required, setRequired] = React.useState(true);

    // Reset form when dialog opens with new initial data
    React.useEffect(() => {
        if (open) {
            setTitle(initialData?.title ?? '');
            setDescription(initialData?.description ?? '');
            setRequired(initialData?.required ?? true);
        }
    }, [open, initialData]);

    const handleConfirm = React.useCallback(() => {
        onConfirm({
            title: title.trim(),
            description: description.trim(),
            required,
        });
    }, [title, description, required, onConfirm]);

    const handleClose = React.useCallback(() => {
        onClose();
    }, [onClose]);

    const isAddMode = mode === 'add';
    const dialogTitle = isAddMode ? 'Add New Requirement' : 'Edit Requirement';
    const confirmButtonText = isAddMode ? 'Add' : 'Save';

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {dialogTitle}
                {isAddMode && stageLabel && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        This requirement will be added to the {stageLabel} stage.
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Chapter 1 Submission"
                        required
                        fullWidth
                        autoFocus
                    />
                    <TextField
                        label="Description / Instructions"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description for students"
                        multiline
                        rows={3}
                        fullWidth
                    />
                    {isAddMode && (
                        <>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Switch
                                    checked={required}
                                    onChange={(_, checked) => setRequired(checked)}
                                    size="small"
                                />
                                <Typography variant="body2">
                                    Required
                                </Typography>
                            </Stack>
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={!title.trim()}
                >
                    {confirmButtonText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
