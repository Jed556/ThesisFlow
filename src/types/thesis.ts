import type { FileAttachment } from './file';
import type { UserRole } from './profile';


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
 * State of expert approvals (maps expert role to approval status)
 */
export type ExpertApprovalState = Partial<Record<ExpertRole, boolean>>;

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
 * Supported thesis progress stages
 */
export type ThesisStageName = 'Pre-Proposal' | 'Post-Proposal' | 'Pre-Defense' | 'Post-Defense';

/**
 * Environmental, Social, and Governance (ESG) categories
 */
export type ESG = 'Environment' | 'Social' | 'Governance';

/**
 * Array of all ESG values for selection
 */
export const ESG_VALUES: ESG[] = ['Environment', 'Social', 'Governance'];

/**
 * Sustainable Development Goals (SDG)
 */
export type SDG = 'No Poverty' | 'Zero Hunger' | 'Good Health and Well-being' | 'Quality Education' | 'Gender Equality' |
    'Clean Water and Sanitation' | 'Affordable and Clean Energy' | 'Decent Work and Economic Growth' |
    'Industry, Innovation and Infrastructure' | 'Reduced Inequalities' | 'Sustainable Cities and Communities' |
    'Responsible Consumption and Production' | 'Climate Action' | 'Life Below Water' | 'Life on Land' |
    'Peace, Justice and Strong Institutions' | 'Partnerships for the Goals';

/**
 * Array of all SDG values for selection
 */
export const SDG_VALUES: SDG[] = [
    'No Poverty',
    'Zero Hunger',
    'Good Health and Well-being',
    'Quality Education',
    'Gender Equality',
    'Clean Water and Sanitation',
    'Affordable and Clean Energy',
    'Decent Work and Economic Growth',
    'Industry, Innovation and Infrastructure',
    'Reduced Inequalities',
    'Sustainable Cities and Communities',
    'Responsible Consumption and Production',
    'Climate Action',
    'Life Below Water',
    'Life on Land',
    'Peace, Justice and Strong Institutions',
    'Partnerships for the Goals',
];

/**
 * Chapter submission status for review workflow
 */
export type ChapterSubmissionStatus = 'under_review' | 'approved' | 'rejected' | 'revision_required';

/**
 * Chapter submission entry with decision metadata
 */
export interface ChapterSubmissionEntry {
    id: string;
    status: ChapterSubmissionStatus;
    decidedAt?: string;
    decidedBy?: ExpertRole | 'system';
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
    /** Decision timestamp */
    decidedAt?: string;
    /** Who made the decision */
    decidedBy?: ExpertRole | 'system';
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
    chapters?: ThesisChapter[];
}

/**
 * Thesis chapter details
 */
export interface ThesisChapter {
    id: number;
    title: string;
    status: ThesisStatus;
    submissionDate?: Date | string | null;
    lastModified?: Date | string | null;
    submissions: (ChapterSubmission | ChapterSubmissionEntry)[];
    comments: ThesisComment[];
    stage?: ThesisStageName[];
    approvalStatus?: ThesisStatus;
    expertApprovals?: ExpertApprovalState;
}

/**
 * Main thesis data
 */
export interface ThesisData {
    id?: string;
    title: string;
    submissionDate: Date | string;
    lastUpdated: Date | string;
    stages: ThesisStage[];
    chapters?: ThesisChapter[];
    /** Research agenda classification */
    agenda?: ThesisAgenda;
    /** ESG category */
    ESG?: ESG;
    /** Sustainable Development Goal */
    SDG?: SDG;
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
