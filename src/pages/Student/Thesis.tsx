import * as React from 'react';
import {
    Alert, Box, Button, Divider, IconButton, LinearProgress, List, ListItem, ListItemIcon,
    ListItemText, Paper, Skeleton, Stack, Step, StepContent, StepLabel, Stepper, Tooltip, Typography
} from '@mui/material';
import {
    School as SchoolIcon, Groups as GroupsIcon, PersonAdd as PersonAddIcon,
    Topic as TopicIcon, Article as ArticleIcon, Upload as UploadIcon, Event as EventIcon,
    CommentBank as CommentBankIcon, CalendarMonth as CalendarMonthIcon
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisChapter, ThesisData } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { PanelCommentReleaseMap, PanelCommentStage } from '../../types/panelComment';
import type { TopicProposalSetRecord } from '../../utils/firebase/firestore/topicProposals';
import type { ScheduleEvent } from '../../types/schedule';
import type { UserAuditEntry, UserAuditContext } from '../../types/audit';
import { AnimatedPage } from '../../components/Animate';
import { RecentAudits } from '../../components/AuditView';
import type { deriveChapterStatus } from '../../components/ThesisWorkspace/ChapterRail';
import { getThesisTeamMembersById, isTopicApproved } from '../../utils/thesisUtils';
import { hasRoleApproved } from '../../utils/expertUtils';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { listenTopicProposalSetsByGroup } from '../../utils/firebase/firestore/topicProposals';
import { listenEventsByThesisIds } from '../../utils/firebase/firestore/events';
import { listenChaptersForStage, type ChapterContext } from '../../utils/firebase/firestore/chapters';
import {
    listenPanelCommentRelease, listenPanelCommentCompletion, type PanelCommentContext
} from '../../utils/firebase/firestore/panelComments';
import { isAnyTableReleasedForStage } from '../../utils/panelCommentUtils';
import {
    findAndListenTerminalRequirements, type TerminalRequirementSubmissionRecord
} from '../../utils/firebase/firestore/terminalRequirements';
import {
    listenAllUserAuditEntries, buildUserAuditContextFromProfile
} from '../../utils/auditUtils';
import { onUserProfile } from '../../utils/firebase/firestore/user';
import type { UserProfile } from '../../types/profile';
import { THESIS_STAGE_METADATA } from '../../utils/thesisStageUtils';
import { createDefaultPanelCommentReleaseMap } from '../../types/panelComment';
import { DEFAULT_YEAR } from '../../config/firestore';
import { normalizeDateInput } from '../../utils/dateUtils';
import { useNavigate } from 'react-router';
import type { WorkflowStep } from '../../types/workflow';
import type { ThesisStageName } from '../../types/thesis';
import {
    resolveStepState, applyPrerequisiteLocks, getStepMeta, getActiveStepIndex, formatPrerequisiteMessage,
} from '../../utils/workflowUtils';
import StagesConfig from '../../config/stages.json';
import { useSegmentViewed } from '../../hooks';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 0,
    title: 'My Thesis',
    segment: 'thesis',
    icon: <SchoolIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type EventRecord = ScheduleEvent & { id: string };

type TeamMember = Awaited<ReturnType<typeof getThesisTeamMembersById>> extends (infer Member)[]
    ? Member
    : never;

/**
 * Check if a submission is fully approved by experts (adviser, editor, and optionally statistician)
 */
function isFullyApprovedByExperts(
    expertApprovals: ThesisChapter['submissions'][0]['expertApprovals'],
    hasStatistician: boolean
): boolean {
    if (!expertApprovals) return false;
    const hasAdviser = hasRoleApproved(expertApprovals, 'adviser');
    const hasEditor = hasRoleApproved(expertApprovals, 'editor');
    const hasStatisticianApproval = hasRoleApproved(expertApprovals, 'statistician');
    return hasAdviser && hasEditor && (!hasStatistician || hasStatisticianApproval);
}

/**
 * Derive chapter status from its submissions
 * Priority: latest submission status, or check if any approved/under_review/revision
 * Also checks expertApprovals for fully approved state
 */
