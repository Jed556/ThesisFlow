import type { ThesisGroup } from '../types/group';
import type { UserProfile } from '../types/profile';
import type { ExpertRequestRole } from '../types/expertRequest';
import { findUserById } from './firebase/firestore/user';
import { getGroupsByCourse } from './firebase/firestore/groups';

// Re-export user lookup functions for convenience
export { findUserById } from './firebase/firestore/user';

// ============================================================================
// Course Abbreviation Utilities
// ============================================================================

/**
 * List of common prefixes to remove from course names before generating abbreviations.
 * These are typically degree prefixes that shouldn't be included in the abbreviation.
 */
const COURSE_PREFIXES_TO_REMOVE = [
    // Full degree names
    'Bachelor of Science in',
    'Bachelor of Arts in',
    'Bachelor of Science',
    'Bachelor of Arts',
    'Master of Science in',
    'Master of Arts in',
    'Master of Science',
    'Master of Arts',
    'Doctor of Philosophy in',
    'Doctor of Philosophy',
    // Common abbreviations
    'BS in',
    'BA in',
    'MS in',
    'MA in',
    'PhD in',
    'BSBA',
    'BSN',
    'BS',
    'BA',
    'MS',
    'MA',
    'PhD',
];

/**
 * Words to exclude when generating course abbreviations.
 * These are common filler words that don't contribute to the abbreviation.
 */
const WORDS_TO_EXCLUDE = ['and', 'of', 'in', 'the', 'for', 'with', 'to', 'a', 'an'];

/**
 * Generates an abbreviation from a course name by:
 * 1. Removing common degree prefixes (BS, Bachelor of Science in, etc.)
 * 2. Extracting the first letter of each significant word
 *
 * @param courseName - The full course name (e.g., "BS Computer Science", "Bachelor of Science in Information Technology")
 * @returns Course abbreviation (e.g., "CS", "IT")
 *
 * @example
 * getCourseAbbreviation("BS Computer Science") // returns "CS"
 * getCourseAbbreviation("Bachelor of Science in Information Technology") // returns "IT"
 * getCourseAbbreviation("BS Information Systems") // returns "IS"
 * getCourseAbbreviation("Bachelor of Arts in Communication") // returns "C"
 */
export function getCourseAbbreviation(courseName: string): string {
    if (!courseName?.trim()) {
        return '';
    }

    let cleanedName = courseName.trim();

    // Remove prefixes (case-insensitive, sorted by length desc to match longer first)
    const sortedPrefixes = [...COURSE_PREFIXES_TO_REMOVE].sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
        const regex = new RegExp(`^${prefix}\\s*`, 'i');
        if (regex.test(cleanedName)) {
            cleanedName = cleanedName.replace(regex, '').trim();
            break; // Only remove one prefix
        }
    }

    // If nothing left after prefix removal, use original
    if (!cleanedName) {
        cleanedName = courseName.trim();
    }

    // Split into words and filter out excluded words
    const words = cleanedName
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .filter((word) => !WORDS_TO_EXCLUDE.includes(word.toLowerCase()));

    // Get first letter of each remaining word
    const abbreviation = words
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

    return abbreviation || courseName.charAt(0).toUpperCase();
}

/**
 * Generates the next group ID for a course based on existing groups.
 * Format: {CourseAbbreviation}-{NextNumber}
 * This ID will also be used as the display name for the group.
 *
 * @param course - The full course name
 * @param existingGroups - Optional array of existing groups (if already loaded)
 * @returns Promise resolving to the next group ID (e.g., "CS-1", "CS-2")
 *
 * @example
 * // If there are 2 existing groups in "BS Computer Science"
 * await generateNextGroupId("BS Computer Science") // returns "CS-3"
 */
export async function generateNextGroupId(
    course: string,
    existingGroups?: ThesisGroup[]
): Promise<string> {
    const abbreviation = getCourseAbbreviation(course);

    // Get existing groups if not provided
    const groups = existingGroups ?? await getGroupsByCourse(course);

    // Find the highest existing number for this abbreviation pattern
    // Check both group.id and group.name for backward compatibility
    const pattern = new RegExp(`^${abbreviation}-(\\d+)$`, 'i');
    let maxNumber = 0;

    for (const group of groups) {
        // Check ID first (new format)
        const idMatch = group.id?.match(pattern);
        if (idMatch) {
            const num = parseInt(idMatch[1], 10);
            if (num > maxNumber) {
                maxNumber = num;
            }
        }
        // Also check name for backward compatibility
        const nameMatch = group.name?.match(pattern);
        if (nameMatch) {
            const num = parseInt(nameMatch[1], 10);
            if (num > maxNumber) {
                maxNumber = num;
            }
        }
    }

    // Next number is max + 1, or 1 if no existing groups with this pattern
    // If no groups match the pattern but groups exist, start from total count + 1
    const nextNumber = maxNumber > 0 ? maxNumber + 1 : groups.length + 1;

    return `${abbreviation}-${nextNumber}`;
}

/**
 * @deprecated Use generateNextGroupId instead. Group name is now the same as group ID.
 */
export const generateNextGroupName = generateNextGroupId;

/**
 * Collects all relevant participant UIDs from a thesis group ensuring uniqueness.
 *
 * @param groupData Thesis group source object
 * @returns Array of unique participant UIDs
 */
const collectMemberIds = (groupData: ThesisGroup): string[] => {
    const ids = new Set<string>();
    ids.add(groupData.members.leader);
    groupData.members.members.forEach((uid) => ids.add(uid));
    if (groupData.members.adviser) {
        ids.add(groupData.members.adviser);
    }
    if (groupData.members.editor) {
        ids.add(groupData.members.editor);
    }
    if (groupData.members.statistician) {
        ids.add(groupData.members.statistician);
    }
    (groupData.members.panels ?? []).forEach((uid) => ids.add(uid));
    return Array.from(ids);
};

/**
 * Builds a map of profile records for all known group participants.
 *
 * @param groupData Thesis group whose participants should be resolved
 * @returns Map keyed by participant UID for quick lookups
 */
export async function buildGroupProfileMap(groupData: ThesisGroup): Promise<Map<string, UserProfile>> {
    const ids = collectMemberIds(groupData);
    const profileMap = new Map<string, UserProfile>();
    await Promise.all(
        ids.map(async (uid) => {
            const profile = await findUserById(uid);
            if (profile) {
                profileMap.set(uid, profile);
            }
        })
    );
    return profileMap;
}

/**
 * Resolves the expert UID assigned to the requested role for the provided group.
 */
export function getGroupExpertByRole(
    group: ThesisGroup | null | undefined,
    role: ExpertRequestRole,
): string | undefined {
    if (!group) {
        return undefined;
    }
    if (role === 'adviser') {
        return group.members.adviser;
    }
    if (role === 'editor') {
        return group.members.editor;
    }
    return group.members.statistician;
}
