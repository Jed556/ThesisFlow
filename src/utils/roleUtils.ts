/**
 * Utility functions for user role management
 * Handles both system-wide authentication roles and thesis-specific contextual roles
 */

import type { ThesisRole } from '../types/thesis';
import type { UserRole } from '../types/profile';
import { mockThesisData } from '../data/mockData';
import { firebaseAuth, firebaseFirestore } from './firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Determines system-wide user role from Firebase Auth custom claims or Firestore
 * Prioritizes Auth token claims over Firestore data for better performance and security
 * @param email - Optional email parameter for backwards compatibility (not used, uses current user)
 * @param forceRefresh - Whether to force refresh the ID token to get latest claims
 * @returns Promise resolving to the user's role
 */
export async function getUserRole(email?: string, forceRefresh: boolean = true): Promise<UserRole> {
    const user = firebaseAuth.currentUser;

    if (!user) {
        console.warn('No user is signed in');
        return 'student'; // Default role
    }

    try {
        // First, try to get role from Auth custom claims (fastest and most secure)
        const idTokenResult = await user.getIdTokenResult(forceRefresh);

        if (idTokenResult.claims.role) {
            const role = idTokenResult.claims.role as UserRole;
            return role;
        }

        // Fallback to Firestore if no claim exists
        const userEmail = user.email;
        if (userEmail) {
            const userDocRef = doc(firebaseFirestore, 'users', encodeURIComponent(userEmail));
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.role) {
                    return userData.role as UserRole;
                }
            }
        }

        console.warn('No role found in Auth claims or Firestore, defaulting to student');
        return 'student'; // Default role
    } catch (error) {
        console.error('Error getting user role:', error);
        return 'student'; // Default role on error
    }
}

/**
 * Checks if a user has access to a specific role requirement
 */
export function hasRoleAccess(userRole: UserRole, requiredRoles: string[]): boolean {
    if (!requiredRoles || requiredRoles.length === 0) {
        return true; // No role requirement means accessible to all
    }

    return requiredRoles.includes(userRole);
}

/**
 * Gets role hierarchy for permission checking
 * Higher numbers indicate higher privileges
 */
export function getRoleHierarchy(role: UserRole): number {
    switch (role) {
        case 'admin':
            return 4;
        case 'editor':
            return 3;
        case 'adviser':
            return 2;
        case 'student':
            return 1;
        default:
            return 0;
    }
}

/**
 * Checks if user role has at least the minimum required role level
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
    return getRoleHierarchy(userRole) >= getRoleHierarchy(minimumRole);
}

// ==================================================
// THESIS-SPECIFIC ROLE FUNCTIONS
// ==================================================

/**
 * Get user's thesis-specific role by email from thesis data context
 */
export function getThesisRole(email: string): ThesisRole {
    if (email === mockThesisData.leader) return 'leader';
    if (mockThesisData.members.includes(email)) return 'member';
    if (email === mockThesisData.adviser) return 'adviser';
    if (email === mockThesisData.editor) return 'editor';
    return 'unknown';
}

/**
 * Get thesis role display text
 */
export function getThesisRoleDisplayText(email: string): string {
    const role = getThesisRole(email);
    switch (role) {
        case 'leader': return 'Student (Leader)';
        case 'member': return 'Student (Member)';
        case 'adviser': return 'Adviser';
        case 'editor': return 'Editor';
        default: return 'Unknown';
    }
}

/**
 * Check if user is a student in thesis context (leader or member)
 */
export function isThesisStudent(email: string): boolean {
    const role = getThesisRole(email);
    return role === 'leader' || role === 'member';
}
