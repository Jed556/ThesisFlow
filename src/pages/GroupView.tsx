import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Check as CheckIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import Skeleton from '@mui/material/Skeleton';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../types/navigation';
import type { ThesisGroup } from '../types/group';
import type { Session } from '../types/session';
import { formatGroupStatus, GROUP_STATUS_COLORS } from '../components/Group/constants';
import { AnimatedPage } from '../components/Animate';
import { Avatar, Name } from '../components/Avatar';
import { getGroupById, approveGroup, rejectGroup, deleteGroup, updateGroup } from '../utils/firebase/firestore/groups';
import { getAllUsers, getUsersByFilter } from '../utils/firebase/firestore';
import { useSnackbar } from '../contexts/SnackbarContext';
import GroupManageDialog, { type GroupFormErrorKey } from '../components/Group/GroupManageDialog';
import type { ThesisGroupFormData, ThesisGroupMembers } from '../types/group';
import type { UserProfile } from '../types/profile';

export const metadata: NavigationItem = {
    title: 'Group Details',
    segment: 'group/:groupId',
    hidden: true,
};

/**
 * Standalone page for viewing group details
 * Accessible from any page via dynamic route /group/:groupId
 */
export default function GroupViewPage() {
    const session = useSession<Session>();
    const navigate = useNavigate();
    const { groupId = '' } = useParams<{ groupId: string }>();

    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const userRole = session?.user?.role;
    const canManage = userRole === 'admin' || userRole === 'developer';
    const { showNotification } = useSnackbar();
    const [approving, setApproving] = React.useState(false);
    const [rejecting, setRejecting] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [formData, setFormData] = React.useState<ThesisGroupFormData>({
        name: '',
        description: '',
        leader: '',
        members: [],
        adviser: '',
        editor: '',
        status: 'draft',
        thesisTitle: '',
        department: '',
        course: '',
    });
    const [formErrors, setFormErrors] = React.useState<Partial<Record<GroupFormErrorKey, string>>>({});
    const [activeStep, setActiveStep] = React.useState(0);
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [studentOptions, setStudentOptions] = React.useState<UserProfile[]>([]);
    const [studentOptionsLoading, setStudentOptionsLoading] = React.useState(false);

    // Load group data
    React.useEffect(() => {
        const loadGroup = async () => {
            setError(null);
            setGroup(null);
            setLoading(true);

            if (!groupId) {
                setError('Group ID not provided');
                setLoading(false);
                return;
            }

            try {
                const groupData = await getGroupById(groupId);
                if (!groupData) {
                    setGroup(null);
                    setError('Group not found');
                } else {
                    setGroup(groupData);
                }
            } catch (err) {
                console.error('Error loading group:', err);
                setError('Failed to load group details');
            } finally {
                setLoading(false);
            }
        };

        loadGroup();
    }, [groupId]);

    // Load users for edit dialog
    React.useEffect(() => {
        const loadUsers = async () => {
            try {
                const allUsers = await getAllUsers();
                setUsers(allUsers);
            } catch (err) {
                console.error('Error loading users:', err);
            }
        };
        if (canManage) {
            void loadUsers();
        }
    }, [canManage]);

    const handleBack = React.useCallback(() => {
        navigate(-1); // Go back to previous page
    }, [navigate]);

    const handleEdit = React.useCallback(() => {
        if (!group) return;
        // Open edit dialog in this page instead of navigating
        const sanitizedMembers = Array.from(
            new Set((group.members.members || []).filter((uid) => uid && uid !== group.members.leader))
        );
        setFormData({
            id: group.id,
            name: group.name,
            description: group.description,
            leader: group.members.leader,
            members: sanitizedMembers,
            adviser: group.members.adviser ?? '',
            editor: group.members.editor ?? '',
            status: group.status,
            thesisTitle: group.thesisTitle,
            department: group.department,
            course: group.course || '',
        });
        setFormErrors({});
        setActiveStep(0);
        setStudentOptions([]);
        setStudentOptionsLoading(false);
        setEditDialogOpen(true);
    }, [group]);

    const handleApprove = React.useCallback(async () => {
        if (!groupId) return;
        setApproving(true);
        try {
            await approveGroup(groupId);
            showNotification('Group approved successfully', 'success');
            // Reload group
            const updatedGroup = await getGroupById(groupId);
            setGroup(updatedGroup);
        } catch (err) {
            console.error('Error approving group:', err);
            showNotification('Failed to approve group', 'error');
        } finally {
            setApproving(false);
        }
    }, [groupId, showNotification]);

    const handleReject = React.useCallback(async () => {
        if (!groupId) return;
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        setRejecting(true);
        try {
            await rejectGroup(groupId, reason);
            showNotification('Group rejected', 'success');
            // Reload group
            const updatedGroup = await getGroupById(groupId);
            setGroup(updatedGroup);
        } catch (err) {
            console.error('Error rejecting group:', err);
            showNotification('Failed to reject group', 'error');
        } finally {
            setRejecting(false);
        }
    }, [groupId, showNotification]);

    const handleDelete = React.useCallback(async () => {
        if (!groupId || !group) return;
        const confirmed = window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`);
        if (!confirmed) return;

        setDeleting(true);
        try {
            await deleteGroup(groupId);
            showNotification('Group deleted successfully', 'success');
            navigate('/group-management');
        } catch (err) {
            console.error('Error deleting group:', err);
            showNotification('Failed to delete group', 'error');
        } finally {
            setDeleting(false);
        }
    }, [groupId, group, navigate, showNotification]);

    const allMemberUids = React.useMemo(() => {
        if (!group) return [];
        return [group.members.leader, ...group.members.members].filter(Boolean);
    }, [group]);

    const updatedAtLabel = group?.updatedAt ? new Date(group.updatedAt).toLocaleString() : '—';
    const createdAtLabel = group?.createdAt ? new Date(group.createdAt).toLocaleString() : '—';

    // Filter users for dialog
    const students = React.useMemo(() => users.filter((u) => u.role === 'student'), [users]);
    const advisers = React.useMemo(() => users.filter((u) => u.role === 'adviser'), [users]);
    const editors = React.useMemo(() => users.filter((u) => u.role === 'editor'), [users]);

    const departmentOptions = React.useMemo(() => {
        const unique = new Set<string>();
        users.forEach((user) => {
            const department = user.department?.trim();
            if (department) unique.add(department);
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [users]);

    const formSteps = ['Group Details', 'Team', 'Review'];

    const handleCloseEditDialog = React.useCallback(() => {
        setEditDialogOpen(false);
        setFormData({
            name: '',
            description: '',
            leader: '',
            members: [],
            adviser: '',
            editor: '',
            status: 'draft',
            thesisTitle: '',
            department: '',
            course: '',
        });
        setFormErrors({});
        setActiveStep(0);
    }, []);

    const handleFormFieldChange = React.useCallback((changes: Partial<ThesisGroupFormData>) => {
        setFormData((prev) => ({ ...prev, ...changes }));
        setFormErrors((prevErrors) => {
            const nextErrors = { ...prevErrors };
            if (changes.department) delete nextErrors.department;
            if (changes.name) delete nextErrors.name;
            return nextErrors;
        });
    }, []);

    const handleLeaderChange = React.useCallback((newLeader: UserProfile | null) => {
        if (!newLeader?.uid) return;
        setFormData((prev) => ({ ...prev, leader: newLeader.uid }));
    }, []);

    const handleMembersChange = React.useCallback((newMembers: UserProfile[]) => {
        const memberUids = newMembers.map((m) => m.uid).filter(Boolean);
        setFormData((prev) => ({ ...prev, members: memberUids }));
    }, []);

    const handleNextStep = React.useCallback(() => {
        setActiveStep((prev) => Math.min(prev + 1, formSteps.length - 1));
    }, [formSteps.length]);

    const handleBackStep = React.useCallback(() => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleSaveEdit = React.useCallback(async () => {
        if (!group || !groupId) return;
        setSaving(true);
        try {
            await updateGroup(groupId, {
                name: formData.name,
                description: formData.description,
                members: {
                    leader: formData.leader,
                    members: formData.members,
                    adviser: formData.adviser || undefined,
                    editor: formData.editor || undefined,
                    panels: group.members.panels || [],
                } as ThesisGroupMembers,
                status: formData.status,
                thesisTitle: formData.thesisTitle,
                department: formData.department,
                course: formData.course,
            });
            showNotification('Group updated successfully', 'success');
            // Reload group
            const updatedGroup = await getGroupById(groupId);
            setGroup(updatedGroup);
            handleCloseEditDialog();
        } catch (err) {
            console.error('Error updating group:', err);
            showNotification('Failed to update group', 'error');
        } finally {
            setSaving(false);
        }
    }, [group, groupId, formData, showNotification, handleCloseEditDialog]);

    const formatUserLabel = React.useCallback(
        (uid: string | null | undefined): string => {
            if (!uid) return '—';
            const user = users.find((u) => u.uid === uid);
            if (!user) return uid;
            const first = user.name?.first?.trim();
            const last = user.name?.last?.trim();
            const displayName = [first, last].filter(Boolean).join(' ');
            return displayName ? `${displayName} (${user.email})` : user.email;
        },
        [users]
    );

    const memberChipData = React.useMemo(
        () =>
            formData.members.map((uid) => {
                const user = users.find((u) => u.uid === uid);
                return { email: user?.email || uid, label: formatUserLabel(uid) };
            }),
        [formData.members, formatUserLabel, users]
    );

    if (loading) {
        return <GroupViewSkeleton />;
    }

    if (error || !group) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ py: 4, px: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <IconButton onClick={handleBack} size="large">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h4">{error || 'Group Not Found'}</Typography>
                    </Stack>
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            The group information is unavailable or does not exist.
                        </Typography>
                        <Button variant="contained" onClick={handleBack} sx={{ mt: 3 }}>
                            Go Back
                        </Button>
                    </Paper>
                </Box>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ py: 4, px: 3 }}>
                {/* Header with back button and title */}
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <IconButton onClick={handleBack} size="large">
                        <ArrowBackIcon />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h4">{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            ID: {group.id}
                        </Typography>
                    </Box>
                    {canManage && (
                        <Stack direction="row" spacing={1}>
                            {group.status === 'review' && (
                                <>
                                    <Button
                                        startIcon={<CheckIcon />}
                                        variant="contained"
                                        color="success"
                                        onClick={handleApprove}
                                        disabled={approving}
                                    >
                                        {approving ? 'Approving...' : 'Approve'}
                                    </Button>
                                    <Button
                                        startIcon={<CloseIcon />}
                                        variant="outlined"
                                        color="warning"
                                        onClick={handleReject}
                                        disabled={rejecting}
                                    >
                                        {rejecting ? 'Rejecting...' : 'Reject'}
                                    </Button>
                                </>
                            )}
                            <Button
                                startIcon={<EditIcon />}
                                variant="outlined"
                                onClick={handleEdit}
                            >
                                Edit
                            </Button>
                            <Button
                                startIcon={<DeleteIcon />}
                                variant="outlined"
                                color="error"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        </Stack>
                    )}
                </Stack>

                {/* Status and metadata */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                            label={formatGroupStatus(group.status)}
                            color={GROUP_STATUS_COLORS[group.status]}
                            sx={{ textTransform: 'capitalize' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Created {createdAtLabel}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            • Updated {updatedAtLabel}
                        </Typography>
                    </Stack>
                </Paper>

                {/* Overview section */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Overview
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Thesis Title
                                </Typography>
                                <Typography variant="body1">
                                    {group.thesisTitle || '—'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Department
                                </Typography>
                                <Typography variant="body1">
                                    {group.department || '—'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Course
                                </Typography>
                                <Typography variant="body1">
                                    {group.course || '—'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Description
                                </Typography>
                                <Typography variant="body1">
                                    {group.description || '—'}
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Team section */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Team
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={3}>
                            {/* Leader */}
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Group Leader
                                </Typography>
                                <Avatar
                                    uid={group.members.leader}
                                    initials={[Name.FIRST, Name.LAST]}
                                    mode="chip"
                                    tooltip="email"
                                    size="medium"
                                    chipProps={{
                                        variant: 'outlined',
                                        color: 'primary',
                                    }}
                                />
                            </Box>

                            {/* Adviser */}
                            {group.members.adviser && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Adviser
                                    </Typography>
                                    <Avatar
                                        uid={group.members.adviser}
                                        initials={[Name.FIRST, Name.LAST]}
                                        mode="chip"
                                        tooltip="email"
                                        size="medium"
                                        chipProps={{
                                            variant: 'outlined',
                                        }}
                                    />
                                </Box>
                            )}

                            {/* Editor */}
                            {group.members.editor && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Editor
                                    </Typography>
                                    <Avatar
                                        uid={group.members.editor}
                                        initials={[Name.FIRST, Name.LAST]}
                                        mode="chip"
                                        tooltip="email"
                                        size="medium"
                                        chipProps={{
                                            variant: 'outlined',
                                        }}
                                    />
                                </Box>
                            )}

                            {/* Members */}
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Team Members
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {allMemberUids.length > 0 ? (
                                        allMemberUids.map((uid) => (
                                            <Avatar
                                                key={uid}
                                                uid={uid}
                                                initials={[Name.FIRST, Name.LAST]}
                                                mode="chip"
                                                tooltip="email"
                                                size="medium"
                                                chipProps={{
                                                    variant: 'outlined',
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <Typography color="text.secondary">No members listed</Typography>
                                    )}
                                </Stack>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Edit Dialog */}
                {canManage && (
                    <GroupManageDialog
                        open={editDialogOpen}
                        editMode={true}
                        isAdmin={true}
                        activeStep={activeStep}
                        steps={formSteps}
                        formData={formData}
                        formErrors={formErrors}
                        students={studentOptions}
                        advisers={advisers}
                        editors={editors}
                        departmentOptions={departmentOptions}
                        memberChipData={memberChipData}
                        reviewCourse={formData.course || ''}
                        saving={saving}
                        studentLoading={studentOptionsLoading}
                        onClose={handleCloseEditDialog}
                        onFieldChange={handleFormFieldChange}
                        onLeaderChange={handleLeaderChange}
                        onMembersChange={handleMembersChange}
                        onNext={handleNextStep}
                        onBack={handleBackStep}
                        onSubmit={handleSaveEdit}
                        formatUserLabel={formatUserLabel}
                    />
                )}
            </Box>
        </AnimatedPage>
    );
}

/**
 * Skeleton placeholder for the GroupView page while data loads.
 */
export function GroupViewSkeleton() {
    return (
        <AnimatedPage variant="fade">
            <Box sx={{ py: 4, px: 3 }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Skeleton variant="circular" width={48} height={48} />
                    <Box sx={{ flexGrow: 1 }}>
                        <Skeleton variant="text" width={240} height={48} />
                        <Skeleton variant="text" width={200} height={24} />
                    </Box>
                    <Skeleton variant="rectangular" width={100} height={40} />
                    <Skeleton variant="rectangular" width={120} height={40} />
                </Stack>

                {/* Status */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2}>
                        <Skeleton variant="rectangular" width={96} height={32} />
                        <Skeleton variant="text" width={180} />
                    </Stack>
                </Paper>

                {/* Overview */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <Skeleton variant="text" width="100%" />
                            <Skeleton variant="text" width="80%" />
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="90%" />
                        </Stack>
                    </CardContent>
                </Card>

                {/* Team */}
                <Card>
                    <CardContent>
                        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={3}>
                            <Box>
                                <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
                                <Skeleton variant="rectangular" width={200} height={40} />
                            </Box>
                            <Box>
                                <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
                                <Skeleton variant="rectangular" width={200} height={40} />
                            </Box>
                            <Box>
                                <Skeleton variant="text" width={120} sx={{ mb: 1 }} />
                                <Stack direction="row" spacing={1}>
                                    <Skeleton variant="rectangular" width={120} height={40} />
                                    <Skeleton variant="rectangular" width={120} height={40} />
                                    <Skeleton variant="rectangular" width={120} height={40} />
                                </Stack>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </AnimatedPage>
    );
}
