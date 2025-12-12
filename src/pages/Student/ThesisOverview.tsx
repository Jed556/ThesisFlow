import * as React from 'react';
import { Alert, Skeleton, Stack, Typography } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData, ThesisStageName } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { ConversationParticipant } from '../../components/Conversation';
import type { WorkspaceUploadPayload } from '../../types/workspace';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import { listenThesesForParticipant, getThesisTeamMembers, type ThesisContext } from '../../utils/firebase/firestore/thesis';
import {
    createSubmission, submitDraftSubmission, deleteSubmission, type SubmissionContext,
} from '../../utils/firebase/firestore/submissions';
import {
    listenPanelCommentCompletion, listenPanelCommentRelease, type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentReleaseMap, type PanelCommentStage,
} from '../../types/panelComment';
import { isAnyTableReleasedForStage } from '../../utils/panelCommentUtils';
import { uploadThesisFile } from '../../utils/firebase/storage/thesis';
import { THESIS_STAGE_METADATA, getStageLabel, type StageGateOverrides } from '../../utils/thesisStageUtils';
import { findAndListenTerminalRequirements } from '../../utils/firebase/firestore/terminalRequirements';
import type { TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { DEFAULT_YEAR } from '../../config/firestore';
import { auditAndNotify, notifyDraftDeleted } from '../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Thesis Workspace',
    segment: 'student-thesis-workspace',
    icon: <SchoolIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type TeamMember = Awaited<ReturnType<typeof getThesisTeamMembers>> extends (infer Member)[]
    ? Member
    : never;

const formatUserName = (name: UserProfile['name']) => (
    [name.prefix, name.first, name.middle, name.last, name.suffix]
        .filter((part): part is string => Boolean(part))
        .join(' ')
);

/**
 * Maps PanelCommentStage to its corresponding thesis stage slug.
 * Panel comments 'proposal' are tied to 'pre-proposal' stage.
 * Panel comments 'defense' are tied to 'pre-defense' stage.
 */
const PANEL_COMMENT_STAGE_TO_THESIS_STAGE: Record<PanelCommentStage, ThesisStageName> = {
    'proposal': 'pre-proposal',
    'defense': 'pre-defense',
};

export default function StudentThesisOverviewPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [participants, setParticipants] = React.useState<Record<string, ConversationParticipant>>();
    const [terminalSubmissions, setTerminalSubmissions] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});
    // Panel comment release map - used to determine if Post stages should unlock
    const [panelCommentReleaseMap, setPanelCommentReleaseMap] = React.useState<PanelCommentReleaseMap>(
        createDefaultPanelCommentReleaseMap()
    );
    // Panel comment approval map - used to gate Post terminal requirements
    const [panelCommentApprovalMap, setPanelCommentApprovalMap] = React.useState<
        Partial<Record<ThesisStageName, boolean>>
    >({});

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                // Select first thesis record (user is already filtered as participant)
                const preferred = records[0] ?? null;
                setThesis(preferred ?? null);
                setIsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load student thesis:', listenerError);
                setError('Unable to load your thesis workspace right now.');
                setIsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!thesis?.id) {
            setParticipants(undefined);
            setTerminalSubmissions({});
            return;
        }

        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => (
            findAndListenTerminalRequirements(thesis.id!, stageMeta.value, {
                onData: (records) => {
                    setTerminalSubmissions((prev) => ({
                        ...prev,
                        [stageMeta.value]: records,
                    }));
                },
                onError: (listenerError) => {
                    console.error('Failed to listen for terminal requirement progress:', listenerError);
                },
            })
        ));

        let cancelled = false;
        void (async () => {
            try {
                // Need group context for getThesisTeamMembers - wait until group is loaded
                if (!group) {
                    return;
                }
                const thesisCtx: ThesisContext = {
                    year: DEFAULT_YEAR,
                    department: group.department ?? '',
                    course: group.course ?? '',
                    groupId: group.id,
                };
                const members: TeamMember[] = await getThesisTeamMembers(thesisCtx);
                if (cancelled) {
                    return;
                }
                const roster: Record<string, ConversationParticipant> = {};
                members.forEach((member) => {
                    roster[member.uid] = {
                        uid: member.uid,
                        displayName: formatUserName(member.name) || member.email,
                        roleLabel: member.thesisRole,
                    };
                });
                setParticipants(roster);
            } catch (teamError) {
                if (!cancelled) {
                    console.error('Failed to load thesis team members:', teamError);
                    setParticipants(undefined);
                }
            }
        })();

        return () => {
            cancelled = true;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesis?.id, group]);

    // Fetch group for panel comment context - load user's groups directly
    React.useEffect(() => {
        if (!userUid) {
            setGroup(null);
            return;
        }

        let cancelled = false;
        void (async () => {
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
            } catch (err) {
                console.error('Failed to fetch group for panel context:', err);
                if (!cancelled) {
                    setGroup(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userUid]);

    // Listen for panel comment RELEASE status - gates Post-Proposal/Post-Defense chapters
    React.useEffect(() => {
        if (!group?.id || !group?.department || !group?.course) {
            setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }

        const panelCommentCtx: PanelCommentContext = {
            year: DEFAULT_YEAR,
            department: group.department,
            course: group.course,
            groupId: group.id,
        };

        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (releaseMap) => {
                setPanelCommentReleaseMap(releaseMap);
            },
            onError: (err) => {
                console.error('Failed to listen for panel comment release:', err);
                setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            },
        });

        return () => unsubscribe();
    }, [group?.id, group?.department, group?.course]);

    // Listen for panel comment APPROVAL status - gates Post-Proposal/Post-Defense terminal requirements
    React.useEffect(() => {
        if (!group?.id || !group?.department || !group?.course) {
            setPanelCommentApprovalMap({});
            return;
        }

        const panelCommentCtx: PanelCommentContext = {
            year: DEFAULT_YEAR,
            department: group.department,
            course: group.course,
            groupId: group.id,
        };

        const stages: PanelCommentStage[] = ['proposal', 'defense'];
        const unsubscribers = stages.map((panelCommentStage) => (
            listenPanelCommentCompletion(panelCommentCtx, panelCommentStage, {
                onData: (allApproved) => {
                    // Map PanelCommentStage to ThesisStageName for lock map compatibility
                    const thesisStage = PANEL_COMMENT_STAGE_TO_THESIS_STAGE[panelCommentStage];
                    setPanelCommentApprovalMap((prev) => ({
                        ...prev,
                        [thesisStage]: allApproved,
                    }));
                },
                onError: (err) => {
                    console.error(`Failed to listen for panel comment approval (${panelCommentStage}):`, err);
                },
            })
        ));

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [group?.id, group?.department, group?.course]);

    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const submissions = terminalSubmissions[stageMeta.value] ?? [];
            // Stage is complete if there are submissions and ALL are approved
            acc[stageMeta.value] = submissions.length > 0 && submissions.every((s) => s.status === 'approved');
            return acc;
        }, {} as Record<ThesisStageName, boolean>);
    }, [terminalSubmissions]);

    const handleUploadChapter = React.useCallback(async (
        { thesisId, groupId, chapterId, chapterStage, file, year, department, course }: WorkspaceUploadPayload
    ) => {
        if (!userUid) {
            throw new Error('You must be signed in to upload a chapter.');
        }
        if (!group) {
            throw new Error('Group context is not available.');
        }

        const result = await uploadThesisFile({
            file,
            userUid,
            thesisId,
            groupId,
            chapterId,
            chapterStage,
            category: 'submission',
            metadata: { scope: 'student-workspace' },
            year: year ?? DEFAULT_YEAR,
            department: department ?? group.department ?? '',
            course: course ?? group.course ?? '',
        });

        const submissionId = result.fileAttachment.id ?? result.fileAttachment.url;
        if (!submissionId) {
            throw new Error('Upload failed to return a submission identifier.');
        }

        // Build submission context for hierarchical storage
        const submissionCtx: SubmissionContext = {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId,
            thesisId,
            stage: chapterStage,
            chapterId: String(chapterId),
        };

        // Create submission record with file reference - starts as 'draft' until student submits
        await createSubmission(submissionCtx, {
            status: 'draft',
            submittedAt: result.fileAttachment.uploadDate
                ? new Date(result.fileAttachment.uploadDate)
                : new Date(),
            submittedBy: 'student',
            files: [result.fileAttachment],
        });
    }, [userUid, group]);

    /**
     * Handler for submitting a draft for review
     */
    const handleSubmitDraft = React.useCallback(async (
        { thesisId, chapterId, stage, submissionId }: {
            thesisId: string; chapterId: number; stage: ThesisStageName; submissionId: string;
        }
    ) => {
        if (!group || !userUid) {
            throw new Error('Group context is not available.');
        }

        const submissionCtx: SubmissionContext = {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId: group.id ?? '',
            thesisId,
            stage,
            chapterId: String(chapterId),
        };

        await submitDraftSubmission(submissionCtx, submissionId);

        // Create audit notification for draft submission
        try {
            await auditAndNotify({
                group,
                userId: userUid,
                name: 'Draft Submitted for Review',
                description: `Chapter ${chapterId} draft has been submitted for expert review.`,
                category: 'submission',
                action: 'submission_created',
                targets: {
                    groupMembers: true,
                    adviser: true,
                    editor: true,
                    statistician: true,
                    excludeUserId: userUid,
                },
                details: { thesisId, chapterId, stage, submissionId },
                sendEmail: true,
            });
        } catch (auditError) {
            console.error('Failed to create audit notification:', auditError);
        }
    }, [group, userUid]);

    /**
     * Handler for deleting a draft submission
     */
    const handleDeleteDraft = React.useCallback(async (
        { thesisId, chapterId, stage, submissionId }: {
            thesisId: string; chapterId: number; stage: ThesisStageName; submissionId: string;
        }
    ) => {
        if (!group || !userUid) {
            throw new Error('Group context is not available.');
        }

        const submissionCtx: SubmissionContext = {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId: group.id ?? '',
            thesisId,
            stage,
            chapterId: String(chapterId),
        };

        await deleteSubmission(submissionCtx, submissionId);

        // Notify group members about the draft deletion (informational, no email)
        try {
            await notifyDraftDeleted({
                group,
                userId: userUid,
                chapterName: `Chapter ${chapterId}`,
                stageName: getStageLabel(stage),
                details: { thesisId, chapterId, stage, submissionId },
            });
        } catch (notifyError) {
            console.error('Failed to send draft deletion notification:', notifyError);
        }
    }, [group, userUid]);

    /**
     * Panel comment completion map based on RELEASE status.
     * This is used to unlock Post-Proposal/Post-Defense chapters.
     * When any panelist's table is released for a stage, the next stage chapters unlock.
     */
    const panelCommentCompletionMap = React.useMemo<Partial<Record<ThesisStageName, boolean>>>(() => {
        const stages: PanelCommentStage[] = ['proposal', 'defense'];
        return stages.reduce<Partial<Record<ThesisStageName, boolean>>>((acc, panelStage) => {
            const thesisStage = PANEL_COMMENT_STAGE_TO_THESIS_STAGE[panelStage];
            acc[thesisStage] = isAnyTableReleasedForStage(panelStage, panelCommentReleaseMap);
            return acc;
        }, {});
    }, [panelCommentReleaseMap]);

    /**
     * Stage gate overrides for terminal requirements.
     * Post-Proposal and Post-Defense terminals require panel comments to be APPROVED (not just released).
     * The gate is satisfied when panel comments for the preceding stage are all approved.
     */
    const stageGateOverrides = React.useMemo<StageGateOverrides>(() => ({
        terminalRequirements: {
            // Post-proposal terminal requires proposal panel comments to be approved
            'post-proposal': panelCommentApprovalMap['pre-proposal'] ?? false,
            // Post-defense terminal requires defense panel comments to be approved
            'post-defense': panelCommentApprovalMap['pre-defense'] ?? false,
        },
    }), [panelCommentApprovalMap]);

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={2} sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary">
                    Upload new chapter versions and review expert feedback organized per submission.
                </Typography>
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {isLoading ? (
                <Stack spacing={2}>
                    <Skeleton variant="text" width="50%" height={32} />
                    <Skeleton variant="rounded" height={420} />
                </Stack>
            ) : !thesis ? (
                <UnauthorizedNotice
                    title="Pending group approval"
                    description="Your thesis workspace will appear here once your research group is approved."
                    variant="box"
                />
            ) : !group?.members?.adviser ? (
                <UnauthorizedNotice
                    title="Assign a research adviser to continue"
                    description="Your thesis workspace unlocks after a research adviser accepts your request."
                    variant="box"
                />
            ) : (
                <ThesisWorkspace
                    thesisId={thesis.id}
                    groupId={group?.id}
                    year={DEFAULT_YEAR}
                    department={group?.department}
                    course={group?.course}
                    thesis={thesis}
                    participants={participants}
                    currentUserId={userUid ?? undefined}
                    isLoading={false}
                    allowCommenting={false}
                    emptyStateMessage="Select a chapter to upload your first version and unlock feedback."
                    onUploadChapter={handleUploadChapter}
                    onSubmitDraft={handleSubmitDraft}
                    onDeleteDraft={handleDeleteDraft}
                    enforceTerminalRequirementSequence
                    terminalRequirementCompletionMap={terminalRequirementCompletionMap}
                    panelCommentCompletionMap={panelCommentCompletionMap}
                    stageGateOverrides={stageGateOverrides}
                />
            )}
        </AnimatedPage>
    );
}
