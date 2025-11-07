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
import type { ChatMessage } from '../../types/chat';
import { AnimatedPage } from '../../components/Animate';
import ChatBox from '../../components/Chat/ChatBox';
import { getAllTheses } from '../../utils/firebase/firestore/thesis';
import { getFilesByThesis } from '../../utils/firebase/firestore/file';
import { getDisplayName } from '../../utils/firebase/firestore/profile';
import { getThesisRole } from '../../utils/roleUtils';

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

const DEFAULT_EMPTY_MESSAGE = 'No theses assigned to you yet.';

export default function EditorThesisOverviewPage() {
    const session = useSession<Session>();
    const editorUid = session?.user?.email ?? undefined;

    // State for thesis data
    const [activeThesis, setActiveThesis] = React.useState<(ThesisData & { id: string }) | null>(null);
    const [recentFiles, setRecentFiles] = React.useState<FileAttachment[]>([]);
    const [displayNames, setDisplayNames] = React.useState<Map<string, string>>(new Map());
    const [roleTexts, setRoleTexts] = React.useState<Map<string, string>>(new Map());
    const [loading, setLoading] = React.useState(true);

    // Fetch theses assigned to this editor
    React.useEffect(() => {
        if (!editorUid) return;

        const fetchTheses = async () => {
            setLoading(true);
            try {
                const allTheses = await getAllTheses();
                // Filter theses where current user is the editor
                const editorTheses = allTheses.filter(thesis => thesis.editor === editorUid);

                // Set the first thesis as active
                if (editorTheses.length > 0) {
                    setActiveThesis(editorTheses[0]);
                }
            } catch (error) {
                console.error('Error fetching theses:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTheses();
    }, [editorUid]);

    // Fetch files and user data for active thesis
    React.useEffect(() => {
        if (!activeThesis) return;

        const fetchThesisData = async () => {
            try {
                // Fetch recent files for this thesis
                const files = await getFilesByThesis(activeThesis.id);
                setRecentFiles(files.slice(0, 5)); // Get 5 most recent

                // Fetch display names and roles for all participants
                const names = new Map<string, string>();
                const roles = new Map<string, string>();
                const uids = [
                    activeThesis.leader,
                    ...activeThesis.members,
                    activeThesis.adviser,
                    activeThesis.editor
                ].filter(Boolean);

                await Promise.all(
                    uids.map(async (uid) => {
                        const [displayName, role] = await Promise.all([
                            getDisplayName(uid),
                            getThesisRole(uid)
                        ]);
                        names.set(uid, displayName);

                        // Map role to display text
                        const roleDisplayText = role === 'leader' ? 'Leader' :
                            role === 'member' ? 'Member' :
                                role === 'adviser' ? 'Adviser' :
                                    role === 'editor' ? 'Editor' : 'Unknown';
                        roles.set(uid, roleDisplayText);
                    })
                );

                setDisplayNames(names);
                setRoleTexts(roles);
            } catch (error) {
                console.error('Error fetching thesis data:', error);
            }
        };

        fetchThesisData();
    }, [activeThesis]);

    const progress = React.useMemo(() =>
        (activeThesis ? calculateThesisProgress(activeThesis) : 0),
        [activeThesis]
    );

    // Helper to get cached display name
    const getCachedDisplayName = (uid: string | undefined): string => {
        if (!uid) return 'Unknown user';
        return displayNames.get(uid) || uid;
    };

    // Helper to get cached role text
    const getCachedRoleText = (uid: string | undefined): string => {
        if (!uid) return 'Unknown';
        return roleTexts.get(uid) || 'Unknown';
    };

    // Placeholder chat messages (this would come from Firestore in a real implementation)
    const chatMessages: ChatMessage[] = [];

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

            {loading ? (
                <Card>
                    <CardContent>
                        <Skeleton variant="text" width="60%" height={40} />
                        <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
                        <Skeleton variant="rectangular" height={200} sx={{ mt: 3 }} />
                    </CardContent>
                </Card>
            ) : !activeThesis ? (
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
                                            <Typography variant="h6">{activeThesis.title}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Stage: {activeThesis.overallStatus}
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
                                        <Chip label={`${getCachedDisplayName(activeThesis.leader)} (Leader)`}
                                            size="small" color="primary" variant="outlined" />
                                        {activeThesis.members.length === 0 && (
                                            <Typography variant="body2" color="text.secondary">
                                                No additional team members registered.
                                            </Typography>
                                        )}
                                        {activeThesis.members.map((memberUid: string) => (
                                            <Chip key={memberUid} label={`${getCachedDisplayName(memberUid)} (Member)`}
                                                size="small" variant="outlined" />
                                        ))}
                                        <Divider sx={{ my: 1 }} />
                                        <Stack direction="row" spacing={1}>
                                            <Chip label={`Adviser: ${getCachedDisplayName(activeThesis.adviser)}`}
                                                size="small" color="default" />
                                            <Chip label={`Editor: ${getCachedDisplayName(activeThesis.editor)}`}
                                                size="small" color="info" />
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
                                        {activeThesis.chapters.filter(ch => ch.status !== 'approved').length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                All chapters are currently approved.
                                            </Typography>
                                        ) : (
                                            activeThesis.chapters
                                                .filter(ch => ch.status !== 'approved')
                                                .map((chapter) => (
                                                    <Chip
                                                        key={chapter.id}
                                                        label={`${chapter.title} – ${chapter.status.replace('_', ' ')}`}
                                                        color={chapter.status === 'revision_required' ?
                                                            'warning' : chapter.status === 'under_review' ? 'info' : 'default'}
                                                        variant="outlined"
                                                    />
                                                ))
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
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No conversation history yet. Start a discussion with the thesis team.
                                        </Typography>
                                    ) : (
                                        <ChatBox
                                            currentUserId={editorUid ?? ''}
                                            messages={chatMessages}
                                            height={360}
                                            showInput={false}
                                            getDisplayName={getCachedDisplayName}
                                            getRoleDisplayText={(id) => getCachedRoleText(id)}
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
