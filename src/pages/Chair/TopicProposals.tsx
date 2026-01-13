import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Skeleton, Stack, Tooltip, Typography
} from '@mui/material';
import type { ButtonProps } from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type {
    TopicProposalEntry, TopicProposalEntryStatus, TopicProposalSetRecord
} from '../../types/proposal';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import {
    TopicProposalEntryCard, TopicProposalDecisionDialog, ChairApprovalDialog
} from '../../components/TopicProposals';
import type { ChairApprovalFormValues } from '../../components/TopicProposals';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { listenTopicProposalSetsByGroup, recordChairDecision } from '../../utils/firebase/firestore/topicProposals';
import { getGroupsByCourse, getGroupsByDepartment } from '../../utils/firebase/firestore/groups';
import { findUserById, findUsersByFilter } from '../../utils/firebase/firestore/user';
import { notifyChairApprovedTopicForHead, notifyChairRejectedTopic } from '../../utils/auditNotificationUtils';
import { useSegmentViewed } from '../../hooks';

function splitSectionList(value?: string | null): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(/[;|\u007C]/)
        .map((section) => section.trim())
        .filter(Boolean);
}

interface StatusActionButtonConfig {
    label: string;
    color?: ButtonProps['color'];
    variant?: ButtonProps['variant'];
}

/**
 * Get button config for chair based on entry status
 */
function getChairStatusButtonConfig(status: TopicProposalEntryStatus): StatusActionButtonConfig | null {
    switch (status) {
        case 'head_review':
            return { label: 'Approved - awaiting head', color: 'success', variant: 'outlined' };
        case 'head_approved':
            return { label: 'Head approved', color: 'success', variant: 'contained' };
        case 'head_rejected':
            return { label: 'Head rejected', color: 'error', variant: 'contained' };
        case 'chair_rejected':
            return { label: 'Rejected', color: 'error', variant: 'outlined' };
        case 'moderator_rejected':
            return { label: 'Moderator rejected', color: 'error', variant: 'outlined' };
        case 'submitted':
            return { label: 'Awaiting moderator', color: 'info', variant: 'outlined' };
        case 'draft':
            return { label: 'Draft in progress', color: 'inherit', variant: 'outlined' };
        default:
            return null;
    }
}

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'Topic Proposals',
    segment: 'chair-topic-proposals',
    icon: <HistoryEduIcon />,
    roles: ['chair'],
};

interface DecisionDialogState {
    setId: string;
    proposal: TopicProposalEntry;
    decision: 'approved' | 'rejected';
}

interface ApprovalDialogState {
    setId: string;
    proposal: TopicProposalEntry;
}

/**
 * Program Chair dashboard for reviewing student topic proposals after moderator approval.
 * Approved topics are forwarded to the Research Head for final review.
 */
