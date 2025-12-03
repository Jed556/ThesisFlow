import * as React from 'react';
import {
    Alert, Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogContentText, DialogTitle, Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon, Cancel as RejectIcon, Group as GroupIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { ThesisGroup } from '../../../types/group';
import type { UserProfile } from '../../../types/profile';
import { AnimatedList, AnimatedPage } from '../../../components/Animate';
import { Avatar, Name } from '../../../components/Avatar';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import { findUserById } from '../../../utils/firebase/firestore/user';
import { getGroupsByCourse, approveGroup, rejectGroup } from '../../../utils/firebase/firestore/groups';

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Group Approvals',
    segment: 'mod-group-approvals',
    icon: <GroupIcon />,
    roles: ['moderator'],
};

function splitSectionList(value?: string | null): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(/[;|\u007C]/)
        .map((section) => section.trim())
        .filter(Boolean);
}

/**
 * Moderator view for approving group formation requests limited to assigned courses.
 */
export default function ModeratorGroupApprovalsPage() {
    const session = useSession<Session>();
    const moderatorUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [profileError, setProfileError] = React.useState<string | null>(null);

    const [pendingGroups, setPendingGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
    const [groupsError, setGroupsError] = React.useState<string | null>(null);

    const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
    const [selectedGroup, setSelectedGroup] = React.useState<ThesisGroup | null>(null);
    const [rejectionReason, setRejectionReason] = React.useState('');

    React.useEffect(() => {
        if (!moderatorUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setProfileError(null);

        void findUserById(moderatorUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
            })
            .catch((fetchError) => {
                console.error('Failed to fetch moderator profile:', fetchError);
                if (!cancelled) {
                    setProfileError('Unable to load your profile.');
                    setProfile(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [moderatorUid]);

    const moderatorSections = React.useMemo(() => {
        if (!profile) {
            return [];
        }

        const explicitSections = (profile.moderatedCourses ?? []).filter(Boolean);
        if (explicitSections.length > 0) {
            return explicitSections;
        }

        const fallbackSections = splitSectionList(profile.course);
        if (fallbackSections.length > 0) {
            return fallbackSections;
        }

        return [];
    }, [profile]);

    const loadPendingGroups = React.useCallback(async () => {
        if (moderatorSections.length === 0) {
            setPendingGroups([]);
            return;
        }

        try {
            setGroupsLoading(true);
            setGroupsError(null);

            const resolvedGroups = await Promise.all(
                moderatorSections.map((section) => getGroupsByCourse(section))
            );

            const deduped = new Map<string, ThesisGroup>();
            resolvedGroups
                .flat()
                .filter((group) => group.status === 'review')
                .forEach((group) => {
                    deduped.set(group.id, group);
                });

            setPendingGroups(
                Array.from(deduped.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            );
        } catch (error) {
            console.error('Failed to load pending moderator groups:', error);
            setGroupsError('Unable to load group requests for your sections.');
            setPendingGroups([]);
        } finally {
            setGroupsLoading(false);
        }
    }, [moderatorSections]);

    React.useEffect(() => {
        void loadPendingGroups();
    }, [loadPendingGroups]);

    const handleApprove = React.useCallback(async (groupId: string) => {
        try {
            await approveGroup(groupId);
            showNotification('Group approved', 'success');
            await loadPendingGroups();
        } catch (error) {
            console.error('Failed to approve group:', error);
            showNotification('Failed to approve group', 'error');
        }
    }, [loadPendingGroups, showNotification]);

    const handleOpenRejectDialog = (group: ThesisGroup) => {
        setSelectedGroup(group);
        setRejectionReason('');
        setRejectDialogOpen(true);
    };

    const handleReject = async () => {
        if (!selectedGroup || !rejectionReason.trim()) {
            return;
        }

        try {
            await rejectGroup(selectedGroup.id, rejectionReason.trim());
            showNotification('Group rejected', 'info');
            setRejectDialogOpen(false);
            setSelectedGroup(null);
            setRejectionReason('');
            await loadPendingGroups();
        } catch (error) {
            console.error('Failed to reject group:', error);
            showNotification('Failed to reject group', 'error');
        }
    };

    if (!session?.user && session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={120} />
                </Paper>
            </AnimatedPage>
        );
    }

    if (!moderatorUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to review group requests.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Review pending group requests for the sections assigned to you. Only groups within your
                        courses appear here.
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" color="text.secondary">
                        Courses:
                    </Typography>
                    {moderatorSections.length === 0 ? (
                        <Chip label="No sections assigned" color="default" variant="outlined" size="small" />
                    ) : (
                        moderatorSections.map((section) => (
                            <Chip key={section} label={section} color="info" size="small" />
                        ))
                    )}
                </Stack>

                {profileError && <Alert severity="error">{profileError}</Alert>}
                {groupsError && <Alert severity="error">{groupsError}</Alert>}

                {!profileLoading && moderatorSections.length === 0 && (
                    <Alert severity="info">
                        Your profile does not list any sections to moderate. Update your assignments to start
                        reviewing groups.
                    </Alert>
                )}

                {(profileLoading || groupsLoading) && (
                    <Paper sx={{ p: 3 }}>
                        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
                        <Skeleton variant="rectangular" height={120} />
                    </Paper>
                )}

                {moderatorSections.length > 0 && !groupsLoading && pendingGroups.length === 0 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="body1" color="text.secondary">
                            No pending group requests for your sections right now.
                        </Typography>
                    </Paper>
                )}

                {pendingGroups.length > 0 && (
                    <AnimatedList variant="slideUp" staggerDelay={50}>
                        {pendingGroups.map((group) => (
                            <GroupRequestCard
                                key={group.id}
                                group={group}
                                onApprove={() => handleApprove(group.id)}
                                onReject={() => handleOpenRejectDialog(group)}
                            />
                        ))}
                    </AnimatedList>
                )}
            </Stack>

            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
                <DialogTitle>Reject group request</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Provide a reason for rejecting this group. The members will see this message.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Rejection reason"
                        fullWidth
                        multiline
                        rows={4}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
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

interface GroupRequestCardProps {
    group: ThesisGroup;
    onApprove: () => void;
    onReject: () => void;
}

function GroupRequestCard({ group, onApprove, onReject }: GroupRequestCardProps) {
    const [leaderProfile, setLeaderProfile] = React.useState<UserProfile | null>(null);
    const [memberProfiles, setMemberProfiles] = React.useState<Map<string, UserProfile>>(new Map());

    React.useEffect(() => {
        let cancelled = false;

        const loadProfiles = async () => {
            try {
                const leader = await findUserById(group.members.leader);
                if (!cancelled && leader) {
                    setLeaderProfile(leader);
                }

                const membersMap = new Map<string, UserProfile>();
                await Promise.all(
                    group.members.members.map(async (uid) => {
                        const profile = await findUserById(uid);
                        if (profile) {
                            membersMap.set(uid, profile);
                        }
                    })
                );

                if (!cancelled) {
                    setMemberProfiles(membersMap);
                }
            } catch (error) {
                console.error('Failed to load group member profiles:', error);
            }
        };

        void loadProfiles();

        return () => {
            cancelled = true;
        };
    }, [group.members.leader, group.members.members]);

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                        <Typography variant="h6">{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {group.course ?? 'Unassigned course'} • {group.department ?? 'No department'}
                        </Typography>
                    </Box>
                    <Chip label="Pending moderator review" color="warning" size="small" />
                </Stack>

                {group.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {group.description}
                    </Typography>
                )}

                <Stack spacing={1} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        <strong>Group ID:</strong> {group.id}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Created:</strong> {new Date(group.createdAt).toLocaleDateString()}
                    </Typography>
                </Stack>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Group leader
                </Typography>
                {leaderProfile ? (
                    <Avatar
                        uid={group.members.leader}
                        initials={[Name.FIRST]}
                        mode="chip"
                        tooltip="email"
                        label={`${leaderProfile.name.first} ${leaderProfile.name.last}`}
                        size="small"
                        chipProps={{ variant: 'outlined', size: 'small', color: 'primary' }}
                        editable={false}
                    />
                ) : (
                    <Chip label={group.members.leader} size="small" variant="outlined" color="primary" />
                )}

                {group.members.members.length > 0 && (
                    <>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                            Members ({group.members.members.length})
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {group.members.members.map((uid) => {
                                const profile = memberProfiles.get(uid);
                                return (
                                    <Avatar
                                        key={uid}
                                        uid={uid}
                                        initials={[Name.FIRST]}
                                        mode="chip"
                                        tooltip="email"
                                        label={profile ? `${profile.name.first} ${profile.name.last}` : uid}
                                        size="small"
                                        chipProps={{ variant: 'outlined', size: 'small' }}
                                        editable={false}
                                    />
                                );
                            })}
                        </Stack>
                    </>
                )}
            </CardContent>
            <CardActions>
                <Button startIcon={<ApproveIcon />} color="success" variant="contained" onClick={onApprove}>
                    Approve
                </Button>
                <Button startIcon={<RejectIcon />} color="error" variant="outlined" onClick={onReject}>
                    Reject
                </Button>
            </CardActions>
        </Card>
    );
}
