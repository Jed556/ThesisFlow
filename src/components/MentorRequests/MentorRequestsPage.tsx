import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { MentorRequest, MentorRequestRole } from '../../types/mentorRequest';
import type { ThesisGroup } from '../../types/group';
import type { ThesisData } from '../../types/thesis';
import type { Session } from '../../types/session';
import type { UserProfile, UserRole } from '../../types/profile';
import { AnimatedPage } from '../Animate';
import { useSnackbar } from '../../contexts/SnackbarContext';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';
import {
    assignMentorToGroup,
    getGroupById,
} from '../../utils/firebase/firestore/groups';
import {
    listenMentorRequestsByMentor,
    respondToMentorRequest,
} from '../../utils/firebase/firestore/mentorRequests';
import { listenThesesForMentor } from '../../utils/firebase/firestore/thesis';
import { getUsersByIds, onUserProfile, setUserProfile } from '../../utils/firebase/firestore/user';
import MentorRequestCard from './MentorRequestCard';
import { filterActiveMentorTheses } from '../../utils/mentorProfileUtils';

interface MentorRequestViewModel {
    request: MentorRequest;
    group: ThesisGroup | null;
    requester: UserProfile | null;
}

function resolveGroupMentor(group: ThesisGroup | null, role: MentorRequestRole): string | undefined {
    if (!group) {
        return undefined;
    }
    if (role === 'adviser') {
        return group.members.adviser;
    }
    if (role === 'editor') {
        return group.members.editor;
    }
    return group.members.statistician;
}

function formatMinimumCapacityMessage(currentCount: number): string {
    return `You currently mentor ${currentCount} group${currentCount === 1 ? '' : 's'}. Slots cannot go below that.`;
}

export interface MentorRequestsPageProps {
    role: MentorRequestRole;
    roleLabel: string;
    allowedRoles?: UserRole[];
}

