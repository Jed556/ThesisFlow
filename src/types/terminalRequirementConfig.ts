import type { ThesisStage } from './thesis';

export interface TerminalRequirementTemplateMetadata {
    fileId: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    uploadedBy: string;
}

export interface TerminalRequirementConfigEntry {
    stage: ThesisStage;
    requirementId: string;
    active: boolean;
    requireAttachment?: boolean;
    template?: TerminalRequirementTemplateMetadata;
}

export interface TerminalRequirementConfigDocument {
    id: string;
    department: string;
    course: string;
    requirements: TerminalRequirementConfigEntry[];
    createdAt: string;
    updatedAt: string;
}
