import * as React from 'react';
import {
    Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Stack, TextField, Typography, Paper, MenuItem,
} from '@mui/material';
import {
    Add as AddIcon, ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon, Delete as DeleteIcon,
} from '@mui/icons-material';
import type { ChapterConfigFormData, ChapterFormErrorKey, ChapterTemplate } from '../../types/chapter';
import type { ThesisStageName } from '../../types/thesis';
import { GrowTransition } from '../Animate';
import {
    DEFAULT_CHAPTER_STAGE,
    coerceChapterStages,
    createEmptyChapterTemplate,
    moveChapterTemplate,
    normalizeChapterOrder,
} from '../../utils/chapterUtils';
import { THESIS_STAGE_METADATA } from '../../utils/thesisStageUtils';
import { buildDefaultChapters } from './constants';

interface ChapterManageDialogProps {
    open: boolean;
    editMode: boolean;
    formData: ChapterConfigFormData;
    formErrors: Partial<Record<ChapterFormErrorKey, string>>;
    departmentOptions: string[];
    courseOptions: string[];
    saving: boolean;
    onClose: () => void;
    onFieldChange: (changes: Partial<ChapterConfigFormData>) => void;
    onSubmit: () => void | Promise<void>;
}

const MIN_CHAPTERS = 1;

/** Dialog used for creating or editing a thesis chapter requirement template. */
export default function ChapterManageDialog({
    open,
    editMode,
    formData,
    formErrors,
    departmentOptions,
    courseOptions,
    saving,
    onClose,
    onFieldChange,
    onSubmit,
}: ChapterManageDialogProps) {
    // Seed default chapters when creating a new entry and the form is empty
    React.useEffect(() => {
        if (!open) {
            return;
        }

        if (formData.chapters.length === 0) {
            onFieldChange({ chapters: buildDefaultChapters() });
        }
    }, [open, formData.chapters.length, onFieldChange]);

    const isCourseDisabled = !formData.department.trim();

    const handleDepartmentChange = React.useCallback(
        (_: unknown, value: string | null) => {
            const nextValue = value ?? '';
            if (nextValue === formData.department) {
                return;
            }
            onFieldChange({ department: nextValue, course: '' });
        },
        [formData.department, onFieldChange]
    );

    const handleCourseChange = React.useCallback(
        (_: unknown, value: string | null) => {
            onFieldChange({ course: value ?? '' });
        },
        [onFieldChange]
    );

    const handleChapterFieldChange = React.useCallback(
        (index: number, changes: Partial<ChapterTemplate>) => {
            onFieldChange({
                chapters: normalizeChapterOrder(
                    formData.chapters.map((chapter, chapterIndex) =>
                        chapterIndex === index ? { ...chapter, ...changes } : chapter
                    )
                ),
            });
        },
        [formData.chapters, onFieldChange]
    );

    const handleAddChapter = React.useCallback(() => {
        const nextOrder = formData.chapters.length + 1;
        const lastChapter = formData.chapters[formData.chapters.length - 1];
        const fallbackStages = coerceChapterStages(lastChapter?.stage);
        const nextStage = fallbackStages[fallbackStages.length - 1] ?? DEFAULT_CHAPTER_STAGE;

        onFieldChange({
            chapters: [...formData.chapters, createEmptyChapterTemplate(nextOrder, nextStage)],
        });
    }, [formData.chapters, onFieldChange]);

    const handleRemoveChapter = React.useCallback(
        (index: number) => {
            if (formData.chapters.length <= MIN_CHAPTERS) {
                return;
            }
            const updated = [...formData.chapters];
            updated.splice(index, 1);
            onFieldChange({ chapters: normalizeChapterOrder(updated) });
        },
        [formData.chapters, onFieldChange]
    );

    const handleMoveChapter = React.useCallback(
        (index: number, direction: 1 | -1) => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= formData.chapters.length) {
                return;
            }
            onFieldChange({ chapters: moveChapterTemplate(formData.chapters, index, targetIndex) });
        },
        [formData.chapters, onFieldChange]
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slots={{ transition: GrowTransition }}>
            <DialogTitle>{editMode ? 'Edit Chapter Requirements' : 'Create Chapter Requirements'}</DialogTitle>
            <DialogContent dividers sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                <Stack spacing={3}>
                    {formErrors.general && (
                        <Typography color="error" variant="body2">
                            {formErrors.general}
                        </Typography>
                    )}
                    <Stack
                        spacing={2}
                        direction={{ xs: 'column', md: 'row' }}
                        sx={{ '& > *': { flex: 1 } }}
                    >
                        <Autocomplete
                            freeSolo
                            options={departmentOptions}
                            value={formData.department}
                            onChange={handleDepartmentChange}
                            inputValue={formData.department}
                            onInputChange={(_, newValue) => {
                                if (newValue === formData.department) {
                                    return;
                                }
                                onFieldChange({ department: newValue, course: '' });
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Department"
                                    required
                                    error={!!formErrors.department}
                                    helperText={
                                        formErrors.department || 'Select an existing department or type a new one'
                                    }
                                />
                            )}
                        />
                        <Autocomplete
                            freeSolo
                            options={courseOptions}
                            disabled={isCourseDisabled}
                            value={formData.course}
                            onChange={handleCourseChange}
                            inputValue={formData.course}
                            onInputChange={(_, newValue) => onFieldChange({ course: newValue })}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Course"
                                    required
                                    error={!!formErrors.course}
                                    helperText={
                                        formErrors.course ||
                                        (isCourseDisabled
                                            ? 'Select a department first'
                                            : 'Select an existing course or type a new one')
                                    }
                                />
                            )}
                        />
                    </Stack>

                    <Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Box>
                                <Typography variant="subtitle1">Chapters</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Add, reorder, or edit chapter requirements. Stage selection now supports multiples.
                                </Typography>
                            </Box>
                            <Button startIcon={<AddIcon />} onClick={handleAddChapter}>
                                Add Chapter
                            </Button>
                        </Stack>
                        {formErrors.chapters && (
                            <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                                {formErrors.chapters}
                            </Typography>
                        )}
                        <Stack spacing={2}>
                            {formData.chapters.length === 0 ? (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography color="text.secondary">
                                        No chapters configured yet. Use “Add Chapter” to get started.
                                    </Typography>
                                </Paper>
                            ) : (
                                formData.chapters.map((chapter, index) => {
                                    const stageValues = coerceChapterStages(chapter.stage);
                                    return (
                                        <Paper key={chapter.id} variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={1.5}>
                                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                    <Typography variant="subtitle2">Chapter {chapter.id}</Typography>
                                                    <Stack direction="row" spacing={1}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveChapter(index, -1)}
                                                            disabled={index === 0}
                                                            aria-label="Move chapter up"
                                                        >
                                                            <ArrowUpwardIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveChapter(index, 1)}
                                                            disabled={index === formData.chapters.length - 1}
                                                            aria-label="Move chapter down"
                                                        >
                                                            <ArrowDownwardIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleRemoveChapter(index)}
                                                            disabled={formData.chapters.length <= MIN_CHAPTERS}
                                                            aria-label="Remove chapter"
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                                <TextField
                                                    label="Title"
                                                    value={chapter.title}
                                                    onChange={(event) =>
                                                        handleChapterFieldChange(index, { title: event.target.value })
                                                    }
                                                    fullWidth
                                                    required
                                                    helperText="Provide the chapter title as it should appear in ThesisData"
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
                                                >
                                                    {THESIS_STAGE_METADATA.map((stage) => (
                                                        <MenuItem key={stage.value} value={stage.value}>
                                                            {stage.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                                <TextField
                                                    label="Description"
                                                    value={chapter.description || ''}
                                                    onChange={(event) =>
                                                        handleChapterFieldChange(index, { description: event.target.value })
                                                    }
                                                    fullWidth
                                                    multiline
                                                    minRows={2}
                                                    helperText="Optional: add guidance or requirements for this chapter"
                                                />
                                            </Stack>
                                        </Paper>
                                    );
                                })
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent >
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    onClick={() => {
                        void onSubmit();
                    }}
                    variant="contained"
                    disabled={saving}
                >
                    {saving ? 'Saving…' : editMode ? 'Save Changes' : 'Create Template'}
                </Button>
            </DialogActions>
        </Dialog >
    );
}
