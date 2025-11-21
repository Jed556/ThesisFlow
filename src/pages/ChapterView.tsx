import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    Stack,
    Typography,
    Skeleton,

} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../components/Animate';
import { ChapterDeleteDialog } from '../components/Chapter';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisChapterConfig, ChapterConfigIdentifier } from '../types/chapter';
import { getChapterConfigByCourse, deleteChapterConfig } from '../utils/firebase/firestore';
import { useSnackbar } from '../contexts/SnackbarContext';

export const metadata: NavigationItem = {
    title: 'Chapter Details',
    segment: 'chapter/:department/:course',
    hidden: true,
};

function decodeParam(value?: string) {
    try {
        return value ? decodeURIComponent(value) : '';
    } catch {
        return value || '';
    }
}

function formatDate(value?: string) {
    if (!value) {
        return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Page for viewing a single chapter configuration in detail. */
export default function ChapterViewPage() {
    const navigate = useNavigate();
    const params = useParams<{ department: string; course: string }>();
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();

    const department = React.useMemo(() => decodeParam(params.department), [params.department]);
    const course = React.useMemo(() => decodeParam(params.course), [params.course]);

    const userRole = session?.user?.role;
    const canManage = userRole === 'admin' || userRole === 'developer';

    const [config, setConfig] = React.useState<ThesisChapterConfig | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    const loadConfig = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!department || !course) {
                setError('Department or course not provided.');
                setConfig(null);
                return;
            }
            const data = await getChapterConfigByCourse(department, course);
            if (!data) {
                setError('Chapter template not found.');
                setConfig(null);
                return;
            }
            setConfig(data);
        } catch (err) {
            console.error('Error loading chapter template:', err);
            setError('Failed to load chapter template.');
        } finally {
            setLoading(false);
        }
    }, [course, department]);

    React.useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleEdit = React.useCallback(() => {
        if (!config) {
            return;
        }
        const identifier: ChapterConfigIdentifier = {
            department: config.department,
            course: config.course,
        };
        navigate('/chapter-management', {
            state: {
                editChapter: identifier,
                filters: identifier,
            },
        });
    }, [config, navigate]);

    const handleDelete = React.useCallback(() => {
        setDeleteDialogOpen(true);
    }, []);

    const handleCloseDeleteDialog = React.useCallback(() => {
        setDeleteDialogOpen(false);
    }, []);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!config) {
            return;
        }
        setDeleting(true);
        try {
            await deleteChapterConfig(config.department, config.course);
            showNotification('Chapter template deleted.', 'success');
            setDeleteDialogOpen(false);
            navigate('/chapter-management', {
                replace: true,
                state: {
                    filters: {
                        department: config.department,
                        course: config.course,
                    },
                },
            });
        } catch (err) {
            console.error('Error deleting chapter template:', err);
            showNotification('Failed to delete chapter template.', 'error');
        } finally {
            setDeleting(false);
        }
    }, [config, navigate, showNotification]);

    if (loading) {
        return <ChapterViewSkeleton onBack={handleBack} />;
    }

    if (error || !config) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ py: 4, px: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <IconButton onClick={handleBack} size="large">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h4">Chapter Details</Typography>
                    </Stack>
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>
                            {error || 'Chapter template not found.'}
                        </Typography>
                        <Button variant="contained" onClick={handleBack}>
                            Go Back
                        </Button>
                    </Paper>
                </Box>
            </AnimatedPage>
        );
    }

    const createdAtLabel = formatDate(config.createdAt);
    const updatedAtLabel = formatDate(config.updatedAt);

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ py: 4, px: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <IconButton onClick={handleBack} size="large">
                        <ArrowBackIcon />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h4">{config.course}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Department: {config.department}
                        </Typography>
                    </Box>
                    {canManage && (
                        <Stack direction="row" spacing={1}>
                            <Button startIcon={<EditIcon />} variant="outlined" onClick={handleEdit}>
                                Edit
                            </Button>
                            <Button
                                startIcon={<DeleteIcon />}
                                variant="outlined"
                                color="error"
                                onClick={handleDelete}
                            >
                                Delete
                            </Button>
                        </Stack>
                    )}
                </Stack>

                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={`${config.chapters.length} Required Chapters`} color="primary" />
                        <Typography variant="body2" color="text.secondary">
                            Created {createdAtLabel}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            • Updated {updatedAtLabel}
                        </Typography>
                    </Stack>
                </Paper>

                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Chapter Breakdown
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <List>
                            {config.chapters.map((chapter) => (
                                <ListItem key={chapter.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', mb: 0.5 }}>
                                        <Typography variant="subtitle1">
                                            Chapter {chapter.id}: {chapter.title}
                                        </Typography>
                                        <Chip label={`Order ${chapter.id}`} variant="outlined" size="small" />
                                    </Stack>
                                    <ListItemText
                                        primary={chapter.description || 'No additional guidance provided.'}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>

                <ChapterDeleteDialog
                    open={deleteDialogOpen}
                    config={config}
                    deleting={deleting}
                    onClose={handleCloseDeleteDialog}
                    onConfirm={handleConfirmDelete}
                />
            </Box>
        </AnimatedPage>
    );
}

interface ChapterViewSkeletonProps {
    onBack: () => void;
}

/** Skeleton used while the chapter configuration loads. */
export function ChapterViewSkeleton({ onBack }: ChapterViewSkeletonProps) {
    return (
        <AnimatedPage variant="fade">
            <Box sx={{ py: 4, px: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <IconButton onClick={onBack} size="large">
                        <ArrowBackIcon />
                    </IconButton>
                    <Skeleton variant="text" width={240} height={48} />
                    <Skeleton variant="rectangular" width={120} height={40} />
                </Stack>

                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2}>
                        <Skeleton variant="rectangular" width={160} height={32} />
                        <Skeleton variant="text" width={180} />
                    </Stack>
                </Paper>

                <Card>
                    <CardContent>
                        <Skeleton variant="text" width={160} height={32} sx={{ mb: 2 }} />
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            {[1, 2, 3].map((item) => (
                                <Box key={item}>
                                    <Skeleton variant="text" width="70%" />
                                    <Skeleton variant="text" width="100%" />
                                </Box>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </AnimatedPage>
    );
}
