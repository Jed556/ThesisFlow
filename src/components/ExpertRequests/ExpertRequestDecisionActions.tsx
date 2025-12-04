import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent,
    DialogContentText, DialogTitle, TextField, Tooltip,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Close as RejectIcon } from '@mui/icons-material';
import type { ExpertRequest, ExpertRequestRole } from '../../types/expertRequest';
import type { ThesisGroup } from '../../types/group';
import { assignExpertToGroup } from '../../utils/firebase/firestore/groups';
import { respondToExpertRequestById } from '../../utils/firebase/firestore/expertRequests';
import { getGroupExpertByRole } from '../../utils/groupUtils';
import { useSnackbar } from '../../contexts/SnackbarContext';

export interface ExpertRequestDecisionActionsProps {
    request: ExpertRequest | null;
    group: ThesisGroup | null;
    role: ExpertRequestRole;
    roleLabel: string;
    expertUid: string | null | undefined;
    loading?: boolean;
    onCompleted?: (status: 'approved' | 'rejected') => void;
}

/**
 * Renders approve/reject controls with the same behavior as the service requests list.
 */
export default function ExpertRequestDecisionActions({ request, group, role, roleLabel, expertUid, loading, onCompleted }:
    ExpertRequestDecisionActionsProps) {

    const { showNotification } = useSnackbar();
    const [dialogMode, setDialogMode] = React.useState<'approve' | 'reject' | null>(null);
    const [dialogNote, setDialogNote] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    const roleLabelLower = roleLabel.toLowerCase();
    const roleArticle = /^[aeiou]/i.test(roleLabelLower) ? 'an' : 'a';

    const assignedExpertUid = getGroupExpertByRole(group, role);
    const alreadyExpertedByViewer = Boolean(expertUid && assignedExpertUid === expertUid);
    const approveDisabledReason = assignedExpertUid && !alreadyExpertedByViewer
        ? `This group already has ${roleArticle} ${roleLabelLower} assigned.`
        : undefined;

    const disableAll = loading || !expertUid || !request || request.status !== 'pending';
    const disableApprove = disableAll || Boolean(approveDisabledReason);

    const handleOpenDialog = React.useCallback((mode: 'approve' | 'reject') => {
        if (disableAll) {
            return;
        }
        setDialogMode(mode);
        setDialogNote('');
    }, [disableAll]);

    const handleCloseDialog = React.useCallback(() => {
        if (submitting) {
            return;
        }
        setDialogMode(null);
        setDialogNote('');
    }, [submitting]);

    const handleSubmit = React.useCallback(async () => {
        if (!dialogMode || !request || !expertUid) {
            return;
        }
        if (request.status !== 'pending') {
            showNotification('This request is no longer pending.', 'info');
            handleCloseDialog();
            return;
        }

        setSubmitting(true);
        const note = dialogNote.trim() || undefined;
        try {
            if (dialogMode === 'approve') {
                if (!group) {
                    showNotification('Group details are missing. Please reload and try again.', 'error');
                    return;
                }
                if (assignedExpertUid && assignedExpertUid !== expertUid) {
                    showNotification('This group already has a expert for this role.', 'warning');
                    return;
                }
                await assignExpertToGroup(group.id, expertUid!, role);
                await respondToExpertRequestById(request.id, 'approved', { responseNote: note });
                showNotification('Request approved successfully.', 'success');
                onCompleted?.('approved');
            } else {
                await respondToExpertRequestById(request.id, 'rejected', { responseNote: note });
                showNotification('Request rejected.', 'info');
                onCompleted?.('rejected');
            }
            setDialogMode(null);
            setDialogNote('');
        } catch (err) {
            console.error('Failed to update service request from group view:', err);
            const fallback = err instanceof Error ? err.message : 'Unable to process the request right now.';
            showNotification(fallback, 'error');
        } finally {
            setSubmitting(false);
        }
    }, [assignedExpertUid, dialogMode, dialogNote, group, expertUid, onCompleted, request, role, showNotification]);

    if (!request) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
                variant="outlined"
                color="error"
                onClick={() => handleOpenDialog('reject')}
                disabled={disableAll}
                startIcon={<RejectIcon />}
            >
                Reject
            </Button>
            <Tooltip
                title={approveDisabledReason ?? ''}
                placement="top"
                arrow
                disableHoverListener={!approveDisabledReason}
            >
                <span>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleOpenDialog('approve')}
                        disabled={disableApprove}
                        startIcon={<ApproveIcon />}
                    >
                        Approve
                    </Button>
                </span>
            </Tooltip>

            <Dialog open={Boolean(dialogMode)} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {dialogMode === 'approve'
                        ? `Approve ${roleLabel} Request`
                        : `Reject ${roleLabel} Request`}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {dialogMode === 'approve'
                            ? 'Approving this request assigns you to the group immediately.'
                            : 'Please include a short note so the group understands the rejection.'}
                    </DialogContentText>
                    <TextField
                        label="Response note"
                        multiline
                        minRows={3}
                        fullWidth
                        value={dialogNote}
                        onChange={(event) => setDialogNote(event.target.value)}
                        placeholder={dialogMode === 'approve'
                            ? 'Optional note for the group'
                            : 'Explain why the request is being rejected'}
                        required={dialogMode === 'reject'}
                        error={dialogMode === 'reject' && dialogNote.trim().length === 0}
                        helperText={dialogMode === 'reject'
                            ? 'A note is required when rejecting a request.'
                            : 'Optional'}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color={dialogMode === 'approve' ? 'success' : 'error'}
                        onClick={handleSubmit}
                        disabled={
                            submitting ||
                            (dialogMode === 'reject' && dialogNote.trim().length === 0)
                        }
                    >
                        {dialogMode === 'approve' ? 'Approve Request' : 'Reject Request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
