import type { ThesisStage } from './thesis';

/**
 * Lifecycle states for a terminal requirement document.
 */
export type TerminalRequirementStatus = 'pending' | 'submitted';

/**
 * Static definition describing a required document for a thesis stage.
 */
export interface TerminalRequirementDefinition {
    id: string;
    stage: ThesisStage;
    title: string;
    description: string;
    instructions?: string;
    optional?: boolean;
    tags?: string[];
    templateFileName?: string;
    templateFileUrl?: string;
    templateFileId?: string;
}

/**
 * Lightweight progress snapshot for a terminal requirement.
 */
export interface TerminalRequirementProgress {
    requirementId: string;
    stage: ThesisStage;
    status: TerminalRequirementStatus;
    fileCount: number;
    updatedAt?: string;
}
