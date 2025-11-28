import type { ThesisStageName } from './thesis';

export interface TerminalRequirementTemplateMetadata {
    fileId: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    uploadedBy: string;
}

export interface TerminalRequirementConfigEntry {
    stage: ThesisStageName;
    requirementId: string;
    active: boolean;
    requireAttachment?: boolean;
    template?: TerminalRequirementTemplateMetadata;
}

/**
 * Terminal Requirement Configuration Document
 * 
 * Terminal requirements are now global (same for all departments/courses).
 * The `name` field is the display name for the configuration.
 * The `department` and `course` fields are deprecated but kept for backward compatibility.
 */
export interface TerminalRequirementConfigDocument {
    /** Document ID */
    id: string;
    /** Display name for the configuration */
    name: string;
    /** Optional description */
    description?: string;
    /** @deprecated Terminal requirements are now global */
    department?: string;
    /** @deprecated Terminal requirements are now global */
    course?: string;
    /** Requirement entries */
    requirements: TerminalRequirementConfigEntry[];
    /** Creation timestamp (ISO string) */
    createdAt: string;
    /** Last update timestamp (ISO string) */
    updatedAt: string;
}
