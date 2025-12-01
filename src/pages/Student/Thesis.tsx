import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Paper, Skeleton, Stack,
    Step, StepContent, StepLabel, Stepper, Typography
} from '@mui/material';
import {
    School as SchoolIcon, Groups as GroupsIcon, PersonAdd as PersonAddIcon,
    Topic as TopicIcon, Article as ArticleIcon, Upload as UploadIcon
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisChapter, ThesisData } from '../../types/thesis';
import type { UserProfile } from '../../types/profile';
import type { ThesisGroup } from '../../types/group';
import type { TopicProposalSetRecord } from '../../utils/firebase/firestore/topicProposals';
import { AnimatedList, AnimatedPage } from '../../components/Animate';
import { Avatar, Name } from '../../components/Avatar';
import { getThesisTeamMembersById, isTopicApproved } from '../../utils/thesisUtils';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { listenTopicProposalSetsByGroup } from '../../utils/firebase/firestore/topicProposals';
import { normalizeDateInput } from '../../utils/dateUtils';
import { useNavigate } from 'react-router';
import type { WorkflowStep } from '../../types/workflow';
import {
    resolveStepState, applyPrerequisiteLocks, getStepMeta, getActiveStepIndex, formatPrerequisiteMessage,
} from '../../utils/workflowUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 0,
    title: 'My Thesis',
    segment: 'thesis',
    icon: <SchoolIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type TeamMember = Awaited<ReturnType<typeof getThesisTeamMembersById>> extends (infer Member)[]
    ? Member
    : never;

function formatUserName(name: UserProfile['name']): string {
    const parts = [name.prefix, name.first, name.middle, name.last, name.suffix].filter((value): value is string => Boolean(value));
    return parts.join(' ');
}

function getStatusColor(status: ThesisChapter['status']): 'success' | 'warning' | 'error' | 'default' {
    if (status === 'approved') return 'success';
    if (status === 'under_review') return 'warning';
    if (status === 'revision_required') return 'error';
    return 'default';
}

/**
 * Check if any proposal entry has been approved by the head
 */
function hasApprovedProposal(proposalSets: TopicProposalSetRecord[]): boolean {
    return proposalSets.some((set) =>
        set.entries.some((entry) => entry.status === 'head_approved')
    );
}

/**
 * Get the title of the first approved proposal entry
 */
function getApprovedProposalTitle(proposalSets: TopicProposalSetRecord[]): string | undefined {
    for (const set of proposalSets) {
        const approvedEntry = set.entries.find((entry) => entry.status === 'head_approved');
        if (approvedEntry) {
            return approvedEntry.title;
        }
    }
    return undefined;
}

/**
 * Check if any proposal has been submitted for review
 */
function hasSubmittedProposals(proposalSets: TopicProposalSetRecord[]): boolean {
    return proposalSets.some((set) =>
        set.entries.some((entry) =>
            entry.status && entry.status !== 'draft'
        )
    );
}

