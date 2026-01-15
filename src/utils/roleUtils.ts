/**
 * Utility functions for user role management
 * Handles both system-wide authentication roles and thesis-specific contextual roles
 */

import type { ThesisRole } from '../types/thesis';
import type { UserRole } from '../types/profile';
import type { ThesisGroup } from '../types/group';
import { firebaseAuth, firebaseFirestore } from './firebase/firebaseConfig';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { findUserById } from './firebase/firestore/user';
import { GROUPS_SUBCOLLECTION } from '../config/firestore';

// Re-export role color utilities for convenience
export { getRoleColor, ROLE_COLORS } from '../config/colors';

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

        // Fallback to Firestore using collectionGroup query across hierarchical paths
        // Use UID as the primary identifier (more stable than email which can change)
        const userProfile = await findUserById(user.uid);
        if (userProfile?.role) {
            return userProfile.role;
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
 * Check whether a user has a specific role (either as primary or secondary role).
 * Useful for multi-role users who have both a primary role and secondary roles.
 * @param userRole - The user's primary role
 * @param secondaryRoles - The user's secondary roles (optional)
 * @param roleToCheck - The role to check for
 * @returns true if the user has the specified role as primary or secondary
 */
export function userHasRole(
    userRole: UserRole,
    secondaryRoles: UserRole[] | undefined,
    roleToCheck: UserRole
): boolean {
    if (userRole === roleToCheck) return true;
    if (secondaryRoles?.includes(roleToCheck)) return true;
    return false;
}

/**
 * Check whether a user has any of the specified roles (either as primary or secondary).
 * @param userRole - The user's primary role
 * @param secondaryRoles - The user's secondary roles (optional)
 * @param rolesToCheck - Array of roles to check for
 * @returns true if the user has any of the specified roles
 */
export function userHasAnyRole(
    userRole: UserRole,
    secondaryRoles: UserRole[] | undefined,
    rolesToCheck: UserRole[]
): boolean {
    if (rolesToCheck.includes(userRole)) return true;
    if (secondaryRoles?.some(r => rolesToCheck.includes(r))) return true;
    return false;
}

/**
 * Get all roles for a user (primary + secondary combined).
 * @param userRole - The user's primary role
 * @param secondaryRoles - The user's secondary roles (optional)
 * @returns Array of all user roles (primary first, then secondary)
 */
export function getAllUserRoles(
    userRole: UserRole,
    secondaryRoles: UserRole[] | undefined
): UserRole[] {
    const roles = [userRole];
    if (secondaryRoles?.length) {
        roles.push(...secondaryRoles.filter(r => r !== userRole));
    }
    return roles;
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
    const profile = await findUserById(uid);
    if (!profile) return false;
    return profile.role === role;
}

// ==================================================
// THESIS-SPECIFIC ROLE FUNCTIONS
// ==================================================

/**
 * Get thesis role for a user from group membership
 * Uses ThesisGroup.members to determine the user's role
 * @param uid - User ID to check
 * @param group - ThesisGroup containing member information
 * @returns The user's thesis role
 */
export function getThesisRoleForUid(uid: string, group: ThesisGroup | null): ThesisRole {
    if (!group?.members) return 'unknown';

    if (uid === group.members.leader) return 'leader';
    if (group.members.members?.includes(uid)) return 'member';
    if (uid === group.members.adviser) return 'adviser';
    if (uid === group.members.editor) return 'editor';
    if (uid === group.members.statistician) return 'statistician';
    if (group.members.panels?.includes(uid)) return 'panel';

    return 'unknown';
}

/**
 * Get group by user UID from Firestore using collectionGroup query
 * Searches for a group where the user is leader, member, adviser, editor, or statistician
 * Uses hierarchical group subcollection path
 */
async function getGroupByUserUid(uid: string): Promise<ThesisGroup | null> {
    try {
        const groupsGroup = collectionGroup(firebaseFirestore, GROUPS_SUBCOLLECTION);

        // Query for groups where user is leader
        const leaderQuery = query(groupsGroup, where('members.leader', '==', uid));
        const leaderSnap = await getDocs(leaderQuery);
        if (!leaderSnap.empty) {
            return { id: leaderSnap.docs[0].id, ...leaderSnap.docs[0].data() } as ThesisGroup;
        }

        // Query for groups where user is in members array
        const memberQuery = query(groupsGroup, where('members.members', 'array-contains', uid));
        const memberSnap = await getDocs(memberQuery);
        if (!memberSnap.empty) {
            return { id: memberSnap.docs[0].id, ...memberSnap.docs[0].data() } as ThesisGroup;
        }

        // Query for groups where user is adviser
        const adviserQuery = query(groupsGroup, where('members.adviser', '==', uid));
        const adviserSnap = await getDocs(adviserQuery);
        if (!adviserSnap.empty) {
            return { id: adviserSnap.docs[0].id, ...adviserSnap.docs[0].data() } as ThesisGroup;
        }

        // Query for groups where user is editor
        const editorQuery = query(groupsGroup, where('members.editor', '==', uid));
        const editorSnap = await getDocs(editorQuery);
        if (!editorSnap.empty) {
            return { id: editorSnap.docs[0].id, ...editorSnap.docs[0].data() } as ThesisGroup;
        }

        // Query for groups where user is statistician
        const statisticianQuery = query(groupsGroup, where('members.statistician', '==', uid));
        const statisticianSnap = await getDocs(statisticianQuery);
        if (!statisticianSnap.empty) {
            return { id: statisticianSnap.docs[0].id, ...statisticianSnap.docs[0].data() } as ThesisGroup;
        }

        return null;
    } catch (error) {
        console.error('Error getting group by user UID:', error);
        return null;
    }
}

/**
 * Get user's thesis-specific role by uid from Firestore group data
 */
export async function getThesisRole(uid: string): Promise<ThesisRole> {
    const group = await getGroupByUserUid(uid);
    return getThesisRoleForUid(uid, group);
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
        case 'statistician': return 'Statistician';
        case 'panel': return 'Panel Member';
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
