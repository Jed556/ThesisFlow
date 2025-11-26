import * as React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { ThesisChapterConfig } from '../../types/chapter';
import { GrowTransition } from '../Animate';

interface ChapterDeleteDialogProps {
    open: boolean;
    config: ThesisChapterConfig | null;
    deleting: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
}

/** Confirmation dialog used before deleting a chapter configuration. */
export default function ChapterDeleteDialog({ open, config, deleting, onClose, onConfirm }: ChapterDeleteDialogProps) {
    const handleConfirm = React.useCallback(() => {
        void onConfirm();
    }, [onConfirm]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slots={{ transition: GrowTransition }}>
            <DialogTitle>Delete Chapter Template</DialogTitle>
            <DialogContent>
                <Typography>
                    Are you sure you want to delete the chapter requirements for
                    {' '}<strong>{config?.department || 'this department'}</strong>
                    {' '}({config?.course || 'course'})? This action cannot be undone.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={deleting}>
                    Cancel
                </Button>
                <Button color="error" onClick={handleConfirm} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
