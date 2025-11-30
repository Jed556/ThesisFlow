import type { FileAttachment } from './file';
import type { ChapterSubmissionStatus, ExpertRole, ThesisStageName } from './thesis';

export interface WorkspaceFilterOption {
    label: string;
    value: string;
    description?: string;
}

export interface WorkspaceFilterConfig {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
    helperText?: string;
    disabled?: boolean;
    required?: boolean;
    loading?: boolean;
    options: WorkspaceFilterOption[];
    onChange: (value: string) => void;
}

export interface WorkspaceCommentPayload {
    thesisId: string;
    chapterId: number;
    chapterStage: ThesisStageName;
    versionIndex: number | null;
    content: string;
    files: File[];
    replyToId?: string;
}

export interface WorkspaceEditPayload extends WorkspaceCommentPayload {
    commentId: string;
}

export interface WorkspaceUploadPayload {
    thesisId: string;
    groupId: string;
    chapterId: number;
    chapterStage: ThesisStageName;
    file: File;
    /** Academic year for hierarchical storage path */
    year?: string;
    /** Department for hierarchical storage path */
    department?: string;
    /** Course for hierarchical storage path */
    course?: string;
}

export type WorkspaceChapterDecision = 'approved' | 'revision_required';

export interface WorkspaceChapterDecisionPayload {
    thesisId: string;
    chapterId: number;
    versionIndex?: number | null;
    decision: WorkspaceChapterDecision;
    role?: ExpertRole;
}

export interface VersionOption {
    id: string;
    label: string;
    versionIndex: number;
    file?: FileAttachment;
    status?: ChapterSubmissionStatus;
}

export type ChapterVersionMap = Record<number, VersionOption[]>;
