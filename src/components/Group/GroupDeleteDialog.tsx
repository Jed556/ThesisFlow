import * as React from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import type { ThesisGroup } from '../../types/group';
import { GrowTransition } from '../Animate';

interface GroupDeleteDialogProps {
    open: boolean;
    group: ThesisGroup | null;
    onCancel: () => void;
    onConfirm: () => void;
    loading?: boolean;
}

/**
 * Confirmation dialog for destructive group deletion. Requires the user to type
 * the group name before enabling the delete action.
 */
export default function GroupDeleteDialog({
    open,
    group,
    onCancel,
    onConfirm,
    loading = false,
}: GroupDeleteDialogProps) {
    const [confirmationValue, setConfirmationValue] = React.useState('');
    const normalizedGroupName = group?.name?.trim() ?? '';

    React.useEffect(() => {
        if (open) {
            setConfirmationValue('');
        }
    }, [open, normalizedGroupName]);

    const handleDelete = React.useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmationValue(event.target.value);
    }, []);

    const isDisabled = loading || confirmationValue.trim() !== normalizedGroupName;

    return (
        <Dialog open={open} onClose={onCancel} slots={{ transition: GrowTransition }}>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography>
                        This action cannot be undone. To confirm, type the group name below:
                    </Typography>
                    <Typography variant="subtitle1" color="text.primary">
                        {normalizedGroupName || 'Unnamed group'}
                    </Typography>
                    <TextField
                        label="Group name"
                        value={confirmationValue}
                        onChange={handleInputChange}
                        autoFocus
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button onClick={handleDelete} color="error" variant="contained" disabled={isDisabled}>
                    {loading ? 'Deleting...' : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
