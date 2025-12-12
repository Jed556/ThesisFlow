import * as React from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography
} from '@mui/material';
import type { ScheduleEvent } from '../../types/schedule';

/**
 * Props for the DeleteEventDialog component
 */
export interface DeleteEventDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback to close the dialog */
    onClose: () => void;
    /** Callback to confirm deletion */
    onConfirm: () => void;
    /** Event to be deleted */
    event: (ScheduleEvent & { id: string }) | null;
}

/**
 * Dialog component for confirming event deletion
 */
export function DeleteEventDialog({
    open,
    onClose,
    onConfirm,
    event,
}: DeleteEventDialogProps) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogContent>
                <Typography>
                    Are you sure you want to delete "{event?.title}"? This action cannot be undone.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onConfirm} color="error" variant="contained">
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default DeleteEventDialog;
