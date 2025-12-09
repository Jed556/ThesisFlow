import * as React from 'react';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, IconButton,
    DialogTitle, Paper, Skeleton, Stack, TextField, Typography, InputAdornment,
} from '@mui/material';
import {
    Group as GroupIcon, Check as CheckIcon, Close as CloseIcon, Add as AddIcon, Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { ThesisGroup, ThesisGroupFormData } from '../../../types/group';
import type { UserProfile } from '../../../types/profile';
import type { GroupFormErrorKey } from '../../../components/Group/GroupManageDialog';
import { AnimatedPage, AnimatedList } from '../../../components/Animate';
import GroupCard from '../../../components/Group/GroupCard';
import GroupManageDialog from '../../../components/Group/GroupManageDialog';
import GroupDeleteDialog from '../../../components/Group/GroupDeleteDialog';
import StudentGroupCard from './StudentGroupCard';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import { buildGroupProfileMap } from '../../../utils/groupUtils';
import { getAcademicYear } from '../../../utils/dateUtils';
import {
    acceptInvite, acceptJoinRequest, createGroupForUser, deleteGroupById, findGroupById,
    getGroupsByCourse, getGroupsByLeader, getGroupsByMember, getGroupInvites,
    getGroupJoinRequests, getGroupsWithInviteFor, inviteUserToGroup, rejectJoinRequest,
    removeInviteFromGroup, submitGroupForReview,
} from '../../../utils/firebase/firestore/groups';
import { findUserById, findUsersByFilter } from '../../../utils/firebase/firestore/user';
import { auditAndNotify } from '../../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'My Group',
    segment: 'group',
    icon: <GroupIcon />,
    roles: ['student'],
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
    const navigate = useNavigate();
    const userUid = session?.user?.uid;
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

    // My group state
    const [myGroup, setMyGroup] = React.useState<ThesisGroup | null>(null);
    const [isLeader, setIsLeader] = React.useState(false);
    // Invites and requests for my group (fetched from join subcollection)
    const [myGroupInvites, setMyGroupInvites] = React.useState<string[]>([]);
    const [myGroupRequests, setMyGroupRequests] = React.useState<string[]>([]);

    // Available groups (same course)
    const [availableGroups, setAvailableGroups] = React.useState<GroupWithInvites[]>([]);

    // My invites (groups that have invited me)
    const [myInvites, setMyInvites] = React.useState<ThesisGroup[]>([]);

    // Users map for GroupCard
    const [usersByUid, setUsersByUid] = React.useState<Map<string, UserProfile>>(new Map());
    // Profiles for the active group (used for richer member cards)
    const [myGroupProfiles, setMyGroupProfiles] = React.useState<Map<string, UserProfile>>(new Map());

    // Loading & error states
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

    // Form states for GroupManageDialog
    const [formData, setFormData] = React.useState<ThesisGroupFormData>({
        name: '',
        description: '',
        leader: '',
        members: [],
        adviser: '',
        editor: '',
        status: 'draft',
        department: '',
        course: '',
    });
    const [formErrors, setFormErrors] = React.useState<Partial<Record<GroupFormErrorKey, string>>>({});
    const [activeStep, setActiveStep] = React.useState(0);
    const [saving, setSaving] = React.useState(false);
    const [studentOptions, setStudentOptions] = React.useState<UserProfile[]>([]);
    const [studentOptionsLoading, setStudentOptionsLoading] = React.useState(false);
    const formSteps = React.useMemo(() => ['Group Details', 'Team', 'Review'], []);

    // Simple dialog states
    const [inviteUid, setInviteUid] = React.useState('');
    const [searchInput, setSearchInput] = React.useState('');
    const [appliedSearchTerm, setAppliedSearchTerm] = React.useState('');

    React.useEffect(() => {
        if (!searchInput.trim() && appliedSearchTerm) {
            setAppliedSearchTerm('');
        }
    }, [searchInput, appliedSearchTerm]);

    const normalizedSearchTerm = appliedSearchTerm.toLowerCase();

    const filteredInvites = React.useMemo(() => {
        if (!normalizedSearchTerm) {
            return myInvites;
        }
        return myInvites.filter((group) =>
            group.name?.toLowerCase().includes(normalizedSearchTerm)
        );
    }, [myInvites, normalizedSearchTerm]);

    const filteredAvailableGroups = React.useMemo(() => {
        if (!normalizedSearchTerm) {
            return availableGroups;
        }
        return availableGroups.filter((group) =>
            group.name?.toLowerCase().includes(normalizedSearchTerm)
        );
    }, [availableGroups, normalizedSearchTerm]);

    const { showNotification } = useSnackbar();
    const isInviteLocked = (status?: ThesisGroup['status']) => status === 'review' || status === 'active';

    // Check if user has an established group (review, active, or completed) that prevents joining/creating another
    const hasEstablishedGroup = React.useMemo(() => {
        if (!myGroup) return false;
        return myGroup.status === 'review' || myGroup.status === 'active' || myGroup.status === 'completed';
    }, [myGroup]);

    // Load user profile
    React.useEffect(() => {
        if (!userUid) {
            setUserProfile(null);
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await findUserById(userUid);
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
        if (!userUid) {
            setLoading(false);
            setMyGroup(null);
            setIsLeader(false);
            setMyGroupProfiles(new Map());
            return;
        }

        if (!userProfile?.course) {
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

                        // Fetch profiles and invites/requests in parallel
                        const year = getAcademicYear();
                        const [profileMap, invites, requests] = await Promise.all([
                            buildGroupProfileMap(group),
                            getGroupInvites(year, group.department ?? '', group.course ?? '', group.id),
                            getGroupJoinRequests(year, group.department ?? '', group.course ?? '', group.id),
                        ]);
                        if (!cancelled) {
                            setMyGroupProfiles(profileMap);
                            setMyGroupInvites(invites);
                            setMyGroupRequests(requests);
                        }
                    } else {
                        setMyGroup(null);
                        setIsLeader(false);
                        setMyGroupProfiles(new Map());
                        setMyGroupInvites([]);
                        setMyGroupRequests([]);
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

                    // Filter groups by same department and course, exclude my group, and only include draft/review/active
                    const available = courseGroups.filter(g =>
                        g.id !== uniqueGroups[0]?.id &&
                        g.department === userProfile.department &&
                        g.course === userProfile.course &&
                        (g.status === 'draft' || g.status === 'review' || g.status === 'active')
                    );

                    // Load user profiles for all groups
                    const allMemberUids = new Set<string>();
                    available.forEach(g => {
                        allMemberUids.add(g.members.leader);
                        g.members.members.forEach(m => allMemberUids.add(m));
                    });

                    const usersMap = new Map<string, UserProfile>();
                    await Promise.all(
                        Array.from(allMemberUids).map(async (uid) => {
                            const profile = await findUserById(uid);
                            if (profile) {
                                usersMap.set(uid, profile);
                            }
                        })
                    );

                    if (!cancelled) {
                        setUsersByUid(usersMap);
                    }

                    // Get groups where I have pending invites (from subcollection)
                    const inviteGroups = await getGroupsWithInviteFor(userUid);
                    // Filter invite groups to only those in same department/course
                    const filteredInviteGroups = inviteGroups.filter(g =>
                        g.department === userProfile.department &&
                        g.course === userProfile.course &&
                        g.id !== uniqueGroups[0]?.id
                    );

                    // Filter out invite groups from available
                    const inviteGroupIds = new Set(filteredInviteGroups.map(g => g.id));
                    const others = available.filter(g => !inviteGroupIds.has(g.id));

                    setMyInvites(filteredInviteGroups);
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

    const handleOpenCreateDialog = React.useCallback(() => {
        if (!userUid || !userProfile) return;

        // Pre-fill form with student's info
        setFormData({
            name: '',
            description: '',
            leader: userUid,
            members: [],
            adviser: '',
            editor: '',
            status: 'draft',
            department: userProfile.department || '',
            course: userProfile.course || '',
        });
        setFormErrors({});
        setActiveStep(0);
        setStudentOptions([]);
        setStudentOptionsLoading(false);
        setCreateDialogOpen(true);
    }, [userUid, userProfile]);

    const handleFormFieldChange = React.useCallback((changes: Partial<ThesisGroupFormData>) => {
        // Prevent changes to department and course - these must match the creator
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { department, course, ...allowedChanges } = changes;
        setFormData((prev) => ({ ...prev, ...allowedChanges }));
        // Clear related errors
        setFormErrors((prevErrors) => {
            const nextErrors = { ...prevErrors };
            if (changes.name && nextErrors.name) delete nextErrors.name;
            return nextErrors;
        });
    }, []);

    const handleNextStep = React.useCallback(async (pendingChanges?: Partial<ThesisGroupFormData>) => {
        // Validate current step
        const errors: Partial<Record<GroupFormErrorKey, string>> = {};
        const pendingName = pendingChanges?.name ?? formData.name;

        if (activeStep === 0) {
            if (!pendingName.trim()) {
                errors.name = 'Group name is required';
            }
        }

        if (activeStep === 1) {
            // Students manage their own members; validation handled by dialog
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        if (activeStep === 0 && userProfile?.course) {
            // Load students from same course
            try {
                setStudentOptionsLoading(true);
                const students = await findUsersByFilter({
                    role: 'student',
                    course: userProfile.course,
                });
                setStudentOptions(students.filter(s => s.uid !== userUid));
            } catch (err) {
                console.error('Failed to load students:', err);
                showNotification('Failed to load students', 'error');
            } finally {
                setStudentOptionsLoading(false);
            }
        }

        setActiveStep((prev) => Math.min(prev + 1, formSteps.length - 1));
    }, [activeStep, formData.name, formSteps.length, userProfile?.course, userUid, showNotification]);

    const handleBackStep = React.useCallback(() => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleLeaderChange = React.useCallback(() => {
        // Students cannot change leader (it's pre-set to themselves)
    }, []);

    const handleMembersChange = React.useCallback((selectedUsers: UserProfile[]) => {
        const memberUids = selectedUsers.map(u => u.uid).filter(Boolean) as string[];
        // Keep department and course locked to creator's values
        setFormData((prev: ThesisGroupFormData) => ({ ...prev, members: memberUids }));
    }, []);

    const resolveProfileByUid = React.useCallback((uid: string | null | undefined): UserProfile | undefined => {
        if (!uid) {
            return undefined;
        }

        if (uid === userProfile?.uid) {
            return userProfile;
        }

        return myGroupProfiles.get(uid)
            ?? studentOptions.find((student) => student.uid === uid)
            ?? usersByUid.get(uid);
    }, [myGroupProfiles, studentOptions, userProfile, usersByUid]);

    const formatParticipantLabel = React.useCallback((uid: string | null | undefined): string => {
        if (!uid) {
            return '—';
        }

        const profile = resolveProfileByUid(uid);
        if (!profile) {
            return uid;
        }

        const first = profile.name?.first?.trim();
        const last = profile.name?.last?.trim();
        const fullName = [first, last].filter(Boolean).join(' ');

        if (fullName) {
            return `${fullName} (${uid})`;
        }

        if (profile.email) {
            return `${profile.email} (${uid})`;
        }

        return uid;
    }, [resolveProfileByUid]);

    const formatParticipantOptionLabel = React.useCallback((profileRecord: UserProfile): string => {
        const first = profileRecord.name?.first?.trim();
        const last = profileRecord.name?.last?.trim();
        const fullName = [first, last].filter(Boolean).join(' ');
        if (fullName) {
            return `${fullName} (${profileRecord.uid})`;
        }
        return profileRecord.email ? `${profileRecord.email} (${profileRecord.uid})` : profileRecord.uid;
    }, []);

    const handleOpenProfilePage = React.useCallback((uid: string) => {
        if (!uid) {
            return;
        }

        const cachedProfile = resolveProfileByUid(uid);
        navigate(`/group/profile/${uid}`, {
            state: cachedProfile ? { profile: cachedProfile } : undefined,
        });
    }, [navigate, resolveProfileByUid]);

    const handleOpenGroupView = React.useCallback((targetGroupId: string) => {
        if (!targetGroupId) {
            return;
        }
        navigate(`/group/${targetGroupId}`);
    }, [navigate]);


    const handleSaveGroup = React.useCallback(async () => {
        if (!userUid || !userProfile) return;

        // Final validation
        const errors: Partial<Record<GroupFormErrorKey, string>> = {};
        if (!formData.name.trim()) {
            errors.name = 'Group name is required';
            setActiveStep(0);
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setSaving(true);
        try {
            const newGroupData: ThesisGroupFormData = {
                name: formData.name.trim(),
                description: formData.description?.trim(),
                leader: userUid,
                members: formData.members,
                status: 'draft',
                course: userProfile.course || '',
                department: userProfile.department || '',
            };

            const createdGroupId = await createGroupForUser(
                userProfile.department || '',
                userProfile.course || '',
                newGroupData
            );
            const createdGroup = await findGroupById(createdGroupId);
            if (!createdGroup) throw new Error('Failed to find created group');
            setMyGroup(createdGroup);
            setIsLeader(true);
            const profileMap = await buildGroupProfileMap(createdGroup);
            setMyGroupProfiles(profileMap);
            setCreateDialogOpen(false);
            showNotification('Group created successfully', 'success');

            // Reset form
            setFormData({
                name: '',
                description: '',
                leader: userUid,
                members: [],
                adviser: '',
                editor: '',
                status: 'draft',
                department: userProfile.department || '',
                course: userProfile.course || '',
            });
            setActiveStep(0);
        } catch (err) {
            console.error('Failed to create group:', err);
            showNotification('Failed to create group. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    }, [userUid, userProfile, formData, showNotification]);

    const handleCloseCreateDialog = React.useCallback(() => {
        setCreateDialogOpen(false);
        setFormData({
            name: '',
            description: '',
            leader: '',
            members: [],
            adviser: '',
            editor: '',
            status: 'draft',
            department: '',
            course: '',
        });
        setFormErrors({});
        setActiveStep(0);
        setSaving(false);
    }, []);

    const handleDeleteGroup = async () => {
        if (!myGroup) return;

        try {
            await deleteGroupById(myGroup.id);
            setMyGroup(null);
            setIsLeader(false);
            setDeleteDialogOpen(false);
            setMyGroupProfiles(new Map());
        } catch (err) {
            console.error('Failed to delete group:', err);
            setError('Failed to delete group. Please try again.');
        }
    };

    const handleInviteUser = async () => {
        if (!myGroup || !inviteUid.trim() || !userUid) return;

        if (isInviteLocked(myGroup.status)) {
            showNotification('Invites are disabled once your group has been submitted for review or approved.', 'info');
            return;
        }

        try {
            await inviteUserToGroup(myGroup.id, inviteUid.trim());

            // Create audit notification for invite
            try {
                await auditAndNotify({
                    group: myGroup,
                    userId: userUid,
                    name: 'Invite Sent',
                    description: 'A new member has been invited to join the group.',
                    category: 'group',
                    action: 'member_invited',
                    targets: {
                        userIds: [inviteUid.trim()],
                        excludeUserId: userUid,
                    },
                    details: { invitedUserId: inviteUid.trim() },
                });
            } catch (auditError) {
                console.error('Failed to create audit notification:', auditError);
            }

            setInviteDialogOpen(false);
            setInviteUid('');

            // Reload my group
            const updated = await findGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
                const profileMap = await buildGroupProfileMap(updated);
                setMyGroupProfiles(profileMap);
            }
        } catch (err) {
            console.error('Failed to invite user:', err);
            setError('Failed to send invite. Please check the UID and try again.');
        }
    };

    const handleSearchGroup = React.useCallback(() => {
        setAppliedSearchTerm(searchInput.trim());
    }, [searchInput]);

    const handleAcceptInvite = async (groupId: string) => {
        if (!userUid) return;

        try {
            await acceptInvite(groupId, userUid);

            // Reload my group
            const updated = await findGroupById(groupId);
            if (updated) {
                setMyGroup(updated);
                setIsLeader(updated.members.leader === userUid);
                const profileMap = await buildGroupProfileMap(updated);
                setMyGroupProfiles(profileMap);

                // Create audit notification for accepted invite
                try {
                    await auditAndNotify({
                        group: updated,
                        userId: userUid,
                        name: 'Invite Accepted',
                        description: 'A new member has joined the group.',
                        category: 'group',
                        action: 'invite_accepted',
                        targets: {
                            groupMembers: true,
                            leader: true,
                            excludeUserId: userUid,
                        },
                        details: { newMemberId: userUid },
                    });
                } catch (auditError) {
                    console.error('Failed to create audit notification:', auditError);
                }
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
        if (!myGroup || !userUid) return;

        try {
            await submitGroupForReview(myGroup.id);

            // Create audit notification for group submission
            try {
                await auditAndNotify({
                    group: myGroup,
                    userId: userUid,
                    name: 'Group Submitted for Review',
                    description: `Group "${myGroup.name}" has been submitted for moderator review.`,
                    category: 'group',
                    action: 'group_status_changed',
                    targets: {
                        groupMembers: true,
                        moderators: true,
                        excludeUserId: userUid,
                    },
                    details: { previousStatus: 'draft', newStatus: 'pending' },
                });
            } catch (auditError) {
                console.error('Failed to create audit notification:', auditError);
            }

            // Reload my group
            const updated = await findGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
                const profileMap = await buildGroupProfileMap(updated);
                setMyGroupProfiles(profileMap);
            }
        } catch (err) {
            console.error('Failed to submit for review:', err);
            setError('Failed to submit group for review. Please try again.');
        }
    };

    const handleAcceptJoinRequest = async (requesterUid: string) => {
        if (!myGroup || !userUid) return;

        try {
            await acceptJoinRequest(myGroup.id, requesterUid);

            // Create audit notification for accepted join request
            try {
                await auditAndNotify({
                    group: myGroup,
                    userId: userUid,
                    name: 'Join Request Accepted',
                    description: 'A new member has joined the group.',
                    category: 'group',
                    action: 'join_request_accepted',
                    targets: {
                        groupMembers: true,
                        userIds: [requesterUid],
                        excludeUserId: userUid,
                    },
                    details: { newMemberId: requesterUid },
                });
            } catch (auditError) {
                console.error('Failed to create audit notification:', auditError);
            }

            // Reload my group
            const updated = await findGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
                const profileMap = await buildGroupProfileMap(updated);
                setMyGroupProfiles(profileMap);
            }
        } catch (err) {
            console.error('Failed to accept request:', err);
            setError('Failed to accept join request. Please try again.');
        }
    };

    const handleRejectJoinRequest = async (requesterUid: string) => {
        if (!myGroup || !userUid) return;

        try {
            await rejectJoinRequest(myGroup.id, requesterUid);

            // Create audit notification for rejected join request
            try {
                await auditAndNotify({
                    group: myGroup,
                    userId: userUid,
                    name: 'Join Request Rejected',
                    description: 'A join request has been declined.',
                    category: 'group',
                    action: 'join_request_rejected',
                    targets: {
                        userIds: [requesterUid],
                        excludeUserId: userUid,
                    },
                    details: { rejectedUserId: requesterUid },
                });
            } catch (auditError) {
                console.error('Failed to create audit notification:', auditError);
            }

            // Reload my group
            const updated = await findGroupById(myGroup.id);
            if (updated) {
                setMyGroup(updated);
                const profileMap = await buildGroupProfileMap(updated);
                setMyGroupProfiles(profileMap);
            }
        } catch (err) {
            console.error('Failed to reject request:', err);
            setError('Failed to reject join request. Please try again.');
        }
    };

    if (!userUid) {
        if (loading) {
            return (
                <AnimatedPage variant="slideUp">
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
                        <Skeleton variant="rounded" height={120} />
                    </Paper>
                </AnimatedPage>
            );
        }

        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to manage your thesis group.</Alert>
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

            {/* Hide create/search controls when loading or when user has an established group */}
            {!loading && !hasEstablishedGroup && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
                    <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreateDialog}>
                        Create Group
                    </Button>
                    <TextField
                        label="Group Name"
                        placeholder="Search groups by name"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' ? void handleSearchGroup() : undefined}
                        variant="outlined"
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={handleSearchGroup}
                                            disabled={!searchInput.trim()}
                                            aria-label="Apply group name filter"
                                        >
                                            <SearchIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }
                        }}
                        sx={{ minWidth: 260, flex: 1 }}
                    />
                </Stack>
            )}

            <StudentGroupCard
                loading={loading}
                group={myGroup}
                isLeader={isLeader}
                profiles={myGroupProfiles}
                invites={myGroupInvites}
                requests={myGroupRequests}
                formatLabel={formatParticipantLabel}
                onOpenProfile={handleOpenProfilePage}
                onOpenCreateDialog={handleOpenCreateDialog}
                // Search UI moved to page toolbar — no dialog trigger
                onOpenInviteDialog={() => setInviteDialogOpen(true)}
                onSubmitForReview={handleSubmitForReview}
                onDeleteGroup={() => setDeleteDialogOpen(true)}
                onAcceptJoinRequest={handleAcceptJoinRequest}
                onRejectJoinRequest={handleRejectJoinRequest}
                inviteActionsDisabled={myGroup ? isInviteLocked(myGroup.status) : false}
            />

            {/* My Invites - hidden when user has an established group */}
            {!loading && !hasEstablishedGroup && myInvites.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Group Invites
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                lg: 'repeat(3, 1fr)',
                            },
                            gap: 2,
                        }}
                    >
                        {filteredInvites.length > 0 ? (
                            <AnimatedList variant="slideUp" staggerDelay={50}>
                                {filteredInvites.map((group) => (
                                    <Stack key={group.id} spacing={1.5}>
                                        <GroupCard
                                            group={group}
                                            usersByUid={usersByUid}
                                            onClick={() => handleOpenGroupView(group.id)}
                                        />
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                size="small"
                                                color="success"
                                                startIcon={<CheckIcon />}
                                                onClick={() => handleAcceptInvite(group.id)}
                                                fullWidth
                                            >
                                                Accept
                                            </Button>
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={<CloseIcon />}
                                                onClick={() => handleDeclineInvite(group.id)}
                                                fullWidth
                                            >
                                                Decline
                                            </Button>
                                        </Stack>
                                    </Stack>
                                ))}
                            </AnimatedList>
                        ) : (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ gridColumn: '1 / -1', textAlign: 'center' }}
                            >
                                No invites match your search.
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            {/* Available Groups - only shown when user has no group */}
            {!loading && !myGroup && !hasEstablishedGroup && availableGroups.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Groups in Your Department & Course
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                lg: 'repeat(3, 1fr)',
                            },
                            gap: 2,
                        }}
                    >
                        {filteredAvailableGroups.length > 0 ? (
                            <AnimatedList variant="slideUp" staggerDelay={50}>
                                {filteredAvailableGroups.map((group) => (
                                    <Box key={group.id}>
                                        <GroupCard
                                            group={group}
                                            usersByUid={usersByUid}
                                            onClick={() => handleOpenGroupView(group.id)}
                                        />
                                    </Box>
                                ))}
                            </AnimatedList>
                        ) : (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ gridColumn: '1 / -1', textAlign: 'center' }}
                            >
                                No groups match your search.
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            {/* Create Group Dialog */}
            <GroupManageDialog
                open={createDialogOpen}
                editMode={false}
                isAdmin={false}
                activeStep={activeStep}
                steps={formSteps}
                formData={formData}
                formErrors={formErrors}
                students={studentOptions}
                advisers={[]}
                editors={[]}
                departmentOptions={[]}
                memberChipData={formData.members.map((uid) => ({
                    email: uid,
                    label: formatParticipantLabel(uid),
                }))}
                reviewCourse={formData.course || ''}
                saving={saving}
                studentLoading={studentOptionsLoading}
                onClose={handleCloseCreateDialog}
                onFieldChange={handleFormFieldChange}
                onLeaderChange={handleLeaderChange}
                onMembersChange={handleMembersChange}
                onNext={handleNextStep}
                onBack={handleBackStep}
                onSubmit={handleSaveGroup}
                formatUserLabel={formatParticipantLabel}
                formatMemberOptionLabel={formatParticipantOptionLabel}
            />

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
                    <Button
                        onClick={handleInviteUser}
                        variant="contained"
                        disabled={!inviteUid.trim() || isInviteLocked(myGroup?.status)}
                    >
                        Send Invite
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Group Dialog */}
            <GroupDeleteDialog
                open={deleteDialogOpen}
                group={myGroup}
                onCancel={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteGroup}
            />

        </AnimatedPage>
    );
}
