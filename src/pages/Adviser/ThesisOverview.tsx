import * as React from 'react';
import {
    Box, Card, CardContent, Chip, Divider, Grid, LinearProgress, List, ListItem, ListItemText, Skeleton, Stack, Typography
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ForumIcon from '@mui/icons-material/Forum';
import SummarizeIcon from '@mui/icons-material/Summarize';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../components/Animate';
import ChatBox from '../../components/Chat/ChatBox';
import type { ChatMessage } from '../../types/chat';
import type { ThesisData } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import { getReviewerAssignments, getReviewerWorkspace, getThesisBySlug } from '../../data/reviewerWorkspace';
import { mockFileRegistry } from '../../data/mockData';
import { getDisplayName } from '../../utils/firebase/firestore/user';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 3,
    title: 'Adviser Thesis Overview',
    segment: 'adviser/thesis-overview',
    icon: <SchoolIcon />,
    roles: ['adviser', 'admin'],
};

function calculateThesisProgress(thesis: ThesisData): number {
    if (thesis.chapters.length === 0) return 0;
    const approved = thesis.chapters.filter((chapter) => chapter.status === 'approved').length;
    return Math.round((approved / thesis.chapters.length) * 100);
}

function resolveAttachments(hashes: string[]): FileAttachment[] {
    return hashes
        .map((hash) => mockFileRegistry[hash])
        .filter((file): file is FileAttachment => Boolean(file));
}

function resolveDisplayName(email?: string | null): string {
    if (!email) return 'Unknown user';
    return getDisplayName(email) || email;
}

const EMPTY_STATE = 'No advisee selected. Assign yourself to a thesis to view its workspace.';

export default function AdviserThesisOverviewPage() {
    const session = useSession<Session>();
    const adviserEmail = session?.user?.email;
    const assignments = React.useMemo(
        () => getReviewerAssignments('adviser', adviserEmail ?? undefined),
        [adviserEmail],
    );
    const activeAssignment = assignments[0];
    const thesis = React.useMemo(
        () => (activeAssignment ? getThesisBySlug(activeAssignment.thesisId) : undefined),
        [activeAssignment],
    );
    const workspace = React.useMemo(
        () => (activeAssignment ? getReviewerWorkspace(activeAssignment.thesisId) : undefined),
        [activeAssignment],
    );

    const progress = React.useMemo(
        () => (thesis ? calculateThesisProgress(thesis) : 0),
        [thesis],
    );
    const chatMessages = React.useMemo<ChatMessage[]>(
        () => workspace?.chatMessages ?? [],
        [workspace],
    );
    const focusFiles = React.useMemo(
        () => (workspace ? resolveAttachments(workspace.recentFileHashes) : []),
        [workspace],
    );

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

            {!activeAssignment || !thesis || !workspace ? (
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
                                            <Typography variant="h6">{thesis.title}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Stage: {thesis.overallStatus}
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
                                            <Typography variant="subtitle2">{progress}%</Typography>
                                        </Stack>
                                        <LinearProgress
                                            variant="determinate"
                                            value={progress}
                                            sx={{ height: 8, borderRadius: 1 }}
                                        />
                                    </Box>
                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">Team roster</Typography>
                                        <Chip
                                            label={`${resolveDisplayName(thesis.leader)} (Leader)`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        {thesis.members.map((memberEmail) => (
                                            <Chip
                                                key={memberEmail}
                                                label={`${resolveDisplayName(memberEmail)} (Member)`}
                                                size="small"
                                                variant="outlined"
                                            />
                                        ))}
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="subtitle2">Assigned editor</Typography>
                                        <Chip label={resolveDisplayName(thesis.editor)} size="small" color="info" />
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
                                                <ListItem key={file.url} disablePadding>
                                                    <ListItemText
                                                        primary={file.name}
                                                        secondary={`${file.type.toUpperCase()} • ${file.uploadDate}`}
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
                                        {workspace.focusChapters.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                No outstanding actions. Keep mentoring the team on next milestones.
                                            </Typography>
                                        ) : (
                                            workspace.focusChapters.map((chapterId) => {
                                                const chapter = thesis.chapters.find((item) => item.id === chapterId);
                                                if (!chapter) return null;
                                                const color: 'success' | 'info' | 'warning' | 'default' =
                                                    chapter.status === 'revision_required'
                                                        ? 'warning'
                                                        : chapter.status === 'under_review'
                                                            ? 'info'
                                                            : chapter.status === 'approved'
                                                                ? 'success'
                                                                : 'default';
                                                return (
                                                    <Chip
                                                        key={chapter.id}
                                                        label={`${chapter.title} – ${chapter.status.replace('_', ' ')}`}
                                                        color={color}
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
                                    {chatMessages.length === 0 ? (
                                        <Skeleton variant="rounded" height={360} />
                                    ) : (
                                        <ChatBox
                                            currentUserId={adviserEmail ?? ''}
                                            messages={chatMessages}
                                            height={360}
                                            showInput={false}
                                            getDisplayName={resolveDisplayName}
                                            getRoleDisplayText={(id) => (
                                                id === thesis.editor
                                                    ? 'Editor'
                                                    : id === thesis.leader
                                                        ? 'Leader'
                                                        : 'Contributor'
                                            )}
                                        />
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </AnimatedPage>
    );
}
