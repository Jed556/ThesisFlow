import type { ConversationParticipant } from '../Conversation';
import type { ThesisData } from '../../types/thesis';

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
    chapterId: number;
    file: File;
}

export interface ThesisWorkspaceProps {
    thesisId?: string;
    thesis?: ThesisData | null;
    participants?: Record<string, ConversationParticipant>;
    currentUserId?: string;
    filters?: WorkspaceFilterConfig[];
    isLoading?: boolean;
    allowCommenting?: boolean;
    emptyStateMessage?: string;
    conversationHeight?: number | string;
    onCreateComment?: (payload: WorkspaceCommentPayload) => Promise<void> | void;
    onEditComment?: (payload: WorkspaceEditPayload) => Promise<void> | void;
    onUploadChapter?: (payload: WorkspaceUploadPayload) => Promise<void> | void;
}
