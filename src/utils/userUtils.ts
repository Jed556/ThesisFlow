import type { UserProfile } from '../types/profile';
import { getProfile } from './firebase/firestore/user';

/**
 * Builds a human-friendly label for a user profile using their name and email.
 */
export function formatProfileLabel(profile: UserProfile | null | undefined): string {
    if (!profile) {
        return '';
    }

    const parts = [profile.name?.first, profile.name?.last]
        .filter((segment): segment is string => Boolean(segment && segment.trim()))
        .map((segment) => segment.trim());

    if (parts.length === 0) {
        return profile.email;
    }

    const name = parts.join(' ');
    return profile.email ? `${name} (${profile.email})` : name;
}

/**
 * Get formatted display name for user
 * @param uid - User ID of the user
 * @returns Formatted display name or UID as fallback
 */
export async function getDisplayName(uid: string): Promise<string> {
    const profile = await getProfile(uid);

    if (!profile) {
        return uid;
    }

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
}
