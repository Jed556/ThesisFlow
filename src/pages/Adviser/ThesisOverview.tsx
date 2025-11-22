import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip, Divider, Grid, LinearProgress,
    List, ListItem, ListItemText, Skeleton, Stack, Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ForumIcon from '@mui/icons-material/Forum';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../components/Animate';
import ChatBox from '../../components/Chat/ChatBox';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ChatMessage } from '../../types/chat';
import type { ThesisData } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ReviewerAssignment } from '../../types/reviewer';
import { getFilesByThesis } from '../../utils/firebase/firestore/file';
import { getDisplayName } from '../../utils/userUtils';
import {
    calculateThesisProgress,
    getReviewerAssignmentsForUser,
    getThesisById,
} from '../../utils/firebase/firestore/thesis';
import { thesisCommentToChatMessage } from '../../utils/chatUtils';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 3,
    title: 'Adviser Thesis Overview',
    segment: 'adviser/thesis-overview',
    icon: <SchoolIcon />,
    roles: ['adviser'],
};

const EMPTY_STATE = 'No advisee selected. Assign yourself to a thesis to view its workspace.';
const MAX_FOCUS_FILES = 5;

type ChapterStatus = ThesisData['chapters'][number]['status'];

function getChapterStatusChipColor(status: ChapterStatus): 'success' | 'info' | 'warning' | 'default' {
    if (status === 'revision_required') return 'warning';
    if (status === 'under_review') return 'info';
    if (status === 'approved') return 'success';
    return 'default';
}

