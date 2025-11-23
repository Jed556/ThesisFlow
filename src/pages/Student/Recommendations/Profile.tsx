import * as React from 'react';
import {
    Alert, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, TextField, Tooltip,
    Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../ProfileView';
import GroupCard, { GroupCardSkeleton } from '../../../components/Group/GroupCard';
import { onUserProfile, getUsersByIds } from '../../../utils/firebase/firestore/user';
import { listenThesesForMentor } from '../../../utils/firebase/firestore/thesis';
import { getGroupsByLeader, listenGroupsByMentorRole } from '../../../utils/firebase/firestore/groups';
import { createMentorRequest } from '../../../utils/firebase/firestore/mentorRequests';
import { filterActiveMentorTheses, deriveMentorThesisHistory } from '../../../utils/mentorProfileUtils';
import { evaluateMentorCompatibility, type ThesisRoleStats } from '../../../utils/recommendUtils';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisData } from '../../../types/thesis';
import type { UserProfile, HistoricalThesisEntry, UserRole } from '../../../types/profile';
import type { ThesisGroup } from '../../../types/group';
import type { Session } from '../../../types/session';

export const metadata: NavigationItem = {
    title: 'Mentor Profile',
    segment: 'mentor/:uid',
    hidden: true,
};

type MentorRole = 'adviser' | 'editor' | 'statistician';

function isMentorRole(role: UserRole | undefined): role is MentorRole {
    return role === 'adviser' || role === 'editor' || role === 'statistician';
}

