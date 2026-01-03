/**
 * Color configuration for ThesisFlow
 * Defines consistent RGB colors for user roles and other UI elements
 */

/**
 * Role color definitions
 * Each role has a specific RGB color for consistent visual identification
 */
export const ROLE_COLORS = {
    /** Student - Neutral gray (#9E9E9E) */
    student: 'rgb(158, 158, 158)',
    
    /** Adviser - Professional blue (#2196F3) */
    adviser: 'rgb(33, 150, 243)',
    
    /** Editor - Lighter editorial purple (better in dark mode) */
    editor: 'rgb(186, 84, 211)',
    
    /** Statistician - Success green (#4CAF50) */
    statistician: 'rgb(76, 175, 80)',
    
    /** Panel - Information cyan (#00BCD4) */
    panel: 'rgb(0, 188, 212)',
    
    /** Moderator - Caution orange (#FF9800) */
    moderator: 'rgb(255, 152, 0)',
    
    /** Chair - Authority gold (#FFC107) */
    chair: 'rgb(255, 193, 7)',
    
    /** Head - Lighter teal (better in dark mode) */
    head: 'rgb(0, 150, 136)',
    
    /** Admin - Administrative crimson (#C62828) */
    admin: 'rgb(198, 40, 40)',
    
    /** Developer - Indigo (replaced dark red) */
    developer: 'rgb(63, 81, 181)',
} as const;

/**
 * Type-safe role color keys
 */
export type RoleColorKey = keyof typeof ROLE_COLORS;

/**
 * Get RGB color for a specific role
 * @param role - The user role
 * @returns RGB color string or default gray
 */
export function getRoleColor(role: string): string {
    return ROLE_COLORS[role as RoleColorKey] ?? ROLE_COLORS.student;
}
