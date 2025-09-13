// User role types - System-wide roles
export type UserRole = 'student' | 'editor' | 'adviser' | 'admin';

/**
 * Interface for user profiles in the ThesisFlow system
 */
export interface UserProfile {
    id: number;
    prefix?: string; // e.g., "Dr.", "Prof.", "Mr.", "Ms."
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string; // e.g., "Jr.", "Sr.", "III", "Ph.D."
    email: string;
    role: UserRole; // System-wide role: student, editor, adviser, admin
    department?: string;
    avatar?: string;
}