import * as React from 'react';
import {
    Box, Typography, Button, Card, CardContent, Stack, Chip, Avatar,
    TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Skeleton, Tabs, Tab, Grid, InputAdornment,
    Accordion, AccordionSummary, AccordionDetails, Divider, Alert,
    LinearProgress, CircularProgress,
} from '@mui/material';
import {
    People as PeopleIcon, Refresh as RefreshIcon, Search as SearchIcon,
    School as SchoolIcon, ExpandMore as ExpandMoreIcon, Edit as EditIcon,
    Person as PersonIcon, Groups as GroupsIcon, Close as CloseIcon,
    Save as SaveIcon, Tune as TuneIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage, GrowTransition } from '../../../components/Animate';
import ProfileView from '../../../components/Profile/ProfileView';
import { SkillRatingForm } from '../../../components/SkillRating';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { UserProfile, UserRole } from '../../../types/profile';
import type { ThesisGroup } from '../../../types/group';
import type { ExpertSkillRating, SkillTemplateRecord } from '../../../types/skillTemplate';
import type { SlotRequestRecord } from '../../../types/slotRequest';
import { DEFAULT_MAX_EXPERT_SLOTS } from '../../../types/slotRequest';
import {
    findUsersByFilter, updateUserProfile, getUserDepartments, getUserCoursesByDepartment,
} from '../../../utils/firebase/firestore/user';
import { getActiveSkillTemplates } from '../../../utils/firebase/firestore/skillTemplates';
import { listenSlotRequests, approveSlotRequest, rejectSlotRequest } from '../../../utils/firebase/firestore/slotRequests';
import { listenGroupsByExpertRole } from '../../../utils/firebase/firestore/groups';
import { DEFAULT_YEAR } from '../../../config/firestore';
import { getInitialsFromFullName } from '../../../utils/avatarUtils';
import { formatProfileLabel } from '../../../utils/userUtils';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Experts',
    segment: 'experts',
    icon: <SchoolIcon />,
    roles: ['admin', 'developer'],
};

// ============================================================================
// Types
// ============================================================================

/** Expert roles that can have slots and skill ratings */
const EXPERT_ROLES: UserRole[] = ['adviser', 'editor', 'statistician'];

type ExpertRole = 'adviser' | 'editor' | 'statistician';

interface ExpertWithGroups extends UserProfile {
    assignedGroups?: ThesisGroup[];
}

// ============================================================================
// Expert Card Component
// ============================================================================

interface ExpertCardProps {
    expert: ExpertWithGroups;
    onEdit: (expert: UserProfile) => void;
    onViewProfile: (expert: UserProfile) => void;
}

