/**
 * Recommendation-related TypeScript types used by student adviser/editor pages.
 */

/**
 * Supported recommendation roles in the student workflow.
 */
export type RecommendationRole = 'adviser' | 'editor';

/**
 * Describes a recommended faculty match for a thesis team.
 */
export interface RecommendationEntry {
    /** Unique identifier for the recommendation row. */
    id: number;
    /** Email used to look up the faculty profile. */
    userEmail: string;
    /** Whether the recommendation is for an adviser or editor role. */
    role: RecommendationRole;
    /** Subject-matter expertise areas to highlight for the student. */
    expertiseAreas: string[];
    /** Recent or notable thesis titles the faculty member handled. */
    recentProjects: string[];
    /** Numeric compatibility score (0-100) derived from matching algorithm. */
    matchScore: number;
    /** Count of active teams currently advised/edited by the faculty member. */
    currentAssignments: number;
    /** Suggested maximum number of teams the faculty member can handle. */
    capacity: number;
    /** Average response turnaround for feedback in hours. */
    avgResponseHours: number;
    /** Additional notes to help the student decide. */
    notes?: string;
}
