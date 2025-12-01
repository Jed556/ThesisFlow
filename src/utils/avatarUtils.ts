import type { UserProfile } from '../types/profile';
import { uploadAvatar as uploadAvatarToStorage } from './firebase/storage/avatar';
import { updateUserProfile } from './firebase/firestore';

/**
 * Utility functions for avatar generation and user name handling
 */

/**
 * Validates an avatar file for upload
 * @param file - File to validate
 * @returns Object with validation result and optional error message
 */
export const validateAvatarFile = (file: File): { valid: boolean; error?: string } => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'Please select an image file' };
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'Image size must be less than 10MB' };
    }

    return { valid: true };
};

/**
 * Creates a preview URL from a file using FileReader
 * @param file - File to create preview from
 * @returns Promise that resolves to data URL string
 */
export const createAvatarPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Uploads an avatar file to Firebase Storage and updates the user profile
 * @param avatarFile - File to upload
 * @param uid - User ID
 * @returns Promise that resolves to the uploaded avatar URL
 * @throws Error if upload fails
 */
export const uploadAvatar = async (
    avatarFile: File,
    uid: string
): Promise<string> => {
    // Upload to storage
    const avatarUrl = await uploadAvatarToStorage(avatarFile, uid);

    // Update the profile with the new avatar URL
    await updateUserProfile(uid, { avatar: avatarUrl });

    return avatarUrl;
};

/**
 * Generates initials from first and last name for avatar display
 * Returns first letter of first name + first letter of last name (e.g., "JD" for "John Doe")
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @returns Two-letter initials string in uppercase
 */
export const getAvatarInitials = (firstName: string, lastName: string): string => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
};

/**
 * Generates initials from a UserProfile object
 * @param profile - UserProfile object
 * @returns Two-letter initials string in uppercase
 */
export const getProfileInitials = (profile: UserProfile): string => {
    return getAvatarInitials(profile.name.first, profile.name.last);
};

/**
 * Generates initials from a full name string (for backward compatibility)
 * Extracts first and last names from a full name string
 * @param fullName - Full name string (e.g., "John Doe" or "Dr. Jane Smith")
 * @returns Two-letter initials string in uppercase
 */
export const getInitialsFromFullName = (fullName: string): string => {
    // Remove common prefixes and suffixes
    const cleanName = fullName
        .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
        .replace(/\s+(Jr\.?|Sr\.?|III|IV|Ph\.?D\.?)$/i, '')
        .trim();

    const nameParts = cleanName.split(/\s+/);

    if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1]; // Use last part as last name
        return getAvatarInitials(firstName, lastName);
    } else if (nameParts.length === 1) {
        // If only one name part, use first letter only
        return nameParts[0].charAt(0).toUpperCase();
    }

    return '';
};

/**
 * Generates a full display name from UserProfile components
 * @param profile - UserProfile object
 * @returns Formatted full name with prefix and suffix if present
 * 
 * @internal
 */
export const getDisplayName = (profile: UserProfile): string => {
    const parts: string[] = [];

    if (profile.name.prefix) {
        parts.push(profile.name.prefix);
    }

    parts.push(profile.name.first);

    if (profile.name.middle) {
        parts.push(profile.name.middle);
    }

    parts.push(profile.name.last);

    if (profile.name.suffix) {
        parts.push(profile.name.suffix);
    }

    return parts.join(' ');
};
