import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseStorage, firebaseAuth } from '../firebaseConfig';
import { validateImageFile, compressImage } from './file';

/**
 * Maximum file size for banner images (10MB)
 */
export const MAX_BANNER_SIZE = 10 * 1024 * 1024;

/**
 * Upload banner image for a user
 * @param file - Image file to upload
 * @param userEmail - User's email (used for file path)
 * @returns Download URL of uploaded image
 */
export async function uploadBanner(file: File, userEmail?: string): Promise<string> {
    const currentUser = firebaseAuth.currentUser;
    const email = userEmail || currentUser?.email;

    if (!email) {
        throw new Error('User not authenticated');
    }

    // Validate file
    const validation = validateImageFile(file, MAX_BANNER_SIZE);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    try {
        // Compress image to 1500x500 max (3:1 aspect ratio for banner)
        const compressedBlob = await compressImage(file, 1500, 500, 0.85);

        // Create storage reference
        const fileName = `banner_${Date.now()}.jpg`;
        const storageRef = ref(firebaseStorage, `banners/${encodeURIComponent(email)}/${fileName}`);

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
    } catch (error: any) {
        throw new Error(`Failed to upload banner: ${error?.message ?? String(error)}`);
    }
}
