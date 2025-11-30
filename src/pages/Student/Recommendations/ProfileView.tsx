import * as React from 'react';
import {
    Alert, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../../components/Profile/ProfileView';
import GroupCard, { GroupCardSkeleton } from '../../../components/Group/GroupCard';
import { onUserProfile, findUsersByIds } from '../../../utils/firebase/firestore/user';
import { getGroupsByLeader, listenGroupsByExpertRole } from '../../../utils/firebase/firestore/groups';
import {
    createExpertRequestByGroup, listenExpertRequestsByGroup,
} from '../../../utils/firebase/firestore/expertRequests';
import { filterActiveGroups, deriveExpertThesisHistory } from '../../../utils/expertProfileUtils';
import { evaluateExpertCompatibility, type ThesisRoleStats } from '../../../utils/recommendUtils';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { UserProfile, HistoricalThesisEntry, UserRole } from '../../../types/profile';
import type { ThesisGroup } from '../../../types/group';
import type { Session } from '../../../types/session';
import type { ExpertRequest } from '../../../types/expertRequest';

type ExpertRole = 'adviser' | 'editor' | 'statistician';

export const metadata: NavigationItem = {
    title: 'Expert Profile',
    segment: 'expert/:uid',
    hidden: true,
};

function isExpertRole(role: UserRole | undefined): role is ExpertRole {
    return role === 'adviser' || role === 'editor' || role === 'statistician';
}

export default function ExpertProfileViewPage() {
    const navigate = useNavigate();
    const { uid = '' } = useParams<{ uid: string }>();
    const session = useSession<Session>();
    const viewerUid = session?.user?.uid ?? null;
    const viewerRole = session?.user?.role;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [membersByUid, setMembersByUid] = React.useState<Map<string, UserProfile>>(new Map());
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [groupsLoading, setGroupsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [ownedGroups, setOwnedGroups] = React.useState<ThesisGroup[]>([]);
    const [ownedGroupsLoading, setOwnedGroupsLoading] = React.useState(false);
    const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
    const [selectedGroupId, setSelectedGroupId] = React.useState('');
    const [requestMessage, setRequestMessage] = React.useState('');
    const [requestSubmitting, setRequestSubmitting] = React.useState(false);
    const [groupRequests, setGroupRequests] = React.useState<Map<string, ExpertRequest[]>>(new Map());

    React.useEffect(() => {
        if (!uid) {
            setProfile(null);
            setError('Profile not found');
            setProfileLoading(false);
            return () => { /* no-op */ };
        }

        setProfileLoading(true);
        const unsubscribeProfile = onUserProfile(uid, (profileData) => {
            if (!profileData) {
                setProfile(null);
                setError('Profile not found');
            } else if (!isExpertRole(profileData.role)) {
                setProfile(profileData);
                setError('Only adviser or editor profiles can be viewed here.');
            } else {
                setProfile(profileData);
                setError(null);
            }
            setProfileLoading(false);
        });

        return () => {
            unsubscribeProfile();
        };
    }, [uid]);

    const expertRole = React.useMemo<ExpertRole | null>(() => (
        isExpertRole(profile?.role) ? profile.role : null
    ), [profile?.role]);

    React.useEffect(() => {
        if (!uid || !expertRole) {
            setGroups([]);
            setGroupsLoading(false);
            return () => { /* no-op */ };
        }

        setGroupsLoading(true);
        const unsubscribe = listenGroupsByExpertRole(expertRole, uid, {
            onData: (records) => {
                setGroups(records);
                setGroupsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load expert groups:', listenerError);
                setGroups([]);
                setGroupsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [expertRole, uid]);

    React.useEffect(() => {
        let cancelled = false;

        if (!viewerUid) {
            setOwnedGroups([]);
            setOwnedGroupsLoading(false);
            return () => { cancelled = true; };
        }

        setOwnedGroupsLoading(true);
        void getGroupsByLeader(viewerUid)
            .then((records) => {
                if (!cancelled) {
                    setOwnedGroups(records);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Failed to load owned groups:', err);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setOwnedGroupsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [viewerUid]);

    React.useEffect(() => {
        let cancelled = false;
        if (groups.length === 0) {
            setMembersByUid(new Map());
            return () => {
                cancelled = true;
            };
        }

        const memberIds = new Set<string>();
        groups.forEach((group) => {
            memberIds.add(group.members.leader);
            group.members.members.forEach((memberUid) => memberIds.add(memberUid));
        });

        void (async () => {
            try {
                const profiles = await findUsersByIds(Array.from(memberIds));
                if (cancelled) return;
                const next = new Map<string, UserProfile>();
                profiles.forEach((entry) => next.set(entry.uid, entry));
                setMembersByUid(next);
            } catch (memberError) {
                if (!cancelled) {
                    console.error('Failed to hydrate group members:', memberError);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [groups]);

    const activeAssignments = React.useMemo<ThesisGroup[]>(
        () => filterActiveGroups(groups),
        [groups]
    );

    const history = React.useMemo<HistoricalThesisEntry[]>(() => {
        if (!profile || !expertRole) {
            return [];
        }
        return deriveExpertThesisHistory(groups, profile.uid, expertRole);
    }, [groups, expertRole, profile]);

    const roleStats = React.useMemo<ThesisRoleStats>(() => {
        if (!expertRole) {
            return { adviserCount: 0, editorCount: 0, statisticianCount: 0 };
        }
        const total = groups.length;
        if (expertRole === 'adviser') {
            return { adviserCount: total, editorCount: 0, statisticianCount: 0 };
        }
        if (expertRole === 'editor') {
            return { adviserCount: 0, editorCount: total, statisticianCount: 0 };
        }
        return { adviserCount: 0, editorCount: 0, statisticianCount: total };
    }, [groups.length, expertRole]);

    const capacity = profile?.slots ?? 0;
    const openSlots = capacity > 0 ? Math.max(capacity - activeAssignments.length, 0) : 0;
    const normalizedCapacity = Math.max(capacity, activeAssignments.length);
    const openSlotsDisplay = normalizedCapacity > 0
        ? `${openSlots}/${normalizedCapacity}`
        : `${openSlots}/0`;
    const compatibility = profile && expertRole
        ? evaluateExpertCompatibility(profile, roleStats, expertRole)
        : null;

    const sortedGroups = React.useMemo(() => {
        const priority: Record<ThesisGroup['status'], number> = {
            active: 0,
            review: 1,
            draft: 2,
            inactive: 3,
            rejected: 4,
            completed: 5,
            archived: 6,
        };
        return [...groups].sort((a, b) => priority[a.status] - priority[b.status]);
    }, [groups]);

    const loading = profileLoading || groupsLoading;
    const skills = React.useMemo(() => profile?.skills ?? [], [profile?.skills]);

    const roleLabel = expertRole === 'adviser'
        ? 'Adviser'
        : expertRole === 'editor'
            ? 'Editor'
            : expertRole === 'statistician'
                ? 'Statistician'
                : 'Expert';
    const roleLabelLower = roleLabel.toLowerCase();
    const roleArticle = /^[aeiou]/i.test(roleLabelLower) ? 'an' : 'a';

    const leaderGroups = React.useMemo(
        () => ownedGroups.filter((group) => group.members.leader === viewerUid),
        [ownedGroups, viewerUid]
    );

    const requestableGroups = React.useMemo(() => {
        if (!expertRole) {
            return [];
        }
        return leaderGroups.filter((group) => !group.members[expertRole]);
    }, [leaderGroups, expertRole]);
    const ownsAnyLeaderGroup = leaderGroups.length > 0;
    const noGroupMessage = 'Create and lead a thesis group before sending requests.';
    const allRolesFilledMessage = `All of your groups already have ${roleArticle} ${roleLabelLower} assigned.`;

    React.useEffect(() => {
        setGroupRequests(new Map());
        if (requestableGroups.length === 0) {
            return () => { /* no-op */ };
        }

        const unsubscribes = requestableGroups.map((group) =>
            listenExpertRequestsByGroup(group.id, {
                onData: (requests) => {
                    setGroupRequests((previous) => {
                        const next = new Map(previous);
                        next.set(group.id, requests);
                        return next;
                    });
                },
                onError: (listenerError) => {
                    console.error(`Failed to load expert requests for group ${group.id}:`, listenerError);
                },
            })
        );

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [requestableGroups]);

    const hasPendingRequest = React.useMemo(() => {
        if (!profile) {
            return false;
        }
        for (const group of requestableGroups) {
            const requests = groupRequests.get(group.id) ?? [];
            if (requests.some((request) => request.status === 'pending' && request.expertUid === profile.uid)) {
                return true;
            }
        }
        return false;
    }, [groupRequests, profile, requestableGroups]);

    const slotsFull = capacity <= 0 || openSlots <= 0;
    const canShowRequestButton = viewerRole === 'student' && Boolean(expertRole);

    let requestDisabledReason: string | undefined;
    if (hasPendingRequest) {
        requestDisabledReason = 'You already have a pending request for this expert.';
    } else if (slotsFull) {
        requestDisabledReason = 'This expert is not accepting requests right now.';
    } else if (!ownsAnyLeaderGroup) {
        requestDisabledReason = noGroupMessage;
    } else if (requestableGroups.length === 0) {
        requestDisabledReason = allRolesFilledMessage;
    }

    const requestButtonDisabled = Boolean(slotsFull || requestableGroups.length === 0 || requestSubmitting || hasPendingRequest);
    const requestButtonLabel = hasPendingRequest
        ? 'Request pending'
        : slotsFull
            ? 'Not accepting requests'
            : `Request as ${roleLabel}`;
    const canSubmitExpertRequest = Boolean(
        selectedGroupId && requestableGroups.length > 0 && !requestSubmitting && !hasPendingRequest
    );
    const dialogDisabled = requestableGroups.length === 0 || ownedGroupsLoading || hasPendingRequest;

    React.useEffect(() => {
        if (!requestDialogOpen) {
            return;
        }

        if (requestableGroups.length === 0) {
            setSelectedGroupId('');
            return;
        }

        const exists = requestableGroups.some((group) => group.id === selectedGroupId);
        if (!exists) {
            setSelectedGroupId(requestableGroups[0].id);
        }
    }, [requestDialogOpen, requestableGroups, selectedGroupId]);

    let requestButton: React.ReactNode;

    const summaryCard = profile ? (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6" gutterBottom>Expert workload</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
                    {[
                        { label: 'Active Teams', value: activeAssignments.length },
                        { label: 'Total Assignments', value: groups.length },
                        { label: 'Open Slots', value: openSlotsDisplay },
                        { label: 'Compatibility', value: compatibility != null ? `${compatibility}%` : '—' },
                    ].map((stat) => (
                        <Stack key={stat.label} spacing={0.5} minWidth={140}>
                            <Typography variant="caption" color="text.secondary">
                                {stat.label}
                            </Typography>
                            <Typography variant="h6">{stat.value}</Typography>
                        </Stack>
                    ))}
                </Stack>
            </CardContent>
        </Card>
    ) : null;

    const handledGroupsCard = profile ? (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h6">Handled groups</Typography>
                    <Chip label={`${groups.length} total`} size="small" />
                </Stack>
                {groupsLoading ? (
                    <Stack spacing={2}>
                        {Array.from({ length: 2 }).map((_, idx) => (
                            <GroupCardSkeleton key={idx} />
                        ))}
                    </Stack>
                ) : sortedGroups.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No groups are currently assigned to this {roleLabel.toLowerCase()}.
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {sortedGroups.map((group) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                usersByUid={membersByUid}
                                onClick={() => navigate(`/group/${group.id}`)}
                            />
                        ))}
                    </Stack>
                )}
            </CardContent>
        </Card>
    ) : null;

    const handleOpenRequestDialog = React.useCallback(() => {
        if (hasPendingRequest) {
            showNotification('A request for this expert is already pending.', 'info');
            return;
        }

        if (requestableGroups.length === 0) {
            showNotification('Create a thesis group first to send expert requests.', 'info');
            return;
        }

        setSelectedGroupId((prev) => {
            const stillValid = prev && requestableGroups.some((group) => group.id === prev);
            if (stillValid) {
                return prev;
            }
            return requestableGroups[0]?.id ?? '';
        });
        setRequestMessage('');
        setRequestDialogOpen(true);
    }, [hasPendingRequest, requestableGroups, showNotification]);

    const handleCloseRequestDialog = React.useCallback(() => {
        setRequestDialogOpen(false);
    }, []);

    const handleSubmitExpertRequest = React.useCallback(async () => {
        if (!profile || !expertRole || !viewerUid) {
            return;
        }

        const targetGroup = requestableGroups.find((group) => group.id === selectedGroupId);
        if (!targetGroup) {
            showNotification('Select a group to continue.', 'warning');
            return;
        }

        setRequestSubmitting(true);
        try {
            await createExpertRequestByGroup(targetGroup.id, {
                expertUid: profile.uid,
                role: expertRole,
                requestedBy: viewerUid,
                message: requestMessage.trim() || undefined,
            });
            showNotification('Request sent successfully.', 'success');
            setRequestDialogOpen(false);
            setRequestMessage('');
        } catch (err) {
            console.error('Failed to send expert request:', err);
            const fallback = err instanceof Error ? err.message : 'Failed to send request.';
            showNotification(fallback, 'error');
        } finally {
            setRequestSubmitting(false);
        }
    }, [expertRole, profile, requestMessage, requestableGroups, selectedGroupId, showNotification, viewerUid]);

    if (canShowRequestButton) {
        requestButton = (
            <Tooltip
                title={requestDisabledReason}
                disableHoverListener={!requestDisabledReason}
                placement="top"
            >
                <span>
                    <Button
                        variant="contained"
                        color="secondary"
                        size="medium"
                        disabled={requestButtonDisabled}
                        onClick={handleOpenRequestDialog}
                    >
                        {requestButtonLabel}
                    </Button>
                </span>
            </Tooltip>
        );
    }

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    if (loading) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2}>
                    <Skeleton variant="text" width={300} height={60} />
                    <Skeleton variant="rectangular" width="100%" height={400} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (error || !profile || !expertRole) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="flex-start">
                    <Alert severity="warning" sx={{ maxWidth: 480 }}>
                        {error || 'Expert profile not available.'}
                    </Alert>
                    <Button onClick={handleBack}>Back</Button>
                </Stack>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <ProfileView
                profile={profile}
                currentGroups={activeAssignments}
                skills={skills}
                skillRatings={profile.skillRatings}
                timeline={history}
                assignmentsEmptyMessage={`No active theses assigned as ${roleLabel.toLowerCase()} yet.`}
                timelineEmptyMessage="Historical thesis records will appear here once available."
                backAction={{
                    label: 'Back',
                    onClick: handleBack,
                }}
                floatingBackButton
                headerActions={requestButton}
                additionalSections={(
                    <Stack spacing={3}>
                        {summaryCard}
                        {handledGroupsCard}
                    </Stack>
                )}
            />

            <Dialog
                open={requestDialogOpen}
                onClose={handleCloseRequestDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Request {roleLabel}
                </DialogTitle>
                <DialogContent dividers>
                    {ownedGroupsLoading ? (
                        <Stack spacing={2} sx={{ mb: 2 }}>
                            {Array.from({ length: 2 }).map((_, idx) => (
                                <Skeleton key={idx} variant="rounded" height={56} />
                            ))}
                        </Stack>
                    ) : requestableGroups.length === 0 ? (
                        <Alert severity="info">
                            {ownsAnyLeaderGroup ? allRolesFilledMessage : noGroupMessage}
                        </Alert>
                    ) : (
                        <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
                            <RadioGroup
                                value={selectedGroupId}
                                onChange={(event) => setSelectedGroupId(event.target.value)}
                            >
                                {requestableGroups.map((group) => (
                                    <FormControlLabel
                                        key={group.id}
                                        value={group.id}
                                        control={<Radio />}
                                        label={(<Stack spacing={0.25}>
                                            <Typography variant="subtitle2">{group.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {(group.course ?? 'Course TBD')} · {group.status.toUpperCase()}
                                            </Typography>
                                        </Stack>)}
                                    />
                                ))}
                            </RadioGroup>
                        </FormControl>
                    )}
                    <TextField
                        label="Message (optional)"
                        placeholder={`Explain why this ${roleLabel.toLowerCase()} is a good fit`}
                        multiline
                        minRows={3}
                        fullWidth
                        value={requestMessage}
                        onChange={(event) => setRequestMessage(event.target.value)}
                        disabled={dialogDisabled}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRequestDialog} disabled={requestSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmitExpertRequest}
                        disabled={!canSubmitExpertRequest}
                    >
                        {requestSubmitting ? 'Sending…' : 'Send request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
