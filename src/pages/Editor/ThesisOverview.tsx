import * as React from 'react';
import {
    Box, Card, CardContent, Chip, Divider, Grid, LinearProgress, List, ListItem, ListItemText, Skeleton, Stack, Typography
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ForumIcon from '@mui/icons-material/Forum';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisData } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import { AnimatedPage } from '../../components/Animate';
import ChatBox from '../../components/Chat/ChatBox';
import type { ChatMessage } from '../../types/chat';
import { getReviewerAssignments, getReviewerWorkspace, getThesisBySlug } from '../../data/reviewerWorkspace';
import { mockFileRegistry } from '../../data/mockData';
import { getDisplayName } from '../../utils/dbUtils';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 0,
    title: 'Editor Thesis Overview',
    segment: 'editor/thesis-overview',
    icon: <VisibilityIcon />,
    roles: ['editor', 'admin'],
};

/**
 * Compute completion percentage for the supplied thesis.
 */
function calculateThesisProgress(thesis: ThesisData): number {
    const { chapters } = thesis;
    if (chapters.length === 0) return 0;
    const approved = chapters.filter((chapter) => chapter.status === 'approved').length;
    return Math.round((approved / chapters.length) * 100);
}

/**
 * Map file hashes to attachment metadata while filtering unknown references.
 */
function resolveAttachments(hashes: string[]): FileAttachment[] {
    return hashes
        .map((hash) => mockFileRegistry[hash])
        .filter((file): file is FileAttachment => Boolean(file));
}

/**
 * Build display name for chat participants.
 */
function resolveDisplayName(email: string | undefined): string {
    if (!email) return 'Unknown user';
    return getDisplayName(email) || email;
}

const DEFAULT_EMPTY_MESSAGE = 'Select or request an assignment to view thesis activity.';

export default function EditorThesisOverviewPage() {
    const session = useSession<Session>();
    // Ensure null is converted to undefined so the argument matches
    // the expected type `string | undefined`.
    const editorEmail = session?.user?.email ?? undefined;

    const assignments = React.useMemo(() => getReviewerAssignments('editor', editorEmail), [editorEmail]);
    const activeAssignment = assignments[0];
    const thesis = React.useMemo(() => activeAssignment ? getThesisBySlug(activeAssignment.thesisId) : undefined, [activeAssignment]);
    const workspace = React.useMemo(() => activeAssignment ? getReviewerWorkspace(activeAssignment.thesisId) : undefined, [activeAssignment]);

    const progress = React.useMemo(() => (thesis ? calculateThesisProgress(thesis) : 0), [thesis]);
    const recentFiles = React.useMemo(() => (workspace ? resolveAttachments(workspace.recentFileHashes) : []), [workspace]);
    const chatMessages = React.useMemo<ChatMessage[]>(() => workspace?.chatMessages ?? [], [workspace]);

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Editorial workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Monitor thesis activity, exchange feedback, and reference the latest file submissions.
                </Typography>
            </Box>

            {!activeAssignment || !thesis || !workspace ? (
                <Card>
                    <CardContent>
                        <Typography variant="body1" color="text.secondary">
                            {DEFAULT_EMPTY_MESSAGE}
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
                                        <AssessmentIcon color="primary" />
                                        <Box>
                                            <Typography variant="h6">{thesis.title}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Stage: {thesis.overallStatus}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Box sx={{ mt: 2 }}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Overall progress</Typography>
                                            <Typography variant="subtitle2">{progress}%</Typography>
                                        </Stack>
                                        <LinearProgress value={progress} variant="determinate" sx={{ borderRadius: 1, height: 8 }} />
                                    </Box>
                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">Students</Typography>
                                        <Chip label={`${resolveDisplayName(thesis.leader)} (Leader)`} size="small" color="primary" variant="outlined" />
                                        {thesis.members.length === 0 && (
                                            <Typography variant="body2" color="text.secondary">
                                                No additional team members registered.
                                            </Typography>
                                        )}
                                        {thesis.members.map((memberEmail) => (
                                            <Chip key={memberEmail} label={`${resolveDisplayName(memberEmail)} (Member)`} size="small" variant="outlined" />
                                        ))}
                                        <Divider sx={{ my: 1 }} />
                                        <Stack direction="row" spacing={1}>
                                            <Chip label={`Adviser: ${resolveDisplayName(thesis.adviser)}`} size="small" color="default" />
                                            <Chip label={`Editor: ${resolveDisplayName(thesis.editor)}`} size="small" color="info" />
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                        <UploadFileIcon color="primary" />
                                        <Typography variant="h6">Recent files</Typography>
                                    </Stack>
                                    {recentFiles.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            No files have been exchanged in this workspace yet.
                                        </Typography>
                                    ) : (
                                        <List dense>
                                            {recentFiles.map((file) => (
                                                <ListItem key={file.url} disablePadding>
                                                    <ListItemText
                                                        primary={file.name}
                                                        secondary={`${file.type.toUpperCase()} • Uploaded ${file.uploadDate}`}
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
                                        Focus chapters
                                    </Typography>
                                    <Stack spacing={1}>
                                        {workspace.focusChapters.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                All chapters are currently approved.
                                            </Typography>
                                        ) : (
                                            workspace.focusChapters.map((chapterId) => {
                                                const chapter = thesis.chapters.find((ch) => ch.id === chapterId);
                                                if (!chapter) return null;
                                                return (
                                                    <Chip
                                                        key={chapter.id}
                                                        label={`${chapter.title} – ${chapter.status.replace('_', ' ')}`}
                                                        color={chapter.status === 'revision_required' ? 'warning' : chapter.status === 'under_review' ? 'info' : 'default'}
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
                                    <Typography variant="h6">Thesis conversation</Typography>
                                </Stack>
                                <Box sx={{ flexGrow: 1 }}>
                                    {chatMessages.length === 0 ? (
                                        <Skeleton variant="rounded" height={320} />
                                    ) : (
                                        <ChatBox
                                            currentUserId={editorEmail ?? ''}
                                            messages={chatMessages}
                                            height={360}
                                            showInput={false}
                                            getDisplayName={resolveDisplayName}
                                            getRoleDisplayText={(id) => (id === thesis.adviser ? 'Adviser' : id === thesis.editor ? 'Editor' : 'Contributor')}
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