function getChapterStatusFromSubmissions(
    chapter: ThesisChapter,
    hasStatistician = false
): ReturnType<typeof deriveChapterStatus> {
    const submissions = chapter.submissions ?? [];
    if (submissions.length === 0) {
        return 'not_submitted';
    }

    // Check the latest submission's status OR expertApprovals
    const latestSubmission = submissions[submissions.length - 1];
    if (latestSubmission?.status === 'approved' ||
        isFullyApprovedByExperts(latestSubmission?.expertApprovals, hasStatistician)) {
        return 'approved';
    }
    if (latestSubmission?.status === 'under_review') return 'under_review';
    if (latestSubmission?.status === 'revision_required') return 'revision_required';

    // Fallback: check if any submission is approved (by status or expertApprovals)
    const hasApproved = submissions.some((s) =>
        s.status === 'approved' || isFullyApprovedByExperts(s.expertApprovals, hasStatistician)
    );
    if (hasApproved) return 'approved';

    const hasUnderReview = submissions.some((s) => s.status === 'under_review');
    if (hasUnderReview) return 'under_review';

    const hasRevision = submissions.some((s) => s.status === 'revision_required');
    if (hasRevision) return 'revision_required';

    return 'not_submitted';
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
 * Check if any proposal entry has been marked as used for thesis
 */
function hasUsedProposal(proposalSets: TopicProposalSetRecord[]): boolean {
    return proposalSets.some((set) =>
        set.entries.some((entry) => entry.usedAsThesis === true)
    );
}

/**
 * Get the title of the first used-as-thesis proposal entry, or fallback to approved
 */
function getUsedOrApprovedProposalTitle(proposalSets: TopicProposalSetRecord[]): string | undefined {
    // First, look for the used-as-thesis entry
    for (const set of proposalSets) {
        const usedEntry = set.entries.find((entry) => entry.usedAsThesis === true);
        if (usedEntry) {
            return usedEntry.title;
        }
    }
    // Fallback to approved entry
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

/**
 * Check if a specific stage is completed based on thesis stages array
 */
function isStageCompleted(record: ThesisRecord | null, stageSlug: string): boolean {
    if (!record?.stages) return false;
    return record.stages.some(
        (s) => s.name === stageSlug && s.completedAt != null
    );
}

/**
 * Check if a specific stage has been started based on thesis stages array
 */
function isStageStarted(record: ThesisRecord | null, stageSlug: string): boolean {
    if (!record?.stages) return false;
    return record.stages.some((s) => s.name === stageSlug);
}

/**
 * Chapters organized by stage slug
 */
type StageChaptersMap = Record<string, ThesisChapter[]>;

/**
 * Maps stage slugs that trigger panel comments to their PanelCommentStage value.
 * Pre-proposal terminal completion unlocks 'proposal' panel comments.
 * Pre-defense terminal completion unlocks 'defense' panel comments.
 */
const STAGE_TO_PANEL_COMMENT_STAGE: Partial<Record<ThesisStageName, PanelCommentStage>> = {
    'pre-proposal': 'proposal',
    'pre-defense': 'defense',
};

/**
 * Maps PanelCommentStage to the next thesis stage that follows (whose chapters it unlocks).
 */
const PANEL_COMMENT_UNLOCKS_STAGE: Record<PanelCommentStage, ThesisStageName> = {
    'proposal': 'post-proposal',
    'defense': 'post-defense',
};

function buildThesisWorkflowSteps(
    record: ThesisRecord | null,
    members: TeamMember[],
    group: ThesisGroup | null,
    proposalSets: TopicProposalSetRecord[] = [],
    stageChaptersMap: StageChaptersMap = {},
    panelCommentReleaseMap?: PanelCommentReleaseMap,
    panelCommentCompletionMap?: Partial<Record<PanelCommentStage, boolean>>,
    terminalRequirementCompletionMap?: Partial<Record<ThesisStageName, boolean>>
): WorkflowStep[] {
    // Check proposal approval and usage status from proposal sets
    const proposalApproved = hasApprovedProposal(proposalSets);
    const proposalInUse = hasUsedProposal(proposalSets);
    const displayTitle = getUsedOrApprovedProposalTitle(proposalSets) || record?.title;
    const proposalsSubmitted = hasSubmittedProposals(proposalSets);

    // Common group state checks
    const groupStatus = group?.status;
    const isDraft = groupStatus === 'draft';
    const isInReview = groupStatus === 'review';
    const isActive = groupStatus === 'active';
    const isRejected = groupStatus === 'rejected';
    const hasGroup = Boolean(group);
    const totalMembers = members.length;
    const groupApproved = isActive || (totalMembers > 1 && groupStatus !== 'draft' && groupStatus !== 'review');

    const adviserAssigned = Boolean(group?.members?.adviser);
    const editorAssigned = Boolean(group?.members?.editor);
    const hasTopicProposals = Boolean(record?.title) || proposalsSubmitted;
    // Topic is considered complete for workflow when it's marked as "used" (not just approved)
    const topicComplete = proposalInUse || (record ? isTopicApproved(record) : false);
    // Topic is approved but not yet in use - student needs to click "Use This Topic"
    const topicApprovedNotUsed = proposalApproved && !proposalInUse;

    // Build group description based on current status
    let groupDescription: string;
    let groupState: WorkflowStep['state'] = hasGroup ? 'in-progress' : 'available';

    if (groupApproved) {
        groupDescription = `Group approved with ${totalMembers} members.`;
        groupState = 'completed';
    } else if (isInReview) {
        groupDescription = 'Group is awaiting approval from the Research Moderator.';
        groupState = 'in-progress';
    } else if (isRejected) {
        groupDescription = group?.rejectionReason
            ? `Group was rejected: ${group.rejectionReason}. Please update and resubmit.`
            : 'Group was rejected. Please review and resubmit.';
        groupState = 'available';
    } else if (isDraft) {
        groupDescription = 'Group created. Review your members and submit the group request when ready.';
        groupState = 'in-progress';
    } else if (hasGroup) {
        groupDescription = 'Awaiting Research Moderator approval.';
        groupState = 'in-progress';
    } else {
        groupDescription = 'Form your research group with team members and submit for moderator approval.';
    }

    const editorDescription = editorAssigned
        ? 'Research editor assigned.'
        : groupApproved
            ? 'Select and request approval from your research editor.'
            : 'Your research group must be approved before selecting an editor.';

    // Build initial setup steps
    const baseSteps: WorkflowStep[] = [
        {
            id: 'create-group',
            title: 'Create Research Group',
            description: groupDescription,
            completedMessage: `Your research group has been created and approved with ${totalMembers} members.`,
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
            state: editorAssigned ? 'completed' : 'available',
            actionLabel: editorAssigned ? undefined : 'Browse Editors',
            actionPath: '/recommendation',
            icon: <PersonAddIcon />,
            prerequisites: [
                { stepId: 'create-group', type: 'prerequisite' },
            ],
        },
        {
            id: 'submit-proposals',
            title: 'Submit Topic Proposals',
            description: topicComplete
                ? `Topic in use: "${displayTitle}"`
                : topicApprovedNotUsed
                    ? `Topic approved: "${displayTitle}". Click "Use This Topic" to proceed.`
                    : hasTopicProposals
                        ? 'Proposals submitted. Awaiting approval.'
                        : 'Upload up to 3 thesis title proposals for review and approval.',
            completedMessage: `Your topic "${displayTitle}" is now in use for your thesis.`,
            state: resolveStepState({ completed: topicComplete, started: hasTopicProposals || proposalApproved }),
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
                : topicComplete
                    ? 'Choose your research adviser now that your topic is in use.'
                    : topicApprovedNotUsed
                        ? 'Click "Use This Topic" on your approved proposal to unlock adviser selection.'
                        : 'Adviser selection unlocks after your topic proposal is approved and in use.',
            completedMessage: 'Research adviser has been assigned to your group.',
            state: resolveStepState({ completed: adviserAssigned, started: topicComplete && !adviserAssigned }),
            actionLabel: adviserAssigned ? undefined : 'Browse Advisers',
            actionPath: '/recommendation',
            icon: <PersonAddIcon />,
            prerequisites: [
                { stepId: 'submit-proposals', type: 'prerequisite' },
            ],
        },
    ];

    // Build stage-specific steps for each stage
    const stageSteps: WorkflowStep[] = [];
    let previousStepId = 'request-adviser';

    StagesConfig.stages.forEach((stageConfig) => {
        const stageSlug = stageConfig.slug as ThesisStageName;
        const stageName = stageConfig.name;
        const stageCompleted = isStageCompleted(record, stageSlug);
        const stageStarted = isStageStarted(record, stageSlug);

        // Chapter upload step for this stage
        const chapterStepId = `chapters-${stageSlug}`;
        const chapterPrerequisites: WorkflowStep['prerequisites'] = [
            { stepId: previousStepId, type: 'prerequisite' },
        ];

        // Check chapter status for this stage using the chapters map
        const stageChapters = stageChaptersMap[stageSlug] ?? [];
        const stageChaptersSubmitted = stageChapters.some(
            (ch) => getChapterStatusFromSubmissions(ch) !== 'not_submitted'
        );
        const stageChaptersApproved = stageChapters.length > 0 && stageChapters.every(
            (ch) => getChapterStatusFromSubmissions(ch) === 'approved'
        );

        let chapterDescription: string;
        if (stageChaptersApproved && stageChapters.length > 0) {
            chapterDescription = `All ${stageChapters.length} chapters approved for ${stageName}.`;
        } else if (stageChaptersSubmitted) {
            const approvedCount = stageChapters.filter(
                (ch) => getChapterStatusFromSubmissions(ch) === 'approved'
            ).length;
            chapterDescription = `${approvedCount}/${stageChapters.length} chapters approved for ${stageName}.`;
        } else {
            chapterDescription = `Submit your thesis chapters for ${stageName} review.`;
        }

        stageSteps.push({
            id: chapterStepId,
            title: `${stageName} - Upload Chapters`,
            description: chapterDescription,
            completedMessage: `All chapters for ${stageName} have been approved.`,
            state: resolveStepState({ completed: stageChaptersApproved, started: stageChaptersSubmitted }),
            actionLabel: 'View Chapters',
            actionPath: `/student-thesis-workspace?stage=${stageSlug}`,
            icon: <ArticleIcon />,
            prerequisites: chapterPrerequisites,
        });

        // Terminal requirements step for this stage
        const terminalStepId = `terminal-${stageSlug}`;
        // Use terminal requirement completion map if available, otherwise fall back to stage completion
        const terminalCompleted = terminalRequirementCompletionMap?.[stageSlug] ?? stageCompleted;
        const terminalStarted = stageStarted && stageChaptersApproved;

        let terminalDescription: string;
        if (terminalCompleted) {
            terminalDescription = `${stageName} requirements completed.`;
        } else if (terminalStarted) {
            terminalDescription = `Submit terminal requirements for ${stageName}.`;
        } else {
            terminalDescription = `Complete chapter reviews to unlock ${stageName} requirements.`;
        }

        stageSteps.push({
            id: terminalStepId,
            title: `${stageName} - Terminal Requirements`,
            description: terminalDescription,
            completedMessage: `${stageName} requirements completed successfully.`,
            state: resolveStepState({ completed: terminalCompleted, started: terminalStarted }),
            actionLabel: 'View Requirements',
            actionPath: `/terminal-requirements?stage=${stageSlug}`,
            icon: <UploadIcon />,
            prerequisites: [
                { stepId: chapterStepId, type: 'prerequisite' },
            ],
        });

        // Update previous step ID for next stage's prerequisites
        previousStepId = terminalStepId;

        // Add panel comment step after terminal requirements for specific stages
        const panelCommentStage = STAGE_TO_PANEL_COMMENT_STAGE[stageSlug];
        if (panelCommentStage) {
            const panelCommentStepId = `panel-comments-${panelCommentStage}`;
            // Check if any panelist table has been released for this stage
            const isReleased = isAnyTableReleasedForStage(panelCommentStage, panelCommentReleaseMap);
            const nextStageName = PANEL_COMMENT_UNLOCKS_STAGE[panelCommentStage];
            const nextStageConfig = StagesConfig.stages.find((s) => s.slug === nextStageName);
            const nextStageLabel = nextStageConfig?.name ?? nextStageName;

            let panelCommentDescription: string;
            let panelCommentState: WorkflowStep['state'];

            // Step is complete when panel comments have been released (students can view and address them)
            // Step is available when terminal is complete but waiting for release
            // Step is locked when terminal requirements not complete
            if (isReleased) {
                panelCommentDescription = 'Panel comments released. Review and address panel feedback.';
                panelCommentState = 'completed';
            } else if (terminalCompleted) {
                panelCommentDescription = `Waiting for panel comments to be released for ${stageName}.`;
                panelCommentState = 'available';
            } else {
                panelCommentDescription = `Complete ${stageName} terminal requirements to unlock panel comments.`;
                panelCommentState = 'locked';
            }

            stageSteps.push({
                id: panelCommentStepId,
                title: `${nextStageLabel} Panel Comments`,
                description: panelCommentDescription,
                completedMessage: `Panel comments for ${stageName} have been released.`,
                state: panelCommentState,
                actionLabel: 'View Comments',
                actionPath: `/panel-comments?stage=${panelCommentStage}`,
                icon: <CommentBankIcon />,
                prerequisites: [
                    { stepId: terminalStepId, type: 'prerequisite' },
                ],
            });

            previousStepId = panelCommentStepId;
        }
    });

    return applyPrerequisiteLocks([...baseSteps, ...stageSteps]);
}

function formatDateLabel(value?: string | Date | null): string {
    const date = normalizeDateInput(value ?? undefined);
    return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

/**
 * Calculate the overall completion percentage from chapters across all stages.
 * @param stageChaptersMap - Chapters organized by stage slug
 * @returns Completion percentage between 0 and 100
 */
function computeThesisProgressPercent(stageChaptersMap: StageChaptersMap): number {
    // Flatten all chapters from all stages
    const allChapters = Object.values(stageChaptersMap).flat();
    if (allChapters.length === 0) {
        return 0;
    }
    const approvedCount = allChapters.filter(
        (chapter) => getChapterStatusFromSubmissions(chapter) === 'approved'
    ).length;
    return (approvedCount / allChapters.length) * 100;
}

/**
 * Main thesis overview page for students, showing progress, chapters, and team members.
 */
export default function ThesisPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const navigate = useNavigate();

    // Mark audit notifications as page-viewed when visiting this page
    useSegmentViewed({ segment: 'thesis' });

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [userTheses, setUserTheses] = React.useState<ThesisRecord[]>([]);
    const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [proposalSets, setProposalSets] = React.useState<TopicProposalSetRecord[]>([]);
    const [stageChaptersMap, setStageChaptersMap] = React.useState<StageChaptersMap>({});
    const [progress, setProgress] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [hasNoThesis, setHasNoThesis] = React.useState<boolean>(false);
    const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());

    // Panel comment release state
    const [panelCommentReleaseMap, setPanelCommentReleaseMap] = React.useState(
        createDefaultPanelCommentReleaseMap()
    );

    // Panel comment completion state (all comments approved per stage)
    const [panelCommentCompletionMap, setPanelCommentCompletionMap] = React.useState<
        Partial<Record<PanelCommentStage, boolean>>
    >({});

    // Terminal requirement submissions by stage
    const [terminalSubmissionsByStage, setTerminalSubmissionsByStage] = React.useState<
        Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>
    >({} as Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>);

    // Upcoming events state
    const [upcomingEvents, setUpcomingEvents] = React.useState<EventRecord[]>([]);
    const [eventsLoading, setEventsLoading] = React.useState<boolean>(false);

    // Recent audits state
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [recentAudits, setRecentAudits] = React.useState<UserAuditEntry[]>([]);
    const [auditsLoading, setAuditsLoading] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setUserTheses([]);
            setTeamMembers([]);
            setStageChaptersMap({});
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
            setStageChaptersMap({});
            setProgress(0);
            setHasNoThesis(true);
            return;
        }

        // Select thesis - prefer one where user is the group leader
        const candidate = userTheses[0];
        setThesis(candidate);
        // Progress will be calculated when chapters are loaded
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

    // Load chapters for all stages when thesis and group are available
    React.useEffect(() => {
        if (!thesis?.id || !group?.id || !group.year || !group.department || !group.course) {
            setStageChaptersMap({});
            setProgress(0);
            return;
        }

        // Create listeners for each stage
        const unsubscribers: (() => void)[] = [];
        const chaptersMap: StageChaptersMap = {};

        StagesConfig.stages.forEach((stageConfig) => {
            const stageSlug = stageConfig.slug;
            const ctx: ChapterContext = {
                year: group.year as string,
                department: group.department as string,
                course: group.course as string,
                groupId: group.id,
                thesisId: thesis.id,
                stage: stageSlug,
            };

            const unsubscribe = listenChaptersForStage(ctx, {
                onData: (chapters) => {
                    // Update the chapters map for this stage
                    setStageChaptersMap((prev) => {
                        const updated = { ...prev, [stageSlug]: chapters };
                        // Recalculate progress with updated chapters
                        setProgress(computeThesisProgressPercent(updated));
                        return updated;
                    });
                },
                onError: (err) => {
                    console.error(`Failed to load chapters for stage ${stageSlug}:`, err);
                },
            });

            unsubscribers.push(unsubscribe);
            chaptersMap[stageSlug] = [];
        });

        // Initialize empty map
        setStageChaptersMap(chaptersMap);

        return () => {
            unsubscribers.forEach((unsub) => unsub());
        };
    }, [thesis?.id, group?.id, group?.year, group?.department, group?.course]);

    // Load upcoming events when thesis is available
    React.useEffect(() => {
        if (!thesis?.id) {
            setUpcomingEvents([]);
            return;
        }

        setEventsLoading(true);
        const unsubscribe = listenEventsByThesisIds([thesis.id], {
            onData: (events) => {
                // Filter to only show upcoming events (starting from now)
                const now = new Date();
                const upcoming = events.filter((event) => {
                    const eventStart = new Date(event.startDate);
                    return eventStart >= now;
                }).slice(0, 5); // Show max 5 upcoming events
                setUpcomingEvents(upcoming);
                setEventsLoading(false);
            },
            onError: (err) => {
                console.error('Failed to load events:', err);
                setUpcomingEvents([]);
                setEventsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesis?.id]);

    // Build panel comment context from group
    const panelCommentCtx: PanelCommentContext | null = React.useMemo(() => {
        if (!group) return null;
        return {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId: group.id,
        };
    }, [group]);

    // Listen for panel comment release status
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }

        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (releaseMap) => {
                setPanelCommentReleaseMap(releaseMap);
            },
            onError: (err) => {
                console.error('Failed to load panel comment release status:', err);
                setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            },
        });

        return () => {
            unsubscribe();
        };
    }, [panelCommentCtx]);

    // Listen for panel comment completion (all comments approved) for each stage
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setPanelCommentCompletionMap({});
            return;
        }

        // Listen for both proposal and defense stages
        const stages: PanelCommentStage[] = ['proposal', 'defense'];
        const unsubscribers = stages.map((stage) =>
            listenPanelCommentCompletion(panelCommentCtx, stage, {
                onData: (isComplete) => {
                    setPanelCommentCompletionMap((prev) => ({
                        ...prev,
                        [stage]: isComplete,
                    }));
                },
                onError: (err) => {
                    console.error(`Failed to listen for panel comment completion (${stage}):`, err);
                },
            })
        );

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [panelCommentCtx]);

    // Listen for terminal requirement submissions for each stage
    React.useEffect(() => {
        if (!thesis?.id) {
            setTerminalSubmissionsByStage({} as Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>);
            return;
        }

        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => {
            const stageValue = stageMeta.value as ThesisStageName;
            return findAndListenTerminalRequirements(thesis.id, stageValue, {
                onData: (records) => {
                    setTerminalSubmissionsByStage((prev) => ({
                        ...prev,
                        [stageValue]: records,
                    }));
                },
                onError: (listenerError) => {
                    console.error(`Terminal requirement listener error for ${stageValue}:`, listenerError);
                },
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesis?.id]);

    // Compute terminal requirement completion map from submissions
    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const stageValue = stageMeta.value as ThesisStageName;
            const submissions = terminalSubmissionsByStage[stageValue] ?? [];
            // Stage is complete if there are submissions and ALL are approved
            acc[stageValue] = submissions.length > 0 && submissions.every((s) => s.status === 'approved');
            return acc;
        }, {} as Record<ThesisStageName, boolean>);
    }, [terminalSubmissionsByStage]);

    // Load user profile for audits
    React.useEffect(() => {
        if (!userUid) {
            setUserProfile(null);
            return;
        }

        const unsubscribe = onUserProfile(userUid, (profileData) => {
            setUserProfile(profileData);
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    // Build user audit context
    const userAuditContext = React.useMemo<UserAuditContext | null>(() => {
        if (!userProfile?.uid) return null;
        return buildUserAuditContextFromProfile(userProfile);
    }, [userProfile]);

    // Listen to recent audits for the user
    React.useEffect(() => {
        if (!userUid || !userAuditContext) {
            setRecentAudits([]);
            return;
        }

        setAuditsLoading(true);

        const unsubscribe = listenAllUserAuditEntries(
            userUid,
            {
                onData: (entries: UserAuditEntry[]) => {
                    // Sort by timestamp descending (most recent first)
                    const sorted = [...entries].sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                    setRecentAudits(sorted);
                    setAuditsLoading(false);
                },
                onError: (auditError: Error) => {
                    console.error('Error listening to audits:', auditError);
                    setRecentAudits([]);
                    setAuditsLoading(false);
                },
            },
            userAuditContext
        );

        return () => {
            unsubscribe?.();
        };
    }, [userUid, userAuditContext]);

    // Compute workflow steps before any conditional returns (hooks must be called unconditionally)
    const workflowSteps = React.useMemo(
        () => buildThesisWorkflowSteps(
            thesis, teamMembers, group, proposalSets, stageChaptersMap,
            panelCommentReleaseMap, panelCommentCompletionMap, terminalRequirementCompletionMap
        ),
        [thesis, teamMembers, group, proposalSets, stageChaptersMap,
            panelCommentReleaseMap, panelCommentCompletionMap, terminalRequirementCompletionMap]
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

    // Ref for stepper container to enable auto-scroll
    const stepperContainerRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to current step when activeStepIndex changes
    React.useEffect(() => {
        if (stepperContainerRef.current && activeStepIndex >= 0) {
            const stepElements = stepperContainerRef.current.querySelectorAll('.MuiStep-root');
            const activeStep = stepElements[activeStepIndex] as HTMLElement;
            if (activeStep) {
                // Scroll the step into view with smooth behavior
                activeStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeStepIndex]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 120px)' }}>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Paper sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Skeleton variant="text" width={180} height={32} sx={{ mb: 1 }} />
                            <Skeleton variant="text" width={300} height={20} sx={{ mb: 2 }} />
                            <Stack spacing={2} sx={{ flex: 1 }}>
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <Skeleton key={idx} variant="rectangular" height={60} />
                                ))}
                            </Stack>
                        </Paper>
                    </Box>
                    <Box
                        sx={{
                            width: 340,
                            display: { xs: 'none', lg: 'flex' },
                            flexDirection: 'column',
                        }}
                    >
                        <Stack spacing={2} sx={{ height: '100%' }}>
                            <Skeleton
                                variant="rectangular"
                                height={100}
                                sx={{ borderRadius: 1, flexShrink: 0 }}
                            />
                            <Skeleton
                                variant="rectangular"
                                sx={{ borderRadius: 1, flex: 1 }}
                            />
                            <Skeleton
                                variant="rectangular"
                                sx={{ borderRadius: 1, flex: 1 }}
                            />
                        </Stack>
                    </Box>
                </Box>
            </AnimatedPage>
        );
    }

    if (loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 120px)' }}>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Paper sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Skeleton variant="text" width={180} height={32} sx={{ mb: 1 }} />
                            <Skeleton variant="text" width={300} height={20} sx={{ mb: 2 }} />
                            <Stack spacing={2} sx={{ flex: 1 }}>
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <Skeleton key={idx} variant="rectangular" height={60} />
                                ))}
                            </Stack>
                        </Paper>
                    </Box>
                    <Box
                        sx={{
                            width: 340,
                            display: { xs: 'none', lg: 'flex' },
                            flexDirection: 'column',
                        }}
                    >
                        <Stack spacing={2} sx={{ height: '100%' }}>
                            <Skeleton
                                variant="rectangular"
                                height={100}
                                sx={{ borderRadius: 1, flexShrink: 0 }}
                            />
                            <Skeleton
                                variant="rectangular"
                                sx={{ borderRadius: 1, flex: 1 }}
                            />
                            <Skeleton
                                variant="rectangular"
                                sx={{ borderRadius: 1, flex: 1 }}
                            />
                        </Stack>
                    </Box>
                </Box>
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
        // Show workflow even without thesis record - with sidebar layout
        const sidebarWidth = 340;

        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 120px)' }}>
                    {/* Main Content - Left Side */}
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Fixed Header */}
                            <Box sx={{ flexShrink: 0 }}>
                                <Typography variant="h4" gutterBottom>
                                    My Thesis Journey
                                </Typography>
                                <Typography
                                    variant="body1"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                >
                                    Follow these steps to complete your thesis from group formation
                                    to final submission.
                                </Typography>
                            </Box>

                            {/* Scrollable Stepper */}
                            <Box
                                sx={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    pr: 1,
                                    '&::-webkit-scrollbar': { width: 6 },
                                    '&::-webkit-scrollbar-thumb': {
                                        bgcolor: 'action.hover',
                                        borderRadius: 3,
                                    },
                                }}
                            >
                                <Stepper
                                    orientation="vertical"
                                    activeStep={activeStepIndex}
                                >
                                    {workflowSteps.map((step) => {
                                        const stepMeta = getStepMeta(step);
                                        const isExpanded = expandedSteps.has(step.id);
                                        const isLocked = step.state === 'locked';
                                        const isStepCompleted = step.state === 'completed';
                                        const iconColor = isStepCompleted
                                            ? 'success.main'
                                            : undefined;
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
                                                    onClick={() =>
                                                        handleStepToggle(step.id, stepMeta.expandable)
                                                    }
                                                    sx={{
                                                        cursor: stepMeta.expandable
                                                            ? 'pointer'
                                                            : 'default',
                                                        opacity: stepMeta.accessible ? 1 : 0.5,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body1"
                                                        color={stepTitleColor}
                                                    >
                                                        {step.title}
                                                    </Typography>
                                                </StepLabel>
                                                <StepContent>
                                                    {isLocked ? (
                                                        <Typography
                                                            variant="body2"
                                                            color="text.disabled"
                                                            sx={{ fontStyle: 'italic' }}
                                                        >
                                                            {formatPrerequisiteMessage(
                                                                step,
                                                                workflowSteps
                                                            )}
                                                        </Typography>
                                                    ) : (
                                                        <>
                                                            <Typography
                                                                variant="body2"
                                                                sx={{ mb: 2 }}
                                                            >
                                                                {stepMeta.displayMessage}
                                                            </Typography>
                                                            {stepMeta.showActionButton &&
                                                                step.actionPath &&
                                                                step.actionLabel && (
                                                                    <Button
                                                                        variant="contained"
                                                                        size="small"
                                                                        onClick={() =>
                                                                            handleNavigateToStep(
                                                                                step.actionPath
                                                                            )
                                                                        }
                                                                    >
                                                                        {step.actionLabel}
                                                                    </Button>
                                                                )}
                                                            {stepMeta.showActionButton &&
                                                                !step.actionPath &&
                                                                step.actionLabel && (
                                                                    <Button
                                                                        variant="outlined"
                                                                        size="small"
                                                                        disabled
                                                                    >
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
                            </Box>
                        </Paper>
                    </Box>

                    {/* Sidebar - Right Side (Fixed) */}
                    <Box
                        sx={{
                            width: sidebarWidth,
                            flexShrink: 0,
                            display: { xs: 'none', lg: 'flex' },
                            flexDirection: 'column',
                        }}
                    >
                        <Stack spacing={2} sx={{ height: '100%' }}>
                            {/* Progress Card - Shows 0% when no thesis */}
                            <Paper sx={{ p: 2.5, flexShrink: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 600, mb: 1 }}
                                >
                                    Getting Started
                                </Typography>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ mb: 0.5 }}
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        Progress
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, color: 'text.secondary' }}
                                    >
                                        0%
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={0}
                                    sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: 'action.hover',
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mt: 1 }}
                                >
                                    Start your thesis journey
                                </Typography>
                            </Paper>

                            {/* Upcoming Events Card - Flex to fill space */}
                            <Paper
                                sx={{
                                    p: 2.5,
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0,
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ mb: 1.5, flexShrink: 0 }}
                                >
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <EventIcon color="primary" fontSize="small" />
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            Upcoming Events
                                        </Typography>
                                    </Stack>
                                    <Tooltip title="View Calendar">
                                        <IconButton
                                            size="small"
                                            onClick={() => navigate('/calendar')}
                                            sx={{
                                                color: 'primary.main',
                                                '&:hover': { bgcolor: 'action.hover' },
                                            }}
                                        >
                                            <CalendarMonthIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                                <Box
                                    sx={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <CalendarMonthIcon
                                        sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        No upcoming events
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={() => navigate('/calendar')}
                                        sx={{ mt: 1 }}
                                    >
                                        View Calendar
                                    </Button>
                                </Box>
                            </Paper>

                            {/* Recent Updates Card - Flex to fill space */}
                            <Paper
                                sx={{
                                    p: 2.5,
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0,
                                }}
                            >
                                <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <RecentAudits
                                        audits={recentAudits}
                                        loading={auditsLoading}
                                        userRole={session?.user?.role}
                                        maxItems={5}
                                        showAvatars
                                        showCategories
                                        title="Recent Updates"
                                        showViewAll
                                        viewAllPath="/audits"
                                        emptyMessage="No recent updates"
                                    />
                                </Box>
                            </Paper>
                        </Stack>
                    </Box>
                </Box>
            </AnimatedPage>
        );
    }

    // Sidebar width for fixed positioning
    const sidebarWidth = 340;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 120px)' }}>
                {/* Main Content - Left Side */}
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Thesis Workflow */}
                    <Paper
                        sx={{
                            p: 3,
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Fixed Header */}
                        <Box sx={{ flexShrink: 0 }}>
                            <Typography variant="h5" gutterBottom>
                                Thesis Workflow
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Follow these steps to complete your thesis journey.
                            </Typography>
                        </Box>

                        {/* Scrollable Stepper */}
                        <Box
                            ref={stepperContainerRef}
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                pr: 1,
                                '&::-webkit-scrollbar': { width: 6 },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: 'action.hover',
                                    borderRadius: 3,
                                },
                            }}
                        >
                            <Stepper orientation="vertical" activeStep={activeStepIndex}>
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
                                                onClick={() =>
                                                    handleStepToggle(step.id, stepMeta.expandable)
                                                }
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
                                                    <Typography
                                                        variant="body2"
                                                        color="text.disabled"
                                                        sx={{ fontStyle: 'italic' }}
                                                    >
                                                        {formatPrerequisiteMessage(step, workflowSteps)}
                                                    </Typography>
                                                ) : (
                                                    <>
                                                        <Typography variant="body2" sx={{ mb: 2 }}>
                                                            {stepMeta.displayMessage}
                                                        </Typography>
                                                        {stepMeta.showActionButton &&
                                                            step.actionPath &&
                                                            step.actionLabel && (
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    onClick={() =>
                                                                        handleNavigateToStep(step.actionPath)
                                                                    }
                                                                >
                                                                    {step.actionLabel}
                                                                </Button>
                                                            )}
                                                        {stepMeta.showActionButton &&
                                                            !step.actionPath &&
                                                            step.actionLabel && (
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
                        </Box>
                    </Paper>
                </Box>

                {/* Sidebar - Right Side (Fixed) */}
                <Box
                    sx={{
                        width: sidebarWidth,
                        flexShrink: 0,
                        display: { xs: 'none', lg: 'flex' },
                        flexDirection: 'column',
                    }}
                >
                    <Stack spacing={2} sx={{ height: '100%' }}>
                        {/* Progress Card with Thesis Title */}
                        <Paper sx={{ p: 2.5, flexShrink: 0 }}>
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                }}
                            >
                                {thesis.title}
                            </Typography>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 0.5 }}
                            >
                                <Typography variant="body2" color="text.secondary">
                                    Progress
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                        color: (theme) =>
                                            progress >= 100
                                                ? theme.palette.success.main
                                                : progress >= 50
                                                    ? theme.palette.primary.main
                                                    : theme.palette.warning.main,
                                    }}
                                >
                                    {Math.round(progress)}%
                                </Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: 'action.hover',
                                }}
                            />
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 1 }}
                            >
                                {progress >= 100
                                    ? 'All chapters approved!'
                                    : `${Math.round(progress)}% of chapters completed`}
                            </Typography>
                        </Paper>

                        {/* Upcoming Events Card - Flex to fill space */}
                        <Paper sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 1.5, flexShrink: 0 }}
                            >
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <EventIcon color="primary" fontSize="small" />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Upcoming Events
                                    </Typography>
                                </Stack>
                                <Tooltip title="View Calendar">
                                    <IconButton
                                        size="small"
                                        onClick={() => navigate('/calendar')}
                                        sx={{
                                            color: 'primary.main',
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                    >
                                        <CalendarMonthIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                {eventsLoading ? (
                                    <Stack spacing={1}>
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <Skeleton key={idx} variant="rectangular" height={40} />
                                        ))}
                                    </Stack>
                                ) : upcomingEvents.length > 0 ? (
                                    <List disablePadding dense>
                                        {upcomingEvents.map((event, index) => (
                                            <React.Fragment key={event.id}>
                                                {index > 0 && <Divider />}
                                                <ListItem
                                                    disableGutters
                                                    disablePadding
                                                    sx={{ py: 0.75 }}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <EventIcon fontSize="small" color="action" />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={event.title}
                                                        secondary={new Date(
                                                            event.startDate
                                                        ).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                        slotProps={{
                                                            primary: {
                                                                variant: 'body2',
                                                                fontWeight: 500,
                                                                noWrap: true,
                                                            },
                                                            secondary: { variant: 'caption' },
                                                        }}
                                                    />
                                                </ListItem>
                                            </React.Fragment>
                                        ))}
                                    </List>
                                ) : (
                                    <Box
                                        sx={{
                                            textAlign: 'center',
                                            py: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100%',
                                        }}
                                    >
                                        <CalendarMonthIcon
                                            sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                            No upcoming events
                                        </Typography>
                                        <Button
                                            size="small"
                                            onClick={() => navigate('/calendar')}
                                            sx={{ mt: 1 }}
                                        >
                                            View Calendar
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        </Paper>

                        {/* Recent Updates Card - Flex to fill space */}
                        <Paper sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                <RecentAudits
                                    audits={recentAudits}
                                    loading={auditsLoading}
                                    userRole={session?.user?.role}
                                    maxItems={5}
                                    showAvatars
                                    showCategories
                                    title="Recent Updates"
                                    showViewAll
                                    viewAllPath="/audits"
                                    emptyMessage="No recent updates"
                                />
                            </Box>
                        </Paper>
                    </Stack>
                </Box>
            </Box>
        </AnimatedPage>
    );
}