function buildThesisWorkflowSteps(
    record: ThesisRecord | null,
    members: TeamMember[],
    group: ThesisGroup | null,
    proposalSets: TopicProposalSetRecord[] = []
): WorkflowStep[] {
    // Check proposal approval status from proposal sets
    const proposalApproved = hasApprovedProposal(proposalSets);
    const approvedTitle = getApprovedProposalTitle(proposalSets);
    const proposalsSubmitted = hasSubmittedProposals(proposalSets);

    if (!record) {
        // Determine group state for better messaging
        const groupStatus = group?.status;
        const isDraft = groupStatus === 'draft';
        const isInReview = groupStatus === 'review';
        const isActive = groupStatus === 'active';
        const isRejected = groupStatus === 'rejected';

        let groupDescription = 'Form your research group with team members and submit for moderator approval.';
        let groupState: WorkflowStep['state'] = group ? 'in-progress' : 'available';
        const adviserAssigned = Boolean(group?.members?.adviser);
        const editorAssigned = Boolean(group?.members?.editor);
        const hasGroup = Boolean(group);

        if (isActive) {
            groupDescription = 'Group has been approved and is active.';
            groupState = 'completed';
        } else if (isInReview) {
            groupDescription = 'Group is awaiting approval from the Research Moderator.';
            groupState = 'in-progress';
        } else if (isRejected) {
            groupDescription = group?.rejectionReason
                ? `Group was rejected: ${group.rejectionReason}`
                : 'Group was rejected. Please review and resubmit.';
            groupState = 'available';
        } else if (isDraft) {
            groupDescription = 'Group created. Review your members and submit the group request when ready.';
            groupState = 'in-progress';
        }

        const editorDescription = editorAssigned
            ? 'Research editor assigned.'
            : hasGroup
                ? 'Select and request approval from your research editor.'
                : 'Create your research group to unlock editor selection.';
        const editorState: WorkflowStep['state'] = editorAssigned ? 'completed' : 'available';

        const adviserState: WorkflowStep['state'] = adviserAssigned ? 'completed' : 'available';

        const baseSteps: WorkflowStep[] = [
            {
                id: 'create-group',
                title: 'Create Research Group',
                description: groupDescription,
                completedMessage: 'Your research group has been created and approved.',
                state: groupState,
                actionLabel: 'Go to My Group',
                actionPath: '/group',
                icon: <GroupsIcon />,
            },
            {
                id: 'request-editor',
                title: 'Select Research Editor',
                description: editorDescription,
                completedMessage: 'Research editor has been assigned to your group.',
                state: editorState,
                actionLabel: editorAssigned ? undefined : 'Browse Editors',
                actionPath: '/recommendation',
                icon: <PersonAddIcon />,
                prerequisites: [
                    { stepId: 'create-group', type: 'corequisite' },
                ],
            },
            {
                id: 'submit-proposals',
                title: 'Submit Topic Proposals',
                description: proposalApproved
                    ? `Topic approved: "${approvedTitle}"`
                    : proposalsSubmitted
                        ? 'Proposals submitted. Awaiting approval.'
                        : 'Upload up to 3 thesis title proposals for review and approval.',
                completedMessage: proposalApproved
                    ? `Your topic proposal "${approvedTitle}" has been approved.`
                    : 'Your topic proposal has been approved.',
                state: resolveStepState({ completed: proposalApproved, started: proposalsSubmitted }),
                actionLabel: 'View Proposals',
                actionPath: '/topic-proposals',
                icon: <TopicIcon />,
                prerequisites: [
                    { stepId: 'create-group', type: 'prerequisite' },
                    { stepId: 'request-editor', type: 'prerequisite' },
                ],
            },
            {
                id: 'request-adviser',
                title: 'Select Research Adviser',
                description: adviserAssigned
                    ? 'Research adviser assigned.'
                    : proposalApproved
                        ? 'Choose your research adviser now that your topic is approved.'
                        : 'Adviser selection unlocks after your topic proposal is approved.',
                completedMessage: 'Research adviser has been assigned to your group.',
                state: adviserState,
                actionLabel: adviserAssigned ? undefined : 'Browse Advisers',
                actionPath: '/recommendation',
                icon: <PersonAddIcon />,
                prerequisites: [
                    { stepId: 'submit-proposals', type: 'prerequisite' },
                ],
            },
            {
                id: 'upload-chapters',
                title: 'Upload Thesis Chapters',
                description: 'Submit your thesis chapters for adviser and editor review.',
                completedMessage: 'All thesis chapters have been approved.',
                state: 'available',
                actionLabel: 'View Chapters',
                actionPath: '/student-thesis-workspace',
                icon: <ArticleIcon />,
                prerequisites: [
                    { stepId: 'submit-proposals', type: 'prerequisite' },
                    { stepId: 'request-adviser', type: 'prerequisite' },
                ],
            },
            {
                id: 'terminal-requirements',
                title: 'Submit Terminal Requirements',
                description: 'Upload final documents and complete terminal requirements for submission.',
                completedMessage: 'All terminal requirements have been submitted.',
                state: 'available',
                actionLabel: 'View Requirements',
                actionPath: '/terminal-requirements',
                icon: <UploadIcon />,
                prerequisites: [
                    { stepId: 'upload-chapters', type: 'prerequisite' },
                ],
            },
        ];
        return applyPrerequisiteLocks(baseSteps);
    }

    const chapters = record.chapters ?? [];
    const totalMembers = members.length;
    const hasGroup = totalMembers > 0 || Boolean(group);

    // Determine group approval state with detailed status
    const groupStatus = group?.status;
    const isDraft = groupStatus === 'draft';
    const isInReview = groupStatus === 'review';
    const isActive = groupStatus === 'active';
    const isRejected = groupStatus === 'rejected';
    const groupApproved = isActive || (totalMembers > 1 && groupStatus !== 'draft');

    const adviserAssigned = Boolean(group?.members?.adviser);
    const editorAssigned = Boolean(group?.members?.editor);
    const hasTopicProposals = Boolean(record.title) || proposalsSubmitted;
    // Topic is approved if proposal is head_approved OR thesis record indicates approval
    const topicApproved = proposalApproved || isTopicApproved(record);
    const displayTitle = approvedTitle || record.title;
    const chaptersSubmitted = chapters.some((chapter) => chapter.status !== 'not_submitted');
    const approvedCount = chapters.filter((chapter) => chapter.status === 'approved').length;
    const allChaptersApproved = chapters.length > 0 && approvedCount === chapters.length;

    // Build group description based on current status
    let groupDescription: string;
    if (groupApproved) {
        groupDescription = `Group approved with ${totalMembers} members.`;
    } else if (isInReview) {
        groupDescription = 'Group is awaiting approval from the Research Moderator.';
    } else if (isRejected) {
        groupDescription = group?.rejectionReason
            ? `Group was rejected: ${group.rejectionReason}. Please update and resubmit.`
            : 'Group was rejected. Please review and resubmit.';
    } else if (isDraft) {
        groupDescription = 'Group created. Review your members and submit the group request when ready.';
    } else if (hasGroup) {
        groupDescription = 'Awaiting Research Moderator approval.';
    } else {
        groupDescription = 'Form your research group with team members and submit for moderator approval.';
    }

    const baseSteps: WorkflowStep[] = [
        {
            id: 'create-group',
            title: 'Create Research Group',
            description: groupDescription,
            completedMessage: `Your research group has been created and approved with ${totalMembers} members.`,
            state: resolveStepState({ completed: groupApproved, started: hasGroup }),
            actionLabel: 'Go to My Group',
            actionPath: '/group',
            icon: <GroupsIcon />,
        },
        {
            id: 'request-editor',
            title: 'Select Research Editor',
            description: editorAssigned
                ? 'Research editor assigned.'
                : hasGroup
                    ? 'Select and request approval from your research editor.'
                    : 'Create and submit your research group to access editors.',
            completedMessage: 'Research editor has been assigned to your group.',
            state: editorAssigned ? 'completed' : 'available',
            actionLabel: editorAssigned ? undefined : 'Browse Editors',
            actionPath: '/recommendation',
            icon: <PersonAddIcon />,
            prerequisites: [
                { stepId: 'create-group', type: 'corequisite' },
            ],
        },
        {
            id: 'submit-proposals',
            title: 'Submit Topic Proposals',
            description: topicApproved
                ? `Topic approved: "${displayTitle}"`
                : hasTopicProposals
                    ? 'Proposals submitted. Awaiting approval.'
                    : 'Upload up to 3 thesis title proposals for review and approval.',
            completedMessage: `Your topic proposal "${displayTitle}" has been approved.`,
            state: resolveStepState({ completed: topicApproved, started: hasTopicProposals || topicApproved }),
            actionLabel: 'View Proposals',
            actionPath: '/topic-proposals',
            icon: <TopicIcon />,
            prerequisites: [
                { stepId: 'create-group', type: 'prerequisite' },
                { stepId: 'request-editor', type: 'prerequisite' },
            ],
        },
        {
            id: 'request-adviser',
            title: 'Select Research Adviser',
            description: adviserAssigned
                ? 'Research adviser assigned.'
                : topicApproved
                    ? 'Choose your research adviser now that your topic is approved.'
                    : hasTopicProposals
                        ? 'Awaiting topic approval before adviser selection opens.'
                        : 'Submit your topic proposals to unlock adviser selection.',
            completedMessage: 'Research adviser has been assigned to your group.',
            state: resolveStepState({ completed: adviserAssigned, started: topicApproved && !adviserAssigned }),
            actionLabel: adviserAssigned ? undefined : 'Browse Advisers',
            actionPath: '/recommendation',
            icon: <PersonAddIcon />,
            prerequisites: [
                { stepId: 'submit-proposals', type: 'prerequisite' },
            ],
        },
        {
            id: 'upload-chapters',
            title: 'Upload Thesis Chapters',
            description: allChaptersApproved
                ? `All ${chapters.length} chapters approved.`
                : chaptersSubmitted
                    ? `${approvedCount}/${chapters.length} chapters approved.`
                    : 'Submit your thesis chapters for adviser and editor review.',
            completedMessage: `All ${chapters.length} thesis chapters have been approved.`,
            state: resolveStepState({ completed: allChaptersApproved, started: chaptersSubmitted }),
            actionLabel: 'View Chapters',
            actionPath: '/student-thesis-workspace',
            icon: <ArticleIcon />,
            prerequisites: [
                { stepId: 'submit-proposals', type: 'prerequisite' },
                { stepId: 'request-adviser', type: 'prerequisite' },
            ],
        },
        {
            id: 'terminal-requirements',
            title: 'Submit Terminal Requirements',
            description: 'Upload final documents and complete terminal requirements for submission.',
            completedMessage: 'All terminal requirements have been submitted successfully.',
            state: 'available',
            actionLabel: 'View Requirements',
            actionPath: '/terminal-requirements',
            icon: <UploadIcon />,
            prerequisites: [
                { stepId: 'upload-chapters', type: 'prerequisite' },
            ],
        },
    ];

    return applyPrerequisiteLocks(baseSteps);
}

