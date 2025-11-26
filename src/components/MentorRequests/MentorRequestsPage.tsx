import * as React from 'react';
import {
    Alert, Box, Button, Card, CardActions, CardContent,
    Paper, Skeleton, Stack, TextField, Typography,
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
import { getGroupById } from '../../utils/firebase/firestore/groups';
import { listenMentorRequestsByMentor } from '../../utils/firebase/firestore/mentorRequests';
import { listenThesesForMentor } from '../../utils/firebase/firestore/thesis';
import { getUsersByIds, onUserProfile, setUserProfile } from '../../utils/firebase/firestore/user';
import MentorRequestCard from './MentorRequestCard';
import { filterActiveMentorTheses } from '../../utils/mentorProfileUtils';

interface MentorRequestViewModel {
    request: MentorRequest;
    group: ThesisGroup | null;
    requester: UserProfile | null;
    usersByUid: Map<string, UserProfile>;
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
        const uniqueIds = new Set<string>();
        requests.forEach((req) => {
            if (req.requestedBy) {
                uniqueIds.add(req.requestedBy);
            }
        });
        groupsById.forEach((groupRecord) => {
            const leaderUid = groupRecord?.members.leader;
            if (leaderUid) {
                uniqueIds.add(leaderUid);
            }
        });
        const ids = Array.from(uniqueIds);
        if (ids.length === 0) {
            setProfilesByUid(new Map());
            return () => { /* no-op */ };
        }

        void (async () => {
            try {
                const profiles = await getUsersByIds(ids);
                if (!cancelled) {
                    setProfilesByUid(new Map(profiles.map((profile) => [profile.uid, profile])));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to resolve group/requester profiles:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [groupsById, requests]);

    return React.useMemo(() => (
        requests.map((request) => {
            const group = groupsById.get(request.groupId) ?? null;
            const requester = profilesByUid.get(request.requestedBy) ?? null;
            const usersByUid = new Map<string, UserProfile>();
            if (requester) {
                usersByUid.set(requester.uid, requester);
            }
            const leaderUid = group?.members.leader;
            if (leaderUid) {
                const leaderProfile = profilesByUid.get(leaderUid);
                if (leaderProfile) {
                    usersByUid.set(leaderUid, leaderProfile);
                }
            }
            return {
                request,
                group,
                requester,
                usersByUid,
            } satisfies MentorRequestViewModel;
        })
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

    // Dialog state removed: approvals are handled in the group view header now.
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



    const handleOpenGroupView = React.useCallback((requestToOpen: MentorRequest) => {
        const basePath = role === 'adviser'
            ? '/adviser-requests'
            : role === 'editor'
                ? '/editor-requests'
                : '/statistician-requests';
        navigate(`${basePath}/${requestToOpen.groupId}`, { state: { mentorRequest: requestToOpen } });
    }, [navigate, role]);


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
                variant='box'
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
                    {viewModels.map(({ request, group, requester, usersByUid }) => {
                        if (!group) {
                            return (
                                <Card key={request.id} variant="outlined">
                                    <CardContent>
                                        <Typography variant="body2" color="text.secondary">
                                            Group details are unavailable. Please ask the students to resend their request.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            );
                        }

                        return (
                            <Box key={request.id} sx={{ display: 'flex' }}>
                                <MentorRequestCard
                                    request={request}
                                    group={group}
                                    requester={requester}
                                    usersByUid={usersByUid}
                                    onOpenGroup={handleOpenGroupView}
                                />
                            </Box>
                        );
                    })}
                </Box>
            )}

        </AnimatedPage>
    );
}