export default function MentorProfilePage() {
    const navigate = useNavigate();
    const { uid = '' } = useParams<{ uid: string }>();
    const session = useSession<Session>();
    const viewerUid = session?.user?.uid ?? null;
    const viewerRole = session?.user?.role;
    const viewerEmail = session?.user?.email ?? undefined;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [assignments, setAssignments] = React.useState<(ThesisData & { id: string })[]>([]);
    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [membersByUid, setMembersByUid] = React.useState<Map<string, UserProfile>>(new Map());
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
    const [groupsLoading, setGroupsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [viewerProfile, setViewerProfile] = React.useState<UserProfile | null>(null);
    const [ownedGroups, setOwnedGroups] = React.useState<ThesisGroup[]>([]);
    const [ownedGroupsLoading, setOwnedGroupsLoading] = React.useState(false);
    const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
    const [selectedGroupId, setSelectedGroupId] = React.useState('');
    const [requestMessage, setRequestMessage] = React.useState('');
    const [requestSubmitting, setRequestSubmitting] = React.useState(false);

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
            } else if (!isMentorRole(profileData.role)) {
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

    React.useEffect(() => {
        if (!viewerUid) {
            setViewerProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(viewerUid, (viewerData) => {
            setViewerProfile(viewerData);
        });

        return () => {
            unsubscribe();
        };
    }, [viewerUid]);

    const mentorRole = React.useMemo<MentorRole | null>(() => (
        isMentorRole(profile?.role) ? profile.role : null
    ), [profile?.role]);

    React.useEffect(() => {
        if (!uid || !mentorRole) {
            setAssignments([]);
            setAssignmentsLoading(false);
            return () => { /* no-op */ };
        }

        setAssignmentsLoading(true);
        const unsubscribe = listenThesesForMentor(mentorRole, uid, {
            onData: (records) => {
                setAssignments(records);
                setAssignmentsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to listen for mentor assignments:', listenerError);
                setAssignments([]);
                setAssignmentsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mentorRole, uid]);

    React.useEffect(() => {
        if (!uid || !mentorRole) {
            setGroups([]);
            setGroupsLoading(false);
            return () => { /* no-op */ };
        }

        setGroupsLoading(true);
        const unsubscribe = listenGroupsByMentorRole(mentorRole, uid, {
            onData: (records) => {
                setGroups(records);
                setGroupsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load mentor groups:', listenerError);
                setGroups([]);
                setGroupsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mentorRole, uid]);

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
                if (cancelled) return;
                setOwnedGroups(records);
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
                const profiles = await getUsersByIds(Array.from(memberIds));
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


    const activeAssignments = React.useMemo<ThesisData[]>(
        () => filterActiveMentorTheses(assignments),
        [assignments]
    );

    const history = React.useMemo<HistoricalThesisEntry[]>(() => {
        if (!profile || !mentorRole) {
            return [];
        }
        return deriveMentorThesisHistory(assignments, profile.uid, mentorRole);
    }, [assignments, mentorRole, profile]);

    const roleStats = React.useMemo<ThesisRoleStats>(() => {
        if (!mentorRole) {
            return { adviserCount: 0, editorCount: 0, statisticianCount: 0 };
        }
        const total = assignments.length;
        if (mentorRole === 'adviser') {
            return { adviserCount: total, editorCount: 0, statisticianCount: 0 };
        }
        if (mentorRole === 'editor') {
            return { adviserCount: 0, editorCount: total, statisticianCount: 0 };
        }
        return { adviserCount: 0, editorCount: 0, statisticianCount: total };
    }, [assignments.length, mentorRole]);

    const capacity = profile?.capacity ?? 0;
    const openSlots = capacity > 0 ? Math.max(capacity - activeAssignments.length, 0) : 0;
    const compatibility = profile && mentorRole
        ? evaluateMentorCompatibility(profile, roleStats, mentorRole)
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

    const loading = profileLoading || assignmentsLoading;

    const skills = React.useMemo(
        () => profile?.skills ?? [],
        [profile?.skills]
    );

    const roleLabel = mentorRole === 'adviser'
        ? 'Adviser'
        : mentorRole === 'editor'
            ? 'Editor'
            : mentorRole === 'statistician'
                ? 'Statistician'
                : 'Mentor';

    const requestableGroups = React.useMemo(
        () => ownedGroups.filter((group) => group.members.leader === viewerUid),
        [ownedGroups, viewerUid]
    );

    const slotsFull = capacity <= 0 || (capacity > 0 && openSlots <= 0);
    const canShowRequestButton = viewerRole === 'student' && Boolean(mentorRole);

    let requestDisabledReason: string | undefined;
    if (slotsFull) {
        requestDisabledReason = 'This mentor is not accepting requests right now.';
    } else if (requestableGroups.length === 0) {
        requestDisabledReason = 'Create and lead a thesis group before sending requests.';
    }

    const requestButtonDisabled = Boolean(slotsFull || requestableGroups.length === 0 || requestSubmitting);
    const requestButtonLabel = slotsFull ? 'Not accepting requests' : `Request as ${roleLabel}`;
    const canSubmitMentorRequest = Boolean(selectedGroupId && requestableGroups.length > 0 && !requestSubmitting);
    const dialogDisabled = requestableGroups.length === 0 || ownedGroupsLoading;

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

    let bannerRequestButton: React.ReactNode;

    const summaryCard = profile ? (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6" gutterBottom>Mentor workload</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
                    {[
                        { label: 'Active Teams', value: activeAssignments.length },
                        { label: 'Total Assignments', value: assignments.length },
                        { label: 'Open Slots', value: capacity > 0 ? `${openSlots}/${capacity}` : `${openSlots}/0` },
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
        if (requestableGroups.length === 0) {
            showNotification('Create a thesis group first to send mentor requests.', 'info');
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
    }, [requestableGroups, showNotification]);

    const handleCloseRequestDialog = React.useCallback(() => {
        setRequestDialogOpen(false);
    }, []);

    const handleSubmitMentorRequest = React.useCallback(async () => {
        if (!profile || !mentorRole || !viewerUid) {
            return;
        }

        const targetGroup = requestableGroups.find((group) => group.id === selectedGroupId);
        if (!targetGroup) {
            showNotification('Select a group to continue.', 'warning');
            return;
        }

        setRequestSubmitting(true);
        try {
            await createMentorRequest({
                groupId: targetGroup.id,
                mentorUid: profile.uid,
                role: mentorRole,
                requestedBy: viewerUid,
                message: requestMessage.trim() || undefined,
            });
            showNotification('Request sent successfully.', 'success');
            setRequestDialogOpen(false);
            setRequestMessage('');
        } catch (err) {
            console.error('Failed to send mentor request:', err);
            const fallback = err instanceof Error ? err.message : 'Failed to send request.';
            showNotification(fallback, 'error');
        } finally {
            setRequestSubmitting(false);
        }
    }, [mentorRole, profile, requestMessage, requestableGroups, selectedGroupId, showNotification, viewerEmail, viewerProfile, viewerUid]);

    if (canShowRequestButton) {
        bannerRequestButton = (
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

    // Loading state
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

    // Error or not found state
    if (error || !profile || !mentorRole) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="flex-start">
                    <Alert severity="warning" sx={{ maxWidth: 480 }}>
                        {error || 'Mentor profile not available.'}
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
                currentTheses={activeAssignments}
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
                bannerActionSlot={bannerRequestButton}
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
                            Create and lead a thesis group first before sending mentor requests.
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
                        onClick={handleSubmitMentorRequest}
                        disabled={!canSubmitMentorRequest}
                    >
                        {requestSubmitting ? 'Sending…' : 'Send request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
