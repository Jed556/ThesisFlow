import * as React from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography
} from '@mui/material';

export interface PanelCommentEditorDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialValue?: {
        comment?: string;
        reference?: string;
    };
    onClose: () => void;
    onSubmit: (values: { comment: string; reference?: string }) => Promise<void> | void;
    submitting?: boolean;
}

/**
 * Dialog used by panel members to create or edit comment rows without cluttering page layouts.
 */
export function PanelCommentEditorDialog({
    open,
    mode,
    initialValue,
    onClose,
    onSubmit,
    submitting = false,
}: PanelCommentEditorDialogProps) {
    const [comment, setComment] = React.useState('');
    const [reference, setReference] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            return;
        }
        setComment(initialValue?.comment ?? '');
        setReference(initialValue?.reference ?? '');
        setError(null);
    }, [open, initialValue]);

    const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedComment = comment.trim();
        if (!trimmedComment) {
            setError('Comment is required.');
            return;
        }
        const trimmedReference = reference.trim();
        try {
            await onSubmit({
                comment: trimmedComment,
                reference: trimmedReference ? trimmedReference : undefined,
            });
        } catch (submitError) {
            console.error('Failed to submit panel comment dialog:', submitError);
            if (!error) {
                setError('Failed to save comment.');
            }
        }
    }, [comment, reference, onSubmit, error]);

    const title = mode === 'create' ? 'Add panel comment' : 'Edit panel comment';

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose}
            fullWidth maxWidth="sm" component="form" onSubmit={handleSubmit}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Comment / suggestion"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        multiline
                        minRows={3}
                        autoFocus
                        required
                    />
                    <TextField
                        label="Page / chapter reference"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        helperText="Optional. Helps students locate the context quickly."
                    />
                    {error && (
                        <Typography variant="body2" color="error">{error}</Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={submitting}>
                    {mode === 'create' ? 'Add comment' : 'Save changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default PanelCommentEditorDialog;