function ExpertCard({ expert, onEdit, onViewProfile }: ExpertCardProps) {
    const slots = expert.slots ?? 0;
    const maxSlots = expert.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS;
    const assignedCount = expert.assignedGroups?.length ?? 0;
    const availableSlots = Math.max(0, slots - assignedCount);
    const slotsUtilization = slots > 0 ? (assignedCount / slots) * 100 : 0;
    const skillCount = expert.skillRatings?.filter((r) => r.rating > 0).length ?? 0;

    const fullName = formatProfileLabel(expert);

    return (
        <Card
            variant="outlined"
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2,
                },
            }}
        >
            <CardContent sx={{ flexGrow: 1 }}>
                <Stack spacing={2}>
                    {/* Header with avatar and name */}
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Avatar
                            src={expert.avatar}
                            sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
                        >
                            {getInitialsFromFullName(fullName)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight="bold"
                                noWrap
                                title={fullName}
                            >
                                {fullName}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                <Chip
                                    label={expert.role}
                                    size="small"
                                    color="primary"
                                    sx={{ textTransform: 'capitalize' }}
                                />
                                {expert.department && (
                                    <Chip
                                        label={expert.department}
                                        size="small"
                                        variant="outlined"
                                        sx={{ maxWidth: 120 }}
                                    />
                                )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {expert.email}
                            </Typography>
                        </Box>
                    </Stack>

                    {/* Slots info */}
                    <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary">
                                Slots Utilization
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                                {assignedCount}/{slots} used
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(slotsUtilization, 100)}
                            sx={{
                                mt: 0.5,
                                height: 8,
                                borderRadius: 4,
                                bgcolor: 'grey.200',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                    bgcolor: slotsUtilization >= 100 ? 'error.main' : 'success.main',
                                },
                            }}
                        />
                        <Stack direction="row" justifyContent="space-between" mt={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                {availableSlots} available
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Max: {maxSlots}
                            </Typography>
                        </Stack>
                    </Box>

                    {/* Skills summary */}
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Skills Rated: {skillCount}
                        </Typography>
                    </Box>

                    {/* Assigned groups preview */}
                    {(expert.assignedGroups?.length ?? 0) > 0 && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Assigned Groups:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {expert.assignedGroups?.slice(0, 3).map((g) => (
                                    <Chip
                                        key={g.id}
                                        label={g.name?.slice(0, 20) ?? g.id}
                                        size="small"
                                        variant="outlined"
                                        sx={{ maxWidth: 100 }}
                                    />
                                ))}
                                {(expert.assignedGroups?.length ?? 0) > 3 && (
                                    <Chip
                                        label={`+${(expert.assignedGroups?.length ?? 0) - 3} more`}
                                        size="small"
                                        color="default"
                                    />
                                )}
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </CardContent>

            {/* Actions */}
            <Box sx={{ p: 1.5, pt: 0, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={() => onViewProfile(expert)}
                >
                    View Profile
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => onEdit(expert)}
                >
                    Edit Settings
                </Button>
            </Box>
        </Card>
    );
}

// ============================================================================
// Slot Request Card
// ============================================================================

interface SlotRequestCardProps {
    request: SlotRequestRecord;
    expertProfile?: UserProfile;
    onApprove: (id: string, note: string) => void;
    onReject: (id: string, note: string) => void;
    busy?: boolean;
}

function SlotRequestCard({ request, expertProfile, onApprove, onReject, busy }: SlotRequestCardProps) {
    const [note, setNote] = React.useState('');
    const expertName = expertProfile
        ? formatProfileLabel(expertProfile)
        : request.expertUid;

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={expertProfile?.avatar} sx={{ bgcolor: 'primary.main' }}>
                            {expertProfile
                                ? getInitialsFromFullName(formatProfileLabel(expertProfile))
                                : '?'
                            }
                        </Avatar>
                        <Box flex={1}>
                            <Typography variant="subtitle1" fontWeight="medium">
                                {expertName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {request.expertRole} • {request.department ?? 'No department'}
                            </Typography>
                        </Box>
                        <Chip
                            label={request.status.toUpperCase()}
                            size="small"
                            color={
                                request.status === 'approved' ? 'success' :
                                    request.status === 'rejected' ? 'error' :
                                        'warning'
                            }
                        />
                    </Stack>

                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Requested Slots: {request.currentSlots} → {request.requestedSlots}
                        </Typography>
                        {request.reason && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Reason:</strong> {request.reason}
                            </Typography>
                        )}
                    </Box>

                    {request.status === 'pending' && (
                        <>
                            <TextField
                                size="small"
                                label="Response Note (optional)"
                                fullWidth
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={busy}
                            />
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                    color="error"
                                    variant="outlined"
                                    onClick={() => onReject(request.id, note)}
                                    disabled={busy}
                                >
                                    Reject
                                </Button>
                                <Button
                                    color="success"
                                    variant="contained"
                                    onClick={() => onApprove(request.id, note)}
                                    disabled={busy}
                                >
                                    Approve
                                </Button>
                            </Stack>
                        </>
                    )}

                    {request.responseNote && request.status !== 'pending' && (
                        <Typography variant="body2" color="text.secondary">
                            <strong>Admin Note:</strong> {request.responseNote}
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Edit Expert Dialog
// ============================================================================

interface EditExpertDialogProps {
    open: boolean;
    expert: UserProfile | null;
    onClose: () => void;
    onSave: (expert: UserProfile, updates: Partial<UserProfile>) => Promise<void>;
}

function EditExpertDialog({ open, expert, onClose, onSave }: EditExpertDialogProps) {
    const [slots, setSlots] = React.useState(0);
    const [maxSlots, setMaxSlots] = React.useState(DEFAULT_MAX_EXPERT_SLOTS);
    const [skillRatings, setSkillRatings] = React.useState<ExpertSkillRating[]>([]);
    const [departmentSkills, setDepartmentSkills] = React.useState<SkillTemplateRecord[]>([]);
    const [skillsLoading, setSkillsLoading] = React.useState(false);
    const [skillsExpanded, setSkillsExpanded] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Reset state when expert changes
    React.useEffect(() => {
        if (expert) {
            setSlots(expert.slots ?? 0);
            setMaxSlots(expert.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS);
            setSkillRatings(expert.skillRatings ?? []);
        }
    }, [expert]);

    // Load department skills
    React.useEffect(() => {
        if (open && expert?.department) {
            setSkillsLoading(true);
            getActiveSkillTemplates(DEFAULT_YEAR, expert.department)
                .then(setDepartmentSkills)
                .catch(() => setDepartmentSkills([]))
                .finally(() => setSkillsLoading(false));
        }
    }, [open, expert?.department]);

    function handleSkillRatingChange(skillId: string, skillName: string, rating: number) {
        setSkillRatings((prev) => {
            const existing = prev.find((r) => r.skillId === skillId);
            if (existing) {
                return prev.map((r) =>
                    r.skillId === skillId
                        ? { ...r, rating, updatedAt: new Date().toISOString() }
                        : r
                );
            }
            return [
                ...prev,
                { skillId, name: skillName, rating, updatedAt: new Date().toISOString() },
            ];
        });
    }

    async function handleSave() {
        if (!expert) return;
        setSaving(true);
        try {
            await onSave(expert, {
                slots: Math.max(0, Math.min(slots, maxSlots)),
                maxSlots: Math.max(slots, maxSlots),
                skillRatings,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    }

    if (!expert) return null;

    const fullName = formatProfileLabel(expert);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center">
                        <TuneIcon color="primary" />
                        <Typography variant="h6">Edit Expert Settings</Typography>
                    </Stack>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3}>
                    {/* Expert Info */}
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={expert.avatar} sx={{ width: 48, height: 48 }}>
                            {getInitialsFromFullName(fullName)}
                        </Avatar>
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {fullName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {expert.role} • {expert.department ?? 'No department'}
                            </Typography>
                        </Box>
                    </Stack>

                    <Divider />

                    {/* Slot Settings */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>
                            Slot Configuration
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Current Slots"
                                    type="number"
                                    fullWidth
                                    value={slots}
                                    onChange={(e) => setSlots(Math.max(0, Number(e.target.value)))}
                                    slotProps={{
                                        htmlInput: { min: 0, max: maxSlots },
                                    }}
                                    helperText="Number of theses this expert can currently handle"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Maximum Slots"
                                    type="number"
                                    fullWidth
                                    value={maxSlots}
                                    onChange={(e) => setMaxSlots(Math.max(1, Number(e.target.value)))}
                                    slotProps={{
                                        htmlInput: { min: 1 },
                                    }}
                                    helperText="Maximum slots this expert can request"
                                />
                            </Grid>
                        </Grid>
                        {slots > maxSlots && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                Current slots exceed maximum. Max will be adjusted to match.
                            </Alert>
                        )}
                    </Box>

                    {/* Skills Section */}
                    <Accordion
                        expanded={skillsExpanded}
                        onChange={(_, expanded) => setSkillsExpanded(expanded)}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">
                                    Skill Ratings
                                </Typography>
                                <Chip
                                    label={`${skillRatings.filter((r) => r.rating > 0).length} rated`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            {skillsLoading ? (
                                <Stack spacing={2}>
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} variant="rectangular" height={100} />
                                    ))}
                                </Stack>
                            ) : expert.department ? (
                                <SkillRatingForm
                                    department={expert.department}
                                    skills={departmentSkills}
                                    ratings={skillRatings}
                                    onRatingChange={handleSkillRatingChange}
                                    showLegend
                                    compact
                                />
                            ) : (
                                <Alert severity="info">
                                    This expert has no department assigned. Skills cannot be rated.
                                </Alert>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ============================================================================
// Profile View Dialog
// ============================================================================

interface ProfileViewDialogProps {
    open: boolean;
    expert: UserProfile | null;
    groups?: ThesisGroup[];
    onClose: () => void;
}

function ProfileViewDialog({ open, expert, groups, onClose }: ProfileViewDialogProps) {
    if (!expert) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogContent sx={{ p: 0 }}>
                <ProfileView
                    profile={expert}
                    currentGroups={groups}
                    skillRatings={expert.skillRatings}
                    sectionVisibility={{
                        expertise: true,
                        currentTheses: true,
                        timeline: false,
                    }}
                    floatingBackButton
                    backAction={{ label: 'Close', onClick: onClose }}
                />
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Admin page for managing expert (adviser/editor/statistician) settings,
 * including slots, skill ratings, and handling slot requests.
 */
export default function ExpertsPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const adminUid = session?.user?.uid ?? '';

    // State
    const [experts, setExperts] = React.useState<ExpertWithGroups[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    // Filters
    const [selectedTab, setSelectedTab] = React.useState<number>(0);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedDepartment, setSelectedDepartment] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [selectedRole, setSelectedRole] = React.useState<ExpertRole | ''>('');

    // Dropdown options
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [courses, setCourses] = React.useState<string[]>([]);

    // Dialog state
    const [editingExpert, setEditingExpert] = React.useState<UserProfile | null>(null);
    const [viewingExpert, setViewingExpert] = React.useState<UserProfile | null>(null);

    // Slot requests
    const [slotRequests, setSlotRequests] = React.useState<SlotRequestRecord[]>([]);
    const [requestBusy, setRequestBusy] = React.useState<Record<string, boolean>>({});

    // Groups by expert UID for utilization display
    const [groupsByExpert, setGroupsByExpert] = React.useState<Map<string, ThesisGroup[]>>(new Map());

    // =========================================================================
    // Load departments
    // =========================================================================

    React.useEffect(() => {
        getUserDepartments()
            .then(setDepartments)
            .catch(() => setDepartments([]));
    }, []);

    // Load courses when department changes
    React.useEffect(() => {
        if (selectedDepartment) {
            getUserCoursesByDepartment(selectedDepartment)
                .then(setCourses)
                .catch(() => setCourses([]));
        } else {
            setCourses([]);
        }
        setSelectedCourse('');
    }, [selectedDepartment]);

    // =========================================================================
    // Load experts
    // =========================================================================

    const loadExperts = React.useCallback(async () => {
        try {
            const allExperts: UserProfile[] = [];
            for (const role of EXPERT_ROLES) {
                const roleExperts = await findUsersByFilter({ role });
                allExperts.push(...roleExperts);
            }
            setExperts(allExperts);
        } catch (error) {
            console.error('Failed to load experts:', error);
            showNotification('Failed to load experts', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showNotification]);

    React.useEffect(() => {
        loadExperts();
    }, [loadExperts]);

    // =========================================================================
    // Load groups for utilization (listen to all expert roles)
    // =========================================================================

    React.useEffect(() => {
        const unsubscribes: (() => void)[] = [];

        for (const expert of experts) {
            if (!EXPERT_ROLES.includes(expert.role)) continue;

            const unsubscribe = listenGroupsByExpertRole(
                expert.role as ExpertRole,
                expert.uid,
                {
                    onData: (groups) => {
                        setGroupsByExpert((prev) => {
                            const next = new Map(prev);
                            next.set(expert.uid, groups);
                            return next;
                        });
                    },
                    onError: (err) => console.error('Groups listener error:', err),
                }
            );
            unsubscribes.push(unsubscribe);
        }

        return () => {
            unsubscribes.forEach((unsub) => unsub());
        };
    }, [experts]);

    // Merge groups into experts
    const expertsWithGroups = React.useMemo<ExpertWithGroups[]>(() => {
        return experts.map((expert) => ({
            ...expert,
            assignedGroups: groupsByExpert.get(expert.uid) ?? [],
        }));
    }, [experts, groupsByExpert]);

    // =========================================================================
    // Load slot requests
    // =========================================================================

    React.useEffect(() => {
        const unsubscribe = listenSlotRequests(
            {
                onData: setSlotRequests,
                onError: (err: Error) => console.error('Slot requests listener error:', err),
            },
            { status: selectedTab === 1 ? 'pending' : undefined },
            DEFAULT_YEAR
        );

        return () => unsubscribe();
    }, [selectedTab]);

    // =========================================================================
    // Filter experts
    // =========================================================================

    const filteredExperts = React.useMemo(() => {
        return expertsWithGroups.filter((expert) => {
            // Role filter
            if (selectedRole && expert.role !== selectedRole) return false;

            // Department filter
            if (selectedDepartment && expert.department !== selectedDepartment) return false;

            // Course filter
            if (selectedCourse && expert.course !== selectedCourse) return false;

            // Search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const fullName = formatProfileLabel(expert).toLowerCase();
                const email = (expert.email ?? '').toLowerCase();
                if (!fullName.includes(query) && !email.includes(query)) {
                    return false;
                }
            }

            return true;
        });
    }, [expertsWithGroups, selectedRole, selectedDepartment, selectedCourse, searchQuery]);

    // =========================================================================
    // Build expert profile map for slot requests
    // =========================================================================

    const expertProfileMap = React.useMemo(() => {
        const map = new Map<string, UserProfile>();
        experts.forEach((e) => map.set(e.uid, e));
        return map;
    }, [experts]);

    // =========================================================================
    // Handlers
    // =========================================================================

    function handleRefresh() {
        setRefreshing(true);
        loadExperts();
    }

    async function handleSaveExpert(expert: UserProfile, updates: Partial<UserProfile>) {
        try {
            await updateUserProfile(expert.uid, updates);
            showNotification('Expert settings saved successfully', 'success');
            // Refresh
            loadExperts();
        } catch (error) {
            console.error('Failed to save expert:', error);
            showNotification('Failed to save expert settings', 'error');
            throw error;
        }
    }

    async function handleApproveRequest(requestId: string, note: string) {
        setRequestBusy((prev) => ({ ...prev, [requestId]: true }));
        try {
            await approveSlotRequest(requestId, {
                respondedBy: adminUid,
                responseNote: note || undefined,
            });
            showNotification('Slot request approved', 'success');
        } catch (error) {
            console.error('Failed to approve request:', error);
            showNotification('Failed to approve request', 'error');
        } finally {
            setRequestBusy((prev) => ({ ...prev, [requestId]: false }));
        }
    }

    async function handleRejectRequest(requestId: string, note: string) {
        setRequestBusy((prev) => ({ ...prev, [requestId]: true }));
        try {
            await rejectSlotRequest(requestId, {
                respondedBy: adminUid,
                responseNote: note || undefined,
            });
            showNotification('Slot request rejected', 'success');
        } catch (error) {
            console.error('Failed to reject request:', error);
            showNotification('Failed to reject request', 'error');
        } finally {
            setRequestBusy((prev) => ({ ...prev, [requestId]: false }));
        }
    }

    // =========================================================================
    // Render
    // =========================================================================

    if (loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ p: 3 }}>
                    <Skeleton variant="text" width={200} height={40} />
                    <Skeleton variant="rectangular" height={60} sx={{ my: 2, borderRadius: 1 }} />
                    <Grid container spacing={2}>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                                <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </AnimatedPage>
        );
    }

    const pendingRequestCount = slotRequests.filter((r) => r.status === 'pending').length;

    return (
        <AnimatedPage variant="fade">
            <GrowTransition>
                <Box sx={{ p: 3 }}>
                    {/* Header */}
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={3}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <SchoolIcon color="primary" fontSize="large" />
                            <Typography variant="h5" fontWeight="bold">
                                Expert Management
                            </Typography>
                        </Stack>
                        <Button
                            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            Refresh
                        </Button>
                    </Stack>

                    {/* Tabs */}
                    <Tabs
                        value={selectedTab}
                        onChange={(_, v) => setSelectedTab(v)}
                        sx={{ mb: 2 }}
                    >
                        <Tab
                            label="All Experts"
                            icon={<PeopleIcon />}
                            iconPosition="start"
                        />
                        <Tab
                            label={
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <span>Slot Requests</span>
                                    {pendingRequestCount > 0 && (
                                        <Chip
                                            label={pendingRequestCount}
                                            size="small"
                                            color="warning"
                                        />
                                    )}
                                </Stack>
                            }
                            icon={<GroupsIcon />}
                            iconPosition="start"
                        />
                    </Tabs>

                    {/* Tab 0: All Experts */}
                    {selectedTab === 0 && (
                        <>
                            {/* Filters */}
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={2}
                                mb={3}
                            >
                                <TextField
                                    size="small"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    sx={{ minWidth: 250 }}
                                />
                                <TextField
                                    size="small"
                                    select
                                    label="Role"
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value as ExpertRole | '')}
                                    sx={{ minWidth: 150 }}
                                >
                                    <MenuItem value="">All Roles</MenuItem>
                                    {EXPERT_ROLES.map((role) => (
                                        <MenuItem key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    size="small"
                                    select
                                    label="Department"
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    sx={{ minWidth: 200 }}
                                >
                                    <MenuItem value="">All Departments</MenuItem>
                                    {departments.map((dept) => (
                                        <MenuItem key={dept} value={dept}>
                                            {dept}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    size="small"
                                    select
                                    label="Course"
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    disabled={!selectedDepartment}
                                    sx={{ minWidth: 200 }}
                                >
                                    <MenuItem value="">All Courses</MenuItem>
                                    {courses.map((course) => (
                                        <MenuItem key={course} value={course}>
                                            {course}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            {/* Expert Grid */}
                            {filteredExperts.length === 0 ? (
                                <Alert severity="info">
                                    No experts found matching your filters.
                                </Alert>
                            ) : (
                                <Grid container spacing={2}>
                                    {filteredExperts.map((expert) => (
                                        <Grid key={expert.uid} size={{ xs: 12, sm: 6, md: 4 }}>
                                            <ExpertCard
                                                expert={expert}
                                                onEdit={setEditingExpert}
                                                onViewProfile={setViewingExpert}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </>
                    )}

                    {/* Tab 1: Slot Requests */}
                    {selectedTab === 1 && (
                        <Box>
                            {slotRequests.length === 0 ? (
                                <Alert severity="info">
                                    No slot requests found.
                                </Alert>
                            ) : (
                                slotRequests.map((request) => (
                                    <SlotRequestCard
                                        key={request.id}
                                        request={request}
                                        expertProfile={expertProfileMap.get(request.expertUid)}
                                        onApprove={handleApproveRequest}
                                        onReject={handleRejectRequest}
                                        busy={requestBusy[request.id]}
                                    />
                                ))
                            )}
                        </Box>
                    )}
                </Box>
            </GrowTransition>

            {/* Edit Dialog */}
            <EditExpertDialog
                open={!!editingExpert}
                expert={editingExpert}
                onClose={() => setEditingExpert(null)}
                onSave={handleSaveExpert}
            />

            {/* Profile View Dialog */}
            <ProfileViewDialog
                open={!!viewingExpert}
                expert={viewingExpert}
                groups={viewingExpert ? groupsByExpert.get(viewingExpert.uid) : undefined}
                onClose={() => setViewingExpert(null)}
            />
        </AnimatedPage>
    );
}
