import * as React from 'react';
import {
    Box, Typography, Button, Card, CardContent, Stack, Chip, Avatar,
    TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Skeleton, Tabs, Tab, Grid, InputAdornment,
    Accordion, AccordionSummary, AccordionDetails, Divider, Alert,
    CircularProgress, Badge,
} from '@mui/material';
import {
    Refresh as RefreshIcon, Search as SearchIcon,
    School as SchoolIcon, ExpandMore as ExpandMoreIcon,
    Person as PersonIcon, Groups as GroupsIcon, Close as CloseIcon,
    Save as SaveIcon, Tune as TuneIcon, EditNote as EditNoteIcon,
    StarRate as StarRateIcon, PersonSearch as PersonSearchIcon,
    InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage, GrowTransition } from '../../../components/Animate';
import ProfileView from '../../../components/Profile/ProfileView';
import { ExpertRecommendationCard } from '../../../components/Profile';
import { SkillRatingForm } from '../../../components/SkillRating';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { Session } from '../../../types/session';
import type { UserProfile, UserRole } from '../../../types/profile';
import type { ThesisGroup } from '../../../types/group';
import type { ExpertSkillRating, SkillTemplateRecord } from '../../../types/skillTemplate';
import type { SlotRequestRecord } from '../../../types/slotRequest';
import { DEFAULT_MAX_EXPERT_SLOTS } from '../../../types/slotRequest';
import {
    updateUserProfile, getUserDepartments, getUserCoursesByDepartment,
    listenUsersByFilter,
} from '../../../utils/firebase/firestore/user';
import { getActiveSkillTemplates } from '../../../utils/firebase/firestore/skillTemplates';
import { listenSlotRequests, approveSlotRequest, rejectSlotRequest } from '../../../utils/firebase/firestore/slotRequests';
import { listenGroupsByExpertRole, listenAllGroups } from '../../../utils/firebase/firestore/groups';
import { DEFAULT_YEAR } from '../../../config/firestore';
import { getInitialsFromFullName } from '../../../utils/avatarUtils';
import { formatProfileLabel } from '../../../utils/userUtils';
import { aggregateThesisStats, computeExpertCards, type ExpertCardData } from '../../../utils/recommendUtils';
import type { NavigationItem } from '../../../types/navigation';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Experts',
    segment: 'expert-management',
    icon: <SchoolIcon />,
    roles: ['admin', 'developer'],
};

// ============================================================================
// Types
// ============================================================================

/** Expert roles that can have slots and skill ratings */
const EXPERT_ROLES: UserRole[] = ['adviser', 'editor', 'statistician'];

type ExpertRole = 'adviser' | 'editor' | 'statistician';

/** Tab indices for the main tabs */
const TAB_ADVISERS = 0;
const TAB_EDITORS = 1;
const TAB_STATISTICIANS = 2;
const TAB_STUDENTS = 3;
const TAB_SLOT_REQUESTS = 4;

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
// Profile View Dialog (Enhanced for Admin with Edit Capability)
// ============================================================================

interface ProfileViewDialogProps {
    open: boolean;
    profile: UserProfile | null;
    groups?: ThesisGroup[];
    onClose: () => void;
    onEditSlots?: (profile: UserProfile) => void;
    isExpert?: boolean;
}

