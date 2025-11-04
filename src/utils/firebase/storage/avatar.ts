import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseStorage, firebaseAuth } from '../firebaseConfig';
import { validateImageFile, compressImage } from './file';
import { getError } from '../../../../utils/errorUtils';

/**
 * Maximum file size for avatar images (5MB)
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/**
 * Upload avatar image for a user
 * @param file - Image file to upload
 * @param userEmail - User's email (used for file path)
 * @returns Download URL of uploaded image
 */
export async function uploadAvatar(file: File, userEmail?: string): Promise<string> {
    const currentUser = firebaseAuth.currentUser;
    const email = userEmail || currentUser?.email;

    if (!email) {
        throw new Error('User not authenticated');
    }

    // Validate file
    const validation = validateImageFile(file, MAX_AVATAR_SIZE);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    try {
        // Compress image to 400x400 max
        const compressedBlob = await compressImage(file, 400, 400, 0.85);

        // Create storage reference
        const fileName = `avatar_${Date.now()}.jpg`;
        const storageRef = ref(firebaseStorage, `avatars/${encodeURIComponent(email)}/${fileName}`);

        // Upload file
        await uploadBytes(storageRef, compressedBlob, {
            contentType: 'image/jpeg',
            customMetadata: {
                uploadedBy: email,
                originalName: file.name,
            },
        });

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to upload avatar');
        throw new Error(`Failed to upload avatar: ${message}`);
    }
}
