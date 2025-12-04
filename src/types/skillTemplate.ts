/**
 * Skill Template Types for Department-Level Expertise Configuration
 *
 * Skill templates are stored at the department level and define the
 * available skills that advisers/editors/statisticians can rate themselves on.
 * Advisers must rate their skills before being allowed to increase their slots.
 *
 * Firestore path: year/{year}/departments/{department}/adviserSkills/{skillId}
 */

/**
 * A single skill template entry in the department's adviserSkills subcollection
 */
export interface SkillTemplate {
    /** Unique identifier for this skill template */
    id: string;
    /** Display name of the skill (e.g., "Machine Learning", "Data Analysis") */
    name: string;
    /** Optional description or elaboration of the skill */
    description?: string;
    /** Category/grouping for the skill (e.g., "Technical", "Research Methods") */
    category?: string;
    /** Display order for sorting skills in the UI */
    order?: number;
    /** Whether this skill is currently active (admins can disable skills) */
    isActive: boolean;
    /** ISO timestamp when the skill template was created */
    createdAt: string;
    /** ISO timestamp when the skill template was last updated */
    updatedAt: string;
    /** UID of the admin who created this skill template */
    createdBy?: string;
}

/**
 * SkillTemplate with document ID for component usage
 */
export type SkillTemplateRecord = SkillTemplate & { id: string };

/**
 * An expert's self-rating for a specific skill
 * Stored in the user's profile as part of skillRatings array
 */
export interface ExpertSkillRating {
    /** Reference to the skill template ID */
    skillId: string;
    /** Display name of the skill (denormalized for display) */
    name: string;
    /** Self-assessed rating (0-5 scale: 0=Not Applicable, 1-5=Beginner to Expert) */
    rating: number;
    /** Optional note or elaboration from the expert */
    note?: string;
    /** ISO timestamp when the rating was last updated */
    updatedAt?: string;
}

/**
 * Rating scale labels for UI display
 */
export const SKILL_RATING_LABELS: Record<number, string> = {
    0: 'Not Applicable',
    1: 'Beginner',
    2: 'Basic',
    3: 'Intermediate',
    4: 'Advanced',
    5: 'Expert',
};

/**
 * Minimum and maximum skill rating values
 */
export const MIN_SKILL_RATING = 0;
export const MAX_SKILL_RATING = 5;

/**
 * Checks if an expert has rated all required skills for their department
 * @param userSkillRatings - The expert's current skill ratings
 * @param departmentSkills - The department's skill template IDs
 * @returns true if all department skills have been rated (rating > 0 or explicit 0 for N/A)
 */
export function hasRatedAllSkills(
    userSkillRatings: ExpertSkillRating[] | undefined | null,
    departmentSkills: SkillTemplate[] | undefined | null
): boolean {
    if (!departmentSkills || departmentSkills.length === 0) {
        // No skills defined means no rating requirement
        return true;
    }

    if (!userSkillRatings || userSkillRatings.length === 0) {
        return false;
    }

    const activeSkillIds = departmentSkills
        .filter((skill) => skill.isActive)
        .map((skill) => skill.id);

    if (activeSkillIds.length === 0) {
        // No active skills means no rating requirement
        return true;
    }

    const ratedSkillIds = new Set(userSkillRatings.map((rating) => rating.skillId));

    return activeSkillIds.every((skillId) => ratedSkillIds.has(skillId));
}

/**
 * Gets the count of skills that still need to be rated
 * @param userSkillRatings - The expert's current skill ratings
 * @param departmentSkills - The department's skill templates
 * @returns Number of skills that need to be rated
 */
export function getUnratedSkillCount(
    userSkillRatings: ExpertSkillRating[] | undefined | null,
    departmentSkills: SkillTemplate[] | undefined | null
): number {
    if (!departmentSkills || departmentSkills.length === 0) {
        return 0;
    }

    const activeSkillIds = departmentSkills
        .filter((skill) => skill.isActive)
        .map((skill) => skill.id);

    if (activeSkillIds.length === 0) {
        return 0;
    }

    const ratedSkillIds = new Set(
        (userSkillRatings ?? []).map((rating) => rating.skillId)
    );

    return activeSkillIds.filter((skillId) => !ratedSkillIds.has(skillId)).length;
}
