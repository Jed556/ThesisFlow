import type { UserProfile } from '../types/profile';
import { getProfile } from './dbUtils';

/**
 * Utility functions for avatar generation and user name handling
 */

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
    return getAvatarInitials(profile.firstName, profile.lastName);
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

    if (profile.prefix) {
        parts.push(profile.prefix);
    }

    parts.push(profile.firstName);

    if (profile.middleName) {
        parts.push(profile.middleName);
    }

    parts.push(profile.lastName);

    if (profile.suffix) {
        parts.push(profile.suffix);
    }

    return parts.join(' ');
};

/**
 * Helper function to find a user profile by email
 * @param email - Email address to search for
 * @returns UserProfile object or null if not found
 * 
 * @internal
 */
export const findProfileByEmail = (email: string): UserProfile | null => {
    return getProfile(email) || null;
};
