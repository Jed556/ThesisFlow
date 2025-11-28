import type { FileAttachment } from './file';
import type { UserRole } from './profile';
import type { TopicProposalSet } from './proposal';


/**
 * Thesis-specific status
 */
export type ThesisStatus = 'none' | 'pending' | 'draft' | 'review' | 'revision' | 'approved' | 'rejected' | 'completed' | 'archived';

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
 * Chapter submission details
 */
export interface ChapterSubmission {
    id: string;
    status: ThesisStatus;
    submittedAt?: Date;
    submittedBy?: UserRole;
    files?: FileAttachment[];
}

/**
 * Thesis comment/feedback
 */
export interface ThesisComment {
    id: string;
    author: string; // Firebase UID of author
    date: Date;
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
    submissionDate: Date;
    lastModified: Date;
    submissions: ChapterSubmission[];
    comments: ThesisComment[];
    stage?: ThesisStageName[];
    approvalStatus?: ThesisStatus;
}

/**
 * Main thesis data
 */
export interface ThesisData {
    id?: string;
    title: string;
    submissionDate: Date;
    lastUpdated: Date;
    stages: ThesisStage[];
    proposals?: TopicProposalSet;
}

/**
 * Status color mapping
 */
export type StatusColor = 'success' | 'warning' | 'error' | 'default';
