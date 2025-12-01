import type { ThesisStageName } from './thesis';

export interface TerminalRequirementFileTemplate {
    fileId: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    uploadedBy: string;
}

export interface TerminalRequirementConfigEntry {
    stage: ThesisStageName;
    requirementId: string;
    required: boolean;
    /** Display title for the requirement */
    title?: string;
    /** Description or instructions for the requirement */
    description?: string;
    requireAttachment?: boolean;
    fileTemplate?: TerminalRequirementFileTemplate;
}

export type TerminalRequirementStageTemplates = Partial<Record<ThesisStageName, TerminalRequirementFileTemplate>>;

/**
 * Terminal Requirement Configuration Document
 *
 * Templates are scoped per academic year, department, and course under the
 * course templates collection. The `name` field is the display label while the
 * `department` and `course` fields identify the owning program.
 */
export interface TerminalRequirementConfigDocument {
    /** Document ID */
    id: string;
    /** Academic year segment */
    year: string;
    /** Display name for the configuration */
    name: string;
    /** Optional description */
    description?: string;
    /** Department for organization/filtering */
    department: string;
    /** Course for organization/filtering */
    course: string;
    /** Requirement entries */
    requirements: TerminalRequirementConfigEntry[];
    /** Stage-level templates mapped by thesis stage */
    stageTemplates?: TerminalRequirementStageTemplates;
    /** Creation timestamp (ISO string) */
    createdAt: string;
    /** Last update timestamp (ISO string) */
    updatedAt: string;
}
