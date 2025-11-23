import * as React from 'react';
import {
    Box, Button, Card, CardContent, Checkbox, FormControlLabel,
    FormGroup, Step, StepContent, StepLabel, Stepper, Typography
} from '@mui/material';
import {
    Check as CheckIcon, Save as SaveIcon
} from '@mui/icons-material';
import type { ChapterTemplate, ChapterStageKey } from '../../types/chapter';
import { CHAPTER_STAGE_OPTIONS } from '../../types/chapter';

/**
 * Props for ChapterStageManagementStepper component
 */
export interface ChapterStageManagementStepperProps {
    /** Chapter templates to configure stages for */
    chapters: ChapterTemplate[];

    /** Callback when stages are updated */
    onStagesUpdate: (updatedChapters: ChapterTemplate[]) => void;

    /** Whether the stepper is in read-only mode */
    readOnly?: boolean;
}

/**
 * Admin stepper UI for managing chapter stages
 * 
 * Allows administrators to configure which stages each chapter appears in.
 * Uses Material-UI Stepper for guided configuration workflow.
 */
export default function ChapterStageManagementStepper({
    chapters,
    onStagesUpdate,
    readOnly = false,
}: ChapterStageManagementStepperProps) {
    const [activeStep, setActiveStep] = React.useState(0);
    const [editedChapters, setEditedChapters] = React.useState<ChapterTemplate[]>(chapters);

    // Sync with external changes
    React.useEffect(() => {
        setEditedChapters(chapters);
    }, [chapters]);

    /**
     * Handle stage selection for a chapter
     */
    const handleStageToggle = (chapterIndex: number, stage: ChapterStageKey) => {
        const updated = [...editedChapters];
        const chapter = updated[chapterIndex];
        const currentStages = chapter.stages || [];

        if (currentStages.includes(stage)) {
            // Remove stage
            chapter.stages = currentStages.filter(s => s !== stage);
        } else {
            // Add stage
            chapter.stages = [...currentStages, stage];
        }

        setEditedChapters(updated);
    };

    /**
     * Save changes and move to next step
     */
    const handleNext = () => {
        if (activeStep === editedChapters.length - 1) {
            // Last step - save all changes
            onStagesUpdate(editedChapters);
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    /**
     * Move to previous step
     */
    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    /**
     * Reset to original values
     */
    const handleReset = () => {
        setEditedChapters(chapters);
        setActiveStep(0);
    };

    /**
     * Check if current step is complete
     */
    const isStepComplete = (stepIndex: number): boolean => {
        const chapter = editedChapters[stepIndex];
        return (chapter.stages?.length ?? 0) > 0;
    };

    if (editedChapters.length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary">
                        No chapters configured. Add chapters to configure stage visibility.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Configure Chapter Stage Visibility
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Select which thesis stages each chapter should appear in.
                Students will only see chapters relevant to their current stage.
            </Typography>

            <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 3 }}>
                {editedChapters.map((chapter, index) => {
                    const isComplete = isStepComplete(index);
                    const currentStages = chapter.stages || [];

                    return (
                        <Step key={chapter.id} completed={isComplete}>
                            <StepLabel
                                optional={
                                    currentStages.length > 0 ? (
                                        <Typography variant="caption">
                                            {currentStages.length} stage{currentStages.length !== 1 ? 's' : ''} selected
                                        </Typography>
                                    ) : (
                                        <Typography variant="caption" color="warning.main">
                                            No stages selected
                                        </Typography>
                                    )
                                }
                            >
                                Chapter {chapter.id}: {chapter.title}
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {chapter.description || 'No description provided'}
                                    </Typography>

                                    <FormGroup sx={{ mt: 2 }}>
                                        {CHAPTER_STAGE_OPTIONS.map((stage) => (
                                            <FormControlLabel
                                                key={stage}
                                                control={
                                                    <Checkbox
                                                        checked={currentStages.includes(stage)}
                                                        onChange={() => handleStageToggle(index, stage)}
                                                        disabled={readOnly}
                                                    />
                                                }
                                                label={stage}
                                            />
                                        ))}
                                    </FormGroup>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        disabled={index === 0}
                                        onClick={handleBack}
                                        variant="outlined"
                                        size="small"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleNext}
                                        size="small"
                                        startIcon={
                                            index === editedChapters.length - 1 ? (
                                                <SaveIcon />
                                            ) : (
                                                <CheckIcon />
                                            )
                                        }
                                        disabled={readOnly || !isComplete}
                                    >
                                        {index === editedChapters.length - 1 ? 'Save All' : 'Next'}
                                    </Button>
                                </Box>
                            </StepContent>
                        </Step>
                    );
                })}
            </Stepper>

            {activeStep === editedChapters.length && (
                <Card sx={{ mt: 2, bgcolor: 'success.light' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            ✓ Stage Configuration Complete
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                            All chapters have been configured. Changes have been saved.
                        </Typography>
                        <Button
                            onClick={handleReset}
                            variant="outlined"
                            size="small"
                            sx={{ mt: 1 }}
                        >
                            Reset
                        </Button>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}
