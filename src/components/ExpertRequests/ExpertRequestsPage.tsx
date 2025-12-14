import * as React from 'react';
import {
    Alert, Box, Button, Card, CardActions, CardContent, Chip,
    Divider, LinearProgress, Paper, Skeleton, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { ExpertRequest, ExpertRequestRole } from '../../types/expertRequest';
import type { ThesisGroup } from '../../types/group';
import type { Session } from '../../types/session';
import type { UserProfile, UserRole } from '../../types/profile';
import type { ExpertSkillRating, SkillTemplateRecord } from '../../types/skillTemplate';
import { DEFAULT_MAX_EXPERT_SLOTS } from '../../types/slotRequest';
import { DEFAULT_YEAR } from '../../config/firestore';
import { AnimatedPage } from '../Animate';
import { useSnackbar } from '../../contexts/SnackbarContext';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';
import { findGroupById, listenGroupsByExpertRole } from '../../utils/firebase/firestore/groups';
import { listenExpertRequestsByExpert } from '../../utils/firebase/firestore/expertRequests';
import { findUsersByIds, onUserProfile, updateUserProfile } from '../../utils/firebase/firestore/user';
import { listenSkillTemplates } from '../../utils/firebase/firestore/skillTemplates';
import ExpertRequestCard from './ExpertRequestCard';
import { SlotRequestButton } from './SlotRequestDialog';
import { SkillRatingDialog } from '../SkillRating/SkillRatingDialog';

interface ExpertRequestViewModel {
    request: ExpertRequest;
    group: ThesisGroup | null;
    requester: UserProfile | null;
    usersByUid: Map<string, UserProfile>;
}

function formatMinimumCapacityMessage(currentCount: number): string {
    return `You currently expert ${currentCount} group${currentCount === 1 ? '' : 's'}. Slots cannot go below that.`;
}

export interface ExpertRequestsPageProps {
    role: ExpertRequestRole;
    roleLabel: string;
    allowedRoles?: UserRole[];
}

function useExpertRequestViewModels(requests: ExpertRequest[]): ExpertRequestViewModel[] {
    const [groupsById, setGroupsById] = React.useState<Map<string, ThesisGroup | null>>(new Map());
    const [profilesByUid, setProfilesByUid] = React.useState<Map<string, UserProfile>>(new Map());

    React.useEffect(() => {
        let cancelled = false;
        const uniqueGroupIds = Array.from(
            new Set(requests.map((req) => req.groupId).filter((id): id is string => !!id))
        );
        if (uniqueGroupIds.length === 0) {
            setGroupsById(new Map());
            return () => { /* no-op */ };
        }

        void (async () => {
            try {
                const resolved = await Promise.all(
                    uniqueGroupIds.map(async (groupId) => {
                        try {
                            const record = await findGroupById(groupId);
                            return [groupId, record] as const;
                        } catch (err) {
                            console.error(`Failed to resolve group ${groupId}:`, err);
                            return [groupId, null] as const;
                        }
                    })
                );
                if (!cancelled) {
                    setGroupsById(new Map(resolved));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to resolve service request groups:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [requests]);

    React.useEffect(() => {
        let cancelled = false;
        const uniqueIds = new Set<string>();
        requests.forEach((req) => {
            if (req.requestedBy) {
                uniqueIds.add(req.requestedBy);
            }
        });
        groupsById.forEach((groupRecord) => {
            const leaderUid = groupRecord?.members.leader;
            if (leaderUid) {
                uniqueIds.add(leaderUid);
            }
        });
        const ids = Array.from(uniqueIds);
        if (ids.length === 0) {
            setProfilesByUid(new Map());
            return () => { /* no-op */ };
        }

        void (async () => {
            try {
                const profiles = await findUsersByIds(ids);
                if (!cancelled) {
                    setProfilesByUid(new Map(profiles.map((profile) => [profile.uid, profile])));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to resolve group/requester profiles:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [groupsById, requests]);

    return React.useMemo(() => (
        requests.map((request) => {
            const group = request.groupId ? groupsById.get(request.groupId) ?? null : null;
            const requester = profilesByUid.get(request.requestedBy) ?? null;
            const usersByUid = new Map<string, UserProfile>();
            if (requester) {
                usersByUid.set(requester.uid, requester);
            }
            const leaderUid = group?.members.leader;
            if (leaderUid) {
                const leaderProfile = profilesByUid.get(leaderUid);
                if (leaderProfile) {
                    usersByUid.set(leaderUid, leaderProfile);
                }
            }
            return {
                request,
                group,
                requester,
                usersByUid,
            } satisfies ExpertRequestViewModel;
        })
    ), [groupsById, profilesByUid, requests]);
}

/**
 * Shared service requests experience for adviser/editor/statistician dashboards.
 */
export default function ExpertRequestsPage({ role, roleLabel, allowedRoles }: ExpertRequestsPageProps) {
    const session = useSession<Session>();
    const expertUid = session?.user?.uid ?? null;
    const viewerRole = session?.user?.role;
    const permittedRoles = allowedRoles ?? [role];
    const { showNotification } = useSnackbar();
    const navigate = useNavigate();

    const [requests, setRequests] = React.useState<ExpertRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Dialog state removed: approvals are handled in the group view header now.
    const [expertProfile, setExpertProfile] = React.useState<UserProfile | null>(null);
    const [capacityInput, setCapacityInput] = React.useState('');
    const [capacityError, setCapacityError] = React.useState<string | null>(null);
    const [capacitySaving, setCapacitySaving] = React.useState(false);
    const [editingCapacity, setEditingCapacity] = React.useState(false);
    const [assignments, setAssignments] = React.useState<ThesisGroup[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(false);

    // Skill rating state
    const [departmentSkills, setDepartmentSkills] = React.useState<SkillTemplateRecord[]>([]);
    const [skillsLoading, setSkillsLoading] = React.useState(false);
    const [skillRatings, setSkillRatings] = React.useState<ExpertSkillRating[]>([]);
    const [skillDialogOpen, setSkillDialogOpen] = React.useState(false);

    // Count only groups with 'active' status as taken slots
    const activeAssignments = React.useMemo(
        () => assignments.filter((group) => group.status === 'active'),
        [assignments]
    );
    const minimumCapacity = activeAssignments.length;
    const expertCapacityRaw = typeof expertProfile?.slots === 'number'
        ? expertProfile.slots
        : 0;
    const maxSlots = expertProfile?.maxSlots ?? DEFAULT_MAX_EXPERT_SLOTS;
    const normalizedCapacity = Math.max(expertCapacityRaw, minimumCapacity);
    const slotsSummary = expertProfile ? `${activeAssignments.length}/${normalizedCapacity}` : '—';
    const openSlots = Math.max(normalizedCapacity - activeAssignments.length, 0);
    const capacityHelperHint = minimumCapacity > 0
        ? `Minimum ${minimumCapacity} to cover current assignments. Max allowed: ${maxSlots}.`
        : `Max allowed: ${maxSlots}.`;

    const viewModels = useExpertRequestViewModels(requests);

    React.useEffect(() => {
        if (!expertUid) {
            setRequests([]);
            setLoading(false);
            return () => { /* no-op */ };
        }

        setLoading(true);
        setError(null);
        const unsubscribe = listenExpertRequestsByExpert(expertUid, role, {
            onData: (records: ExpertRequest[]) => {
                setRequests(records);
                setLoading(false);
            },
            onError: (listenerError: Error) => {
                console.error('Failed to load service requests:', listenerError);
                setError('Unable to load service requests right now.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [expertUid, role]);

    React.useEffect(() => {
        if (!expertUid) {
            setExpertProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(expertUid, (profile) => {
            setExpertProfile(profile);
        });

        return () => {
            unsubscribe();
        };
    }, [expertUid]);

    React.useEffect(() => {
        if (!expertProfile) {
            setCapacityInput('');
            return;
        }
        if (editingCapacity) {
            return;
        }

        const baseValue = typeof expertProfile.slots === 'number'
            ? expertProfile.slots
            : 0;
        const nextValue = Math.max(minimumCapacity, baseValue);
        setCapacityInput(String(nextValue));
    }, [expertProfile, minimumCapacity, editingCapacity]);

    React.useEffect(() => {
        if (!expertUid) {
            setAssignments([]);
            setAssignmentsLoading(false);
            return () => { /* no-op */ };
        }

        setAssignmentsLoading(true);
        const unsubscribe = listenGroupsByExpertRole(role, expertUid, {
            onData: (groups: ThesisGroup[]) => {
                setAssignments(groups);
                setAssignmentsLoading(false);
            },
            onError: (listenerError: Error) => {
                console.error('Failed to load expert assignments for capacity view:', listenerError);
                setAssignments([]);
                setAssignmentsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [expertUid, role]);

    // Load department skill templates
    React.useEffect(() => {
        const department = expertProfile?.department;
        if (!department) {
            setDepartmentSkills([]);
            setSkillsLoading(false);
            return () => { /* no-op */ };
        }

        setSkillsLoading(true);
        const unsubscribe = listenSkillTemplates(DEFAULT_YEAR, department, {
            onData: (skills: SkillTemplateRecord[]) => {
                setDepartmentSkills(skills.filter((skill) => skill.isActive));
                setSkillsLoading(false);
            },
            onError: (listenerError: Error) => {
                console.error('Failed to load department skills:', listenerError);
                setDepartmentSkills([]);
                setSkillsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [expertProfile?.department]);

    // Sync skill ratings from user profile
    React.useEffect(() => {
        if (expertProfile?.skillRatings) {
            setSkillRatings(expertProfile.skillRatings);
        } else {
            setSkillRatings([]);
        }
    }, [expertProfile?.skillRatings]);

    const pendingCount = React.useMemo(
        () => requests.filter((record) => record.status === 'pending').length,
        [requests]
    );
    const approvedCount = React.useMemo(
        () => requests.filter((record) => record.status === 'approved').length,
        [requests]
    );
    const rejectedCount = React.useMemo(
        () => requests.filter((record) => record.status === 'rejected').length,
        [requests]
    );

    const handleCapacityInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value.trim() === '') {
            setCapacityInput(value);
            setCapacityError('Enter how many groups you can handle.');
            return;
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            setCapacityInput(value);
            setCapacityError('Enter a valid number.');
        } else if (!Number.isInteger(parsed)) {
            setCapacityInput(value);
            setCapacityError('Use whole numbers only.');
        } else if (parsed < 0) {
            setCapacityInput(value);
            setCapacityError('Slots cannot be negative.');
        } else {
            // Clamp value between minimumCapacity and maxSlots
            const clamped = Math.max(minimumCapacity, Math.min(parsed, maxSlots));
            setCapacityInput(String(clamped));
            setCapacityError(null);
        }
    }, [minimumCapacity, maxSlots]);

    const capacityHasChanged = React.useMemo(() => {
        if (!expertProfile) {
            return false;
        }
        const baseline = expertCapacityRaw;
        const parsed = Number(capacityInput);
        if (capacityInput.trim() === '' || Number.isNaN(parsed)) {
            return false;
        }
        return parsed !== baseline;
    }, [capacityInput, expertProfile]);

    const canSaveCapacity = Boolean(
        expertUid &&
        !capacitySaving &&
        !capacityError &&
        capacityInput.trim() !== '' &&
        capacityHasChanged
    );

    const handleSaveCapacity = React.useCallback(async () => {
        if (!expertUid) {
            return;
        }

        const parsed = Number(capacityInput.trim());
        if (capacityInput.trim() === '' || Number.isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
            setCapacityError('Provide a non-negative whole number.');
            return;
        }
        if (parsed < minimumCapacity) {
            setCapacityError(formatMinimumCapacityMessage(minimumCapacity));
            return;
        }
        if (parsed > maxSlots) {
            setCapacityError(`Cannot exceed your maximum limit of ${maxSlots}. Request more slots if needed.`);
            return;
        }

        setCapacitySaving(true);
        try {
            await updateUserProfile(expertUid, { slots: parsed });
            showNotification('Updated your available slots.', 'success');
            setEditingCapacity(false);
            setCapacityError(null);
        } catch (err) {
            console.error('Failed to update expert capacity:', err);
            const fallback = err instanceof Error ? err.message : 'Unable to update slots right now.';
            showNotification(fallback, 'error');
        } finally {
            setCapacitySaving(false);
        }
    }, [capacityInput, expertUid, showNotification, minimumCapacity, maxSlots]);

    const handleStartEditing = React.useCallback(() => {
        if (!expertProfile) return;
        setEditingCapacity(true);
    }, [expertProfile]);

    const handleCancelEditing = React.useCallback(() => {
        if (expertProfile) {
            const nextValue = typeof expertProfile.slots === 'number'
                ? String(Math.max(minimumCapacity, expertProfile.slots))
                : String(minimumCapacity);
            setCapacityInput(nextValue);
        }
        setCapacityError(null);
        setEditingCapacity(false);
    }, [expertProfile, minimumCapacity]);

    // Save skill ratings from dialog
    const handleSaveSkillRatings = React.useCallback(async (newRatings: ExpertSkillRating[]) => {
        if (!expertUid) return;

        await updateUserProfile(expertUid, { skillRatings: newRatings });
        showNotification('Your skill ratings have been saved.', 'success');
    }, [expertUid, showNotification]);

    const handleOpenGroupView = React.useCallback((requestToOpen: ExpertRequest) => {
        const basePath = role === 'adviser'
            ? '/adviser-requests'
            : role === 'editor'
                ? '/editor-requests'
                : '/statistician-requests';
        navigate(`${basePath}/${requestToOpen.groupId}`, { state: { expertRequest: requestToOpen } });
    }, [navigate, role]);

    // Check if adviser has all skills properly rated (rating > 0)
    // Advisers must rate their skills before they can edit slots
    const allSkillsRated = React.useMemo(() => {
        // Only advisers need to rate skills before editing slots
        if (role !== 'adviser') return true;
        // If no department skills exist, allow editing
        if (departmentSkills.length === 0) return true;
        // Check if all department skills have a rating > 0
        return departmentSkills.every((skill) => {
            const userRating = skillRatings.find((r) => r.skillId === skill.id);
            return userRating && userRating.rating > 0;
        });
    }, [role, departmentSkills, skillRatings]);

    const editSlotsDisabledReason = !expertProfile
        ? 'Loading profile...'
        : !allSkillsRated
            ? 'Rate all your skills first before editing slots'
            : undefined;


    if (!viewerRole && session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Paper sx={{ p: 3 }}>
                    <Skeleton variant="text" width={240} height={40} />
                    <Skeleton variant="rectangular" height={200} />
                </Paper>
            </AnimatedPage>
        );
    }

    if (!viewerRole || !permittedRoles.includes(viewerRole)) {
        return (
            <UnauthorizedNotice
                variant='box'
                title="Expert access only"
                description={`This page is available to ${roleLabel.toLowerCase()}s.`}
            />
        );
    }

    if (!expertUid) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="warning">
                    You need to sign in again to manage service requests.
                </Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Review and respond to thesis groups requesting you as their {roleLabel.toLowerCase()}.
                </Typography>
            </Box>
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Two-column layout */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' },
                    gap: 3,
                    alignItems: 'start',
                }}
            >
                {/* Left column: Service requests */}
                <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Requests
                    </Typography>
                    {loading ? (
                        <Paper sx={{ p: 3 }}>
                            <Skeleton variant="text" width={200} height={32} sx={{ mb: 1 }} />
                            <Skeleton variant="rectangular" height={140} />
                        </Paper>
                    ) : viewModels.length === 0 ? (
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="body1" color="text.secondary">
                                No service requests yet. Groups with an approved topic can send you a request from your profile page.
                            </Typography>
                        </Paper>
                    ) : (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 2,
                            }}
                        >
                            {viewModels.map(({ request, group, requester, usersByUid }) => {
                                if (!group) {
                                    return (
                                        <Card key={request.id} variant="outlined">
                                            <CardContent>
                                                <Typography variant="body2" color="text.secondary">
                                                    Group details are unavailable. Please ask the students to resend their request.
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    );
                                }

                                return (
                                    <ExpertRequestCard
                                        key={request.id}
                                        request={request}
                                        group={group}
                                        requester={requester}
                                        usersByUid={usersByUid}
                                        onOpenGroup={handleOpenGroupView}
                                    />
                                );
                            })}
                        </Box>
                    )}
                </Box>

                {/* Right column: Stats and Skills */}
                <Stack spacing={2}>
                    {/* Stats summary card */}
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                                Overview
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Stack spacing={1.5}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Pending
                                    </Typography>
                                    <Chip
                                        label={pendingCount}
                                        size="small"
                                        color={pendingCount > 0 ? 'warning' : 'default'}
                                        variant="filled"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Approved
                                    </Typography>
                                    <Chip
                                        label={approvedCount}
                                        size="small"
                                        color={approvedCount > 0 ? 'success' : 'default'}
                                        variant="filled"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Rejected
                                    </Typography>
                                    <Chip
                                        label={rejectedCount}
                                        size="small"
                                        color={rejectedCount > 0 ? 'error' : 'default'}
                                        variant="filled"
                                    />
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Slots management card */}
                    <Card>
                        <CardContent>
                            {editingCapacity ? (
                                <>
                                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                                        Update Accepted Groups
                                    </Typography>
                                    <TextField
                                        label="Slots"
                                        type="number"
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                min: minimumCapacity,
                                                max: maxSlots,
                                                step: 1
                                            }
                                        }}
                                        value={capacityInput}
                                        onChange={handleCapacityInputChange}
                                        error={Boolean(capacityError)}
                                        helperText={capacityError ?? capacityHelperHint}
                                        disabled={!expertProfile}
                                        sx={{ mt: 1 }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                                        Accepted Groups
                                    </Typography>
                                    <Typography variant="h4" sx={{ mb: 0.5 }}>
                                        {assignmentsLoading ? '…' : slotsSummary}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {normalizedCapacity === 0
                                            ? 'Not accepting requests'
                                            : openSlots > 0
                                                ? `${openSlots} slot${openSlots === 1 ? '' : 's'} open`
                                                : 'No open slots'}
                                    </Typography>
                                </>
                            )}
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                            {editingCapacity ? (
                                <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Button
                                        onClick={handleCancelEditing}
                                        disabled={capacitySaving}
                                        sx={{ flex: 1 }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleSaveCapacity}
                                        disabled={!canSaveCapacity}
                                        sx={{ flex: 1 }}
                                    >
                                        {capacitySaving ? 'Saving…' : 'Save'}
                                    </Button>
                                </Stack>
                            ) : (
                                <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Tooltip
                                        title={editSlotsDisabledReason ?? ''}
                                        disableHoverListener={!editSlotsDisabledReason}
                                    >
                                        <span style={{ flex: 1 }}>
                                            <Button
                                                variant="outlined"
                                                onClick={handleStartEditing}
                                                disabled={!expertProfile || !allSkillsRated}
                                                sx={{ width: '100%' }}
                                            >
                                                Edit slots
                                            </Button>
                                        </span>
                                    </Tooltip>
                                    {expertUid && (
                                        <SlotRequestButton
                                            expertUid={expertUid}
                                            expertRole={role}
                                            profile={expertProfile}
                                            currentMaxSlots={maxSlots}
                                            size="small"
                                            fullWidth
                                        />
                                    )}
                                </Stack>
                            )}
                        </CardActions>
                    </Card>

                    {/* Skill ratings card - only for advisers */}
                    {role === 'adviser' && (
                        <Card>
                            <CardContent>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    sx={{ mb: 2 }}
                                >
                                    <Typography variant="subtitle1" fontWeight="medium">
                                        Your Skills
                                    </Typography>
                                    {departmentSkills.length > 0 && (
                                        <Chip
                                            label={`${skillRatings.filter((r) => r.rating > 0).length}/${departmentSkills.length}`}
                                            size="small"
                                            color={
                                                skillRatings.filter((r) => r.rating > 0).length === departmentSkills.length
                                                    ? 'success'
                                                    : 'warning'
                                            }
                                            variant="outlined"
                                        />
                                    )}
                                </Stack>
                                {skillsLoading ? (
                                    <Stack spacing={1}>
                                        <Skeleton variant="text" width="100%" height={24} />
                                        <Skeleton variant="text" width="80%" height={24} />
                                        <Skeleton variant="text" width="90%" height={24} />
                                    </Stack>
                                ) : departmentSkills.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No skill templates defined for your department yet.
                                    </Typography>
                                ) : (
                                    <Stack spacing={1}>
                                        {/* Show skill overview with ratings */}
                                        {departmentSkills.slice(0, 5).map((skill) => {
                                            const userRating = skillRatings.find((r) => r.skillId === skill.id);
                                            // Show 0 if rating is <= 0 (initial rating is -1)
                                            const rawRating = userRating?.rating ?? -1;
                                            const displayRating = rawRating <= 0 ? 0 : rawRating;
                                            const hasValidRating = rawRating > 0;
                                            return (
                                                <Box key={skill.id}>
                                                    <Stack
                                                        direction="row"
                                                        justifyContent="space-between"
                                                        alignItems="center"
                                                        sx={{ mb: 0.5 }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            noWrap
                                                            sx={{ flex: 1, mr: 1 }}
                                                        >
                                                            {skill.name}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight="medium"
                                                            color={hasValidRating ? 'text.primary' : 'text.disabled'}
                                                        >
                                                            {hasValidRating ? `${displayRating}/10` : `${displayRating}/10`}
                                                        </Typography>
                                                    </Stack>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={displayRating * 10}
                                                        sx={{
                                                            height: 4,
                                                            borderRadius: 2,
                                                            bgcolor: 'action.hover',
                                                        }}
                                                    />
                                                </Box>
                                            );
                                        })}
                                        {departmentSkills.length > 5 && (
                                            <Typography variant="caption" color="text.secondary">
                                                +{departmentSkills.length - 5} more skills
                                            </Typography>
                                        )}
                                    </Stack>
                                )}
                            </CardContent>
                            {departmentSkills.length > 0 && (
                                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={() => setSkillDialogOpen(true)}
                                        fullWidth
                                    >
                                        Edit Skills
                                    </Button>
                                </CardActions>
                            )}
                        </Card>
                    )}
                </Stack>
            </Box>

            {/* Skill Rating Dialog */}
            <SkillRatingDialog
                open={skillDialogOpen}
                onClose={() => setSkillDialogOpen(false)}
                department={expertProfile?.department ?? ''}
                skills={departmentSkills}
                ratings={skillRatings}
                onSave={handleSaveSkillRatings}
                loading={skillsLoading}
            />
        </AnimatedPage>
    );
}
