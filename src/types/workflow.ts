/**
 * Workflow step state types
 */
export type WorkflowStepState = 'locked' | 'available' | 'in-progress' | 'completed';

/**
 * Prerequisite requirement type
 * - 'prerequisite': Step must be completed before this step becomes available
 * - 'corequisite': Step must be in-progress or completed alongside this step
 */
export type PrerequisiteType = 'prerequisite' | 'corequisite';

/**
 * Prerequisite configuration for a workflow step
 */
export interface WorkflowPrerequisite {
    /** ID of the required step */
    stepId: string;
    /** Type of requirement */
    type: PrerequisiteType;
}

/**
 * Workflow step configuration
 */
export interface WorkflowStep {
    /** Unique identifier for the step */
    id: string;
    /** Display title */
    title: string;
    /** Description shown when step is available/in-progress */
    description: string;
    /** Message shown when step is completed */
    completedMessage?: string;
    /** Current state of the step */
    state: WorkflowStepState;
    /** Label for the action button */
    actionLabel?: string;
    /** Navigation path for the action button */
    actionPath?: string;
    /** Icon component to display */
    icon: React.ReactNode;
    /** Prerequisites that must be met before this step is accessible */
    prerequisites?: WorkflowPrerequisite[];
}

/**
 * Workflow step display metadata
 */
export interface WorkflowStepMeta {
    /** Whether the step can be expanded */
    expandable: boolean;
    /** Whether the step should be expanded by default */
    defaultExpanded: boolean;
    /** Whether the step is accessible (not locked by prerequisites) */
    accessible: boolean;
    /** Display message based on state */
    displayMessage: string;
    /** Whether to show the action button */
    showActionButton: boolean;
}
