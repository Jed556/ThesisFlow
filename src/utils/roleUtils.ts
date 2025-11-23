/**
 * Utility functions for user role management
 * Handles both system-wide authentication roles and thesis-specific contextual roles
 */

import type { ThesisRole, ThesisData } from '../types/thesis';
import type { UserRole } from '../types/profile';
import { firebaseAuth, firebaseFirestore } from './firebase/firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getUserById } from './firebase/firestore';

/**
 * Determines system-wide user role from Firebase Auth custom claims or Firestore
 * Prioritizes Auth token claims over Firestore data for better performance and security
 * @param forceRefresh - Whether to force refresh the ID token to get latest claims
 * @returns Promise resolving to the user's role
 */
export async function getUserRole(forceRefresh: boolean = true): Promise<UserRole> {
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

/**
 * Check whether the specified user has the provided role.
 * @param uid - User ID of the user to check
 * @param role - Role to compare against
 * @returns true when the user's role matches, false otherwise
 */
export async function isUserInRole(uid: string, role: UserRole): Promise<boolean> {
    const profile = await getUserById(uid);
    if (!profile) return false;
    return profile.role === role;
}

// ==================================================
// THESIS-SPECIFIC ROLE FUNCTIONS
// ==================================================

/**
 * Get thesis by user UID from Firestore
 * Searches for a thesis where the user is leader, member, adviser, or editor
 */
async function getThesisByUserUid(uid: string): Promise<ThesisData | null> {
    try {
        const thesesRef = collection(firebaseFirestore, 'theses');

        // Query for theses where user is leader
        const leaderQuery = query(thesesRef, where('leader', '==', uid));
        const leaderSnap = await getDocs(leaderQuery);
        if (!leaderSnap.empty) {
            return leaderSnap.docs[0].data() as ThesisData;
        }

        // Query for theses where user is in members array
        const memberQuery = query(thesesRef, where('members', 'array-contains', uid));
        const memberSnap = await getDocs(memberQuery);
        if (!memberSnap.empty) {
            return memberSnap.docs[0].data() as ThesisData;
        }

        // Query for theses where user is adviser
        const adviserQuery = query(thesesRef, where('adviser', '==', uid));
        const adviserSnap = await getDocs(adviserQuery);
        if (!adviserSnap.empty) {
            return adviserSnap.docs[0].data() as ThesisData;
        }

        // Query for theses where user is editor
        const editorQuery = query(thesesRef, where('editor', '==', uid));
        const editorSnap = await getDocs(editorQuery);
        if (!editorSnap.empty) {
            return editorSnap.docs[0].data() as ThesisData;
        }

        return null;
    } catch (error) {
        console.error('Error getting thesis by user UID:', error);
        return null;
    }
}

/**
 * Get user's thesis-specific role by uid from Firestore thesis data
 */
export async function getThesisRole(uid: string): Promise<ThesisRole> {
    const thesis = await getThesisByUserUid(uid);

    if (!thesis) return 'unknown';

    if (uid === thesis.leader) return 'leader';
    if (thesis.members.includes(uid)) return 'member';
    if (uid === thesis.adviser) return 'adviser';
    if (uid === thesis.editor) return 'editor';

    return 'unknown';
}

/**
 * Get thesis role display text
 */
export async function getThesisRoleDisplayText(uid: string): Promise<string> {
    const role = await getThesisRole(uid);
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
export async function isThesisStudent(uid: string): Promise<boolean> {
    const role = await getThesisRole(uid);
    return role === 'leader' || role === 'member';
}
