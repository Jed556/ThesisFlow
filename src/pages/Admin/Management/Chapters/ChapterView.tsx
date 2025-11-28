import * as React from 'react';
import {
    Box, Button, Chip, IconButton, MenuItem, Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon, Edit as EditIcon, Delete as DeleteIcon, Check as SaveIcon,
    Add as AddIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../../../components/Animate';
import { ChapterDeleteDialog } from '../../../../components/Chapter';
import type { NavigationItem } from '../../../../types/navigation';
import type { Session } from '../../../../types/session';
import type { ThesisChapterConfig, ChapterTemplate } from '../../../../types/chapter';
import {
    getChapterConfigByCourse, updateChapterTemplatesWithCascade, deleteChapterConfigWithCascade,
} from '../../../../utils/firebase/firestore';
import type { ThesisStageName } from '../../../../types/thesis';
import { useSnackbar } from '../../../../contexts/SnackbarContext';
import { THESIS_STAGE_METADATA } from '../../../../utils/thesisStageUtils';
import {
    DEFAULT_CHAPTER_STAGE, coerceChapterStages, createEmptyChapterTemplate,
    moveChapterTemplate, normalizeChapterOrder,
} from '../../../../utils/chapterUtils';

export const metadata: NavigationItem = {
    title: 'Chapter Details',
    segment: 'chapter-management/:department/:course',
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

const MIN_CHAPTERS = 1;

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
    const [isEditing, setIsEditing] = React.useState(false);
    const [draftChapters, setDraftChapters] = React.useState<ChapterTemplate[]>([]);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    const loadConfig = React.useCallback(async (options?: { silent?: boolean }) => {
        const { silent = false } = options ?? {};
        if (!silent) {
            setLoading(true);
        }
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
            if (!silent) {
                setLoading(false);
            }
        }
    }, [course, department]);

    React.useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    React.useEffect(() => {
        if (!config?.chapters || isEditing) {
            return;
        }
        setDraftChapters(normalizeChapterOrder(config.chapters));
    }, [config, isEditing]);

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleEdit = React.useCallback(() => {
        if (!config) {
            return;
        }
        setDraftChapters(normalizeChapterOrder(config.chapters));
        setFormError(null);
        setIsEditing(true);
    }, [config]);

    const handleCancelEdit = React.useCallback(() => {
        if (config?.chapters) {
            setDraftChapters(normalizeChapterOrder(config.chapters));
        } else {
            setDraftChapters([]);
        }
        setFormError(null);
        setIsEditing(false);
    }, [config]);

    const handleChapterFieldChange = React.useCallback(
        (index: number, changes: Partial<ChapterTemplate>) => {
            setDraftChapters((prev) =>
                normalizeChapterOrder(
                    prev.map((chapter, chapterIndex) =>
                        chapterIndex === index ? { ...chapter, ...changes } : chapter
                    )
                )
            );
        },
        []
    );

    const handleMoveChapter = React.useCallback((index: number, direction: 1 | -1) => {
        setDraftChapters((prev) => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= prev.length) {
                return prev;
            }
            return moveChapterTemplate(prev, index, targetIndex);
        });
    }, []);

    const handleRemoveChapter = React.useCallback((index: number) => {
        setDraftChapters((prev) => {
            if (prev.length <= MIN_CHAPTERS) {
                return prev;
            }
            const next = [...prev];
            next.splice(index, 1);
            return normalizeChapterOrder(next);
        });
    }, []);

    const handleAddChapter = React.useCallback(() => {
        setDraftChapters((prev) => {
            const lastStages = coerceChapterStages(prev[prev.length - 1]?.stage);
            const fallbackStage = lastStages[lastStages.length - 1] ?? DEFAULT_CHAPTER_STAGE;
            return normalizeChapterOrder([
                ...prev,
                createEmptyChapterTemplate(prev.length + 1, fallbackStage),
            ]);
        });
    }, []);

    const validateChapters = React.useCallback((chapters: ChapterTemplate[]) => {
        if (chapters.length === 0) {
            return 'Include at least one chapter.';
        }
        if (chapters.some((chapter) => !chapter.title.trim())) {
            return 'Every chapter must have a title.';
        }
        return null;
    }, []);

    const handleSaveChanges = React.useCallback(async () => {
        if (!config) {
            return;
        }

        const sanitized = normalizeChapterOrder(
            draftChapters.map((chapter) => ({
                ...chapter,
                title: chapter.title.trim(),
                description: chapter.description?.trim() ?? '',
            }))
        );

        const validationError = validateChapters(sanitized);
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSaving(true);
        setFormError(null);
        try {
            const result = await updateChapterTemplatesWithCascade(
                config.department,
                config.course,
                sanitized
            );
            const notification = result.thesisCount > 0
                ? `Template updated and synced to ${result.thesisCount} thesis${result.thesisCount === 1 ? '' : 'es'}.`
                : 'Template updated.';
            showNotification(notification, 'success');
            setIsEditing(false);
            setDraftChapters(sanitized);
            await loadConfig({ silent: true });
        } catch (err) {
            console.error('Error updating chapter template:', err);
            showNotification('Failed to update chapter template.', 'error');
        } finally {
            setSaving(false);
        }
    }, [config, draftChapters, loadConfig, showNotification, validateChapters]);

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
            const result = await deleteChapterConfigWithCascade(config.department, config.course);
            const notification = result.thesisCount > 0
                ? `Chapter template deleted. Cleared chapters for ${result.thesisCount} thesis${result.thesisCount === 1 ? '' : 'es'}.`
                : 'Chapter template deleted.';
            showNotification(notification, 'success');
            setDeleteDialogOpen(false);
            setIsEditing(false);
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
    const chaptersToDisplay = (isEditing ? draftChapters : config.chapters) ?? [];
    const chapterCount = chaptersToDisplay.length;

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
                        isEditing ? (
                            <Stack direction="row" spacing={1}>
                                <Button
                                    startIcon={<SaveIcon />}
                                    variant="contained"
                                    onClick={handleSaveChanges}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving…' : 'Save'}
                                </Button>
                                <Button onClick={handleCancelEdit} disabled={saving}>
                                    Cancel
                                </Button>
                                <Button
                                    startIcon={<DeleteIcon />}
                                    variant="outlined"
                                    color="error"
                                    onClick={handleDelete}
                                    disabled={saving || deleting}
                                >
                                    Delete
                                </Button>
                            </Stack>
                        ) : (
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
                        )
                    )}
                </Stack>

                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip label={`${chapterCount} Required Chapters`} color="primary" />
                            <Typography variant="body2" color="text.secondary">
                                Created {createdAtLabel}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Updated {updatedAtLabel}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {isEditing
                                ? 'Saving applies these chapter changes to every thesis in this course.'
                                : 'These chapter requirements stay in sync with all theses for this course.'}
                        </Typography>
                    </Stack>
                </Paper>

                {formError && (
                    <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                        {formError}
                    </Typography>
                )}

                {chaptersToDisplay.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography color="text.secondary">
                            No chapters configured for this course.
                        </Typography>
                    </Paper>
                ) : (
                    <Stack spacing={2}>
                        {chaptersToDisplay.map((chapter, index) => {
                            const stageValues = coerceChapterStages(chapter.stage);
                            return (
                                <Paper key={`chapter-${chapter.id}-${index}`} variant="outlined" sx={{ p: 3 }}>
                                    <Stack spacing={2}>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography variant="subtitle2" color="text.secondary">
                                                Chapter {chapter.id}
                                            </Typography>
                                            <Box sx={{ flexGrow: 1 }} />
                                            {isEditing && (
                                                <Stack direction="row" spacing={0.5}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleMoveChapter(index, -1)}
                                                        disabled={index === 0 || saving}
                                                        aria-label="Move chapter up"
                                                    >
                                                        <ArrowUpwardIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleMoveChapter(index, 1)}
                                                        disabled={index === chaptersToDisplay.length - 1 || saving}
                                                        aria-label="Move chapter down"
                                                    >
                                                        <ArrowDownwardIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleRemoveChapter(index)}
                                                        disabled={chaptersToDisplay.length <= MIN_CHAPTERS || saving}
                                                        aria-label="Remove chapter"
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            )}
                                        </Stack>

                                        {isEditing ? (
                                            <Stack spacing={2}>
                                                <TextField
                                                    label="Title"
                                                    value={chapter.title}
                                                    onChange={(event) =>
                                                        handleChapterFieldChange(index, { title: event.target.value })
                                                    }
                                                    fullWidth
                                                    required
                                                    disabled={saving}
                                                />
                                                <TextField
                                                    select
                                                    label="Thesis Stages"
                                                    value={stageValues}
                                                    slotProps={{
                                                        select: {
                                                            multiple: true,
                                                            renderValue: (selected) => (selected as string[]).join(', '),
                                                        },
                                                    }}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        const nextStages = Array.isArray(value)
                                                            ? (value as ThesisStageName[])
                                                            : [(value as ThesisStageName)];
                                                        const normalizedStages = nextStages.length > 0
                                                            ? nextStages
                                                            : [DEFAULT_CHAPTER_STAGE];
                                                        handleChapterFieldChange(index, {
                                                            stage: normalizedStages,
                                                        });
                                                    }}
                                                    fullWidth
                                                    disabled={saving}
                                                >
                                                    {THESIS_STAGE_METADATA.map((stage) => (
                                                        <MenuItem key={stage.value} value={stage.value}>
                                                            {stage.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                                <TextField
                                                    label="Description"
                                                    value={chapter.description ?? ''}
                                                    onChange={(event) =>
                                                        handleChapterFieldChange(index, {
                                                            description: event.target.value,
                                                        })
                                                    }
                                                    fullWidth
                                                    multiline
                                                    minRows={3}
                                                    helperText="Optional guidance shared with students"
                                                    disabled={saving}
                                                />
                                            </Stack>
                                        ) : (
                                            <Stack spacing={1}>
                                                <Typography variant="h6">{chapter.title}</Typography>
                                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                    {stageValues.map((stage) => (
                                                        <Chip
                                                            key={`${chapter.id}-view-${stage}`}
                                                            label={stage}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    ))}
                                                </Stack>
                                                <Typography color="text.secondary">
                                                    {chapter.description || 'No additional guidance provided.'}
                                                </Typography>
                                            </Stack>
                                        )}
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Stack>
                )}

                {isEditing && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button startIcon={<AddIcon />} onClick={handleAddChapter} disabled={saving}>
                            Add Chapter
                        </Button>
                    </Box>
                )}

                <ChapterDeleteDialog
                    open={deleteDialogOpen}
                    config={config}
                    deleting={deleting}
                    onClose={handleCloseDeleteDialog}
                    onConfirm={handleConfirmDelete}
                />
            </Box>
        </AnimatedPage >
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
                    <Stack spacing={1.5}>
                        <Skeleton variant="rectangular" width={220} height={32} />
                        <Skeleton variant="text" width={200} />
                    </Stack>
                </Paper>

                <Stack spacing={2}>
                    {[1, 2, 3].map((item) => (
                        <Paper key={item} variant="outlined" sx={{ p: 3 }}>
                            <Stack spacing={1.5}>
                                <Skeleton variant="text" width={140} />
                                <Skeleton variant="text" width="60%" />
                                <Skeleton variant="text" width="90%" />
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            </Box>
        </AnimatedPage>
    );
}
