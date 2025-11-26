/**
 * Image file storage utilities
 * Handles image validation, compression, and upload
 */

import { ALLOWED_MIME_TYPES, IMAGE_COMPRESSION } from '../../../config/files';

/**
 * Allowed image types for upload
 */
export const ALLOWED_IMAGE_TYPES = ALLOWED_MIME_TYPES.image;

/**
 * Validate image file before upload
 * @param file - File to validate
 * @param maxSize - Maximum allowed file size in bytes
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File, maxSize: number): { valid: boolean; error?: string } {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        return {
            valid: false,
            error: 'Invalid file type. Allowed types: JPG, PNG, WebP, GIF',
        };
    }

    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File size exceeds ${maxSizeMB}MB limit`,
        };
    }

    return { valid: true };
}

/**
 * Compress image file using canvas
 * @param file - Original image file
 * @param maxWidth - Maximum width for compressed image
 * @param maxHeight - Maximum height for compressed image
 * @param quality - JPEG quality (0-1), defaults to 0.85
 * @returns Compressed image blob
 */
export async function compressImage(
    file: File,
    maxWidth: number = IMAGE_COMPRESSION.preview.maxWidth,
    maxHeight: number = IMAGE_COMPRESSION.preview.maxHeight,
    quality: number = IMAGE_COMPRESSION.preview.quality
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}



/**
 * Create a preview URL for an image file
 * @param file - Image file to preview
 * @returns Object URL for preview (remember to revoke when done)
 */
export function createImagePreview(file: File): string {
    return URL.createObjectURL(file);
}

/**
 * Revoke an object URL to free memory
 * @param url - Object URL to revoke
 */
export function revokeImagePreview(url: string): void {
    URL.revokeObjectURL(url);
}
