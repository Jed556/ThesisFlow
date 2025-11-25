import * as React from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ReviewerAssignment } from '../../types/reviewer';
import type { ThesisData } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceChapterDecisionPayload, WorkspaceFilterConfig } from '../../types/workspace';
import {
    getReviewerAssignmentsForUser,
    getThesisById,
} from '../../utils/firebase/firestore/thesis';
import { appendChapterComment } from '../../utils/firebase/firestore/conversation';
import { updateChapterDecision } from '../../utils/firebase/firestore/chapterDecisions';
import { uploadConversationAttachments } from '../../utils/firebase/storage/conversation';
import { getDisplayName } from '../../utils/userUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 0,
    title: 'Thesis Overview',
    segment: 'editor-thesis-overview',
    icon: <VisibilityIcon />,
    roles: ['editor'],
};

export default function EditorThesisOverviewPage() {
    const session = useSession<Session>();
    const editorUid = session?.user?.uid ?? '';

    const [assignments, setAssignments] = React.useState<ReviewerAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
    const [selectedThesisId, setSelectedThesisId] = React.useState<string>('');
    const [thesis, setThesis] = React.useState<ThesisData | null>(null);
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
            if (!editorUid) {
                setAssignments([]);
                setAssignmentsLoading(false);
                return;
            }
            setAssignmentsLoading(true);
            setError(null);
            try {
                const rows = await getReviewerAssignmentsForUser('editor', editorUid);
                if (!cancelled) {
                    setAssignments(rows);
                }
            } catch (err) {
                console.error('Failed to load editor assignments:', err);
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
    }, [editorUid]);

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
                const data = await getThesisById(selectedThesisId);
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
        if (editorUid && !map[editorUid]) {
            register(editorUid, 'You');
        }
        return map;
    }, [thesis, resolveDisplayName, editorUid]);

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
        versionIndex,
        content,
        files,
    }: {
        chapterId: number;
        versionIndex: number | null;
        content: string;
        files: File[];
    }) => {
        if (!editorUid || !selectedThesisId) {
            throw new Error('Missing editor context.');
        }

        let attachments: FileAttachment[] = [];
        if (files.length) {
            attachments = await uploadConversationAttachments(files, {
                userUid: editorUid,
                thesisId: selectedThesisId,
                chapterId,
            });
        }

        const savedComment = await appendChapterComment({
            thesisId: selectedThesisId,
            chapterId,
            comment: {
                author: editorUid,
                comment: content,
                attachments,
                version: typeof versionIndex === 'number' ? versionIndex : undefined,
            },
        });

        setThesis((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                chapters: prev.chapters.map((chapter) =>
                    chapter.id === chapterId
                        ? { ...chapter, comments: [...(chapter.comments ?? []), savedComment] }
                        : chapter
                ),
            };
        });
    }, [editorUid, selectedThesisId]);

    const handleChapterDecision = React.useCallback(async ({ thesisId: targetThesisId, chapterId, decision }: WorkspaceChapterDecisionPayload) => {
        if (!targetThesisId) {
            throw new Error('Missing thesis context for decision.');
        }

        const result = await updateChapterDecision({
            thesisId: targetThesisId,
            chapterId,
            decision,
            role: 'editor',
        });

        if (targetThesisId !== selectedThesisId) {
            return;
        }

        setThesis((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                lastUpdated: result.decidedAt,
                chapters: prev.chapters.map((chapter) =>
                    chapter.id === chapterId
                        ? {
                            ...chapter,
                            status: result.status,
                            lastModified: result.decidedAt,
                            mentorApprovals: result.mentorApprovals,
                        }
                        : chapter
                ),
            };
        });
    }, [selectedThesisId]);

    const isLoading = assignmentsLoading || thesisLoading;
    const noAssignments = !assignmentsLoading && assignments.length === 0;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Editorial workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Monitor thesis activity, select a group, and leave chapter-specific feedback.
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
                            No editorial assignments found. Once assigned to a thesis, it will appear here.
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
                    thesis={thesis}
                    participants={participants}
                    currentUserId={editorUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting
                    emptyStateMessage={assignments.length ? 'Select a thesis to begin reviewing chapters.' : undefined}
                    onCreateComment={({ chapterId, versionIndex, content, files }) =>
                        handleCreateComment({ chapterId, versionIndex, content, files })
                    }
                    mentorRole="editor"
                    onChapterDecision={handleChapterDecision}
                />
            )}
        </AnimatedPage>
    );
}
