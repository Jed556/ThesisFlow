import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, List, ListItem,
    ListItemText, Paper, Skeleton, Stack, TextField, Typography
} from '@mui/material';
import { Groups as Groups, Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisGroup } from '../types/group';
import type { UserProfile, UserRole } from '../types/profile';
import { DEFAULT_MAX_EXPERT_SLOTS } from '../types/slotRequest';
import { AnimatedPage } from '../components/Animate';
import { SlotRequestButton } from '../components/ExpertRequests/SlotRequestDialog';
import { useSnackbar } from '../contexts/SnackbarContext';
import { formatProfileLabel } from '../utils/userUtils';
import { listenGroupsByExpertRole, approveGroup, rejectGroup } from '../utils/firebase/firestore/groups';
import { findUsersByIds, onUserProfile, updateUserProfile } from '../utils/firebase/firestore/user';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 2,
    title: 'Handled Groups',
    segment: 'groups',
    icon: <Groups />,
    roles: ['adviser', 'editor'],
};

type ExpertRole = 'adviser' | 'editor';

function isExpertRole(role: UserRole | undefined): role is ExpertRole {
    return role === 'adviser' || role === 'editor';
}

export default function ExpertGroupsPage() {
    const session = useSession<Session>();
    const expertUid = session?.user?.uid ?? null;
    const expertRole = session?.user?.role;
    const role: ExpertRole | null = isExpertRole(expertRole) ? expertRole : null;

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [capacityDraft, setCapacityDraft] = React.useState(0);
    const [capacitySaving, setCapacitySaving] = React.useState(false);
    const [membersByUid, setMembersByUid] = React.useState<Map<string, UserProfile>>(new Map());
    const [actionBusy, setActionBusy] = React.useState<Record<string, boolean>>({});
    const [editingLimit, setEditingLimit] = React.useState(false);
    const { showNotification } = useSnackbar();

    React.useEffect(() => {
        if (!expertUid || !role) {
            setProfile(null);
            setCapacityDraft(0);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(expertUid, (data) => {
            setProfile(data);
            const nextCapacity = role === 'adviser'
                ? data?.slots ?? 0
                : data?.slots ?? 0;
            setCapacityDraft(nextCapacity);
        });

        return () => {
            unsubscribe();
        };
    }, [expertUid, role]);

    React.useEffect(() => {
        if (!expertUid || !role) {
            setGroups([]);
            setLoading(false);
            return () => { /* no-op */ };
        }

        setLoading(true);
        setError(null);

        const unsubscribe = listenGroupsByExpertRole(role, expertUid, {
            onData: (records) => {
                setGroups(records);
                setLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load expert groups:', listenerError);
                setError('Unable to load groups right now. Please try again later.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [expertUid, role]);

    React.useEffect(() => {
        let cancelled = false;
        if (groups.length === 0) {
            setMembersByUid(new Map());
            return () => { cancelled = true; };
        }

        const memberIds = new Set<string>();
        groups.forEach((group) => {
            memberIds.add(group.members.leader);
            group.members.members.forEach((uid) => memberIds.add(uid));
        });

        void (async () => {
            try {
                const profiles = await findUsersByIds(Array.from(memberIds));
                if (cancelled) return;
                const next = new Map<string, UserProfile>();
                profiles.forEach((profileEntry) => {
                    next.set(profileEntry.uid, profileEntry);
                });
                setMembersByUid(next);
            } catch (memberError) {
                if (!cancelled) {
                    console.error('Failed to load group members:', memberError);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [groups]);

    const capacityValue = React.useMemo(() => {
        if (!role || !profile) {
            return 0;
        }

        return profile.slots ?? 0;
    }, [profile, role]);

    const maxSlotsValue = React.useMemo(() => {
        if (!role || !profile) {
            return DEFAULT_MAX_EXPERT_SLOTS;
        }
        return profile.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS;
    }, [profile, role]);

    const pendingRequests = React.useMemo(
        () => groups.filter((group) => group.status === 'review'),
        [groups]
    );

    const activeAssignments = React.useMemo(
        () => groups.filter((group) => group.status === 'active').length,
        [groups]
    );

    const takenSlots = activeAssignments;
    const limitDirty = capacityDraft !== capacityValue;

    const resolveMemberName = React.useCallback((uid: string): string => {
        const profileEntry = membersByUid.get(uid);
        const formatted = formatProfileLabel(profileEntry);
        return formatted || uid;
    }, [membersByUid]);

    const formatMemberList = React.useCallback((group: ThesisGroup): string => {
        const members = [group.members.leader, ...group.members.members];
        return members
            .map((uid) => resolveMemberName(uid))
            .filter((text) => Boolean(text))
            .join(', ') || 'No members listed';
    }, [resolveMemberName]);

    const handleApprove = React.useCallback(async (groupId: string) => {
        if (!groupId) return;
        setActionBusy((prev) => ({ ...prev, [groupId]: true }));
        try {
            await approveGroup(groupId);
            showNotification('Request approved. Group is now active.', 'success');
        } catch (err) {
            console.error('Failed to approve group:', err);
            showNotification('Unable to approve the request. Please try again.', 'error');
        } finally {
            setActionBusy((prev) => {
                const next = { ...prev };
                delete next[groupId];
                return next;
            });
        }
    }, [showNotification]);

    const handleReject = React.useCallback(async (groupId: string) => {
        if (!groupId) return;
        setActionBusy((prev) => ({ ...prev, [groupId]: true }));
        const reason = role === 'adviser' ? 'Adviser request declined' : 'Editor request declined';
        try {
            await rejectGroup(groupId, reason);
            showNotification('Request declined.', 'info');
        } catch (err) {
            console.error('Failed to reject group:', err);
            showNotification('Unable to decline the request. Please try again.', 'error');
        } finally {
            setActionBusy((prev) => {
                const next = { ...prev };
                delete next[groupId];
                return next;
            });
        }
    }, [role, showNotification]);

    const handleSaveCapacity = React.useCallback(async () => {
        if (!expertUid || !role) return;
        setCapacitySaving(true);
        try {

            await updateUserProfile(expertUid, { slots: capacityDraft });
            showNotification('Slot limit updated.', 'success');
            setEditingLimit(false);
        } catch (err) {
            console.error('Failed to update slot limit:', err);
            showNotification('Unable to save slot limit. Please try again.', 'error');
        } finally {
            setCapacitySaving(false);
        }
    }, [expertUid, role, capacityDraft, showNotification]);

    const renderRequests = () => (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Pending requests
            </Typography>
            {loading ? (
                <Stack spacing={2}>
                    {Array.from({ length: 2 }).map((_, idx) => (
                        <Skeleton key={idx} variant="rounded" height={64} />
                    ))}
                </Stack>
            ) : pendingRequests.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No pending group requests at the moment.
                </Typography>
            ) : (
                <List disablePadding>
                    {pendingRequests.map((group) => (
                        <ListItem
                            key={group.id}
                            divider
                            secondaryAction={(
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        color="success"
                                        startIcon={<CheckIcon />}
                                        onClick={() => handleApprove(group.id)}
                                        disabled={Boolean(actionBusy[group.id])}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        startIcon={<CloseIcon />}
                                        onClick={() => handleReject(group.id)}
                                        disabled={Boolean(actionBusy[group.id])}
                                    >
                                        Disapprove
                                    </Button>
                                </Stack>
                            )}
                        >
                            <ListItemText
                                primary={group.name}
                                secondary={formatMemberList(group)}
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    );

    const renderHandledGroups = () => (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Current groups
            </Typography>
            {loading ? (
                <Stack spacing={2}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={idx} variant="rounded" height={72} />
                    ))}
                </Stack>
            ) : groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No groups assigned yet. Approved groups will appear here.
                </Typography>
            ) : (
                <Stack spacing={2}>
                    {groups.map((group) => (
                        <Card key={group.id} variant="outlined">
                            <CardContent>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                    justifyContent="space-between"
                                    alignItems={{ sm: 'center' }}
                                >
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            {group.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatMemberList(group)}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={group.status.toUpperCase()}
                                        color={group.status === 'active'
                                            ? 'success'
                                            : group.status === 'review'
                                                ? 'warning'
                                                : 'default'}
                                        size="small"
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}
        </Paper>
    );

    if (!role) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">
                    Switch to an adviser or editor account to manage thesis groups.
                </Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box sx={{ mb: 3 }}>
                {/* <Typography variant="h4" gutterBottom>
                    
                </Typography> */}
                <Typography variant="body1" color="text.secondary">
                    Review incoming requests and keep your workload balanced.
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                            Active groups
                        </Typography>
                        <Typography variant="h5">{activeAssignments}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                            Pending requests
                        </Typography>
                        <Typography variant="h5">{pendingRequests.length}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Slots (Max: {maxSlotsValue})
                                </Typography>
                                {!editingLimit ? (
                                    <>
                                        <Typography variant="h5">
                                            {capacityValue > 0 ? `${takenSlots}/${capacityValue}` : `${takenSlots}/0`}
                                        </Typography>
                                    </>
                                ) : (
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1} alignItems={{ sm: 'center' }}>
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Max"
                                            value={capacityDraft}
                                            onChange={(event) => {
                                                const nextValue = Number(event.target.value);
                                                // Limit to maxSlotsValue
                                                setCapacityDraft(
                                                    Number.isNaN(nextValue)
                                                        ? 0
                                                        : Math.max(0, Math.min(nextValue, maxSlotsValue))
                                                );
                                            }}
                                            slotProps={{ input: { inputProps: { min: 0, max: maxSlotsValue } } }}
                                            sx={{ maxWidth: 200 }}
                                            helperText={capacityDraft >= maxSlotsValue ? 'At maximum limit' : undefined}
                                        />
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={handleSaveCapacity}
                                                disabled={capacitySaving || !limitDirty}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                variant="text"
                                                size="small"
                                                onClick={() => {
                                                    setCapacityDraft(capacityValue);
                                                    setEditingLimit(false);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </Stack>
                                    </Stack>
                                )}
                            </Box>
                            <Stack direction="column" spacing={0.5}>
                                {!editingLimit && (
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setCapacityDraft(capacityValue);
                                            setEditingLimit(true);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                )}
                                {expertUid && role && (
                                    <SlotRequestButton
                                        expertUid={expertUid}
                                        expertRole={role}
                                        profile={profile}
                                        currentMaxSlots={maxSlotsValue}
                                        size="small"
                                    />
                                )}
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>

            {renderRequests()}
            {renderHandledGroups()}
        </AnimatedPage>
    );
}
