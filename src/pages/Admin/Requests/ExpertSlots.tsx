import * as React from 'react';
import {
    Alert, Box, Button, Card, CardActions, CardContent, Chip,
    Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import type { SlotRequestRecord } from '../../../types/slotRequest';
import type { UserProfile } from '../../../types/profile';
import { AnimatedPage, AnimatedList } from '../../../components/Animate';
import { Avatar, Name } from '../../../components/Avatar';
import { listenPendingSlotRequests, approveSlotRequest, rejectSlotRequest } from '../../../utils/firebase/firestore/slotRequests';
import { findUserById } from '../../../utils/firebase/firestore/user';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import { firebaseAuth } from '../../../utils/firebase/firebaseConfig';

export const metadata: NavigationItem = {
    group: 'admin-management',
    index: 6,
    title: 'Expert Slots',
    segment: 'slot-increase',
    icon: <SwapIcon />,
    roles: ['admin'],
};

/**
 * Admin page to review and approve/reject expert slot increase requests
 */
export default function ExpertSlotsPage() {
    const { showNotification } = useSnackbar();
    const [pendingRequests, setPendingRequests] = React.useState<SlotRequestRecord[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Dialog states
    const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
    const [selectedRequest, setSelectedRequest] = React.useState<SlotRequestRecord | null>(null);
    const [rejectionReason, setRejectionReason] = React.useState('');
    const [actionBusy, setActionBusy] = React.useState<Record<string, boolean>>({});

    // Subscribe to pending slot requests
    React.useEffect(() => {
        const unsubscribe = listenPendingSlotRequests({
            onData: (requests) => {
                setPendingRequests(requests);
                setLoading(false);
            },
            onError: (err) => {
                console.error('Failed to load pending slot requests:', err);
                setError('Unable to load pending requests. Please try again later.');
                setLoading(false);
            },
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (request: SlotRequestRecord) => {
        const adminUid = firebaseAuth.currentUser?.uid;
        if (!adminUid) {
            showNotification('You must be signed in to approve requests.', 'error');
            return;
        }

        setActionBusy((prev) => ({ ...prev, [request.id]: true }));
        try {
            await approveSlotRequest(request.id, {
                respondedBy: adminUid,
                responseNote: 'Request approved.',
            });
            showNotification(
                `Approved slot increase for expert. New max slots: ${request.requestedSlots}`,
                'success'
            );
        } catch (err) {
            console.error('Failed to approve slot request:', err);
            showNotification('Failed to approve request. Please try again.', 'error');
        } finally {
            setActionBusy((prev) => {
                const next = { ...prev };
                delete next[request.id];
                return next;
            });
        }
    };

    const handleOpenRejectDialog = (request: SlotRequestRecord) => {
        setSelectedRequest(request);
        setRejectDialogOpen(true);
    };

    const handleReject = async () => {
        if (!selectedRequest || !rejectionReason.trim()) return;

        const adminUid = firebaseAuth.currentUser?.uid;
        if (!adminUid) {
            showNotification('You must be signed in to reject requests.', 'error');
            return;
        }

        setActionBusy((prev) => ({ ...prev, [selectedRequest.id]: true }));
        try {
            await rejectSlotRequest(selectedRequest.id, {
                respondedBy: adminUid,
                responseNote: rejectionReason,
            });
            setRejectDialogOpen(false);
            setSelectedRequest(null);
            setRejectionReason('');
            showNotification('Request rejected.', 'info');
        } catch (err) {
            console.error('Failed to reject slot request:', err);
            showNotification('Failed to reject request. Please try again.', 'error');
        } finally {
            if (selectedRequest) {
                setActionBusy((prev) => {
                    const next = { ...prev };
                    delete next[selectedRequest.id];
                    return next;
                });
            }
        }
    };

    if (loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={120} />
                </Paper>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Expert Slot Requests
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Review and approve or reject expert slot increase requests.
                    When approved, the expert&apos;s maximum slot limit will be updated.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {pendingRequests.length === 0 ? (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No pending slot requests at this time.
                    </Typography>
                </Paper>
            ) : (
                <AnimatedList variant="slideUp" staggerDelay={50}>
                    {pendingRequests.map((request) => (
                        <SlotRequestCard
                            key={request.id}
                            request={request}
                            onApprove={() => handleApprove(request)}
                            onReject={() => handleOpenRejectDialog(request)}
                            isBusy={Boolean(actionBusy[request.id])}
                        />
                    ))}
                </AnimatedList>
            )}

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
                <DialogTitle>Reject Slot Request</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please provide a reason for rejecting this slot increase request.
                        The expert will see this message.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Rejection Reason"
                        fullWidth
                        multiline
                        rows={4}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleReject}
                        color="error"
                        variant="contained"
                        disabled={!rejectionReason.trim()}
                    >
                        Reject
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}

interface SlotRequestCardProps {
    request: SlotRequestRecord;
    onApprove: () => void;
    onReject: () => void;
    isBusy: boolean;
}

function SlotRequestCard({ request, onApprove, onReject, isBusy }: SlotRequestCardProps) {
    const [expertProfile, setExpertProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await findUserById(request.expertUid);
                if (!cancelled && profile) {
                    setExpertProfile(profile);
                }
            } catch (err) {
                console.error('Failed to load expert profile:', err);
            } finally {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            }
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, [request.expertUid]);

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'adviser':
                return 'Adviser';
            case 'editor':
                return 'Editor';
            case 'statistician':
                return 'Statistician';
            default:
                return role;
        }
    };

    const getRoleColor = (role: string): 'primary' | 'secondary' | 'success' | 'warning' => {
        switch (role) {
            case 'adviser':
                return 'primary';
            case 'editor':
                return 'secondary';
            case 'statistician':
                return 'success';
            default:
                return 'warning';
        }
    };

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 2 }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        {profileLoading ? (
                            <Skeleton variant="circular" width={32} height={32} />
                        ) : expertProfile ? (
                            <Avatar
                                uid={request.expertUid}
                                initials={[Name.FIRST]}
                                mode="chip"
                                tooltip="email"
                                label={`${expertProfile.name.first} ${expertProfile.name.last}`}
                                size="small"
                                chipProps={{ variant: 'outlined', size: 'small' }}
                                editable={false}
                            />
                        ) : (
                            <Chip label={request.expertUid} size="small" variant="outlined" />
                        )}
                        <Chip
                            label={getRoleLabel(request.expertRole)}
                            color={getRoleColor(request.expertRole)}
                            size="small"
                        />
                    </Stack>
                    <Chip label="PENDING" color="warning" size="small" />
                </Stack>

                <Stack spacing={1} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        <strong>Current Slots:</strong> {request.currentSlots}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Requested Slots:</strong>{' '}
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                            {request.requestedSlots}
                        </Box>
                        {' '}
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                            (+{request.requestedSlots - request.currentSlots})
                        </Box>
                    </Typography>
                    {request.department && (
                        <Typography variant="body2">
                            <strong>Department:</strong> {request.department}
                        </Typography>
                    )}
                    <Typography variant="body2">
                        <strong>Submitted:</strong>{' '}
                        {new Date(request.createdAt).toLocaleDateString()}
                    </Typography>
                </Stack>

                {request.reason && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Reason for Request
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {request.reason}
                        </Typography>
                    </Box>
                )}
            </CardContent>
            <CardActions>
                <Button
                    startIcon={<ApproveIcon />}
                    color="success"
                    variant="contained"
                    onClick={onApprove}
                    disabled={isBusy}
                >
                    Approve
                </Button>
                <Button
                    startIcon={<RejectIcon />}
                    color="error"
                    variant="outlined"
                    onClick={onReject}
                    disabled={isBusy}
                >
                    Reject
                </Button>
            </CardActions>
        </Card>
    );
}
