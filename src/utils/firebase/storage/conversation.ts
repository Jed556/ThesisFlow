import type { FileAttachment } from '../../../types/file';
import type { ThesisStageName } from '../../../types/thesis';
import { uploadThesisFilesBatch } from './thesis';

export interface ConversationAttachmentUploadOptions {
    thesisId: string;
    groupId: string;
    chapterId: number;
    chapterStage: ThesisStageName;
    userUid: string;
    commentId?: string;
    metadata?: Record<string, string>;
}

/**
 * Uploads conversation attachments (mentor/adviser feedback assets) to thesis storage.
 */
export async function uploadConversationAttachments(
    files: File[],
    options: ConversationAttachmentUploadOptions
): Promise<FileAttachment[]> {
    if (!files.length) {
        return [];
    }

    const uploaded = await uploadThesisFilesBatch(files, {
        userUid: options.userUid,
        thesisId: options.thesisId,
        groupId: options.groupId,
        chapterId: options.chapterId,
        chapterStage: options.chapterStage,
        category: 'attachment',
        commentId: options.commentId,
        metadata: options.metadata,
    });

    return uploaded.map((item) => item.fileAttachment);
}