export default function ChairTopicProposalsPage() {
    useSegmentViewed({ segment: 'chair-topic-proposals' });
    const session = useSession<Session>();
    const chairUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [profileError, setProfileError] = React.useState<string | null>(null);

    const [assignedGroups, setAssignedGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
    const [groupsError, setGroupsError] = React.useState<string | null>(null);
    const [groupProposalSets, setGroupProposalSets] = React.useState<Map<string, TopicProposalSetRecord | null>>(new Map());

    // Cache of head user IDs by department for notifications
    const [headUsersByDept, setHeadUsersByDept] = React.useState<Map<string, string[]>>(new Map());
    // Cache of moderator user IDs by course for notifications
    const [moderatorUsersByCourse, setModeratorUsersByCourse] = React.useState<Map<string, string[]>>(new Map());

    // Separate dialogs for approval (with classification) and rejection
    const [approvalDialog, setApprovalDialog] = React.useState<ApprovalDialogState | null>(null);
    const [decisionDialog, setDecisionDialog] = React.useState<DecisionDialogState | null>(null);
    const [decisionLoading, setDecisionLoading] = React.useState(false);

    React.useEffect(() => {
        if (!chairUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setProfileError(null);

        void findUserById(chairUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
            })
            .catch((fetchError) => {
                console.error('Failed to fetch chair profile:', fetchError);
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
    }, [chairUid]);

    // Chair scope configuration:
    // - If chair has specific courses (moderatedCourses or course field), scope to those courses
    // - If chair has only a department (no courses), scope to all courses in that department
    type ChairScopeType =
        | { type: 'courses'; courses: string[] }
        | { type: 'department'; department: string }
        | null;

    const chairScope = React.useMemo<ChairScopeType>(() => {
        if (!profile) {
            return null;
        }

        // First check for explicit course assignments
        const explicitCourses = (profile.moderatedCourses ?? []).filter(Boolean);
        if (explicitCourses.length > 0) {
            return { type: 'courses', courses: explicitCourses };
        }

        const fallbackCourses = splitSectionList(profile.course);
        if (fallbackCourses.length > 0) {
            return { type: 'courses', courses: fallbackCourses };
        }

        // If no courses specified but department is set, scope to entire department
        if (profile.department) {
            return { type: 'department', department: profile.department };
        }

        return null;
    }, [profile]);

    React.useEffect(() => {
        if (!chairScope) {
            setAssignedGroups([]);
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setGroupsError(null);

        void (async () => {
            try {
                let resolvedGroups: ThesisGroup[];

                if (chairScope.type === 'department') {
                    // Fetch all groups in the department
                    resolvedGroups = await getGroupsByDepartment(chairScope.department);
                } else {
                    // Fetch groups for specific courses
                    const groupsByCourse = await Promise.all(
                        chairScope.courses.map((course) => getGroupsByCourse(course))
                    );
                    resolvedGroups = groupsByCourse.flat();
                }

                if (cancelled) {
                    return;
                }

                const deduped = new Map<string, ThesisGroup>();
                resolvedGroups.forEach((group) => {
                    deduped.set(group.id, group);
                });
                setAssignedGroups(Array.from(deduped.values()));
            } catch (fetchError) {
                console.error('Failed to fetch chair groups:', fetchError);
                if (!cancelled) {
                    const errorMsg = chairScope.type === 'department'
                        ? 'Unable to load groups for your department.'
                        : 'Unable to load groups for your assigned courses.';
                    setGroupsError(errorMsg);
                    setAssignedGroups([]);
                }
            } finally {
                if (!cancelled) {
                    setGroupsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [chairScope]);

    React.useEffect(() => {
        if (assignedGroups.length === 0) {
            setGroupProposalSets(new Map());
            setHeadUsersByDept(new Map());
            setModeratorUsersByCourse(new Map());
            return () => { /* no-op */ };
        }

        // Fetch head users for all unique departments in assigned groups
        const uniqueDepartments = [...new Set(assignedGroups.map(g => g.department).filter(Boolean))];
        void (async () => {
            const deptHeadMap = new Map<string, string[]>();
            for (const dept of uniqueDepartments) {
                if (!dept) continue;
                try {
                    const heads = await findUsersByFilter({ role: 'head', department: dept });
                    deptHeadMap.set(dept, heads.map(h => h.uid));
                } catch (error) {
                    console.error(`Failed to fetch heads for department ${dept}:`, error);
                }
            }
            setHeadUsersByDept(deptHeadMap);
        })();

        // Fetch moderator users for all unique courses in assigned groups
        const uniqueCourses = [...new Set(assignedGroups.map(g => g.course).filter(Boolean))];
        void (async () => {
            const courseModeratorMap = new Map<string, string[]>();
            for (const course of uniqueCourses) {
                if (!course) continue;
                try {
                    const moderators = await findUsersByFilter({ role: 'moderator', course });
                    courseModeratorMap.set(course, moderators.map(m => m.uid));
                } catch (error) {
                    console.error(`Failed to fetch moderators for course ${course}:`, error);
                }
            }
            setModeratorUsersByCourse(courseModeratorMap);
        })();

        const unsubscribes = assignedGroups.map((group) =>
            listenTopicProposalSetsByGroup(group.id, {
                onData: (records) => {
                    setGroupProposalSets((previous) => {
                        const next = new Map(previous);
                        next.set(group.id, records[0] ?? null);
                        return next;
                    });
                },
                onError: (listenerError) => {
                    console.error(`Failed to listen to topic proposals for group ${group.id}:`, listenerError);
                },
            })
        );

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [assignedGroups]);

    const pendingCount = React.useMemo(() => {
        let total = 0;
        groupProposalSets.forEach((record) => {
            if (!record) {
                return;
            }
            total += record.entries.filter((entry) => entry.status === 'chair_review').length;
        });
        return total;
    }, [groupProposalSets]);

    const scopeLabel = React.useMemo(() => {
        if (!chairScope) {
            return 'No scope assigned';
        }
        if (chairScope.type === 'department') {
            return chairScope.department;
        }
        const courses = chairScope.courses;
        if (courses.length <= 2) {
            return courses.join(', ');
        }
        const [first, second] = courses;
        return `${first}, ${second} +${courses.length - 2} more`;
    }, [chairScope]);

    const sortedGroups = React.useMemo(() => {
        return [...assignedGroups].sort((a, b) => a.name.localeCompare(b.name));
    }, [assignedGroups]);

    const handleOpenApproval = (setId: string, proposal: TopicProposalEntry) => {
        setApprovalDialog({ setId, proposal });
    };

    const handleOpenRejection = (setId: string, proposal: TopicProposalEntry) => {
        setDecisionDialog({ setId, proposal, decision: 'rejected' });
    };

    /**
     * Handle chair approval with optional agenda/ESG/SDG classification updates
     */
    const handleConfirmApproval = async (values: ChairApprovalFormValues) => {
        if (!approvalDialog || !chairUid) {
            return;
        }
        setDecisionLoading(true);
        try {
            await recordChairDecision({
                setId: approvalDialog.setId,
                proposalId: approvalDialog.proposal.id,
                reviewerUid: chairUid,
                decision: 'approved',
                notes: values.notes.trim() || undefined,
                agenda: values.agendaPath.length > 0 ? {
                    type: values.agendaType,
                    department: values.department || undefined,
                    agendaPath: values.agendaPath,
                } : undefined,
                ESG: values.ESG || undefined,
                SDG: values.SDG || undefined,
            });
            showNotification('Topic approved and forwarded to head for final review', 'success');

            // Audit notification for chair approval
            const group = assignedGroups.find((g) =>
                groupProposalSets.get(g.id)?.id === approvalDialog.setId
            );
            if (group) {
                const deptHeadIds = headUsersByDept.get(group.department ?? '') ?? [];
                const courseModeratorIds = moderatorUsersByCourse.get(group.course ?? '') ?? [];
                void notifyChairApprovedTopicForHead({
                    group,
                    chairId: chairUid,
                    proposalTitle: approvalDialog.proposal.title,
                    headUserIds: deptHeadIds,
                    moderatorUserIds: courseModeratorIds,
                    details: {
                        proposalId: approvalDialog.proposal.id,
                        notes: values.notes.trim() || undefined,
                        agenda: values.agendaPath.length > 0 ? values.agendaPath : undefined,
                        ESG: values.ESG || undefined,
                        SDG: values.SDG || undefined,
                    },
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to approve topic';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
            setApprovalDialog(null);
        }
    };

    /**
     * Handle chair rejection
     */
    const handleConfirmRejection = async (notes: string) => {
        if (!decisionDialog || !chairUid) {
            return;
        }
        setDecisionLoading(true);
        try {
            await recordChairDecision({
                setId: decisionDialog.setId,
                proposalId: decisionDialog.proposal.id,
                reviewerUid: chairUid,
                decision: 'rejected',
                notes: notes,
            });
            showNotification('Topic rejected', 'success');

            // Audit notification for chair rejection
            const group = assignedGroups.find((g) =>
                groupProposalSets.get(g.id)?.id === decisionDialog.setId
            );
            if (group) {
                const courseModeratorIds = moderatorUsersByCourse.get(group.course ?? '') ?? [];
                void notifyChairRejectedTopic({
                    group,
                    chairId: chairUid,
                    proposalTitle: decisionDialog.proposal.title,
                    reason: notes,
                    moderatorUserIds: courseModeratorIds,
                    details: {
                        proposalId: decisionDialog.proposal.id,
                    },
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reject topic';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
            setDecisionDialog(null);
        }
    };

    if (!session?.user && session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                    <CircularProgress />
                </Box>
            </AnimatedPage>
        );
    }

    if (!chairUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to review topic proposals.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Review topic proposals approved by moderators. Approved topics will be forwarded
                        to the Research Head for final decision.
                    </Typography>
                </Box>

                <Card>
                    <CardContent>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <Box>
                                <Typography variant="subtitle1">Awaiting chair decision</Typography>
                                <Typography variant="h4">{pendingCount}</Typography>
                            </Box>
                            <Chip
                                label={scopeLabel}
                                color={chairScope ? 'info' : 'default'}
                                variant={chairScope ? 'filled' : 'outlined'}
                            />
                        </Stack>
                    </CardContent>
                </Card>

                {profileError && <Alert severity="error">{profileError}</Alert>}
                {groupsError && <Alert severity="error">{groupsError}</Alert>}
                {!profileLoading && !chairScope && (
                    <Alert severity="info">
                        Your profile does not have a department or course assigned. Update your profile to see
                        topic proposals.
                    </Alert>
                )}

                {(profileLoading || groupsLoading) && (
                    <Stack spacing={2}>
                        {Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton key={index} variant="rectangular" height={140} />
                        ))}
                    </Stack>
                )}

                {!groupsLoading && chairScope && sortedGroups.length === 0 && (
                    <Alert severity="info">
                        {chairScope.type === 'department'
                            ? 'No thesis groups found in your department.'
                            : 'No thesis groups are assigned to your courses yet.'}
                    </Alert>
                )}

                {sortedGroups.map((group) => {
                    const record = groupProposalSets.get(group.id);
                    const entries = record?.entries ?? [];
                    const awaitingHead = Boolean(record?.awaitingHead);
                    const awaitingChair = Boolean(record?.awaitingChair);

                    return (
                        <Card key={group.id} variant="outlined">
                            <CardContent>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    sx={{ mb: 2 }}
                                >
                                    <Box>
                                        <Typography variant="h6">{group.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {group.course ?? 'Unassigned course'} • {group.department ?? 'No department listed'}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Chip label={`Batch ${record?.batch ?? 1}`} size="small" />
                                        {awaitingChair && <Chip label="Chair queue" size="small" color="info" />}
                                        {awaitingHead && <Chip label="Head queue" size="small" color="warning" />}
                                    </Stack>
                                </Stack>

                                {record === undefined && (
                                    <Skeleton variant="rectangular" height={100} />
                                )}

                                {record === null && (
                                    <Alert severity="info">This group has not created any topic proposals yet.</Alert>
                                )}

                                {record && entries.length === 0 && (
                                    <Alert severity="info">No topic proposals have been drafted in this batch.</Alert>
                                )}

                                {record && entries.length > 0 && (
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                                        {entries.map((entry) => {
                                            const statusButton = getChairStatusButtonConfig(
                                                entry.status ?? 'draft'
                                            );
                                            const actions = entry.status === 'chair_review'
                                                ? [
                                                    <Button
                                                        key="approve"
                                                        variant="contained"
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleOpenApproval(record.id, entry)}
                                                    >
                                                        Approve
                                                    </Button>,
                                                    <Button
                                                        key="reject"
                                                        variant="outlined"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenRejection(record.id, entry)}
                                                    >
                                                        Reject
                                                    </Button>,
                                                ]
                                                : statusButton
                                                    ? [
                                                        <Button
                                                            key="status"
                                                            size="small"
                                                            color={statusButton.color ?? 'inherit'}
                                                            variant={statusButton.variant ?? 'outlined'}
                                                            disabled
                                                        >
                                                            {statusButton.label}
                                                        </Button>,
                                                    ]
                                                    : [
                                                        <Tooltip
                                                            key="view-only"
                                                            title="Only moderator-approved proposals can be reviewed"
                                                            placement="top"
                                                        >
                                                            <span>
                                                                <Button size="small" disabled>
                                                                    Await moderator
                                                                </Button>
                                                            </span>
                                                        </Tooltip>,
                                                    ];

                                            return (
                                                <Box key={entry.id} sx={{ flex: '1 1 320px', minWidth: 280 }}>
                                                    <TopicProposalEntryCard
                                                        entry={entry}
                                                        author={undefined}
                                                        actions={actions}
                                                    />
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>

            {/* Chair approval dialog with optional agenda/ESG/SDG classification updates */}
            <ChairApprovalDialog
                open={Boolean(approvalDialog)}
                proposal={approvalDialog?.proposal ?? null}
                loading={decisionLoading}
                onClose={() => setApprovalDialog(null)}
                onConfirm={handleConfirmApproval}
            />

            {/* Rejection dialog (simple notes only) */}
            <TopicProposalDecisionDialog
                open={Boolean(decisionDialog)}
                decision="rejected"
                role="chair"
                proposalTitle={decisionDialog?.proposal.title}
                loading={decisionLoading}
                onClose={() => setDecisionDialog(null)}
                onConfirm={handleConfirmRejection}
            />
        </AnimatedPage>
    );
}
