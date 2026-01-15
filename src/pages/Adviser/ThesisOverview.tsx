import * as React from 'react';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ReviewerAssignment, ThesisWithGroupContext } from '../../utils/firebase/firestore/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceFilterConfig, WorkspaceChapterDecisionPayload, WorkspaceCommentPayload } from '../../types/workspace';
import { getReviewerAssignmentsForUser, findThesisById } from '../../utils/firebase/firestore/thesis';
import { createChat } from '../../utils/firebase/firestore/chat';
import { updateSubmissionDecision } from '../../utils/firebase/firestore/submissions';
import { uploadConversationAttachments } from '../../utils/firebase/storage/conversation';
import { getDisplayName } from '../../utils/userUtils';
import { notifySubmissionApproval, notifyRevisionRequested, notifyNewChatMessage } from '../../utils/auditNotificationUtils';
import { getStageLabel } from '../../utils/thesisStageUtils';
import { findGroupById } from '../../utils/firebase/firestore/groups';
import { useSegmentViewed } from '../../hooks';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Thesis Overview',
    segment: 'adviser-thesis-overview',
    icon: <SchoolIcon />,
    roles: ['adviser'],
};

export default function AdviserThesisOverviewPage() {
    useSegmentViewed({ segment: 'adviser-thesis-overview' });
    const session = useSession<Session>();
    const adviserUid = session?.user?.uid ?? '';

    const [assignments, setAssignments] = React.useState<ReviewerAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
    const [selectedThesisId, setSelectedThesisId] = React.useState<string>('');
    const [thesis, setThesis] = React.useState<ThesisWithGroupContext | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(false);
    const [displayNames, setDisplayNames] = React.useState<Record<string, string>>({});
    const [error, setError] = React.useState<string | null>(null);

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
            if (!adviserUid) {
                setAssignments([]);
                setAssignmentsLoading(false);
                return;
            }
            setAssignmentsLoading(true);
            setError(null);
            try {
                const rows = await getReviewerAssignmentsForUser('adviser', adviserUid);
                if (!cancelled) {
                    setAssignments(rows);
                }
            } catch (err) {
                console.error('Failed to load adviser assignments:', err);
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
    }, [adviserUid]);

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
        if (adviserUid && !map[adviserUid]) {
            register(adviserUid, 'You');
        }
        return map;
    }, [thesis, resolveDisplayName, adviserUid]);

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
                    description: assignment.id,
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
        if (!adviserUid || !selectedThesisId || !thesis?.groupId || !thesis.year ||
            !thesis.department || !thesis.course || !submissionId) {
            throw new Error('Missing adviser context or submission ID.');
        }

        let attachments: FileAttachment[] = [];
        if (files.length) {
            attachments = await uploadConversationAttachments(files, {
                userUid: adviserUid,
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
            author: adviserUid,
            comment: content,
            date: new Date().toISOString(),
            attachments,
        });

        // Send notification for the new chat message
        try {
            const group = await findGroupById(thesis.groupId);
            if (group) {
                await notifyNewChatMessage({
                    group,
                    senderId: adviserUid,
                    senderRole: 'adviser',
                    chapterName: `Chapter ${chapterId}`,
                    stageName: getStageLabel(chapterStage),
                    hasAttachments: attachments.length > 0,
                    details: { thesisId: selectedThesisId, chapterId, chapterStage, submissionId },
                });
            }
        } catch (notifyError) {
            console.error('Failed to send chat notification:', notifyError);
        }
    }, [adviserUid, selectedThesisId, thesis]);

    const handleChapterDecision = React.useCallback(async ({
        thesisId: targetThesisId,
        chapterId,
        stage,
        submissionId,
        decision,
        requiredRoles,
    }: WorkspaceChapterDecisionPayload) => {
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
            role: 'adviser',
            requiredRoles,
        });

        // Create audit notification for the decision
        try {
            const group = await findGroupById(thesis.groupId);
            if (group) {
                const chapterName = `Chapter ${chapterId}`;
                const stageName = getStageLabel(stage);
                // Adviser approval may need to notify editor next in the chain
                const hasEditor = Boolean(group.members.editor);
                if (decision === 'approved') {
                    await notifySubmissionApproval({
                        group,
                        approverId: adviserUid,
                        approverRole: 'adviser',
                        chapterName,
                        stageName,
                        isSequential: hasEditor,
                        chain: 'statistical',
                        isFinalApproval: !hasEditor,
                        details: { thesisId: targetThesisId, stage, submissionId },
                    });
                } else if (decision === 'revision_required') {
                    await notifyRevisionRequested({
                        group,
                        requesterId: adviserUid,
                        requesterRole: 'adviser',
                        chapterName,
                        stageName,
                        details: { thesisId: targetThesisId, stage, submissionId },
                    });
                }
            }
        } catch (auditError) {
            console.error('Failed to create audit notification:', auditError);
        }

        // Submission status is updated in Firestore, ThesisWorkspace will refresh via listener
    }, [selectedThesisId, thesis, adviserUid]);

    const isLoading = assignmentsLoading || thesisLoading;
    const noAssignments = !assignmentsLoading && assignments.length === 0;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary">
                    Monitor thesis activity, select a group, and leave feedback for each chapter version.
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
                            No advisee selected. Assign yourself to a thesis to view its workspace.
                        </Typography>
                    </CardContent>
                </Card>
            ) : isLoading && !thesis ? (
                <Stack spacing={2}>
                    <Skeleton variant="text" width="40%" height={32} />
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
                    currentUserId={adviserUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting
                    emptyStateMessage={assignments.length ? 'Select a thesis to begin reviewing chapters.' : undefined}
                    onCreateComment={handleCreateComment}
                    expertRole="adviser"
                    onChapterDecision={handleChapterDecision}
                />
            )}
        </AnimatedPage>
    );
}
