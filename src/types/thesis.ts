import type { FileAttachment } from './file';
import type { UserRole } from './profile';
import type { TopicProposalSet } from './proposal';


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
 * Mentor role types for thesis mentoring
 */
export type MentorRole = 'adviser' | 'editor' | 'statistician';

/**
 * State of mentor approvals (maps mentor role to approval status)
 */
export type MentorApprovalState = Partial<Record<MentorRole, boolean>>;

/**
 * Thesis role for access control
 */
export type ThesisRole = 'leader' | 'member' | 'adviser' | 'editor' | 'statistician' | 'panel' | 'unknown';

/**
 * 
 */
export type ThesisAgenda = {

    mainTheme: string;
    subTheme: string;
}

export type ThesisAgendas = ThesisAgenda[];

/**
 * Supported thesis progress stages
 */
export type ThesisStageName = 'Pre-Proposal' | 'Post-Proposal' | 'Pre-Defense' | 'Post-Defense';

/**
 *  
 */
export type ESG = 'Environment' | 'Social' | 'Governance';

export type SDG = 'No Poverty' | 'Zero Hunger' | 'Good Health and Well-being' | 'Quality Education' | 'Gender Equality' |
    'Clean Water and Sanitation' | 'Affordable and Clean Energy' | 'Decent Work and Economic Growth' |
    'Industry, Innovation and Infrastructure' | 'Reduced Inequalities' | 'Sustainable Cities and Communities' |
    'Responsible Consumption and Production' | 'Climate Action' | 'Life Below Water' | 'Life on Land' |
    'Peace, Justice and Strong Institutions' | 'Partnerships for the Goals';

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
    decidedBy?: MentorRole | 'system';
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
    decidedBy?: MentorRole | 'system';
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
    mentorApprovals?: MentorApprovalState;
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
    proposals?: TopicProposalSet;
    /** Overall thesis status */
    overallStatus?: ThesisStatus;
    /** Group ID this thesis belongs to */
    groupId?: string;
    /** Assigned adviser UID */
    adviser?: string;
    /** Assigned editor UID */
    editor?: string;
    /** Assigned statistician UID */
    statistician?: string;
    /** Group leader UID */
    leader?: string;
    /** Group member UIDs */
    members?: string[];
    /** List of chapters */
    chapters?: ThesisChapter[];
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
