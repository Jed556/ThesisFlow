/**
 * CSV import/export for User profiles
 */

import type { UserProfile, UserRole } from '../../types/profile';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, splitArrayField, generateCsvText } from './parser';

/**
 * User with optional password for CSV import
 */
export type ImportedUser = UserProfile & { password?: string };

/**
 * Import users from CSV text
 */
export function importUsersFromCsv(csvText: string): { parsed: ImportedUser[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: ImportedUser[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
        const get = (name: string) => row[headerMap[normalizeHeader(name)]] ?? '';

        const email = (get('email') || get('e-mail') || get('user_email')).trim();
        const firstName = get('firstName') || get('first_name') || get('firstname') || get('given_name') || get('first');
        const lastName = get('lastName') || get('last_name') || get('lastname') || get('family_name') || get('last');
        const middleName = get('middleName') || get('middle_name') || get('middle');
        const prefix = get('prefix');
        const suffix = get('suffix');
        const roleRaw = (get('role') || 'student').toLowerCase() as UserRole;
        const uidRaw = get('uid') || get('id') || '';
        const password = get('password') || get('pass');
        const courseSource = get('courses') || get('course');
        const courseEntries = splitArrayField(courseSource) || [];
        const courseValue = courseEntries[0] || courseSource || undefined;
        const moderatedCourseSource = get('moderatedCourses') || get('sections');
        const moderatedCourseEntries = splitArrayField(moderatedCourseSource);

        const normalizedRole: UserRole = (
            [
                'student',
                'statistician',
                'editor',
                'adviser',
                'panel',
                'moderator',
                'head',
                'admin',
                'developer'
            ].includes(roleRaw)
                ? roleRaw
                : 'student'
        );

        const moderatorSections = normalizedRole === 'moderator'
            ? Array.from(new Set([...moderatedCourseEntries, ...courseEntries])).filter(Boolean)
            : moderatedCourseEntries;

        if (!email) {
            errors.push(`row ${idx + 2}: missing email`);
            return;
        }

        if (!firstName || !lastName) {
            errors.push(`row ${idx + 2}: missing firstName or lastName`);
            return;
        }

        const uid = uidRaw || `user_${Date.now()}_${idx}`;

        const user: UserProfile = {
            uid,
            email,
            name: {
                first: firstName,
                last: lastName,
                ...(prefix && { prefix }),
                ...(middleName && { middle: middleName }),
                ...(suffix && { suffix }),
            },
            role: normalizedRole,
            department: get('department') || undefined,
            course: courseValue,
            avatar: get('avatar') || undefined,
            banner: get('banner') || undefined,
            phone: get('phone') || undefined,
            bio: get('bio') || undefined,
        };

        if (moderatorSections.length > 0) {
            user.moderatedCourses = moderatorSections;
        }

        parsed.push(password ? { ...user, password } : user);
    });

    // Require at least one admin
    if (!parsed.some(p => p.role === 'admin')) {
        errors.push('no admin user found; at least one admin is required');
    }

    return { parsed, errors };
}

/**
 * Export users to CSV text
 */
export function exportUsersToCsv(users: UserProfile[], includePassword: boolean = false): string {
    const headers = [
        'uid',
        'email',
        'firstName',
        'middleName',
        'lastName',
        'prefix',
        'suffix',
        'role',
        'department',
        'course',
        'moderatedCourses',
        'phone',
        'avatar',
        'banner',
        'bio',
        ...(includePassword ? ['password'] : []),
    ];

    const rows = users.map(user => [
        user.uid || '',
        user.email,
        user.name.first,
        user.name.middle || '',
        user.name.last,
        user.name.prefix || '',
        user.name.suffix || '',
        user.role,
        user.department || '',
        user.course || '',
        user.moderatedCourses?.join(';') || '',
        user.phone || '',
        user.avatar || '',
        user.banner || '',
        user.bio || '',
        ...(includePassword ? [''] : []), // Password placeholder if needed
    ]);

    return generateCsvText(headers, rows);
}
