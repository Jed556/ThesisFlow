// User role types - System-wide roles
export type UserRole = 'student' | 'statistician' | 'editor' | 'adviser' | 'panel' | 'moderator' | 'head' | 'admin' | 'developer';

export interface UserName {
    /**
     * User's name prefix (e.g., "Dr.", "Prof.", "Mr.", "Ms.")
     */
    prefix?: string;
    /**
     * User's first name
     */
    first: string;
    /**
     * User's middle name or initial
     */
    middle?: string;
    /**
     * User's last name
     */
    last: string;
    /**
     * User's name suffix (e.g., "Jr.", "Sr.", "III", "Ph.D.")
    */
    suffix?: string;
}

/**
 * Interface for user profiles in the ThesisFlow system
 */
export interface UserProfile {
    /**
     * Firebase Auth UID (optional, used for admin operations)
     */
    uid: string;
    /**
     * User's name
     */
    name: UserName;
    /**
     * User's email address
     */
    email: string;
    /**
     * System-wide user role
     */
    role: UserRole; // System-wide role: student, editor, adviser, admin
    /**
     * User's department or affiliation within the institution
     */
    department?: string;
    /**
     * Optional list of departments the user is associated with (for multi-department heads/admins)
     */
    departments?: string[];
    /**
     * User's degree program or course (e.g., BS Computer Science)
     */
    course?: string;
    /**
     * Optional list of sections/courses the user moderates or manages
     */
    moderatedCourses?: string[];
    /**
     * URL to the user's avatar image
     */
    avatar?: string;
    /**
     * URL to the user's profile banner image
     */
    banner?: string;
    /**
     * User's contact phone number
     */
    phone?: string;
    /**
     * User's biography or description
     */
    bio?: string;

    /**
     * Expertise areas or skills (for advisers and editors)
     */
    skills?: string[];

    /**
     * Capacity for advising theses (only for advisers)
     * If 0 or undefined, not accepting advisees
     */
    adviserCapacity?: number;

    /**
     * Capacity for editing theses (only for editors)
     * If 0 or undefined, not accepting editing assignments
     */
    editorCapacity?: number;

    preferences?: {
        /**
         * User's theme color preference (hex color)
         */
        themeColor?: string;
        /**
         * Whether to reduce animations for better performance or accessibility
         */
        reduceAnimations?: boolean;
    }
    /**
     * User's last active date
     */
    lastActive?: Date;
}

/**
 * Shared profile view types for timelines and related metadata.
 */
export interface HistoricalThesisEntry {
    year: string;
    title: string;
    role: 'Adviser' | 'Editor' | 'Student' | 'Collaborator' | string;
    outcome: string;
}
