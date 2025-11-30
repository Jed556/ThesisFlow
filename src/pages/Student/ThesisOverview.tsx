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
import { createSubmission, type SubmissionContext } from '../../utils/firebase/firestore/submissions';
import { uploadThesisFile } from '../../utils/firebase/storage/thesis';
import { THESIS_STAGE_METADATA, type StageGateOverrides } from '../../utils/thesisStageUtils';
import { findAndListenTerminalRequirements } from '../../utils/firebase/firestore/terminalRequirements';
import type { TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import type { PanelCommentReleaseMap } from '../../types/panelComment';
import { listenPanelCommentRelease, type PanelCommentContext } from '../../utils/firebase/firestore/panelComments';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { DEFAULT_YEAR } from '../../config/firestore';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
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

export default function StudentThesisOverviewPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [participants, setParticipants] = React.useState<Record<string, ConversationParticipant>>();
    const [terminalSubmissions, setTerminalSubmissions] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord | null>>
    >({});
    const [panelRelease, setPanelRelease] = React.useState<PanelCommentReleaseMap | null>(null);

    /** Build panel comment context from group */
    const panelCommentCtx: PanelCommentContext | null = React.useMemo(() => {
        if (!group) return null;
        return {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId: group.id,
        };
    }, [group]);

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
            setPanelRelease(null);
            return;
        }

        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => (
            findAndListenTerminalRequirements(thesis.id!, stageMeta.value, {
                onData: (records) => {
                    setTerminalSubmissions((prev) => ({
                        ...prev,
                        [stageMeta.value]: records[0] ?? null,
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

    React.useEffect(() => {
        if (!panelCommentCtx) {
            setPanelRelease(null);
            return;
        }

        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (release) => setPanelRelease(release),
            onError: (listenerError) => {
                console.error('Failed to listen for panel comment release states:', listenerError);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [panelCommentCtx]);

    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const submission = terminalSubmissions[stageMeta.value];
            acc[stageMeta.value] = submission?.status === 'approved';
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

        // Create submission record with file reference
        await createSubmission(submissionCtx, {
            status: 'under_review',
            submittedAt: result.fileAttachment.uploadDate
                ? new Date(result.fileAttachment.uploadDate)
                : new Date(),
            submittedBy: 'student',
            files: [result.fileAttachment],
        });
    }, [userUid, group]);

    const stageGateOverrides = React.useMemo<StageGateOverrides>(() => ({
        chapters: {
            'Post-Proposal': panelRelease?.proposal?.sent ?? false,
            'Post-Defense': panelRelease?.defense?.sent ?? false,
        },
    }), [panelRelease?.proposal?.sent, panelRelease?.defense?.sent]);

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
                    enforceTerminalRequirementSequence
                    terminalRequirementCompletionMap={terminalRequirementCompletionMap}
                    stageGateOverrides={stageGateOverrides}
                />
            )}
        </AnimatedPage>
    );
}
