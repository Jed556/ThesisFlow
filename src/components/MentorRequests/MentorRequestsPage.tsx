import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
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
import {
    CheckCircle as ApproveIcon,
    Close as RejectIcon,
    Group as GroupIcon,
    OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { MentorRequest, MentorRequestRole } from '../../types/mentorRequest';
import type { ThesisGroup } from '../../types/group';
import type { Session } from '../../types/session';
import type { UserProfile, UserRole } from '../../types/profile';
import { AnimatedList, AnimatedPage } from '../Animate';
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
import { getUsersByIds } from '../../utils/firebase/firestore/user';
import { formatDateShort } from '../../utils/dateUtils';

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

interface StatusDisplayConfig {
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
}

const STATUS_CONFIG: Record<MentorRequest['status'], StatusDisplayConfig> = {
    pending: { label: 'Pending', color: 'warning' },
    approved: { label: 'Approved', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
};

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

    const [requests, setRequests] = React.useState<MentorRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<'approve' | 'reject'>('approve');
    const [dialogNote, setDialogNote] = React.useState('');
    const [selectedRequest, setSelectedRequest] = React.useState<MentorRequest | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

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

    const handleOpenDialog = React.useCallback((mode: 'approve' | 'reject', request: MentorRequest) => {
        setDialogMode(mode);
        setSelectedRequest(request);
        setDialogNote('');
        setDialogOpen(true);
    }, []);

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
                    <Typography variant="h4" gutterBottom>
                        {roleLabel} Requests
                    </Typography>
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
                <AnimatedList variant="slideUp" staggerDelay={50}>
                    {viewModels.map(({ request, group, requester }) => {
                        const statusMeta = STATUS_CONFIG[request.status];
                        const requestedDate = formatDateShort(request.createdAt);
                        const respondedDate = request.respondedAt ? formatDateShort(request.respondedAt) : null;
                        const leaderName = requester
                            ? `${requester.name.first} ${requester.name.last}`
                            : request.requestedBy;
                        const groupName = group?.name ?? 'Unknown group';

                        return (
                            <Card key={request.id} variant="outlined" sx={{ mb: 2 }}>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                        <Box>
                                            <Typography variant="overline" color="text.secondary">
                                                Group
                                            </Typography>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <GroupIcon fontSize="small" />
                                                <Typography variant="h6">{groupName}</Typography>
                                            </Stack>
                                            {group?.course && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Course: {group.course}
                                                </Typography>
                                            )}
                                            {group?.department && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Department: {group.department}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Chip label={statusMeta.label} color={statusMeta.color} size="small" />
                                    </Stack>

                                    <Stack spacing={0.5} sx={{ mt: 2 }}>
                                        <Typography variant="body2">
                                            Requested by <strong>{leaderName}</strong> on {requestedDate}
                                        </Typography>
                                        {request.message && (
                                            <Typography variant="body2" color="text.secondary">
                                                “{request.message}”
                                            </Typography>
                                        )}
                                        {respondedDate && (
                                            <Typography variant="body2" color="text.secondary">
                                                Responded on {respondedDate}
                                            </Typography>
                                        )}
                                        {request.responseNote && (
                                            <Typography variant="body2" color="text.secondary">
                                                Note: {request.responseNote}
                                            </Typography>
                                        )}
                                    </Stack>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                    <Button
                                        startIcon={<OpenInNewIcon />}
                                        onClick={() => navigate(`/group/${request.groupId}`)}
                                        disabled={!group}
                                    >
                                        View Group
                                    </Button>
                                    {request.status === 'pending' && (
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                startIcon={<ApproveIcon />}
                                                color="success"
                                                variant="contained"
                                                onClick={() => handleOpenDialog('approve', request)}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                startIcon={<RejectIcon />}
                                                color="error"
                                                variant="outlined"
                                                onClick={() => handleOpenDialog('reject', request)}
                                            >
                                                Reject
                                            </Button>
                                        </Stack>
                                    )}
                                </CardActions>
                            </Card>
                        );
                    })}
                </AnimatedList>
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
