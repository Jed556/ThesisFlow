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
    Cancel as RejectIcon,
    Group as GroupIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { ThesisGroup } from '../../../types/group';
import type { UserProfile } from '../../../types/profile';
import { AnimatedPage, AnimatedList } from '../../../components/Animate';
import { Avatar, Name } from '../../../components/Avatar';
import {
    getAllGroupsByStatus, approveGroup, rejectGroup,
} from '../../../utils/firebase/firestore/groups';
import { findUserById } from '../../../utils/firebase/firestore/user';
import { auditAndNotify } from '../../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'admin-management',
    index: 5,
    title: 'Group Requests',
    segment: 'admin/requests/groups',
    icon: <GroupIcon />,
    roles: ['admin'],
};

/**
 * Admin page to review and approve/reject group creation requests
 */
export default function AdminGroupRequestsPage() {
    const session = useSession<Session>();
    const adminUid = session?.user?.uid;

    const [pendingGroups, setPendingGroups] = React.useState<ThesisGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Dialog states
    const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
    const [selectedGroup, setSelectedGroup] = React.useState<ThesisGroup | null>(null);
    const [rejectionReason, setRejectionReason] = React.useState('');

    // Load pending groups
    const loadPendingGroups = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const groups = await getAllGroupsByStatus('review');
            setPendingGroups(groups);
        } catch (err) {
            console.error('Failed to load pending groups:', err);
            setError('Unable to load pending groups. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadPendingGroups();
    }, [loadPendingGroups]);

    const handleApprove = async (groupId: string) => {
        const group = pendingGroups.find((g) => g.id === groupId);
        try {
            await approveGroup(groupId);

            // Audit notification for group approval by admin
            if (group && adminUid) {
                void auditAndNotify({
                    group,
                    userId: adminUid,
                    name: 'Group Approved',
                    description: `Group "${group.name}" has been approved by administrator.`,
                    category: 'group',
                    action: 'group_approved',
                    targets: {
                        groupMembers: true,
                        excludeUserId: adminUid,
                    },
                    sendEmail: true,
                });
            }

            await loadPendingGroups(); // Reload the list
        } catch (err) {
            console.error('Failed to approve group:', err);
            setError('Failed to approve group. Please try again.');
        }
    };

    const handleOpenRejectDialog = (group: ThesisGroup) => {
        setSelectedGroup(group);
        setRejectDialogOpen(true);
    };

    const handleReject = async () => {
        if (!selectedGroup || !rejectionReason.trim()) return;

        try {
            await rejectGroup(selectedGroup.id, rejectionReason);

            // Audit notification for group rejection by admin
            if (adminUid) {
                void auditAndNotify({
                    group: selectedGroup,
                    userId: adminUid,
                    name: 'Group Rejected',
                    description: `Group "${selectedGroup.name}" has been rejected. Reason: ${rejectionReason.trim()}`,
                    category: 'group',
                    action: 'group_rejected',
                    targets: {
                        groupMembers: true,
                        excludeUserId: adminUid,
                    },
                    details: { reason: rejectionReason.trim() },
                    sendEmail: true,
                });
            }

            setRejectDialogOpen(false);
            setSelectedGroup(null);
            setRejectionReason('');
            await loadPendingGroups(); // Reload the list
        } catch (err) {
            console.error('Failed to reject group:', err);
            setError('Failed to reject group. Please try again.');
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
                    Group Creation Requests
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Review and approve or reject group creation requests from students.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {pendingGroups.length === 0 ? (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No pending group requests at this time.
                    </Typography>
                </Paper>
            ) : (
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

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
                <DialogTitle>Reject Group Request</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please provide a reason for rejecting this group. The students will see this message.
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
                // Load leader profile
                const leader = await findUserById(group.members.leader);
                if (!cancelled && leader) {
                    setLeaderProfile(leader);
                }

                // Load member profiles
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
            } catch (err) {
                console.error('Failed to load member profiles:', err);
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
                    <Typography variant="h6">{group.name}</Typography>
                    <Chip label="PENDING REVIEW" color="warning" size="small" />
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
                    {group.course && (
                        <Typography variant="body2">
                            <strong>Course:</strong> {group.course}
                        </Typography>
                    )}
                    {group.department && (
                        <Typography variant="body2">
                            <strong>Department:</strong> {group.department}
                        </Typography>
                    )}
                    <Typography variant="body2">
                        <strong>Created:</strong> {new Date(group.createdAt).toLocaleDateString()}
                    </Typography>
                </Stack>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Group Leader
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
                                        label={
                                            profile
                                                ? `${profile.name.first} ${profile.name.last}`
                                                : uid
                                        }
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
                <Button
                    startIcon={<ApproveIcon />}
                    color="success"
                    variant="contained"
                    onClick={onApprove}
                >
                    Approve
                </Button>
                <Button
                    startIcon={<RejectIcon />}
                    color="error"
                    variant="outlined"
                    onClick={onReject}
                >
                    Reject
                </Button>
            </CardActions>
        </Card>
    );
}
