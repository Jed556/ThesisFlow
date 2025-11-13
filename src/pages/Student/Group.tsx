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
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    Search as SearchIcon,
    Send as SendIcon,
    Check as CheckIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage, AnimatedList } from '../../components/Animate';
import { Avatar, Name } from '../../components/Avatar';
import {
    createGroup,
    deleteGroup,
    getGroupsByCourse,
    getGroupById,
    inviteUserToGroup,
    removeInviteFromGroup,
    requestToJoinGroup,
    acceptInvite,
    submitGroupForReview,
    getGroupsByLeader,
    getGroupsByMember,
    acceptJoinRequest,
    rejectJoinRequest,
} from '../../utils/firebase/firestore/groups';
import { getUserById } from '../../utils/firebase/firestore/user';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'My Group',
    segment: 'group',
    icon: <GroupIcon />,
    roles: ['student', 'admin'],
};

type GroupWithInvites = ThesisGroup & {
    myInvites?: string[];
    myRequests?: string[];
};

/**
 * Student group management page - create, join, and manage thesis groups
 */
export default function StudentGroupPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

    // My group state
    const [myGroup, setMyGroup] = React.useState<ThesisGroup | null>(null);
    const [isLeader, setIsLeader] = React.useState(false);

    // Available groups (same course)
    const [availableGroups, setAvailableGroups] = React.useState<GroupWithInvites[]>([]);

    // My invites
    const [myInvites, setMyInvites] = React.useState<GroupWithInvites[]>([]);

    // Loading & error states
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
    const [searchDialogOpen, setSearchDialogOpen] = React.useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

    // Form states
    const [groupName, setGroupName] = React.useState('');
    const [groupDescription, setGroupDescription] = React.useState('');
    const [inviteUid, setInviteUid] = React.useState('');
    const [searchGroupId, setSearchGroupId] = React.useState('');
    const [previewGroup, setPreviewGroup] = React.useState<ThesisGroup | null>(null);
    const [previewMembers, setPreviewMembers] = React.useState<Map<string, UserProfile>>(new Map());

    // Load user profile
    React.useEffect(() => {
        if (!userUid) {
            setUserProfile(null);
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await getUserById(userUid);
                if (!cancelled && profile) {
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error('Failed to load user profile:', err);
            }
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, [userUid]);

    // Load my group and available groups
    React.useEffect(() => {
        if (!userUid || !userProfile?.course) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadGroups = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get groups where I'm the leader
                const leaderGroups = await getGroupsByLeader(userUid);
                // Get groups where I'm a member
                const memberGroups = await getGroupsByMember(userUid);

                // Combine and pick the first one as "my group"
                const allMyGroups = [...leaderGroups, ...memberGroups];
                const uniqueGroups = Array.from(
                    new Map(allMyGroups.map(g => [g.id, g])).values()
                );

                if (!cancelled) {
                    if (uniqueGroups.length > 0) {
                        const group = uniqueGroups[0];
                        setMyGroup(group);
                        setIsLeader(group.members.leader === userUid);
                    } else {
                        setMyGroup(null);
                        setIsLeader(false);
                    }

                    // Get all groups in my course
                    if (!userProfile.course) {
                        if (!cancelled) {
                            setAvailableGroups([]);
                            setMyInvites([]);
                        }
                        return;
                    }
                    const courseGroups = await getGroupsByCourse(userProfile.course);

                    // Filter out my group and groups that are not draft/review/active
                    const available = courseGroups.filter(g =>
                        g.id !== uniqueGroups[0]?.id &&
                        (g.status === 'draft' || g.status === 'review' || g.status === 'active')
                    );

                    // Separate groups where I have invites
                    const invites = available.filter(g => g.invites?.includes(userUid));
                    const others = available.filter(g => !g.invites?.includes(userUid));

                    setMyInvites(invites);
                    setAvailableGroups(others);
                }
            } catch (err) {
                console.error('Failed to load groups:', err);
                if (!cancelled) {
                    setError('Unable to load groups. Please try again later.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadGroups();

        return () => {
            cancelled = true;
        };
    }, [userUid, userProfile?.course]);

    const handleCreateGroup = async () => {
        if (!userUid || !userProfile?.course) return;

        try {
            await createGroup({
                name: groupName,
                description: groupDescription,
                members: {
                    leader: userUid,
                    members: [],
                },
                status: 'draft',
                course: userProfile.course,
                department: userProfile.department,
            });

            setCreateDialogOpen(false);
            setGroupName('');
            setGroupDescription('');

            // Reload groups
            const leaderGroups = await getGroupsByLeader(userUid);
            if (leaderGroups.length > 0) {
                setMyGroup(leaderGroups[0]);
                setIsLeader(true);
            }
        } catch (err) {
            console.error('Failed to create group:', err);
            setError('Failed to create group. Please try again.');
        }
    };

    const handleDeleteGroup = async () => {
        if (!myGroup) return;

        try {
            await deleteGroup(myGroup.id);
            setMyGroup(null);
            setIsLeader(false);
            setDeleteDialogOpen(false);
        } catch (err) {
            console.error('Failed to delete group:', err);
            setError('Failed to delete group. Please try again.');
        }
    };

    const handleInviteUser = async () => {
        if (!myGroup || !inviteUid.trim()) return;

        try {
            await inviteUserToGroup(myGroup.id, inviteUid.trim());
            setInviteDialogOpen(false);
            setInviteUid('');

            // Reload my group
            const updated = await getGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
            }
        } catch (err) {
            console.error('Failed to invite user:', err);
            setError('Failed to send invite. Please check the UID and try again.');
        }
    };

    const handleSearchGroup = async () => {
        if (!searchGroupId.trim()) return;

        try {
            const group = await getGroupById(searchGroupId.trim());
            if (!group) {
                setError('Group not found.');
                return;
            }

            if (group.course !== userProfile?.course) {
                setError('This group is not in your course.');
                return;
            }

            // Load preview members
            const memberUids = [
                group.members.leader,
                ...group.members.members,
            ].filter(Boolean);

            const membersMap = new Map<string, UserProfile>();
            await Promise.all(
                memberUids.map(async (uid) => {
                    const profile = await getUserById(uid);
                    if (profile) {
                        membersMap.set(uid, profile);
                    }
                })
            ); setPreviewGroup(group);
            setPreviewMembers(membersMap);
            setSearchDialogOpen(false);
            setPreviewDialogOpen(true);
            setSearchGroupId('');
        } catch (err) {
            console.error('Failed to search group:', err);
            setError('Failed to find group. Please check the group ID and try again.');
        }
    };

    const handleRequestToJoin = async (groupId: string) => {
        if (!userUid) return;

        try {
            await requestToJoinGroup(groupId, userUid);
            setError(null);

            // Reload available groups
            if (userProfile?.course) {
                const courseGroups = await getGroupsByCourse(userProfile.course);
                const available = courseGroups.filter(g =>
                    g.id !== myGroup?.id &&
                    (g.status === 'draft' || g.status === 'review' || g.status === 'active')
                );
                setAvailableGroups(available.filter(g => !g.invites?.includes(userUid)));
            }
        } catch (err) {
            console.error('Failed to request join:', err);
            setError('Failed to send join request. You may have already requested.');
        }
    };

    const handleAcceptInvite = async (groupId: string) => {
        if (!userUid) return;

        try {
            await acceptInvite(groupId, userUid);

            // Reload my group
            const updated = await getGroupById(groupId);
            if (updated) {
                setMyGroup(updated);
                setIsLeader(false);
            }

            // Remove from invites list
            setMyInvites(prev => prev.filter(g => g.id !== groupId));
        } catch (err) {
            console.error('Failed to accept invite:', err);
            setError('Failed to accept invite. Please try again.');
        }
    };

    const handleDeclineInvite = async (groupId: string) => {
        if (!userUid) return;

        try {
            await removeInviteFromGroup(groupId, userUid);

            // Remove from invites list
            setMyInvites(prev => prev.filter(g => g.id !== groupId));
        } catch (err) {
            console.error('Failed to decline invite:', err);
            setError('Failed to decline invite. Please try again.');
        }
    };

    const handleSubmitForReview = async () => {
        if (!myGroup) return;

        try {
            await submitGroupForReview(myGroup.id);

            // Reload my group
            const updated = await getGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
            }
        } catch (err) {
            console.error('Failed to submit for review:', err);
            setError('Failed to submit group for review. Please try again.');
        }
    };

    const handleAcceptJoinRequest = async (requesterUid: string) => {
        if (!myGroup) return;

        try {
            await acceptJoinRequest(myGroup.id, requesterUid);

            // Reload my group
            const updated = await getGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
            }
        } catch (err) {
            console.error('Failed to accept request:', err);
            setError('Failed to accept join request. Please try again.');
        }
    };

    const handleRejectJoinRequest = async (requesterUid: string) => {
        if (!myGroup) return;

        try {
            await rejectJoinRequest(myGroup.id, requesterUid);

            // Reload my group
            const updated = await getGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
            }
        } catch (err) {
            console.error('Failed to reject request:', err);
            setError('Failed to reject join request. Please try again.');
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

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to manage your thesis group.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    My Thesis Group
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Create or join a thesis group to collaborate with your peers.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* My Group Section */}
            {myGroup ? (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h5">{myGroup.name}</Typography>
                        <Stack direction="row" spacing={1}>
                            <Chip
                                label={myGroup.status.toUpperCase()}
                                color={
                                    myGroup.status === 'active' ? 'success' :
                                        myGroup.status === 'review' ? 'warning' :
                                            myGroup.status === 'rejected' ? 'error' : 'default'
                                }
                                size="small"
                            />
                            {isLeader && <Chip label="LEADER" color="primary" size="small" />}
                        </Stack>
                    </Stack>

                    {myGroup.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {myGroup.description}
                        </Typography>
                    )}

                    {myGroup.status === 'rejected' && myGroup.rejectionReason && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            <strong>Rejection Reason:</strong> {myGroup.rejectionReason}
                        </Alert>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                        Members
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                        <Avatar
                            uid={myGroup.members.leader}
                            initials={[Name.FIRST]}
                            mode="chip"
                            tooltip="email"
                            label="Leader"
                            size="small"
                            chipProps={{ variant: 'outlined', size: 'small', color: 'primary' }}
                        />
                        {myGroup.members.members.map((uid) => (
                            <Avatar
                                key={uid}
                                uid={uid}
                                initials={[Name.FIRST]}
                                mode="chip"
                                tooltip="email"
                                label="Member"
                                size="small"
                                chipProps={{ variant: 'outlined', size: 'small' }}
                            />
                        ))}
                    </Stack>

                    {isLeader && (
                        <>
                            {/* Pending Invites */}
                            {(myGroup.invites ?? []).length > 0 && (
                                <>
                                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                        Pending Invites
                                    </Typography>
                                    <Stack spacing={1} sx={{ mb: 2 }}>
                                        {myGroup.invites!.map((uid) => (
                                            <Chip key={uid} label={uid} size="small" variant="outlined" />
                                        ))}
                                    </Stack>
                                </>
                            )}

                            {/* Join Requests */}
                            {(myGroup.requests ?? []).length > 0 && (
                                <>
                                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                        Join Requests
                                    </Typography>
                                    <Stack spacing={1} sx={{ mb: 2 }}>
                                        {myGroup.requests!.map((uid) => (
                                            <Stack key={uid} direction="row" spacing={1} alignItems="center">
                                                <Avatar
                                                    uid={uid}
                                                    initials={[Name.FIRST]}
                                                    mode="chip"
                                                    tooltip="email"
                                                    size="small"
                                                    chipProps={{ variant: 'outlined', size: 'small' }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    color="success"
                                                    onClick={() => handleAcceptJoinRequest(uid)}
                                                >
                                                    <CheckIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleRejectJoinRequest(uid)}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </>
                            )}

                            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                                <Button
                                    startIcon={<PersonAddIcon />}
                                    variant="outlined"
                                    onClick={() => setInviteDialogOpen(true)}
                                >
                                    Invite Member
                                </Button>

                                {myGroup.status === 'draft' && (
                                    <>
                                        <Button
                                            startIcon={<SendIcon />}
                                            variant="contained"
                                            onClick={handleSubmitForReview}
                                        >
                                            Submit for Review
                                        </Button>
                                        <Button
                                            startIcon={<DeleteIcon />}
                                            variant="outlined"
                                            color="error"
                                            onClick={() => setDeleteDialogOpen(true)}
                                        >
                                            Delete Group
                                        </Button>
                                    </>
                                )}
                            </Stack>
                        </>
                    )}
                </Paper>
            ) : (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        You are not part of any group yet. Create a new group or join an existing one.
                    </Typography>
                    <Stack direction="row" spacing={2}>
                        <Button
                            startIcon={<AddIcon />}
                            variant="contained"
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Create Group
                        </Button>
                        <Button
                            startIcon={<SearchIcon />}
                            variant="outlined"
                            onClick={() => setSearchDialogOpen(true)}
                        >
                            Search Group by ID
                        </Button>
                    </Stack>
                </Paper>
            )}

            {/* My Invites */}
            {myInvites.length > 0 && (
                <>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Group Invites
                    </Typography>
                    <AnimatedList variant="slideUp" staggerDelay={50}>
                        {myInvites.map((group) => (
                            <Card key={group.id} sx={{ mb: 2 }}>
                                <CardContent>
                                    <Typography variant="h6">{group.name}</Typography>
                                    {group.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {group.description}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        ID: {group.id}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color="success"
                                        startIcon={<CheckIcon />}
                                        onClick={() => handleAcceptInvite(group.id)}
                                    >
                                        Accept
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<CloseIcon />}
                                        onClick={() => handleDeclineInvite(group.id)}
                                    >
                                        Decline
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </AnimatedList>
                </>
            )}

            {/* Available Groups */}
            {!myGroup && availableGroups.length > 0 && (
                <>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Groups in Your Course
                    </Typography>
                    <AnimatedList variant="slideUp" staggerDelay={50}>
                        {availableGroups.map((group) => (
                            <Card key={group.id} sx={{ mb: 2 }}>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="h6">{group.name}</Typography>
                                        <Chip
                                            label={group.status.toUpperCase()}
                                            size="small"
                                            color={
                                                group.status === 'active' ? 'success' :
                                                    group.status === 'review' ? 'warning' : 'default'
                                            }
                                        />
                                    </Stack>
                                    {group.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {group.description}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        ID: {group.id}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        onClick={() => handleRequestToJoin(group.id)}
                                        disabled={group.requests?.includes(userUid)}
                                    >
                                        {group.requests?.includes(userUid) ? 'Request Sent' : 'Request to Join'}
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </AnimatedList>
                </>
            )}

            {/* Create Group Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Enter the details for your new thesis group. You will be set as the group leader.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Group Name"
                        fullWidth
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Description (optional)"
                        fullWidth
                        multiline
                        rows={3}
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateGroup} variant="contained" disabled={!groupName.trim()}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Invite User Dialog */}
            <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
                <DialogTitle>Invite User to Group</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Enter the UID of the student you want to invite to your group.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="User UID"
                        fullWidth
                        value={inviteUid}
                        onChange={(e) => setInviteUid(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleInviteUser} variant="contained" disabled={!inviteUid.trim()}>
                        Send Invite
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Search Group Dialog */}
            <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)}>
                <DialogTitle>Search Group by ID</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Enter the group ID to search for a specific group.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Group ID"
                        fullWidth
                        value={searchGroupId}
                        onChange={(e) => setSearchGroupId(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSearchDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSearchGroup} variant="contained" disabled={!searchGroupId.trim()}>
                        Search
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preview Group Dialog */}
            <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Group Preview</DialogTitle>
                <DialogContent>
                    {previewGroup && (
                        <>
                            <Typography variant="h6" gutterBottom>
                                {previewGroup.name}
                            </Typography>
                            {previewGroup.description && (
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {previewGroup.description}
                                </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                ID: {previewGroup.id}
                            </Typography>
                            <Chip
                                label={previewGroup.status.toUpperCase()}
                                size="small"
                                color={
                                    previewGroup.status === 'active' ? 'success' :
                                        previewGroup.status === 'review' ? 'warning' : 'default'
                                }
                                sx={{ mb: 2 }}
                            />

                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                Members
                            </Typography>
                            <List dense>
                                {[previewGroup.members.leader, ...previewGroup.members.members]
                                    .filter(Boolean)
                                    .map((uid, idx) => {
                                        const member = previewMembers.get(uid);
                                        const isLeaderMember = idx === 0;
                                        return (
                                            <ListItem key={uid}>
                                                <ListItemText
                                                    primary={
                                                        member
                                                            ? `${member.name.first} ${member.name.last}${isLeaderMember ? ' (Leader)' : ''
                                                            }`
                                                            : `${uid}${isLeaderMember ? ' (Leader)' : ''}`
                                                    }
                                                    secondary={member?.email}
                                                />
                                            </ListItem>
                                        );
                                    })}
                            </List>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
                    {previewGroup && !myGroup && (
                        <Button
                            onClick={() => {
                                handleRequestToJoin(previewGroup.id);
                                setPreviewDialogOpen(false);
                            }}
                            variant="contained"
                        >
                            Request to Join
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Delete Group Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Group</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this group? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteGroup} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
