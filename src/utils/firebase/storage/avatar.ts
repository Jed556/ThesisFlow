import { firebaseAuth } from '../firebaseConfig';
import { validateImageFile, compressImage } from './file';
import { uploadFileToStorage, generateUniqueFileId } from './common';
import { getError } from '../../../../utils/errorUtils';
import { FILE_SIZE_LIMITS, IMAGE_COMPRESSION, STORAGE_PATHS } from '../../../config/files';

/**
 * Maximum file size for avatar images
 */
export const MAX_AVATAR_SIZE = FILE_SIZE_LIMITS.image;

/**
 * Upload avatar image for a user
 * @param file - Image file to upload
 * @param userUid - User's UID (used for file path)
 * @returns Download URL of uploaded image
 */
export async function uploadAvatar(file: File, userUid?: string): Promise<string> {
    const currentUser = firebaseAuth.currentUser;
    const uid = userUid || currentUser?.uid;

    if (!uid) {
        throw new Error('User not authenticated');
    }

    // Validate file
    const validation = validateImageFile(file, MAX_AVATAR_SIZE);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    try {
        // Compress image to optimal avatar size
        const compressedBlob = await compressImage(
            file,
            IMAGE_COMPRESSION.avatar.maxWidth,
            IMAGE_COMPRESSION.avatar.maxHeight,
            IMAGE_COMPRESSION.avatar.quality
        );

        // Generate storage path
        const fileId = generateUniqueFileId(uid, 'avatar');
        const storagePath = `${STORAGE_PATHS.avatars(uid)}/${fileId}.jpg`;

        // Upload file with metadata
        const downloadURL = await uploadFileToStorage(compressedBlob, storagePath, {
            uploadedBy: uid,
            originalName: file.name,
            type: 'avatar'
        });

        return downloadURL;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to upload avatar');
        throw new Error(`Failed to upload avatar: ${message}`);
    }
}
