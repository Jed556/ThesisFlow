import * as React from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';

export interface TopicProposalDecisionDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** The decision type */
    decision: 'approved' | 'rejected';
    /** The role of the user making the decision */
    role: 'moderator' | 'head';
    /** The proposal title for display */
    proposalTitle?: string;
    /** Whether the dialog is in loading state */
    loading?: boolean;
    /** Callback when dialog is closed */
    onClose: () => void;
    /** Callback when decision is confirmed with notes */
    onConfirm: (notes: string) => Promise<void> | void;
}

/**
 * Centralized dialog for moderator and head approval/rejection decisions.
 * Requires notes for all decisions.
 */
export default function TopicProposalDecisionDialog({
    open,
    decision,
    role,
    proposalTitle,
    loading = false,
    onClose,
    onConfirm,
}: TopicProposalDecisionDialogProps) {
    const [notes, setNotes] = React.useState('');

    // Reset notes when dialog opens/closes
    React.useEffect(() => {
        if (open) {
            setNotes('');
        }
    }, [open]);

    const handleConfirm = async () => {
        if (notes.trim().length === 0) {
            return;
        }
        await onConfirm(notes.trim());
    };

    const isApproval = decision === 'approved';
    const roleLabel = role === 'moderator' ? 'Moderator' : 'Head';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {isApproval ? `${roleLabel} Approval` : `${roleLabel} Rejection`}
            </DialogTitle>
            <DialogContent>
                {proposalTitle && (
                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                        Topic: {proposalTitle}
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {isApproval
                        ? 'Provide feedback and guidance for the student group.'
                        : 'Explain why this topic is being rejected to help the group improve.'}
                </Typography>
                <TextField
                    label={isApproval ? 'Approval Notes' : 'Rejection Notes'}
                    fullWidth
                    multiline
                    minRows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                    placeholder={isApproval
                        ? 'Add guidance or justification for the student group'
                        : 'Explain why this topic is being rejected'}
                    required
                    error={notes.trim().length === 0}
                    helperText={notes.trim().length === 0
                        ? `Notes are required. (${notes.length}/500)`
                        : `${notes.length}/500`}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    autoFocus
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit" disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color={isApproval ? 'success' : 'error'}
                    disabled={loading || notes.trim().length === 0}
                >
                    {isApproval ? 'Approve' : 'Reject'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