function useMentorRequestViewModels(requests: MentorRequest[]): MentorRequestViewModel[] {
    const [groupsById, setGroupsById] = React.useState<Map<string, ThesisGroup | null>>(new Map());
    const [profilesByUid, setProfilesByUid] = React.useState<Map<string, UserProfile>>(new Map());

    React.useEffect(() => {
        let cancelled = false;
        const uniqueGroupIds = Array.from(new Set(requests.map((req) => req.groupId)));
        if (uniqueGroupIds.length === 0) {
            setGroupsById(new Map());
            return () => { /* no-op */ };
        }

        void (async () => {
            try {
                const resolved = await Promise.all(
                    uniqueGroupIds.map(async (groupId) => {
                        try {
                            const record = await getGroupById(groupId);
                            return [groupId, record] as const;
                        } catch (err) {
                            console.error(`Failed to resolve group ${groupId}:`, err);
                            return [groupId, null] as const;
                        }
                    })
                );
                if (!cancelled) {
                    setGroupsById(new Map(resolved));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to resolve mentor request groups:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [requests]);

    React.useEffect(() => {
        let cancelled = false;
        const uniqueRequesterIds = Array.from(new Set(requests.map((req) => req.requestedBy)));
        if (uniqueRequesterIds.length === 0) {
            setProfilesByUid(new Map());
            return () => { /* no-op */ };
        }

        void (async () => {
            try {
                const profiles = await getUsersByIds(uniqueRequesterIds);
                if (!cancelled) {
                    setProfilesByUid(new Map(profiles.map((profile) => [profile.uid, profile])));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to resolve requester profiles:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [requests]);

    return React.useMemo(() => (
        requests.map((request) => ({
            request,
            group: groupsById.get(request.groupId) ?? null,
            requester: profilesByUid.get(request.requestedBy) ?? null,
        }))
    ), [groupsById, profilesByUid, requests]);
}

/**
 * Shared mentor requests experience for adviser/editor/statistician dashboards.
 */
export default function MentorRequestsPage({ role, roleLabel, allowedRoles }: MentorRequestsPageProps) {
    const session = useSession<Session>();
    const mentorUid = session?.user?.uid ?? null;
    const viewerRole = session?.user?.role;
    const permittedRoles = allowedRoles ?? [role];
    const { showNotification } = useSnackbar();
    const navigate = useNavigate();
    const roleLabelLower = roleLabel.toLowerCase();
    const roleArticle = /^[aeiou]/i.test(roleLabelLower) ? 'an' : 'a';

    const [requests, setRequests] = React.useState<MentorRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<'approve' | 'reject'>('approve');
    const [dialogNote, setDialogNote] = React.useState('');
    const [selectedRequest, setSelectedRequest] = React.useState<MentorRequest | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [mentorProfile, setMentorProfile] = React.useState<UserProfile | null>(null);
    const [capacityInput, setCapacityInput] = React.useState('');
    const [capacityError, setCapacityError] = React.useState<string | null>(null);
    const [capacitySaving, setCapacitySaving] = React.useState(false);
    const [editingCapacity, setEditingCapacity] = React.useState(false);
    const [assignments, setAssignments] = React.useState<(ThesisData & { id: string })[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(false);

    const activeAssignments = React.useMemo(
        () => filterActiveMentorTheses(assignments),
        [assignments]
    );
    const minimumCapacity = activeAssignments.length;
    const mentorCapacityRaw = typeof mentorProfile?.capacity === 'number'
        ? mentorProfile.capacity
        : 0;
    const normalizedCapacity = Math.max(mentorCapacityRaw, minimumCapacity);
    const slotsSummary = mentorProfile ? `${activeAssignments.length}/${normalizedCapacity}` : '—';
    const openSlots = Math.max(normalizedCapacity - activeAssignments.length, 0);
    const capacityHelperHint = minimumCapacity > 0
        ? `Minimum ${minimumCapacity} to cover current assignments.`
        : 'Students only see you when slots are available.';

    const viewModels = useMentorRequestViewModels(requests);

    React.useEffect(() => {
        if (!mentorUid) {
            setRequests([]);
            setLoading(false);
            return () => { /* no-op */ };
        }

        setLoading(true);
        setError(null);
        const unsubscribe = listenMentorRequestsByMentor(role, mentorUid, {
            onData: (records) => {
                setRequests(records);
                setLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load mentor requests:', listenerError);
                setError('Unable to load mentor requests right now.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mentorUid, role]);

    React.useEffect(() => {
        if (!mentorUid) {
            setMentorProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(mentorUid, (profile) => {
            setMentorProfile(profile);
        });

        return () => {
            unsubscribe();
        };
    }, [mentorUid]);

    React.useEffect(() => {
        if (!mentorProfile) {
            setCapacityInput('');
            return;
        }
        if (editingCapacity) {
            return;
        }

        const baseValue = typeof mentorProfile.capacity === 'number'
            ? mentorProfile.capacity
            : 0;
        const nextValue = Math.max(minimumCapacity, baseValue);
        setCapacityInput(String(nextValue));
    }, [mentorProfile, minimumCapacity, editingCapacity]);

    React.useEffect(() => {
        if (!mentorUid) {
            setAssignments([]);
            setAssignmentsLoading(false);
            return () => { /* no-op */ };
        }

        setAssignmentsLoading(true);
        const unsubscribe = listenThesesForMentor(role, mentorUid, {
            onData: (records) => {
                setAssignments(records);
                setAssignmentsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load mentor assignments for capacity view:', listenerError);
                setAssignments([]);
                setAssignmentsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mentorUid, role]);

    const pendingCount = React.useMemo(
        () => requests.filter((record) => record.status === 'pending').length,
        [requests]
    );
    const approvedCount = React.useMemo(
        () => requests.filter((record) => record.status === 'approved').length,
        [requests]
    );
    const rejectedCount = React.useMemo(
        () => requests.filter((record) => record.status === 'rejected').length,
        [requests]
    );

    const handleCapacityInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setCapacityInput(value);
        if (value.trim() === '') {
            setCapacityError('Enter how many groups you can handle.');
            return;
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            setCapacityError('Enter a valid number.');
        } else if (!Number.isInteger(parsed)) {
            setCapacityError('Use whole numbers only.');
        } else if (parsed < 0) {
            setCapacityError('Slots cannot be negative.');
        } else if (parsed < minimumCapacity) {
            setCapacityError(formatMinimumCapacityMessage(minimumCapacity));
        } else {
            setCapacityError(null);
        }
    }, [minimumCapacity]);

    const capacityHasChanged = React.useMemo(() => {
        if (!mentorProfile) {
            return false;
        }
        const baseline = mentorCapacityRaw;
        const parsed = Number(capacityInput);
        if (capacityInput.trim() === '' || Number.isNaN(parsed)) {
            return false;
        }
        return parsed !== baseline;
    }, [capacityInput, mentorProfile]);

    const canSaveCapacity = Boolean(
        mentorUid &&
        !capacitySaving &&
        !capacityError &&
        capacityInput.trim() !== '' &&
        capacityHasChanged
    );

    const handleSaveCapacity = React.useCallback(async () => {
        if (!mentorUid) {
            return;
        }

        const parsed = Number(capacityInput.trim());
        if (capacityInput.trim() === '' || Number.isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
            setCapacityError('Provide a non-negative whole number.');
            return;
        }
        if (parsed < minimumCapacity) {
            setCapacityError(formatMinimumCapacityMessage(minimumCapacity));
            return;
        }

        setCapacitySaving(true);
        try {
            await setUserProfile(mentorUid, { capacity: parsed });
            showNotification('Updated your available slots.', 'success');
            setEditingCapacity(false);
            setCapacityError(null);
        } catch (err) {
            console.error('Failed to update mentor capacity:', err);
            const fallback = err instanceof Error ? err.message : 'Unable to update slots right now.';
            showNotification(fallback, 'error');
        } finally {
            setCapacitySaving(false);
        }
    }, [capacityInput, mentorUid, showNotification, minimumCapacity]);

    const handleStartEditing = React.useCallback(() => {
        if (!mentorProfile) return;
        setEditingCapacity(true);
    }, [mentorProfile]);

    const handleCancelEditing = React.useCallback(() => {
        if (mentorProfile) {
            const nextValue = typeof mentorProfile.capacity === 'number'
                ? String(Math.max(minimumCapacity, mentorProfile.capacity))
                : String(minimumCapacity);
            setCapacityInput(nextValue);
        }
        setCapacityError(null);
        setEditingCapacity(false);
    }, [mentorProfile, minimumCapacity]);


    const handleOpenDialog = React.useCallback((mode: 'approve' | 'reject', request: MentorRequest) => {
        setDialogMode(mode);
        setSelectedRequest(request);
        setDialogNote('');
        setDialogOpen(true);
    }, []);

    const handleOpenGroupView = React.useCallback((targetGroupId: string) => {
        if (role === 'adviser') navigate(`/adviser-requests/${targetGroupId}`);
        if (role === 'editor') navigate(`/editor-requests/${targetGroupId}`);
        if (role === 'statistician') navigate(`/statistician-requests/${targetGroupId}`);
    }, [navigate]);

    const handleCloseDialog = React.useCallback(() => {
        if (submitting) {
            return;
        }
        setDialogOpen(false);
        setSelectedRequest(null);
        setDialogNote('');
    }, [submitting]);

    const handleSubmitDecision = React.useCallback(async () => {
        if (!selectedRequest || !mentorUid) {
            return;
        }
        if (selectedRequest.status !== 'pending') {
            handleCloseDialog();
            return;
        }

        setSubmitting(true);
        const note = dialogNote.trim() || undefined;
        try {
            if (dialogMode === 'approve') {
                const targetGroup = viewModels.find((model) => model.request.id === selectedRequest.id)?.group ?? null;
                const currentMentor = resolveGroupMentor(targetGroup, role);
                if (!targetGroup) {
                    showNotification('Group record is missing. Please ask the students to resend the request.', 'error');
                    return;
                }
                if (currentMentor && currentMentor !== mentorUid) {
                    showNotification('This group already has another mentor assigned to this role.', 'warning');
                    return;
                }
                await assignMentorToGroup(selectedRequest.groupId, role, mentorUid);
                await respondToMentorRequest(selectedRequest.id, 'approved', { responseNote: note });
                showNotification('Request approved successfully.', 'success');
            } else {
                await respondToMentorRequest(selectedRequest.id, 'rejected', { responseNote: note });
                showNotification('Request rejected.', 'info');
            }
            setDialogOpen(false);
            setDialogNote('');
            setSelectedRequest(null);
        } catch (err) {
            console.error('Failed to update mentor request:', err);
            const fallback = err instanceof Error ? err.message : 'Unable to update request. Please try again.';
            showNotification(fallback, 'error');
        } finally {
            setSubmitting(false);
        }
    }, [dialogMode, dialogNote, handleCloseDialog, mentorUid, role, selectedRequest, showNotification, viewModels]);

    if (!viewerRole && session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Paper sx={{ p: 3 }}>
                    <Skeleton variant="text" width={240} height={40} />
                    <Skeleton variant="rectangular" height={200} />
                </Paper>
            </AnimatedPage>
        );
    }

    if (!viewerRole || !permittedRoles.includes(viewerRole)) {
        return (
            <UnauthorizedNotice
                title="Mentor access only"
                description={`This page is available to ${roleLabel.toLowerCase()}s.`}
            />
        );
    }

    if (!mentorUid) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="warning">
                    You need to sign in again to manage mentor requests.
                </Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Review and respond to thesis groups requesting you as their {roleLabel.toLowerCase()}.
                    </Typography>
                </Box>
                {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                                Pending
                            </Typography>
                            <Typography variant="h5">{pendingCount}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                                Approved
                            </Typography>
                            <Typography variant="h5">{approvedCount}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                                Rejected
                            </Typography>
                            <Typography variant="h5">{rejectedCount}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1, minWidth: 0 }}>
                        <CardContent>
                            {editingCapacity ? (
                                <>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Update accepted groups
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Set how many thesis groups you can handle. Use 0 to temporarily pause new requests.
                                    </Typography>
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={2}
                                        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                                    >
                                        <TextField
                                            label="Accepted groups"
                                            type="number"
                                            slotProps={{ htmlInput: { min: minimumCapacity, step: 1 } }}
                                            value={capacityInput}
                                            onChange={handleCapacityInputChange}
                                            sx={{ flex: 1, maxWidth: 220 }}
                                            error={Boolean(capacityError)}
                                            helperText={capacityError ?? capacityHelperHint}
                                            disabled={!mentorProfile}
                                        />
                                    </Stack>
                                </>
                            ) : (
                                <>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Accepted groups
                                    </Typography>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h5">
                                            {assignmentsLoading ? '…' : slotsSummary}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {normalizedCapacity === 0
                                                ? 'Not accepting requests'
                                                : openSlots > 0
                                                    ? `${openSlots} slot${openSlots === 1 ? '' : 's'} open`
                                                    : 'No open slots'}
                                        </Typography>
                                    </Stack>
                                </>
                            )}
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'flex-end' }}>
                            {editingCapacity ? (
                                <Stack direction="row" spacing={1}>
                                    <Button onClick={handleCancelEditing} disabled={capacitySaving}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleSaveCapacity}
                                        disabled={!canSaveCapacity}
                                    >
                                        {capacitySaving ? 'Saving…' : 'Save slots'}
                                    </Button>
                                </Stack>
                            ) : (
                                <Button
                                    variant="outlined"
                                    onClick={handleStartEditing}
                                    disabled={!mentorProfile}
                                >
                                    Edit slots
                                </Button>
                            )}
                        </CardActions>
                    </Card>
                </Stack>
            </Stack>

            {loading ? (
                <Paper sx={{ p: 3 }}>
                    <Skeleton variant="text" width={200} height={32} sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={140} />
                </Paper>
            ) : viewModels.length === 0 ? (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No mentor requests yet. Groups with an approved topic can send you a request from your profile page.
                    </Typography>
                </Paper>
            ) : (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 2,
                    }}
                >
                    {viewModels.map(({ request, group, requester }) => {
                        const assignedMentorUid = resolveGroupMentor(group, role);
                        const isAssigned = Boolean(assignedMentorUid);
                        const alreadyMentoredByViewer = Boolean(mentorUid && assignedMentorUid === mentorUid);
                        const disableApprove = isAssigned;
                        let approveDisabledReason: string | undefined;
                        if (isAssigned) {
                            approveDisabledReason = alreadyMentoredByViewer
                                ? 'You already mentor this group.'
                                : `This group already has ${roleArticle} ${roleLabelLower} assigned.`;
                        }

                        return (
                            <Box key={request.id} sx={{ display: 'flex' }}>
                                <MentorRequestCard
                                    request={request}
                                    group={group}
                                    requester={requester}
                                    onApprove={(pendingRequest) => handleOpenDialog('approve', pendingRequest)}
                                    onReject={(pendingRequest) => handleOpenDialog('reject', pendingRequest)}
                                    onOpenGroup={handleOpenGroupView}
                                    disableApprove={disableApprove}
                                    approveDisabledReason={approveDisabledReason}
                                />
                            </Box>
                        );
                    })}
                </Box>
            )}

            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {dialogMode === 'approve' ? `Approve ${roleLabel} Request` : `Reject ${roleLabel} Request`}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {dialogMode === 'approve'
                            ? 'Approving this request assigns you to the group immediately.'
                            : 'Please provide a short note so the group understands the rejection.'}
                    </DialogContentText>
                    <TextField
                        label="Response note"
                        multiline
                        minRows={3}
                        fullWidth
                        value={dialogNote}
                        onChange={(event) => setDialogNote(event.target.value)}
                        placeholder={dialogMode === 'approve'
                            ? 'Optional note (e.g., preferred meeting schedule)'
                            : 'Explain why the request is being rejected'}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color={dialogMode === 'approve' ? 'primary' : 'error'}
                        onClick={handleSubmitDecision}
                        disabled={submitting || (dialogMode === 'reject' && dialogNote.trim().length === 0)}
                    >
                        {dialogMode === 'approve' ? 'Approve Request' : 'Reject Request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
