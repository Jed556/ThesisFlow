import type { FileAttachment } from './file';
import type { ThesisStageName } from './thesis';

/**
 * Lifecycle states for a terminal requirement document.
 */
export type TerminalRequirementStatus = 'pending' | 'submitted';

/**
 * Static definition describing a required document for a thesis stage.
 */
export interface TerminalRequirement {
    id: string;
    stage: ThesisStageName;
    title: string;
    description: string;
    instructions?: string;
    optional?: boolean;
    tags?: string[];
    templateFile?: FileAttachment;
}

/**
 * Lightweight progress snapshot for a terminal requirement.
 */
export interface TerminalRequirementProgress {
    requirementId: string;
    stage: ThesisStageName;
    status: TerminalRequirementStatus;
    fileCount: number;
    updatedAt?: string;
}
