import * as React from 'react';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ReviewerAssignment, ThesisWithGroupContext } from '../../utils/firebase/firestore/thesis';
import type { ThesisStageName } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceChapterDecisionPayload, WorkspaceCommentPayload, WorkspaceFilterConfig } from '../../types/workspace';
import { getReviewerAssignmentsForUser, findThesisById } from '../../utils/firebase/firestore/thesis';
import { createChat } from '../../utils/firebase/firestore/chat';
import { updateSubmissionDecision } from '../../utils/firebase/firestore/submissions';
import { uploadConversationAttachments } from '../../utils/firebase/storage/conversation';
import { getDisplayName } from '../../utils/userUtils';
import { THESIS_STAGE_METADATA } from '../../utils/thesisStageUtils';
import { findAndListenTerminalRequirements } from '../../utils/firebase/firestore/terminalRequirements';
import type { TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'Thesis Overview',
    segment: 'statistician-thesis-overview',
    icon: <SchoolIcon />,
    roles: ['statistician'],
};

export default function StatisticianThesisOverviewPage() {
    const session = useSession<Session>();
    const statisticianUid = session?.user?.uid ?? '';

    const [assignments, setAssignments] = React.useState<ReviewerAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
    const [selectedThesisId, setSelectedThesisId] = React.useState<string>('');
    const [thesis, setThesis] = React.useState<ThesisWithGroupContext | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(false);
    const [displayNames, setDisplayNames] = React.useState<Record<string, string>>({});
    const [error, setError] = React.useState<string | null>(null);
    const [submissionByStage, setSubmissionByStage] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});

    const resolveDisplayName = React.useCallback((uid?: string | null) => {
        if (!uid) {
            return 'Unknown user';
        }
        return displayNames[uid] ?? uid;
    }, [displayNames]);

    const hydrateDisplayNames = React.useCallback(async (uids: (string | undefined | null)[]) => {
        const unique = Array.from(new Set(
            uids.filter((uid): uid is string => Boolean(uid && !displayNames[uid]))
        ));
        if (!unique.length) {
            return;
        }
        const results = await Promise.all(unique.map(async (uid) => {
            try {
                const name = await getDisplayName(uid);
                return [uid, name] as const;
            } catch (err) {
                console.error('Failed to resolve display name:', err);
                return [uid, uid] as const;
            }
        }));
        setDisplayNames((prev) => {
            const next = { ...prev };
            results.forEach(([uid, name]) => {
                next[uid] = name;
            });
            return next;
        });
    }, [displayNames]);

    React.useEffect(() => {
        let cancelled = false;

        const loadAssignments = async () => {
            if (!statisticianUid) {
                setAssignments([]);
                setAssignmentsLoading(false);
                return;
            }
            setAssignmentsLoading(true);
            setError(null);
            try {
                const rows = await getReviewerAssignmentsForUser('statistician', statisticianUid);
                if (!cancelled) {
                    setAssignments(rows);
                }
            } catch (err) {
                console.error('Failed to load statistician assignments:', err);
                if (!cancelled) {
                    setAssignments([]);
                    setError('Unable to load your assigned theses right now.');
                }
            } finally {
                if (!cancelled) {
                    setAssignmentsLoading(false);
                }
            }
        };

        void loadAssignments();
        return () => {
            cancelled = true;
        };
    }, [statisticianUid]);

    React.useEffect(() => {
        if (assignments.length && !selectedThesisId) {
            setSelectedThesisId(assignments[0].thesisId);
        } else if (!assignments.length) {
            setSelectedThesisId('');
        }
    }, [assignments, selectedThesisId]);

    React.useEffect(() => {
        let cancelled = false;

        const loadThesis = async () => {
            if (!selectedThesisId) {
                setThesis(null);
                setSubmissionByStage({});
                return;
            }
            setThesisLoading(true);
            setError(null);
            try {
                const data = await findThesisById(selectedThesisId);
                if (!cancelled) {
                    setThesis(data);
                    await hydrateDisplayNames([
                        data?.leader,
                        ...(data?.members ?? []),
                        data?.adviser,
                        data?.editor,
                        data?.statistician,
                    ]);
                }
            } catch (err) {
                console.error('Failed to load thesis data:', err);
                if (!cancelled) {
                    setError('Failed to load thesis details. Please try again later.');
                    setThesis(null);
                }
            } finally {
                if (!cancelled) {
                    setThesisLoading(false);
                }
            }
        };

        void loadThesis();
        return () => {
            cancelled = true;
        };
    }, [selectedThesisId, hydrateDisplayNames]);

    React.useEffect(() => {
        if (!thesis?.id) {
            setSubmissionByStage({});
            return;
        }

        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => (
            findAndListenTerminalRequirements(thesis.id!, stageMeta.value, {
                onData: (records) => {
                    setSubmissionByStage((prev) => ({
                        ...prev,
                        [stageMeta.value]: records,
                    }));
                },
                onError: (listenerError) => {
                    console.error('Failed to listen for statistician terminal requirement submissions:', listenerError);
                },
            })
        ));

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesis?.id]);

    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const records = submissionByStage[stageMeta.value] ?? [];
            // Stage is complete if there are submissions and ALL are approved
            acc[stageMeta.value] = records.length > 0 && records.every((r) => r.status === 'approved');
            return acc;
        }, {} as Record<ThesisStageName, boolean>);
    }, [submissionByStage]);

    const participants = React.useMemo(() => {
        if (!thesis) {
            return undefined;
        }
        const map: Record<string, ConversationParticipant> = {};
        const register = (uid?: string | null, roleLabel?: string) => {
            if (!uid) {
                return;
            }
            map[uid] = {
                uid,
                displayName: resolveDisplayName(uid),
                roleLabel,
            };
        };
        register(thesis.leader, 'Leader');
        thesis.members?.forEach((uid) => register(uid, 'Member'));
        register(thesis.adviser, 'Adviser');
        register(thesis.editor, 'Editor');
        register(thesis.statistician, 'Statistician');
        if (statisticianUid && !map[statisticianUid]) {
            register(statisticianUid, 'You');
        }
        return map;
    }, [thesis, resolveDisplayName, statisticianUid]);

    const filters: WorkspaceFilterConfig[] | undefined = React.useMemo(() => {
        if (!assignments.length) {
            return undefined;
        }
        return [
            {
                id: 'group',
                label: 'Group',
                value: selectedThesisId,
                options: assignments.map((assignment) => ({
                    value: assignment.thesisId,
                    label: assignment.thesisTitle || assignment.thesisId,
                    description: assignment.stage,
                })),
                onChange: (value) => setSelectedThesisId(value),
            },
        ];
    }, [assignments, selectedThesisId]);

    const handleCreateComment = React.useCallback(async ({
        chapterId,
        chapterStage,
        submissionId,
        content,
        files,
    }: WorkspaceCommentPayload) => {
        if (!statisticianUid || !selectedThesisId || !thesis?.groupId || !thesis.year ||
            !thesis.department || !thesis.course || !submissionId) {
            throw new Error('Missing statistician context or submission ID.');
        }

        let attachments: FileAttachment[] = [];
        if (files.length) {
            attachments = await uploadConversationAttachments(files, {
                userUid: statisticianUid,
                thesisId: selectedThesisId,
                groupId: thesis.groupId,
                chapterId,
                chapterStage,
            });
        }

        await createChat({
            year: thesis.year,
            department: thesis.department,
            course: thesis.course,
            groupId: thesis.groupId,
            thesisId: selectedThesisId,
            stage: chapterStage,
            chapterId: String(chapterId),
            submissionId,
        }, {
            author: statisticianUid,
            comment: content,
            date: new Date().toISOString(),
            attachments,
        });
    }, [statisticianUid, selectedThesisId, thesis]);

    const handleChapterDecision = React.useCallback(async (
        { thesisId: targetThesisId, chapterId, stage, submissionId, decision, requiredRoles }: WorkspaceChapterDecisionPayload
    ) => {
        if (!targetThesisId || !thesis?.year || !thesis.department ||
            !thesis.course || !thesis.groupId) {
            throw new Error('Missing thesis context for decision.');
        }

        if (!stage || !submissionId) {
            throw new Error('Missing stage or submissionId for decision.');
        }

        // Only handle decisions for the currently selected thesis
        if (targetThesisId !== selectedThesisId) {
            throw new Error('Cannot make decisions for a different thesis.');
        }

        await updateSubmissionDecision({
            ctx: {
                year: thesis.year,
                department: thesis.department,
                course: thesis.course,
                groupId: thesis.groupId,
                thesisId: targetThesisId,
                stage,
                chapterId: String(chapterId),
            },
            submissionId,
            decision,
            role: 'statistician',
            requiredRoles,
        });

        // Submission status is updated in Firestore, ThesisWorkspace will refresh via listener
    }, [selectedThesisId, thesis]);

    const isLoading = assignmentsLoading || thesisLoading;
    const noAssignments = !assignmentsLoading && assignments.length === 0;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary">
                    Review quantitative notes, select a group, and annotate each submission version.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {noAssignments ? (
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            No statistician assignments found. Once assigned to a thesis, it will appear here.
                        </Typography>
                    </CardContent>
                </Card>
            ) : isLoading && !thesis ? (
                <Stack spacing={2}>
                    <Skeleton variant="text" width="50%" height={32} />
                    <Skeleton variant="rounded" height={420} />
                </Stack>
            ) : (
                <ThesisWorkspace
                    thesisId={selectedThesisId}
                    groupId={thesis?.groupId}
                    year={thesis?.year}
                    department={thesis?.department}
                    course={thesis?.course}
                    thesis={thesis}
                    participants={participants}
                    currentUserId={statisticianUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting
                    emptyStateMessage={assignments.length ? 'Select a thesis to begin reviewing chapters.' : undefined}
                    onCreateComment={handleCreateComment}
                    expertRole="statistician"
                    onChapterDecision={handleChapterDecision}
                    enforceTerminalRequirementSequence
                    terminalRequirementCompletionMap={terminalRequirementCompletionMap}
                />
            )}
        </AnimatedPage>
    );
}