function ProfileViewDialog({
    open, profile, groups, onClose, onEditSlots, isExpert = false,
}: ProfileViewDialogProps) {
    if (!profile) return null;

    const primaryAction = isExpert && onEditSlots ? {
        label: 'Edit Slots',
        onClick: () => onEditSlots(profile),
        icon: <TuneIcon />,
    } : undefined;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogContent sx={{ p: 0 }}>
                <ProfileView
                    profile={profile}
                    currentGroups={groups}
                    skillRatings={profile.skillRatings}
                    sectionVisibility={{
                        expertise: isExpert,
                        currentTheses: true,
                        timeline: false,
                    }}
                    floatingBackButton
                    backAction={{ label: 'Close', onClick: onClose }}
                    primaryAction={primaryAction}
                />
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Student Card Component
// ============================================================================

interface StudentCardProps {
    student: UserProfile;
    onViewProfile: (student: UserProfile) => void;
}

function StudentCard({ student, onViewProfile }: StudentCardProps) {
    const fullName = formatProfileLabel(student);

    return (
        <Card
            variant="outlined"
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2,
                },
            }}
            onClick={() => onViewProfile(student)}
        >
            <CardContent sx={{ flexGrow: 1 }}>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Avatar
                            src={student.avatar}
                            sx={{ width: 56, height: 56, bgcolor: 'secondary.main' }}
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
                                    label="Student"
                                    size="small"
                                    color="secondary"
                                />
                                {student.department && (
                                    <Chip
                                        label={student.department}
                                        size="small"
                                        variant="outlined"
                                        sx={{ maxWidth: 120 }}
                                    />
                                )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {student.email}
                            </Typography>
                        </Box>
                    </Stack>

                    {student.course && (
                        <Typography variant="body2" color="text.secondary">
                            Course: {student.course}
                        </Typography>
                    )}
                </Stack>
            </CardContent>

            <Box sx={{ p: 1.5, pt: 0, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile(student);
                    }}
                >
                    View Profile
                </Button>
            </Box>
        </Card>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Admin page for managing expert (adviser/editor/statistician) settings,
 * viewing students, handling slot requests, and reviewing profiles.
 */
export default function ExpertsPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const adminUid = session?.user?.uid ?? '';

    // State
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    // Real-time expert profiles (separated by role)
    const [adviserProfiles, setAdviserProfiles] = React.useState<UserProfile[]>([]);
    const [editorProfiles, setEditorProfiles] = React.useState<UserProfile[]>([]);
    const [statisticianProfiles, setStatisticianProfiles] = React.useState<UserProfile[]>([]);
    const [studentProfiles, setStudentProfiles] = React.useState<UserProfile[]>([]);

    // All groups for computing workload stats
    const [allGroups, setAllGroups] = React.useState<ThesisGroup[]>([]);

    // Tab and filter state
    const [selectedTab, setSelectedTab] = React.useState<number>(TAB_ADVISERS);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedDepartment, setSelectedDepartment] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');

    // Dropdown options
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [courses, setCourses] = React.useState<string[]>([]);

    // Dialog state
    const [editingExpert, setEditingExpert] = React.useState<UserProfile | null>(null);
    const [viewingProfile, setViewingProfile] = React.useState<UserProfile | null>(null);
    const [infoDialogOpen, setInfoDialogOpen] = React.useState(false);

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
    // Load experts with real-time listeners (similar to Recommendations)
    // =========================================================================

    React.useEffect(() => {
        let active = true;
        const loaded = { advisers: false, editors: false, statisticians: false, students: false };

        const tryResolveLoading = () => {
            if (!active) return;
            if (loaded.advisers && loaded.editors && loaded.statisticians && loaded.students) {
                setLoading(false);
                setRefreshing(false);
            }
        };

        setLoading(true);

        // Failsafe timeout - resolve loading after 10 seconds regardless of listener status
        const timeoutId = setTimeout(() => {
            if (active) {
                console.warn('User loading timeout - forcing load completion');
                setLoading(false);
                setRefreshing(false);
            }
        }, 10000);

        const unsubscribeAdvisers = listenUsersByFilter(
            { role: 'adviser' },
            {
                onData: (profiles) => {
                    if (!active) return;
                    setAdviserProfiles(profiles);
                    loaded.advisers = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load advisers:', err);
                    loaded.advisers = true;
                    tryResolveLoading();
                },
            }
        );

        const unsubscribeEditors = listenUsersByFilter(
            { role: 'editor' },
            {
                onData: (profiles) => {
                    if (!active) return;
                    setEditorProfiles(profiles);
                    loaded.editors = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load editors:', err);
                    loaded.editors = true;
                    tryResolveLoading();
                },
            }
        );

        const unsubscribeStatisticians = listenUsersByFilter(
            { role: 'statistician' },
            {
                onData: (profiles) => {
                    if (!active) return;
                    setStatisticianProfiles(profiles);
                    loaded.statisticians = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load statisticians:', err);
                    loaded.statisticians = true;
                    tryResolveLoading();
                },
            }
        );

        const unsubscribeStudents = listenUsersByFilter(
            { role: 'student' },
            {
                onData: (profiles) => {
                    if (!active) return;
                    setStudentProfiles(profiles);
                    loaded.students = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load students:', err);
                    loaded.students = true;
                    tryResolveLoading();
                },
            }
        );

        return () => {
            active = false;
            unsubscribeAdvisers();
            unsubscribeEditors();
            unsubscribeStatisticians();
            unsubscribeStudents();
            clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // =========================================================================
    // Load all groups for workload statistics
    // =========================================================================

    React.useEffect(() => {
        const unsubscribe = listenAllGroups({
            onData: setAllGroups,
            onError: (err) => console.error('Failed to load groups:', err),
        });

        return () => unsubscribe();
    }, []);

    // Compute thesis stats from all groups
    const thesisStats = React.useMemo(
        () => aggregateThesisStats(allGroups),
        [allGroups]
    );

    // Compute expert cards for each role
    const adviserCards = React.useMemo(
        () => computeExpertCards(adviserProfiles, 'adviser', thesisStats, null),
        [adviserProfiles, thesisStats]
    );
    const editorCards = React.useMemo(
        () => computeExpertCards(editorProfiles, 'editor', thesisStats, null),
        [editorProfiles, thesisStats]
    );
    const statisticianCards = React.useMemo(
        () => computeExpertCards(statisticianProfiles, 'statistician', thesisStats, null),
        [statisticianProfiles, thesisStats]
    );

    // =========================================================================
    // Load groups per expert for utilization display
    // =========================================================================

    React.useEffect(() => {
        const allExperts = [...adviserProfiles, ...editorProfiles, ...statisticianProfiles];
        const unsubscribes: (() => void)[] = [];

        for (const expert of allExperts) {
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
    }, [adviserProfiles, editorProfiles, statisticianProfiles]);

    // =========================================================================
    // Load slot requests
    // =========================================================================

    React.useEffect(() => {
        // Listen to all slot requests (not filtered by status)
        // We filter in the UI instead to avoid missing index issues
        const unsubscribe = listenSlotRequests(
            {
                onData: setSlotRequests,
                onError: (err: Error) => {
                    console.error('Slot requests listener error:', err);
                    // Don't block on slot request errors
                },
            },
            {}, // No status filter - we'll filter client-side
            DEFAULT_YEAR
        );

        return () => unsubscribe();
    }, []); // No dependency on selectedTab

    // =========================================================================
    // Apply filters to each list
    // =========================================================================

    const applyFilters = React.useCallback((profiles: UserProfile[]) => {
        return profiles.filter((profile) => {
            if (selectedDepartment && profile.department !== selectedDepartment) return false;
            if (selectedCourse && profile.course !== selectedCourse) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const fullName = formatProfileLabel(profile).toLowerCase();
                const email = (profile.email ?? '').toLowerCase();
                if (!fullName.includes(query) && !email.includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [selectedDepartment, selectedCourse, searchQuery]);

    const filteredAdviserCards = React.useMemo(
        () => adviserCards.filter((c) => applyFilters([c.profile]).length > 0),
        [adviserCards, applyFilters]
    );
    const filteredEditorCards = React.useMemo(
        () => editorCards.filter((c) => applyFilters([c.profile]).length > 0),
        [editorCards, applyFilters]
    );
    const filteredStatisticianCards = React.useMemo(
        () => statisticianCards.filter((c) => applyFilters([c.profile]).length > 0),
        [statisticianCards, applyFilters]
    );
    const filteredStudents = React.useMemo(
        () => applyFilters(studentProfiles),
        [studentProfiles, applyFilters]
    );

    // =========================================================================
    // Build expert profile map for slot requests
    // =========================================================================

    const expertProfileMap = React.useMemo(() => {
        const map = new Map<string, UserProfile>();
        [...adviserProfiles, ...editorProfiles, ...statisticianProfiles].forEach((e) => {
            map.set(e.uid, e);
        });
        return map;
    }, [adviserProfiles, editorProfiles, statisticianProfiles]);

    // =========================================================================
    // Handlers
    // =========================================================================

    const handleRefresh = React.useCallback(() => {
        setRefreshing(true);
        // The real-time listeners will automatically update, but we set refreshing state
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    const handleTabChange = React.useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    }, []);

    const handleOpenProfile = React.useCallback((profile: UserProfile) => {
        setViewingProfile(profile);
    }, []);

    const handleEditExpert = React.useCallback((expert: UserProfile) => {
        setViewingProfile(null);
        setEditingExpert(expert);
    }, []);

    async function handleSaveExpert(expert: UserProfile, updates: Partial<UserProfile>) {
        try {
            await updateUserProfile(expert.uid, updates);
            showNotification('Expert settings saved successfully', 'success');
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

    // Render expert card with click handler for profile view
    const renderExpertCard = React.useCallback((card: ExpertCardData, roleLabel: 'Adviser' | 'Editor' | 'Statistician') => {
        return (
            <ExpertRecommendationCard
                card={card}
                roleLabel={roleLabel}
                onSelect={handleOpenProfile}
                showRoleLabel
            />
        );
    }, [handleOpenProfile]);

    // =========================================================================
    // Render
    // =========================================================================

    if (loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Skeleton variant="text" width={220} height={42} />
                    <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
                    <Grid container spacing={2}>
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <Grid key={idx} size={{ xs: 12, sm: 6, lg: 4 }}>
                                <Card variant="outlined" sx={{ height: '100%' }}>
                                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Skeleton variant="circular" width={48} height={48} />
                                        <Skeleton variant="text" width="70%" />
                                        <Skeleton variant="rectangular" width="100%" height={80} />
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </AnimatedPage>
        );
    }

    const pendingRequestCount = slotRequests.filter((r) => r.status === 'pending').length;
    const isViewingExpert = Boolean(viewingProfile && EXPERT_ROLES.includes(viewingProfile.role));

    return (
        <AnimatedPage variant="fade">
            <GrowTransition>
                <Box>
                    {/* Tabs - similar to Recommendations page */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, position: 'relative' }}>
                        <Tabs
                            value={selectedTab}
                            onChange={handleTabChange}
                            aria-label="user management tabs"
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            <Tab
                                label={`Advisers (${filteredAdviserCards.length})`}
                                icon={<SchoolIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label={`Editors (${filteredEditorCards.length})`}
                                icon={<EditNoteIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label={`Statisticians (${filteredStatisticianCards.length})`}
                                icon={<StarRateIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label={`Students (${filteredStudents.length})`}
                                icon={<PersonSearchIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <span>Slot Requests</span>
                                        {pendingRequestCount > 0 && (
                                            <Badge badgeContent={pendingRequestCount} color="warning" />
                                        )}
                                    </Stack>
                                }
                                icon={<GroupsIcon />}
                                iconPosition="start"
                            />
                        </Tabs>
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                        >
                            <IconButton
                                onClick={() => setInfoDialogOpen(true)}
                                aria-label="How to use this page"
                                size="small"
                            >
                                <InfoOutlinedIcon />
                            </IconButton>
                            <IconButton
                                onClick={handleRefresh}
                                disabled={refreshing}
                                aria-label="Refresh"
                                size="small"
                            >
                                {refreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
                            </IconButton>
                        </Stack>
                    </Box>

                    {/* Filters - show for expert and student tabs */}
                    {selectedTab !== TAB_SLOT_REQUESTS && (
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
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
                                label="Department"
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                sx={{ minWidth: 200 }}
                            >
                                <MenuItem value="">All Departments</MenuItem>
                                {departments.map((dept) => (
                                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
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
                                    <MenuItem key={course} value={course}>{course}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    )}

                    {/* Advisers Tab */}
                    {selectedTab === TAB_ADVISERS && (
                        <Grid container spacing={2}>
                            {filteredAdviserCards.map((card) => (
                                <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                    {renderExpertCard(card, 'Adviser')}
                                </Grid>
                            ))}
                            {filteredAdviserCards.length === 0 && (
                                <Grid size={{ xs: 12 }}>
                                    <Alert severity="info">
                                        No advisers found matching your filters.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}

                    {/* Editors Tab */}
                    {selectedTab === TAB_EDITORS && (
                        <Grid container spacing={2}>
                            {filteredEditorCards.map((card) => (
                                <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                    {renderExpertCard(card, 'Editor')}
                                </Grid>
                            ))}
                            {filteredEditorCards.length === 0 && (
                                <Grid size={{ xs: 12 }}>
                                    <Alert severity="info">
                                        No editors found matching your filters.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}

                    {/* Statisticians Tab */}
                    {selectedTab === TAB_STATISTICIANS && (
                        <Grid container spacing={2}>
                            {filteredStatisticianCards.map((card) => (
                                <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                    {renderExpertCard(card, 'Statistician')}
                                </Grid>
                            ))}
                            {filteredStatisticianCards.length === 0 && (
                                <Grid size={{ xs: 12 }}>
                                    <Alert severity="info">
                                        No statisticians found matching your filters.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}

                    {/* Students Tab */}
                    {selectedTab === TAB_STUDENTS && (
                        <Grid container spacing={2}>
                            {filteredStudents.map((student) => (
                                <Grid key={student.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                    <StudentCard
                                        student={student}
                                        onViewProfile={handleOpenProfile}
                                    />
                                </Grid>
                            ))}
                            {filteredStudents.length === 0 && (
                                <Grid size={{ xs: 12 }}>
                                    <Alert severity="info">
                                        No students found matching your filters.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}

                    {/* Slot Requests Tab */}
                    {selectedTab === TAB_SLOT_REQUESTS && (
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

            {/* Edit Expert Dialog */}
            <EditExpertDialog
                open={!!editingExpert}
                expert={editingExpert}
                onClose={() => setEditingExpert(null)}
                onSave={handleSaveExpert}
            />

            {/* Profile View Dialog */}
            <ProfileViewDialog
                open={!!viewingProfile}
                profile={viewingProfile}
                groups={viewingProfile ? groupsByExpert.get(viewingProfile.uid) : undefined}
                onClose={() => setViewingProfile(null)}
                onEditSlots={handleEditExpert}
                isExpert={isViewingExpert}
            />

            {/* Info Dialog */}
            <Dialog
                open={infoDialogOpen}
                onClose={() => setInfoDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>User Management Guide</DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            This page allows you to manage all users in the system, including experts and students.
                        </Typography>
                        <Divider />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Expert Tabs (Advisers, Editors, Statisticians)</Typography>
                            <Typography variant="body2" color="text.secondary">
                                View and manage expert profiles. Click on a card to view the full profile,
                                and use the &quot;Edit Slots&quot; button to adjust slot allocations and skill ratings.
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Students Tab</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Browse all student profiles. Click on a student card to view their detailed profile.
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Slot Requests</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Review and respond to slot increase requests from experts.
                                Approve or reject requests with optional notes.
                            </Typography>
                        </Box>
                    </Stack>
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
}
