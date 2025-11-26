import type { ChipProps } from '@mui/material';
import type {
    WorkflowStep,
    WorkflowStepState,
    WorkflowStepMeta,
} from '../types/workflow';

/**
 * Metadata for each workflow step state
 */
export const WORKFLOW_STATE_META: Record<
    WorkflowStepState,
    { label: string; color: ChipProps['color'] }
> = {
    locked: { label: 'Locked', color: 'default' },
    available: { label: 'Available', color: 'info' },
    'in-progress': { label: 'In Progress', color: 'warning' },
    completed: { label: 'Completed', color: 'success' },
};

/**
 * Resolve step state based on completion and activity flags
 */
export function resolveStepState({
    completed,
    started,
}: {
    completed: boolean;
    started?: boolean;
}): 'in-progress' | 'completed' | 'available' {
    if (completed) return 'completed';
    if (started) return 'in-progress';
    return 'available';
}

/**
 * Check if a step's prerequisites are satisfied
 */
export function arePrerequisitesMet(
    step: WorkflowStep,
    allSteps: WorkflowStep[]
): boolean {
    if (!step.prerequisites || step.prerequisites.length === 0) {
        return true;
    }

    return step.prerequisites.every((prereq) => {
        const requiredStep = allSteps.find((s) => s.id === prereq.stepId);
        if (!requiredStep) {
            console.warn(`Prerequisite step ${prereq.stepId} not found`);
            return false;
        }

        if (prereq.type === 'prerequisite') {
            // Must be completed
            return requiredStep.state === 'completed';
        } else if (prereq.type === 'corequisite') {
            // Must be in-progress or completed
            return (
                requiredStep.state === 'in-progress' ||
                requiredStep.state === 'completed'
            );
        }

        return false;
    });
}

/**
 * Apply prerequisite locks to workflow steps
 * Returns a new array with updated states
 */
export function applyPrerequisiteLocks(steps: WorkflowStep[]): WorkflowStep[] {
    return steps.map((step) => {
        // Skip if already completed
        if (step.state === 'completed') {
            return step;
        }

        // Check if prerequisites are met
        const prerequisitesMet = arePrerequisitesMet(step, steps);

        // Lock step if prerequisites not met and step is not in progress
        if (!prerequisitesMet && step.state !== 'in-progress') {
            return {
                ...step,
                state: 'locked',
            };
        }

        return step;
    });
}

/**
 * Get display metadata for a workflow step
 */
export function getStepMeta(step: WorkflowStep): WorkflowStepMeta {
    const isLocked = step.state === 'locked';
    const isCompleted = step.state === 'completed';
    const isAccessible = !isLocked;

    return {
        expandable: !isLocked,
        defaultExpanded: !isCompleted && !isLocked,
        accessible: isAccessible,
        displayMessage: isCompleted
            ? step.completedMessage || step.description
            : step.description,
        showActionButton: !isCompleted && isAccessible,
    };
}

/**
 * Find the index of the first incomplete step
 * Returns the total number of steps if all are completed
 */
export function getActiveStepIndex(steps: WorkflowStep[]): number {
    const firstIncomplete = steps.findIndex(
        (step) => step.state !== 'completed'
    );
    return firstIncomplete === -1 ? steps.length : firstIncomplete;
}

/**
 * Get a list of prerequisite step titles for display
 */
export function getPrerequisiteTitles(
    step: WorkflowStep,
    allSteps: WorkflowStep[]
): string[] {
    if (!step.prerequisites || step.prerequisites.length === 0) {
        return [];
    }

    return step.prerequisites
        .map((prereq) => {
            const requiredStep = allSteps.find((s) => s.id === prereq.stepId);
            return requiredStep?.title || prereq.stepId;
        })
        .filter(Boolean);
}

/**
 * Format prerequisite message for locked steps
 */
export function formatPrerequisiteMessage(
    step: WorkflowStep,
    allSteps: WorkflowStep[]
): string {
    const titles = getPrerequisiteTitles(step, allSteps);

    if (titles.length === 0) {
        return 'This step is currently locked.';
    }

    const hasPrerequisite = step.prerequisites?.some(
        (p) => p.type === 'prerequisite'
    );
    const hasCorequisite = step.prerequisites?.some(
        (p) => p.type === 'corequisite'
    );

    if (hasPrerequisite && !hasCorequisite) {
        const stepText = titles.length === 1 ? 'step' : 'steps';
        return `Complete ${titles.join(', ')} ${stepText} first.`;
    }

    if (hasCorequisite && !hasPrerequisite) {
        const stepText = titles.length === 1 ? 'step' : 'steps';
        return `Start ${titles.join(', ')} ${stepText} to unlock this.`;
    }

    return `Prerequisites: ${titles.join(', ')}`;
}
