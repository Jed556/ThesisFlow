import type { FileAttachment } from './file';
import type { UserRole } from './profile';
import ESGsConfig from '../config/ESGs.json';
import SDGsConfig from '../config/SDGs.json';
import StagesConfig from '../config/stages.json';


/**
 * Thesis-specific status
 */
export type ThesisStatus =
    | 'none'
    | 'pending'
    | 'draft'
    | 'review'
    | 'revision'
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'archived'
    | 'not_submitted'
    | 'under_review'
    | 'revision_required';

/**
 * Expert role types for thesis experting
 */
export type ExpertRole = 'adviser' | 'editor' | 'statistician';

/**
 * Decision made by an expert
 */
export type ExpertDecision = 'approved' | 'revision_required';

/**
 * Individual expert approval entry
 */
export interface ExpertApproval {
    role: ExpertRole;
    decidedAt: string;
    /** The decision made - defaults to 'approved' for backward compatibility */
    decision?: ExpertDecision;
}

/**
 * State of expert approvals (array of approval entries)
 */
export type ExpertApprovalState = ExpertApproval[];

/**
 * Thesis role for access control
 */
export type ThesisRole = 'leader' | 'member' | 'adviser' | 'editor' | 'statistician' | 'panel' | 'unknown';

/**
 * Agenda type - institutional or departmental (collegiate)
 */
export type AgendaType = 'institutional' | 'departmental';

/**
 * Recursive agenda item structure for config files
 */
export interface AgendaItem {
    /** Title of the agenda */
    title: string;
    /** Optional description */
    description?: string;
    /** Nested sub-agendas (can be infinitely nested) */
    subAgenda: AgendaItem[];
}

/**
 * Research agenda classification for a thesis
 * Supports infinite nesting depth via agendaPath array
 */
export type ThesisAgenda = {
    /** Type of agenda: institutional or departmental */
    type: AgendaType;
    /** Department (only for departmental agendas) */
    department?: string;
    /** 
     * Path of selected agendas from root to leaf
     * Each element is a title at that depth level
     * Example: ["DIGITAL TRANSFORMATION AND INNOVATION", "Artificial Intelligence and Data Science", "Machine Learning"]
     */
    agendaPath: string[];
}

export type ThesisAgendas = ThesisAgenda[];

/**
 * Stage configuration from JSON
 */
export interface StageConfigItem {
    name: string;
    slug: string;
}

/**
 * Supported thesis progress stages (derived from JSON config)
 */
export type ThesisStageName = typeof StagesConfig.stages[number]['name'];

/**
 * Array of all stage values for selection
 */
export const THESIS_STAGE_VALUES: readonly ThesisStageName[] = StagesConfig.stages.map(s => s.name) as ThesisStageName[];

/**
 * Environmental, Social, and Governance (ESG) categories
 */
export type ESG = typeof ESGsConfig.values[number];

/**
 * Array of all ESG values for selection
 */
export const ESG_VALUES: readonly ESG[] = ESGsConfig.values as ESG[];

/**
 * Sustainable Development Goals (SDG)
 */
export type SDG = typeof SDGsConfig.values[number];

/**
 * Array of all SDG values for selection
 */
export const SDG_VALUES: readonly SDG[] = SDGsConfig.values as SDG[];

/**
 * Chapter submission status for review workflow
 * - draft: Uploaded but not yet submitted for review
 * - under_review: Submitted and awaiting expert approval
 * - approved: Fully approved by all required experts
 * - rejected: Rejected (legacy, may not be used)
 * - revision_required: Expert requested changes
 * - ignored: Superseded by an approved version (hidden from expert actions)
 */
export type ChapterSubmissionStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'revision_required' | 'ignored';

/**
 * Chapter submission entry with decision metadata
 */
export interface ChapterSubmissionEntry {
    id: string;
    status: ChapterSubmissionStatus;
}

/**
 * Chapter submission details
 */
export interface ChapterSubmission {
    id: string;
    status: ThesisStatus;
    submittedAt?: Date;
    submittedBy?: UserRole;
    files?: FileAttachment[];
    /** Expert approval states for this submission */
    expertApprovals?: ExpertApprovalState;
}

/**
 * Thesis comment/feedback
 */
export interface ThesisComment {
    id: string;
    author: string; // Firebase UID of author
    date: Date | string;
    comment: string;
    isEdited?: boolean;
    attachments?: FileAttachment[];
    version?: number;
}

export interface ThesisStage {
    id: string;
    name: ThesisStageName;
    startedAt: Date;
    completedAt?: Date;
}

/**
 * Thesis chapter details
 * Note: Status and expertApprovals are now per-submission (on FileAttachment)
 */
export interface ThesisChapter {
    id: number;
    title: string;
    submissionDate?: Date | string | null;
    lastModified?: Date | string | null;
    submissions: (ChapterSubmission | ChapterSubmissionEntry)[];
    comments: ThesisComment[];
    stage?: ThesisStageName[];
}

/**
 * Main thesis data
 * Note: Status and expertApprovals are now per-submission (on FileAttachment), not per-chapter
 * Note: Chapters are stored in a subcollection, not embedded in thesis document
 */
export interface ThesisData {
    id?: string;
    title: string;
    submissionDate: Date | string;
    lastUpdated: Date | string;
    stages: ThesisStage[];
    /** Research agenda classification */
    agenda?: ThesisAgenda;
    /** ESG category */
    ESG?: ESG;
    /** Sustainable Development Goal */
    SDG?: SDG;
    /**
     * @deprecated Chapters are stored in subcollection.
     * Use listenChaptersForStage or getChaptersForStage from chapters.ts instead.
     * This field may be populated for backward compatibility but should not be relied upon.
     */
    chapters?: ThesisChapter[];
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
