import * as React from 'react';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent,
    DialogTitle, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import { GrowTransition } from '../Animate';
import { DEFAULT_MAX_EXPERT_SLOTS, type SlotRequestRecord } from '../../types/slotRequest';
import type { UserProfile, UserRole } from '../../types/profile';
import {
    createSlotRequest,
    getPendingSlotRequestByExpert,
} from '../../utils/firebase/firestore/slotRequests';
import { useSnackbar } from '../../contexts/SnackbarContext';

export interface SlotRequestDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Handler called when dialog should close */
    onClose: () => void;
    /** The expert's UID */
    expertUid: string;
    /** The expert's role */
    expertRole: UserRole;
    /** The expert's profile (for department info) */
    profile?: UserProfile | null;
    /** Current max slots the expert has */
    currentMaxSlots?: number;
    /** Callback after successful submission */
    onSubmitSuccess?: () => void;
}

/**
 * Dialog for experts to request a slot increase.
 * Experts specify the total number of slots they want (not additional slots).
 */
export function SlotRequestDialog({
    open,
    onClose,
    expertUid,
    expertRole,
    profile,
    currentMaxSlots,
    onSubmitSuccess,
}: SlotRequestDialogProps) {
    const { showNotification } = useSnackbar();
    const [requestedSlots, setRequestedSlots] = React.useState<number>(0);
    const [reason, setReason] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
    const [pendingRequest, setPendingRequest] = React.useState<SlotRequestRecord | null>(null);
    const [checkingPending, setCheckingPending] = React.useState(true);

    // Get effective current max slots
    const effectiveMaxSlots = currentMaxSlots ?? profile?.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS;

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            setRequestedSlots(effectiveMaxSlots + 1);
            setReason('');
            setError(null);

            // Check for existing pending request
            setCheckingPending(true);
            void (async () => {
                try {
                    const pending = await getPendingSlotRequestByExpert(expertUid);
                    setHasPendingRequest(Boolean(pending));
                    setPendingRequest(pending);
                } catch (err) {
                    console.error('Failed to check pending requests:', err);
                } finally {
                    setCheckingPending(false);
                }
            })();
        }
    }, [open, expertUid, effectiveMaxSlots]);

    const handleSubmit = async () => {
        if (requestedSlots <= effectiveMaxSlots) {
            setError('Requested slots must be greater than your current maximum.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await createSlotRequest({
                expertUid,
                expertRole,
                currentSlots: effectiveMaxSlots,
                requestedSlots,
                reason: reason.trim() || undefined,
                department: profile?.department,
            });

            showNotification(
                'Slot increase request submitted. An admin will review it shortly.',
                'success'
            );
            onSubmitSuccess?.();
            onClose();
        } catch (err) {
            console.error('Failed to submit slot request:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to submit request.';
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const additionalSlots = requestedSlots - effectiveMaxSlots;
    const isValidRequest = requestedSlots > effectiveMaxSlots;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slots={{ transition: GrowTransition }}
        >
            <DialogTitle>Request Slot Increase</DialogTitle>
            <DialogContent>
                {checkingPending ? (
                    <Stack spacing={2}>
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="rectangular" height={56} />
                        <Skeleton variant="rectangular" height={100} />
                    </Stack>
                ) : hasPendingRequest && pendingRequest ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        You already have a pending request for{' '}
                        <strong>{pendingRequest.requestedSlots}</strong> slots.
                        Please wait for admin approval before submitting a new request.
                    </Alert>
                ) : (
                    <Stack spacing={3}>
                        {error && (
                            <Alert severity="error" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        <Typography variant="body2" color="text.secondary">
                            Your current maximum slot limit is{' '}
                            <strong>{effectiveMaxSlots}</strong>.
                            Specify the total number of slots you need (not additional).
                        </Typography>

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Current Max Slots
                            </Typography>
                            <Typography variant="h5" color="text.secondary">
                                {effectiveMaxSlots}
                            </Typography>
                        </Box>

                        <TextField
                            label="Requested Total Slots"
                            type="number"
                            fullWidth
                            value={requestedSlots}
                            onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setRequestedSlots(Number.isNaN(value) ? 0 : Math.max(1, value));
                            }}
                            slotProps={{
                                input: {
                                    inputProps: { min: effectiveMaxSlots + 1, max: 50 },
                                },
                            }}
                            helperText={
                                isValidRequest
                                    ? `This will add ${additionalSlots} slot${additionalSlots !== 1 ? 's' : ''} to your limit`
                                    : 'Must be greater than your current maximum'
                            }
                            error={!isValidRequest && requestedSlots > 0}
                        />

                        <TextField
                            label="Reason for Request (Optional)"
                            multiline
                            rows={4}
                            fullWidth
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why you need additional slots (e.g., high demand, research needs)"
                        />
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    startIcon={<SendIcon />}
                    disabled={
                        submitting ||
                        checkingPending ||
                        hasPendingRequest ||
                        !isValidRequest
                    }
                >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export interface SlotRequestButtonProps {
    /** The expert's UID */
    expertUid: string;
    /** The expert's role */
    expertRole: UserRole;
    /** The expert's profile (for department info) */
    profile?: UserProfile | null;
    /** Current max slots the expert has */
    currentMaxSlots?: number;
    /** Button variant */
    variant?: 'text' | 'outlined' | 'contained';
    /** Button size */
    size?: 'small' | 'medium' | 'large';
    /** Callback after successful submission */
    onSubmitSuccess?: () => void;
}

/**
 * Button that opens the SlotRequestDialog when clicked.
 * Convenient wrapper for use in expert pages.
 */
export function SlotRequestButton({
    expertUid,
    expertRole,
    profile,
    currentMaxSlots,
    variant = 'outlined',
    size = 'small',
    onSubmitSuccess,
}: SlotRequestButtonProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);

    return (
        <>
            <Button
                variant={variant}
                size={size}
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
            >
                Request More
            </Button>
            <SlotRequestDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                expertUid={expertUid}
                expertRole={expertRole}
                profile={profile}
                currentMaxSlots={currentMaxSlots}
                onSubmitSuccess={onSubmitSuccess}
            />
        </>
    );
}

export default SlotRequestDialog;
