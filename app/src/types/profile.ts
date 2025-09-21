// User role types - System-wide roles
export type UserRole = 'student' | 'editor' | 'adviser' | 'admin';

/**
 * Interface for user profiles in the ThesisFlow system
 */
export interface UserProfile {
    /**
     * User's unique identifier
     */
    id: number;
    /**
     * User's name prefix (e.g., "Dr.", "Prof.", "Mr.", "Ms.")
     */
    prefix?: string;
    /**
     * User's first name
     */
    firstName: string;
    /**
     * User's middle name or initial
     */
    middleName?: string;
    /**
     * User's last name
     */
    lastName: string;
    /**
     * User's name suffix (e.g., "Jr.", "Sr.", "III", "Ph.D.")
        */
    suffix?: string;
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
     * URL to the user's avatar image
     */
    avatar?: string;
}