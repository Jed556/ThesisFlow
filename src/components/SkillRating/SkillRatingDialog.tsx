import * as React from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Stack, Typography, useMediaQuery, useTheme
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { ExpertSkillRating, SkillTemplateRecord } from '../../types/skillTemplate';
import { SkillRatingForm } from './SkillRatingForm';

// ============================================================================
// Types
// ============================================================================

export interface SkillRatingDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Called when the dialog should close */
    onClose: () => void;
    /** Department name for header display */
    department: string;
    /** List of skill templates to rate */
    skills: SkillTemplateRecord[];
    /** Current skill ratings */
    ratings: ExpertSkillRating[];
    /** Called when ratings are saved */
    onSave: (ratings: ExpertSkillRating[]) => Promise<void>;
    /** Whether skills are loading */
    loading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dialog wrapper for the SkillRatingForm component.
 * Allows experts to rate their skills in a modal view.
 */
export function SkillRatingDialog({
    open,
    onClose,
    department,
    skills,
    ratings: initialRatings,
    onSave,
    loading = false,
}: SkillRatingDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    // Local state for editing
    const [localRatings, setLocalRatings] = React.useState<ExpertSkillRating[]>(initialRatings);
    const [saving, setSaving] = React.useState(false);

    // Sync local ratings when dialog opens or initial ratings change
    React.useEffect(() => {
        if (open) {
            setLocalRatings(initialRatings);
        }
    }, [open, initialRatings]);

    // Handle rating changes - include description and keywords for TF-IDF matching
    const handleRatingChange = React.useCallback((skillId: string, skillName: string, rating: number) => {
        // Find the skill template to get description and keywords
        const skillTemplate = skills.find((s) => s.id === skillId);
        setLocalRatings((prev) => {
            const existingIndex = prev.findIndex((r) => r.skillId === skillId);
            const newRating: ExpertSkillRating = {
                skillId,
                name: skillName,
                rating,
                description: skillTemplate?.description,
                keywords: skillTemplate?.keywords,
            };
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newRating;
                return updated;
            }
            return [...prev, newRating];
        });
    }, [skills]);

    // Check if ratings have changed
    const hasChanges = React.useMemo(() => {
        if (localRatings.length !== initialRatings.length) return true;
        return localRatings.some((rating) => {
            const initial = initialRatings.find((r) => r.skillId === rating.skillId);
            return !initial || initial.rating !== rating.rating;
        });
    }, [localRatings, initialRatings]);

    // Handle save
    const handleSave = React.useCallback(async () => {
        setSaving(true);
        try {
            await onSave(localRatings);
            onClose();
        } catch (err) {
            console.error('Failed to save skill ratings:', err);
            // Error is handled by parent
        } finally {
            setSaving(false);
        }
    }, [localRatings, onSave, onClose]);

    // Handle cancel
    const handleCancel = React.useCallback(() => {
        setLocalRatings(initialRatings);
        onClose();
    }, [initialRatings, onClose]);

    const ratedCount = localRatings.filter((r) => r.rating > 0).length;
    const totalCount = skills.length;

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            fullScreen={fullScreen}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        maxHeight: fullScreen ? '100%' : '90vh',
                    },
                },
            }}
        >
            <DialogTitle>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Stack>
                        <Typography variant="h6" component="span">
                            Rate Your Skills
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {department} • {ratedCount}/{totalCount} rated
                        </Typography>
                    </Stack>
                    <IconButton
                        onClick={handleCancel}
                        size="small"
                        aria-label="close"
                    >
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <SkillRatingForm
                    department={department}
                    skills={skills}
                    ratings={localRatings}
                    onRatingChange={handleRatingChange}
                    loading={loading}
                    showLegend
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleCancel} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save Ratings'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SkillRatingDialog;
