import type { FileAttachment } from '../../../types/file';
import { uploadThesisFilesBatch } from './thesis';

export interface ConversationAttachmentUploadOptions {
    thesisId: string;
    chapterId: number;
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
        chapterId: options.chapterId,
        category: 'attachment',
        commentId: options.commentId,
        metadata: options.metadata,
    });

    return uploaded.map((item) => item.fileAttachment);
}
