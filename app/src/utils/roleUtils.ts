/**
 * Utility functions for user role management
 */

export type UserRole = 'admin' | 'student' | 'editor' | 'adviser';

/**
 * Determines user role based on email domain or specific email addresses
 * This is a simple implementation - in a real application, you would
 * fetch this from your backend/database or JWT token
 */
export function getUserRole(email: string): UserRole {
  // Admin users - you can add specific admin emails here
  const adminEmails = [
    'admin@thesisflow.com',
    'jed556@gmail.com', // Add your admin email
    // Add more admin emails as needed
  ];

  // Editor users - you can add specific editor emails here
  const editorEmails = [
    'editor@thesisflow.com',
    // Add more editor emails as needed
  ];

  // Adviser users - you can add specific adviser emails here
  const adviserEmails = [
    'adviser@thesisflow.com',
    // Add more adviser emails as needed
  ];

  // Check for specific admin emails
  if (adminEmails.includes(email.toLowerCase())) {
    return 'admin';
  }

  // Check for specific editor emails
  if (editorEmails.includes(email.toLowerCase())) {
    return 'editor';
  }

  // Check for specific adviser emails
  if (adviserEmails.includes(email.toLowerCase())) {
    return 'adviser';
  }

  // You can also check by domain
  // For example, all emails from @admin.thesisflow.com are admins
  if (email.toLowerCase().endsWith('@admin.thesisflow.com')) {
    return 'admin';
  }

  // Default role is 'student'
  return 'student';
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