function formatDateLabel(value?: string | Date | null): string {
    const date = normalizeDateInput(value ?? undefined);
    return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

/**
 * Calculate the overall completion percentage for a thesis record.
 * @param record - Thesis document containing chapter progress information
 * @returns Completion percentage between 0 and 100
 */
function computeThesisProgressPercent(record: ThesisRecord): number {
    const chapters = record.chapters ?? [];
    if (chapters.length === 0) {
        return 0;
    }
    const approvedCount = chapters.filter((chapter) => chapter.status === 'approved').length;
    return (approvedCount / chapters.length) * 100;
}

/**
 * Main thesis overview page for students, showing progress, chapters, and team members.
 */
export default function ThesisPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const navigate = useNavigate();

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [userTheses, setUserTheses] = React.useState<ThesisRecord[]>([]);
    const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [proposalSets, setProposalSets] = React.useState<TopicProposalSetRecord[]>([]);
    const [progress, setProgress] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [hasNoThesis, setHasNoThesis] = React.useState<boolean>(false);
    const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setUserTheses([]);
            setTeamMembers([]);
            setProgress(0);
            setHasNoThesis(false);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        setHasNoThesis(false);
        setUserTheses([]);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                setUserTheses(records);
                setLoading(false);
                setError(null);
            },
            onError: (listenerError) => {
                console.error('Failed to subscribe to thesis data:', listenerError);
                setError('Unable to load thesis data right now. Please try again later.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!userUid) {
            return;
        }

        if (userTheses.length === 0) {
            setThesis(null);
            setTeamMembers([]);
            setProgress(0);
            setHasNoThesis(true);
            return;
        }

        // Select thesis - prefer one where user is the group leader
        const candidate = userTheses[0];
        setThesis(candidate);
        setProgress(computeThesisProgressPercent(candidate));
        setHasNoThesis(false);
    }, [userTheses, userUid]);

    React.useEffect(() => {
        if (!thesis) {
            setTeamMembers([]);
            return;
        }

        let cancelled = false;

        const loadTeam = async () => {
            try {
                const members = await getThesisTeamMembersById(thesis.id);
                if (!cancelled) {
                    setTeamMembers(members);
                }
            } catch (teamError) {
                console.error('Failed to load thesis team members:', teamError);
            }
        };

        void loadTeam();

        return () => {
            cancelled = true;
        };
    }, [thesis]);

    // Load group data
    React.useEffect(() => {
        if (!userUid) {
            setGroup(null);
            return;
        }

        let cancelled = false;

        const loadGroup = async () => {
            try {
                const [leaderGroups, memberGroups] = await Promise.all([
                    getGroupsByLeader(userUid),
                    getGroupsByMember(userUid),
                ]);

                if (cancelled) return;

                const combined = [...leaderGroups, ...memberGroups];
                const unique = Array.from(
                    new Map(combined.map((item) => [item.id, item])).values()
                );

                // Prioritize active groups, then review, then draft
                const priority = ['active', 'review', 'draft'];
                const sorted = unique.sort((a, b) => {
                    const aScore = priority.indexOf(a.status);
                    const bScore = priority.indexOf(b.status);
                    if (aScore === -1 && bScore === -1) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }
                    if (aScore === -1) return 1;
                    if (bScore === -1) return -1;
                    return aScore - bScore;
                });

                setGroup(sorted[0] || null);
            } catch (error) {
                console.error('Failed to load group data:', error);
                if (!cancelled) {
                    setGroup(null);
                }
            }
        };

        void loadGroup();

        return () => {
            cancelled = true;
        };
    }, [userUid]);

    // Load proposal sets when group is available
    React.useEffect(() => {
        if (!group?.id) {
            setProposalSets([]);
            return;
        }

        const unsubscribe = listenTopicProposalSetsByGroup(group.id, {
            onData: (records) => {
                setProposalSets(records);
            },
            onError: (err) => {
                console.error('Failed to load proposal sets:', err);
                setProposalSets([]);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [group?.id]);

    // Compute workflow steps before any conditional returns (hooks must be called unconditionally)
    const workflowSteps = React.useMemo(
        () => buildThesisWorkflowSteps(thesis, teamMembers, group, proposalSets),
        [thesis, teamMembers, group, proposalSets]
    );
    const activeStepIndex = React.useMemo(() => getActiveStepIndex(workflowSteps), [workflowSteps]);

    // Initialize expanded steps on mount or when workflow changes
    React.useEffect(() => {
        const initialExpanded = new Set<string>();
        workflowSteps.forEach((step) => {
            const meta = getStepMeta(step);
            if (meta.defaultExpanded) {
                initialExpanded.add(step.id);
            }
        });
        setExpandedSteps(initialExpanded);
    }, [workflowSteps]);

    const handleNavigateToStep = React.useCallback((path?: string) => {
        if (path) {
            navigate(path);
        }
    }, [navigate]);

    const handleStepToggle = React.useCallback((stepId: string, expandable: boolean) => {
        if (!expandable) return;

        setExpandedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepId)) {
                next.delete(stepId);
            } else {
                next.add(stepId);
            }
            return next;
        });
    }, []);

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={260} height={42} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={10} sx={{ mt: 2 }} />
                </Paper>
            </AnimatedPage>
        );
    }

    if (loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={260} height={42} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={10} sx={{ mt: 2 }} />
                </Paper>
                <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
                <Stack spacing={2}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={idx} variant="rectangular" height={96} />
                    ))}
                </Stack>
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to view your thesis details.</Alert>
            </AnimatedPage>
        );
    }

    if (error) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{error}</Alert>
            </AnimatedPage>
        );
    }

    if (hasNoThesis || !thesis) {
        // Show workflow even without thesis record
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h4" gutterBottom>
                        My Thesis Journey
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Follow these steps to complete your thesis from group formation to final submission.
                    </Typography>

                    <Stepper orientation="vertical" activeStep={activeStepIndex} sx={{ mt: 3 }}>
                        {workflowSteps.map((step) => {
                            const stepMeta = getStepMeta(step);
                            const isExpanded = expandedSteps.has(step.id);
                            const isLocked = step.state === 'locked';
                            const isStepCompleted = step.state === 'completed';
                            const iconColor = isStepCompleted ? 'success.main' : undefined;
                            const stepTitleColor = isStepCompleted
                                ? 'success.main'
                                : stepMeta.accessible
                                    ? 'text.primary'
                                    : 'text.secondary';

                            return (
                                <Step
                                    key={step.id}
                                    completed={step.state === 'completed'}
                                    disabled={!stepMeta.accessible}
                                    expanded={isExpanded}
                                >
                                    <StepLabel
                                        icon={step.icon}
                                        slotProps={{
                                            stepIcon: {
                                                sx: { color: iconColor },
                                            },
                                        }}
                                        onClick={() => handleStepToggle(step.id, stepMeta.expandable)}
                                        sx={{
                                            cursor: stepMeta.expandable ? 'pointer' : 'default',
                                            opacity: stepMeta.accessible ? 1 : 0.5,
                                        }}
                                    >
                                        <Typography variant="body1" color={stepTitleColor}>
                                            {step.title}
                                        </Typography>
                                    </StepLabel>
                                    <StepContent>
                                        {isLocked ? (
                                            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                                {formatPrerequisiteMessage(step, workflowSteps)}
                                            </Typography>
                                        ) : (
                                            <>
                                                <Typography variant="body2" sx={{ mb: 2 }}>
                                                    {stepMeta.displayMessage}
                                                </Typography>
                                                {stepMeta.showActionButton && step.actionPath && step.actionLabel && (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => handleNavigateToStep(step.actionPath)}
                                                    >
                                                        {step.actionLabel}
                                                    </Button>
                                                )}
                                                {stepMeta.showActionButton && !step.actionPath && step.actionLabel && (
                                                    <Button variant="outlined" size="small" disabled>
                                                        {step.actionLabel}
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </StepContent>
                                </Step>
                            );
                        })}
                    </Stepper>
                </Paper>
            </AnimatedPage>
        );
    }

    const formattedSubmissionDate = formatDateLabel(thesis.submissionDate);
    const formattedLastUpdated = formatDateLabel(thesis.lastUpdated);

    return (
        <AnimatedPage variant="slideUp">
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {thesis.title}
                </Typography>

                <Box sx={{ mt: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Research Group Members
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {teamMembers.map((member) => (
                            <Avatar
                                key={member.uid}
                                uid={member.uid}
                                initials={[Name.FIRST]}
                                mode="chip"
                                tooltip="email"
                                label={`${formatUserName(member.name)} (${member.thesisRole})`}
                                size="small"
                                chipProps={{ variant: 'outlined', size: 'small' }}
                                editable={false}
                            />
                        ))}
                        {teamMembers.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                No team members listed yet.
                            </Typography>
                        )}
                    </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body1">
                            <strong>Submission Date:</strong> {formattedSubmissionDate}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Last Updated:</strong> {formattedLastUpdated}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Status:</strong> {group?.status === 'completed' ? 'Completed' : 'In Progress'}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Overall Progress: {Math.round(progress)}% Complete
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                    />
                </Box>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                    Thesis Workflow
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Follow these steps to complete your thesis journey.
                </Typography>

                <Stepper orientation="vertical" activeStep={activeStepIndex} sx={{ mt: 2 }}>
                    {workflowSteps.map((step) => {
                        const stepMeta = getStepMeta(step);
                        const isExpanded = expandedSteps.has(step.id);
                        const isLocked = step.state === 'locked';
                        const isStepCompleted = step.state === 'completed';
                        const iconColor = isStepCompleted ? 'success.main' : undefined;
                        const stepTitleColor = isStepCompleted
                            ? 'success.main'
                            : stepMeta.accessible
                                ? 'text.primary'
                                : 'text.secondary';

                        return (
                            <Step
                                key={step.id}
                                completed={step.state === 'completed'}
                                disabled={!stepMeta.accessible}
                                expanded={isExpanded}
                            >
                                <StepLabel
                                    icon={step.icon}
                                    slotProps={{
                                        stepIcon: {
                                            sx: { color: iconColor },
                                        },
                                    }}
                                    onClick={() => handleStepToggle(step.id, stepMeta.expandable)}
                                    sx={{
                                        cursor: stepMeta.expandable ? 'pointer' : 'default',
                                        opacity: stepMeta.accessible ? 1 : 0.5,
                                    }}
                                >
                                    <Typography variant="body1" color={stepTitleColor} >
                                        {step.title}
                                    </Typography>
                                </StepLabel>
                                <StepContent>
                                    {isLocked ? (
                                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                            {formatPrerequisiteMessage(step, workflowSteps)}
                                        </Typography>
                                    ) : (
                                        <>
                                            <Typography variant="body2" sx={{ mb: 2 }}>
                                                {stepMeta.displayMessage}
                                            </Typography>
                                            {stepMeta.showActionButton && step.actionPath && step.actionLabel && (
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => handleNavigateToStep(step.actionPath)}
                                                >
                                                    {step.actionLabel}
                                                </Button>
                                            )}
                                            {stepMeta.showActionButton && !step.actionPath && step.actionLabel && (
                                                <Button variant="outlined" size="small" disabled>
                                                    {step.actionLabel}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </StepContent>
                            </Step>
                        );
                    })}
                </Stepper>
            </Paper>
        </AnimatedPage>
    );
}
