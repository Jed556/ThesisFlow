import { firebaseAuth } from '../firebaseConfig';
import { validateImageFile, compressImage } from './file';
import { uploadFileToStorage, generateUniqueFileId } from './common';
import { getError } from '../../../../utils/errorUtils';
import { FILE_SIZE_LIMITS, IMAGE_COMPRESSION, STORAGE_PATHS } from '../../../config/files';

/**
 * Maximum file size for banner images
 */
export const MAX_BANNER_SIZE = FILE_SIZE_LIMITS.image;

/**
 * Upload banner image for a user
 * @param file - Image file to upload
 * @param userUid - User's UID (used for file path)
 * @returns Download URL of uploaded image
 */
export async function uploadBanner(file: File, userUid?: string): Promise<string> {
    const currentUser = firebaseAuth.currentUser;
    const uid = userUid || currentUser?.uid;

    if (!uid) {
        throw new Error('User not authenticated');
    }

    // Validate file
    const validation = validateImageFile(file, MAX_BANNER_SIZE);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    try {
        // Compress image to optimal banner size (3:1 aspect ratio)
        const compressedBlob = await compressImage(
            file,
            IMAGE_COMPRESSION.banner.maxWidth,
            IMAGE_COMPRESSION.banner.maxHeight,
            IMAGE_COMPRESSION.banner.quality
        );

        // Generate storage path
        const fileId = generateUniqueFileId(uid, 'banner');
        const storagePath = `${STORAGE_PATHS.banners(uid)}/${fileId}.jpg`;

        // Upload file with metadata
        const downloadURL = await uploadFileToStorage(compressedBlob, storagePath, {
            uploadedBy: uid,
            originalName: file.name,
            type: 'banner'
        });

        return downloadURL;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to upload banner');
        throw new Error(`Failed to upload banner: ${message}`);
    }
}