export default function AdviserThesisOverviewPage() {
    const session = useSession<Session>();
    const adviserUid = session?.user?.uid ?? null;

    const [assignments, setAssignments] = React.useState<ReviewerAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState<boolean>(true);
    const [thesis, setThesis] = React.useState<ThesisData | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState<boolean>(false);
    const [focusFiles, setFocusFiles] = React.useState<FileAttachment[]>([]);
    const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
    const [progress, setProgress] = React.useState<number>(0);
    const [displayNames, setDisplayNames] = React.useState<Record<string, string>>({});
    const displayNamesRef = React.useRef<Record<string, string>>({});
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        displayNamesRef.current = displayNames;
    }, [displayNames]);

    const hydrateDisplayNames = React.useCallback(async (uids: string[]) => {
        const missing = uids.filter((uid) => uid && !displayNamesRef.current[uid]);
        if (missing.length === 0) {
            return;
        }

        const entries = await Promise.all(
            missing.map(async (uid) => {
                try {
                    const name = await getDisplayName(uid);
                    return [uid, name] as const;
                } catch (err) {
                    console.error('Failed to resolve display name:', err);
                    return [uid, uid] as const;
                }
            })
        );

        setDisplayNames((prev) => {
            const next = { ...prev };
            entries.forEach(([uid, name]) => {
                next[uid] = name;
            });
            return next;
        });
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        async function loadAssignments() {
            if (!adviserUid) {
                if (isMounted) {
                    setAssignments([]);
                    setAssignmentsLoading(false);
                }
                return;
            }

            setAssignmentsLoading(true);
            setError(null);

            try {
                const data = await getReviewerAssignmentsForUser('adviser', adviserUid);
                if (!isMounted) {
                    return;
                }
                setAssignments(data);
            } catch (err) {
                console.error('Failed to load adviser assignments:', err);
                if (isMounted) {
                    setError('Failed to load adviser assignments. Please try again later.');
                    setAssignments([]);
                }
            } finally {
                if (isMounted) {
                    setAssignmentsLoading(false);
                }
            }
        }

        void loadAssignments();

        return () => {
            isMounted = false;
        };
    }, [adviserUid]);

    const activeAssignment = React.useMemo(() => assignments[0] ?? null, [assignments]);

    React.useEffect(() => {
        let isMounted = true;

        async function loadThesisDetails() {
            if (!activeAssignment) {
                if (isMounted) {
                    setThesis(null);
                    setFocusFiles([]);
                    setChatMessages([]);
                    setProgress(0);
                }
                return;
            }

            setThesisLoading(true);
            setError(null);

            try {
                const [thesisData, files, progressValue] = await Promise.all([
                    getThesisById(activeAssignment.thesisId),
                    getFilesByThesis(activeAssignment.thesisId, undefined, 'submission'),
                    calculateThesisProgress(activeAssignment.thesisId),
                ]);

                if (!isMounted) {
                    return;
                }

                if (!thesisData) {
                    setThesis(null);
                    setFocusFiles([]);
                    setChatMessages([]);
                    setProgress(0);
                    setError('Thesis record could not be found.');
                    return;
                }

                const latestFiles = files.slice(0, MAX_FOCUS_FILES);
                const chapterMessages = thesisData.chapters?.flatMap((chapter) =>
                    (chapter.comments ?? []).map((comment, index) => thesisCommentToChatMessage(comment, index))
                ) ?? [];

                setThesis(thesisData);
                setProgress(Math.round(progressValue));
                setFocusFiles(latestFiles);
                setChatMessages(chapterMessages);

                const uids = new Set<string>();
                if (thesisData.leader) uids.add(thesisData.leader);
                thesisData.members?.forEach((uid) => {
                    if (uid) uids.add(uid);
                });
                if (thesisData.adviser) uids.add(thesisData.adviser);
                if (thesisData.editor) uids.add(thesisData.editor);
                latestFiles.forEach((file) => {
                    if (file.author) uids.add(file.author);
                });
                chapterMessages.forEach((message) => {
                    if (message.senderId) uids.add(message.senderId);
                });
                if (adviserUid) uids.add(adviserUid);

                await hydrateDisplayNames(Array.from(uids));
            } catch (err) {
                console.error('Failed to load thesis overview data:', err);
                if (isMounted) {
                    setError('Failed to load thesis details. Please try again later.');
                    setThesis(null);
                    setFocusFiles([]);
                    setChatMessages([]);
                    setProgress(0);
                }
            } finally {
                if (isMounted) {
                    setThesisLoading(false);
                }
            }
        }

        void loadThesisDetails();

        return () => {
            isMounted = false;
        };
    }, [activeAssignment, adviserUid, hydrateDisplayNames]);

    const showSkeleton = assignmentsLoading || thesisLoading;
    const noAssignment = !assignmentsLoading && !thesisLoading && (!activeAssignment || !thesis);

    const resolveDisplayName = React.useCallback((uid?: string | null) => {
        if (!uid) return 'Unknown user';
        return displayNames[uid] ?? uid;
    }, [displayNames]);

    const focusChapterIds = React.useMemo(
        () => (thesis
            ? thesis.chapters
                .filter((chapter) => chapter.status !== 'approved')
                .map((chapter) => chapter.id)
            : []),
        [thesis]
    );

    const formatFileDescriptor = React.useCallback((file: FileAttachment) => {
        const typeLabel = file.type ? file.type.toString().toUpperCase() : 'FILE';
        return `${typeLabel} • ${file.uploadDate}`;
    }, []);

    const stageLabel = React.useMemo(
        () => activeAssignment?.stage ?? thesis?.overallStatus ?? 'In Progress',
        [activeAssignment, thesis]
    );

    const resolveRoleLabel = React.useCallback((uid: string) => {
        if (!thesis) return 'Contributor';
        if (uid === thesis.editor) return 'Editor';
        if (uid === thesis.adviser) return 'Adviser';
        if (uid === thesis.leader) return 'Leader';
        if (thesis.members?.includes(uid)) return 'Member';
        return 'Contributor';
    }, [thesis]);

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Advisee workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Review submissions, identify blockers, and coordinate with editors in real time.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {showSkeleton ? (
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <Stack spacing={3}>
                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" width="70%" height={32} />
                                    <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
                                    <Skeleton variant="rectangular" height={8} sx={{ mt: 3, borderRadius: 1 }} />
                                    <Stack spacing={1.5} sx={{ mt: 3 }}>
                                        {Array.from({ length: 4 }).map((_, idx) => (
                                            <Skeleton key={idx} variant="rectangular" height={24} />
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" width="50%" height={28} />
                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <Skeleton key={idx} variant="text" width={`${80 - idx * 10}%`} height={20} />
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" width="60%" height={28} />
                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <Skeleton key={idx} variant="rectangular" height={32} />
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 7 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <Skeleton variant="text" width="40%" height={28} />
                                <Box sx={{ flexGrow: 1, mt: 2 }}>
                                    <Skeleton variant="rounded" height={360} />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            ) : noAssignment ? (
                <Card>
                    <CardContent>
                        <Typography variant="body1" color="text.secondary">
                            {EMPTY_STATE}
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <Stack spacing={3}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <SummarizeIcon color="primary" />
                                        <Box>
                                            <Typography variant="h6">{thesis?.title}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Stage: {stageLabel}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Box sx={{ mt: 2 }}>
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            sx={{ mb: 1 }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Chapter progress
                                            </Typography>
                                            <Typography variant="subtitle2">{Math.round(progress)}%</Typography>
                                        </Stack>
                                        <LinearProgress
                                            variant="determinate"
                                            value={Math.min(Math.max(progress, 0), 100)}
                                            sx={{ height: 8, borderRadius: 1 }}
                                        />
                                    </Box>

                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">Team roster</Typography>
                                        {thesis?.leader && (
                                            <Chip
                                                label={`${resolveDisplayName(thesis.leader)} (Leader)`}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        )}
                                        {(thesis?.members ?? []).map((memberUid) => (
                                            <Chip
                                                key={memberUid}
                                                label={`${resolveDisplayName(memberUid)} (Member)`}
                                                size="small"
                                                variant="outlined"
                                            />
                                        ))}
                                        {thesis?.adviser && (
                                            <Chip
                                                label={`${resolveDisplayName(thesis.adviser)} (Adviser)`}
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                            />
                                        )}
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="subtitle2">Assigned editor</Typography>
                                        {thesis?.editor ? (
                                            <Chip
                                                label={resolveDisplayName(thesis.editor)}
                                                size="small"
                                                color="info"
                                            />
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No editor assigned yet.
                                            </Typography>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Files to review
                                    </Typography>
                                    {focusFiles.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Students have not uploaded new artefacts yet.
                                        </Typography>
                                    ) : (
                                        <List dense>
                                            {focusFiles.map((file) => (
                                                <ListItem key={file.id ?? file.url ?? file.name} disablePadding>
                                                    <ListItemText
                                                        primary={file.name}
                                                        secondary={formatFileDescriptor(file)}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Attention areas
                                    </Typography>
                                    <Stack spacing={1}>
                                        {focusChapterIds.length === 0 || !thesis ? (
                                            <Typography variant="body2" color="text.secondary">
                                                No outstanding actions. Keep mentoring the team on next milestones.
                                            </Typography>
                                        ) : (
                                            focusChapterIds.map((chapterId) => {
                                                const chapter = thesis.chapters.find((item) => item.id === chapterId);
                                                if (!chapter) return null;
                                                return (
                                                    <Chip
                                                        key={chapter.id}
                                                        label={`${chapter.title} – ${chapter.status.replace('_', ' ')}`}
                                                        color={getChapterStatusChipColor(chapter.status)}
                                                        variant="outlined"
                                                    />
                                                );
                                            })
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 7 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                    <ForumIcon color="primary" />
                                    <Typography variant="h6">Mentor chat</Typography>
                                </Stack>
                                <Box sx={{ flexGrow: 1 }}>
                                    <ChatBox
                                        currentUserId={adviserUid ?? ''}
                                        messages={chatMessages}
                                        height={360}
                                        showInput={false}
                                        isLoading={thesisLoading}
                                        getDisplayName={(id) => resolveDisplayName(id)}
                                        getRoleDisplayText={(id) => resolveRoleLabel(id)}
                                        emptyStateMessage="No messages yet. Awaiting discussion."
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </AnimatedPage>
    );
}
