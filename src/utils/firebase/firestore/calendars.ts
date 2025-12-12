import {
    doc, setDoc, onSnapshot, getDoc, deleteDoc,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { DEFAULT_YEAR } from '../../../config/firestore';
import {
    buildGlobalCalendarCollectionPath, buildDepartmentCalendarCollectionPath, buildCourseCalendarCollectionPath,
    buildGroupCalendarCollectionPath, buildYearUserCalendarCollectionPath, buildDepartmentUserCalendarCollectionPath,
    buildCourseUserCalendarCollectionPath, type CalendarPathContext,
} from './paths';

import type {
    Calendar, CalendarLevel, CalendarPathContext as TypedCalendarPathContext,
    CalendarPermission,
} from '../../../types/schedule';
import type { UserRole } from '../../../types/profile';

// ============================================================================
// Constants
// ============================================================================

/** Document ID for the calendar metadata document within each calendar subcollection */
const CALENDAR_METADATA_DOC = 'metadata';

/** Default calendar colors by level */
const DEFAULT_COLORS: Record<CalendarLevel, string> = {
    global: '#DB4437',      // Red - Institution wide
    department: '#AB47BC',  // Purple - Department
    course: '#00ACC1',      // Cyan - Course
    group: '#0B8043',       // Green - Group
    personal: '#4285F4',    // Blue - Personal
};

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the collection path for a calendar based on its level and context
 */
export function getCalendarCollectionPath(
    level: CalendarLevel,
    context: CalendarPathContext
): string {
    const year = context.year || DEFAULT_YEAR;

    switch (level) {
        case 'global':
            return buildGlobalCalendarCollectionPath(year);

        case 'department':
            if (!context.department) {
                throw new Error('Department is required for department-level calendar');
            }
            return buildDepartmentCalendarCollectionPath(year, context.department);

        case 'course':
            if (!context.department || !context.course) {
                throw new Error('Department and course are required for course-level calendar');
            }
            return buildCourseCalendarCollectionPath(year, context.department, context.course);

        case 'group':
            if (!context.department || !context.course || !context.groupId) {
                throw new Error(
                    'Department, course, and groupId are required for group-level calendar'
                );
            }
            return buildGroupCalendarCollectionPath(
                year, context.department, context.course, context.groupId
            );

        case 'personal':
            if (!context.userId) {
                throw new Error('userId is required for personal calendar');
            }
            // Determine user's path level based on available context
            if (context.course && context.department) {
                return buildCourseUserCalendarCollectionPath(
                    year, context.department, context.course, context.userId
                );
            } else if (context.department) {
                return buildDepartmentUserCalendarCollectionPath(
                    year, context.department, context.userId
                );
            } else {
                return buildYearUserCalendarCollectionPath(year, context.userId);
            }

        default:
            throw new Error(`Unknown calendar level: ${level}`);
    }
}

/**
 * Get the document path for a calendar's metadata document
 */
export function getCalendarMetadataDocPath(
    level: CalendarLevel,
    context: CalendarPathContext
): string {
    return `${getCalendarCollectionPath(level, context)}/${CALENDAR_METADATA_DOC}`;
}

// ============================================================================
// Hierarchical Calendar CRUD Operations
// ============================================================================

/**
 * Create or update a hierarchical calendar's metadata
 * @param calendar - Calendar data (must include level and pathContext)
 */
export async function setHierarchicalCalendar(calendar: Calendar): Promise<string> {
    const docPath = getCalendarMetadataDocPath(calendar.level, calendar.pathContext);
    const docRef = doc(firebaseFirestore, docPath);

    const cleanedData = cleanData({
        ...calendar,
        lastModified: new Date().toISOString(),
    }, calendar.id ? 'update' : 'create');

    await setDoc(docRef, cleanedData, { merge: true });
    return calendar.id || docPath;
}

/**
 * Get a hierarchical calendar's metadata
 */
export async function getHierarchicalCalendar(
    level: CalendarLevel,
    context: CalendarPathContext
): Promise<Calendar | null> {
    const docPath = getCalendarMetadataDocPath(level, context);
    const docRef = doc(firebaseFirestore, docPath);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Calendar;
}

/**
 * Delete a hierarchical calendar's metadata
 */
export async function deleteHierarchicalCalendar(
    level: CalendarLevel,
    context: CalendarPathContext
): Promise<void> {
    const docPath = getCalendarMetadataDocPath(level, context);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Personal Calendar Creation (for user creation)
// ============================================================================

/**
 * Create a personal calendar for a user based on their role
 * Should be called when a new user is created
 * @param uid - User's Firebase UID
 * @param userRole - User's role (determines path level)
 * @param context - Path context with year/department/course
 */
export async function createPersonalCalendarForUser(
    uid: string,
    userRole: UserRole,
    context: { year?: string; department?: string; course?: string }
): Promise<string> {
    const year = context.year || DEFAULT_YEAR;

    // Build the appropriate path context based on role
    let pathContext: TypedCalendarPathContext;
    if (userRole === 'admin' || userRole === 'developer') {
        pathContext = { year, userId: uid };
    } else if (['head', 'statistician', 'editor', 'adviser', 'panel', 'moderator'].includes(userRole)) {
        if (!context.department) {
            throw new Error('Department is required for department-level user calendar');
        }
        pathContext = { year, department: context.department, userId: uid };
    } else {
        // Student or other course-level roles
        if (!context.department || !context.course) {
            throw new Error('Department and course are required for course-level user calendar');
        }
        pathContext = {
            year,
            department: context.department,
            course: context.course,
            userId: uid,
        };
    }

    const calendar: Calendar = {
        id: CALENDAR_METADATA_DOC,
        name: 'Personal',
        description: 'Your personal calendar',
        level: 'personal',
        color: DEFAULT_COLORS.personal,
        pathContext,
        ownerUid: uid,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions: [
            {
                uid,
                canView: true,
                canEdit: true,
                canDelete: false, // Can't delete personal calendar
            },
        ],
        isVisible: true,
        isDefault: true,
    };

    return await setHierarchicalCalendar(calendar);
}

/**
 * Load or seed a personal calendar for a user
 * If the personal calendar exists, returns it; otherwise creates it
 * @param uid - User's Firebase UID
 * @param userRole - User's role (determines path level)
 * @param context - Path context with year/department/course
 * @returns Result with the calendar and whether it was newly seeded
 */
export async function loadOrSeedPersonalCalendar(
    uid: string,
    userRole: UserRole,
    context: { year?: string; department?: string; course?: string }
): Promise<LoadOrSeedCalendarResult> {
    const year = context.year || DEFAULT_YEAR;

    // Build the path context based on role (same logic as createPersonalCalendarForUser)
    let pathContext: CalendarPathContext;
    if (userRole === 'admin' || userRole === 'developer') {
        pathContext = { year, userId: uid };
    } else if (['head', 'statistician', 'editor', 'adviser', 'panel', 'moderator'].includes(userRole)) {
        if (!context.department) {
            // If department is missing, create at year level
            pathContext = { year, userId: uid };
        } else {
            pathContext = { year, department: context.department, userId: uid };
        }
    } else if (context.department && context.course) {
        // Student or other course-level roles
        pathContext = { year, department: context.department, course: context.course, userId: uid };
    } else if (context.department) {
        pathContext = { year, department: context.department, userId: uid };
    } else {
        pathContext = { year, userId: uid };

    }

    // Check if personal calendar exists
    const existing = await getHierarchicalCalendar('personal', pathContext);
    if (existing) {
        return { calendar: existing, seeded: false };
    }

    // Create new personal calendar
    const calendar: Calendar = {
        id: CALENDAR_METADATA_DOC,
        name: 'Personal',
        description: 'Your personal calendar',
        level: 'personal',
        color: DEFAULT_COLORS.personal,
        pathContext,
        ownerUid: uid,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions: [
            {
                uid,
                canView: true,
                canEdit: true,
                canDelete: false,
            },
        ],
        isVisible: true,
        isDefault: true,
    };

    await setHierarchicalCalendar(calendar);
    return { calendar, seeded: true };
}

/**
 * Create a group calendar when a new group is created
 * @param groupContext - Path context including year/department/course/groupId
 * @param groupName - Display name for the group
 * @param creatorUid - UID of the user creating the group
 * @param adviserUids - Array of adviser UIDs to grant access
 * @param editorUids - Array of editor UIDs to grant access
 */
export async function createGroupCalendarHierarchical(
    groupContext: { year?: string; department: string; course: string; groupId: string },
    groupName: string,
    creatorUid: string,
    adviserUids?: string[],
    editorUids?: string[]
): Promise<string> {
    const year = groupContext.year || DEFAULT_YEAR;

    const permissions: CalendarPermission[] = [
        {
            groupId: groupContext.groupId,
            canView: true,
            canEdit: true,
            canDelete: false,
        },
    ];

    // Add advisers with view and edit permission
    if (adviserUids?.length) {
        adviserUids.forEach((uid) => {
            permissions.push({
                uid,
                canView: true,
                canEdit: true,
                canDelete: false,
            });
        });
    }

    // Add editors with view and edit permission
    if (editorUids?.length) {
        editorUids.forEach((uid) => {
            permissions.push({
                uid,
                canView: true,
                canEdit: true,
                canDelete: false,
            });
        });
    }

    // Admins and developers can always access
    permissions.push(
        { role: 'admin', canView: true, canEdit: true, canDelete: true },
        { role: 'developer', canView: true, canEdit: true, canDelete: true }
    );

    const pathContext: TypedCalendarPathContext = {
        year,
        department: groupContext.department,
        course: groupContext.course,
        groupId: groupContext.groupId,
    };

    const calendar: Calendar = {
        id: CALENDAR_METADATA_DOC,
        name: groupName,
        description: `Calendar for ${groupName}`,
        level: 'group',
        color: DEFAULT_COLORS.group,
        pathContext,
        ownerUid: groupContext.groupId,
        createdBy: creatorUid,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions,
        groupId: groupContext.groupId,
        groupName,
        isVisible: true,
        isDefault: false,
    };

    return await setHierarchicalCalendar(calendar);
}

// ============================================================================
// User Calendar Access (Hierarchical)
// ============================================================================

/**
 * Get all calendars a user can view based on their role and context
 * 
 * Visibility hierarchy (user sees all levels above them + their own):
 * - Global (year-level): visible to ALL users
 * - Department: visible to all users in that department (including those in courses)
 * - Course: visible to all users in that course
 * - Group: visible to group members only
 * - Personal: visible only to the owner
 * 
 * Admin/Developer special access:
 * - Can see ALL calendars (global, all departments, all courses, all groups)
 * - CANNOT see personal calendars of other users (only their own)
 * 
 * @param uid - User's Firebase UID
 * @param userRole - User's role
 * @param userContext - User's path context (year/department/course)
 * @param groupIds - Array of group IDs the user belongs to
 * @param allUsers - (Admin only) All users to get all department/course combinations
 * @param allGroups - (Admin only) All groups to get all group calendars
 */
export async function getUserCalendarsHierarchical(
    uid: string,
    userRole: UserRole,
    userContext: { year?: string; department?: string; course?: string },
    groupIds?: string[],
    allUsers?: { department?: string; course?: string }[],
    allGroups?: { id: string; department?: string; course?: string }[]
): Promise<Calendar[]> {
    const calendars: Calendar[] = [];
    const year = userContext.year || DEFAULT_YEAR;
    const isAdminOrDev = userRole === 'admin' || userRole === 'developer';

    // 1. Always get global calendar if it exists (visible to ALL users)
    const globalCal = await getHierarchicalCalendar('global', { year });
    if (globalCal) calendars.push(globalCal);

    if (isAdminOrDev && allUsers && allGroups) {
        // Admin/Developer: Get ALL calendars except other users' personal calendars

        // Extract unique departments and department/course pairs
        const departmentsSet = new Set<string>();
        const coursePairsMap = new Map<string, { department: string; course: string }>();

        for (const user of allUsers) {
            if (user.department) {
                departmentsSet.add(user.department);
                if (user.course) {
                    const key = `${user.department}|${user.course}`;
                    if (!coursePairsMap.has(key)) {
                        coursePairsMap.set(key, { department: user.department, course: user.course });
                    }
                }
            }
        }

        // 2. Get ALL department calendars
        for (const department of departmentsSet) {
            const deptCal = await getHierarchicalCalendar('department', { year, department });
            if (deptCal) calendars.push(deptCal);
        }

        // 3. Get ALL course calendars
        for (const { department, course } of coursePairsMap.values()) {
            const courseCal = await getHierarchicalCalendar('course', { year, department, course });
            if (courseCal) calendars.push(courseCal);
        }

        // 4. Get ALL group calendars
        for (const group of allGroups) {
            if (!group.department || !group.course) continue;
            const groupCal = await getHierarchicalCalendar('group', {
                year,
                department: group.department,
                course: group.course,
                groupId: group.id,
            });
            if (groupCal) calendars.push(groupCal);
        }

        // 5. Get ONLY the admin's own personal calendar (not others')
        const personalCal = await getHierarchicalCalendar('personal', {
            year,
            department: userContext.department,
            course: userContext.course,
            userId: uid,
        });
        if (personalCal) calendars.push(personalCal);

    } else {
        // Regular user: Get calendars based on their hierarchy level

        // 2. Get department calendar if user has department context
        // (visible to all users in the department, including those in courses)
        if (userContext.department) {
            const deptCal = await getHierarchicalCalendar('department', {
                year,
                department: userContext.department,
            });
            if (deptCal) calendars.push(deptCal);
        }

        // 3. Get course calendar if user has course context
        // (visible to all users in that course)
        if (userContext.department && userContext.course) {
            const courseCal = await getHierarchicalCalendar('course', {
                year,
                department: userContext.department,
                course: userContext.course,
            });
            if (courseCal) calendars.push(courseCal);
        }

        // 4. Get group calendars for groups the user belongs to
        // (visible only to group members)
        if (groupIds?.length && userContext.department && userContext.course) {
            for (const groupId of groupIds) {
                const groupCal = await getHierarchicalCalendar('group', {
                    year,
                    department: userContext.department,
                    course: userContext.course,
                    groupId,
                });
                if (groupCal) calendars.push(groupCal);
            }
        }

        // 5. Get user's own personal calendar (visible only to the owner)
        const personalCal = await getHierarchicalCalendar('personal', {
            year,
            department: userContext.department,
            course: userContext.course,
            userId: uid,
        });
        if (personalCal) calendars.push(personalCal);
    }

    return calendars;
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a user can view a calendar
 */
export function canViewCalendar(
    calendar: Calendar,
    uid: string,
    userRole?: UserRole,
    userGroups?: string[]
): boolean {
    // Admins and developers can view any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can view
    if (calendar.level === 'personal') {
        return calendar.ownerUid === uid;
    }

    // Group calendars: check if user is in the group
    if (calendar.level === 'group' && calendar.groupId && userGroups?.includes(calendar.groupId)) {
        return true;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find((p) => p.uid === uid);
    if (userPerm) return userPerm.canView;

    // Check role permissions
    const rolePerm = calendar.permissions?.find((p) => p.role === userRole);
    if (rolePerm) return rolePerm.canView;

    // Global, department, course calendars are viewable by users in that context
    // (This is implicit based on getUserCalendarsHierarchical filtering)
    return false;
}

/**
 * Check if a user can edit a calendar
 */
export function canEditCalendar(
    calendar: Calendar,
    uid: string,
    userRole?: UserRole
): boolean {
    // Admins and developers can edit any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can edit
    if (calendar.level === 'personal') {
        return calendar.ownerUid === uid;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find((p) => p.uid === uid);
    if (userPerm) return userPerm.canEdit;

    // Check role permissions
    const rolePerm = calendar.permissions?.find((p) => p.role === userRole);
    if (rolePerm) return rolePerm.canEdit;

    return false;
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * Subscribe to realtime updates for a hierarchical calendar
 */
export function onHierarchicalCalendar(
    level: CalendarLevel,
    context: CalendarPathContext,
    onData: (calendar: Calendar | null) => void,
    onError?: (error: Error) => void
): () => void {
    const docPath = getCalendarMetadataDocPath(level, context);
    const docRef = doc(firebaseFirestore, docPath);

    return onSnapshot(
        docRef,
        (snap) => {
            if (!snap.exists()) {
                onData(null);
                return;
            }
            onData({ id: snap.id, ...snap.data() } as Calendar);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Calendar listener error:', error);
            }
        }
    );
}

// ============================================================================
// Calendar Seeding (for admin initialization)
// ============================================================================

/**
 * Default calendar metadata for different levels
 */
type CalendarMetadataFields = 'id' | 'pathContext' | 'createdAt' | 'lastModified' | 'createdBy' | 'ownerUid';
const DEFAULT_CALENDAR_METADATA: Record<CalendarLevel, Omit<Calendar, CalendarMetadataFields>> = {
    global: {
        name: 'Institution Calendar',
        description: 'Institution-wide events and announcements',
        level: 'global',
        color: DEFAULT_COLORS.global,
        permissions: [
            { role: 'admin', canView: true, canEdit: true, canDelete: true },
            { role: 'developer', canView: true, canEdit: true, canDelete: true },
            { role: 'head', canView: true, canEdit: true, canDelete: false },
        ],
        isVisible: true,
        isDefault: true,
    },
    department: {
        name: 'Department Calendar',
        description: 'Department-wide events and announcements',
        level: 'department',
        color: DEFAULT_COLORS.department,
        permissions: [
            { role: 'admin', canView: true, canEdit: true, canDelete: true },
            { role: 'developer', canView: true, canEdit: true, canDelete: true },
            { role: 'head', canView: true, canEdit: true, canDelete: false },
            { role: 'adviser', canView: true, canEdit: true, canDelete: false },
        ],
        isVisible: true,
        isDefault: true,
    },
    course: {
        name: 'Course Calendar',
        description: 'Course-wide events and announcements',
        level: 'course',
        color: DEFAULT_COLORS.course,
        permissions: [
            { role: 'admin', canView: true, canEdit: true, canDelete: true },
            { role: 'developer', canView: true, canEdit: true, canDelete: true },
            { role: 'head', canView: true, canEdit: true, canDelete: false },
            { role: 'adviser', canView: true, canEdit: true, canDelete: false },
        ],
        isVisible: true,
        isDefault: true,
    },
    group: {
        name: 'Group Calendar',
        description: 'Group-specific events and deadlines',
        level: 'group',
        color: DEFAULT_COLORS.group,
        permissions: [
            { role: 'admin', canView: true, canEdit: true, canDelete: true },
            { role: 'developer', canView: true, canEdit: true, canDelete: true },
        ],
        isVisible: true,
        isDefault: false,
    },
    personal: {
        name: 'Personal Calendar',
        description: 'Your personal calendar',
        level: 'personal',
        color: DEFAULT_COLORS.personal,
        permissions: [],
        isVisible: true,
        isDefault: true,
    },
};

/** Result of loading or seeding calendar data */
export interface LoadOrSeedCalendarResult {
    calendar: Calendar;
    /** Whether new calendar was seeded (true) or existing one loaded (false) */
    seeded: boolean;
}

/**
 * Seed a hierarchical calendar if it doesn't exist
 * Used by admin to initialize calendar structure
 */
export async function loadOrSeedCalendar(
    level: CalendarLevel,
    context: CalendarPathContext,
    creatorUid: string,
    customMetadata?: Partial<Calendar>
): Promise<LoadOrSeedCalendarResult> {
    const existing = await getHierarchicalCalendar(level, context);

    if (existing) {
        return { calendar: existing, seeded: false };
    }

    // Create new calendar with default metadata
    const defaultMeta = DEFAULT_CALENDAR_METADATA[level];
    const now = new Date().toISOString();

    const calendar: Calendar = {
        id: CALENDAR_METADATA_DOC,
        ...defaultMeta,
        ...customMetadata,
        pathContext: context,
        createdBy: creatorUid,
        ownerUid: creatorUid,
        createdAt: now,
        lastModified: now,
    };

    await setHierarchicalCalendar(calendar);
    return { calendar, seeded: true };
}

/**
 * Seed all hierarchical calendars for a user's context
 * This creates global, department, course calendars if they don't exist
 * @param userContext - User's path context (year/department/course)
 * @param creatorUid - UID of the user creating the calendars
 * @returns Array of seeding results
 */
export async function seedCalendarsForContext(
    userContext: { year?: string; department?: string; course?: string },
    creatorUid: string
): Promise<LoadOrSeedCalendarResult[]> {
    const results: LoadOrSeedCalendarResult[] = [];
    const year = userContext.year || DEFAULT_YEAR;

    // 1. Seed global calendar
    const globalResult = await loadOrSeedCalendar(
        'global',
        { year },
        creatorUid
    );
    results.push(globalResult);

    // 2. Seed department calendar if department context exists
    if (userContext.department) {
        const deptResult = await loadOrSeedCalendar(
            'department',
            { year, department: userContext.department },
            creatorUid,
            { name: `${userContext.department} Calendar` }
        );
        results.push(deptResult);
    }

    // 3. Seed course calendar if course context exists
    if (userContext.department && userContext.course) {
        const courseResult = await loadOrSeedCalendar(
            'course',
            { year, department: userContext.department, course: userContext.course },
            creatorUid,
            { name: `${userContext.course} Calendar` }
        );
        results.push(courseResult);
    }

    return results;
}

/**
 * Check if hierarchical calendars exist for a context
 */
export async function checkCalendarsExist(
    userContext: { year?: string; department?: string; course?: string }
): Promise<{ global: boolean; department: boolean; course: boolean }> {
    const year = userContext.year || DEFAULT_YEAR;

    const globalCal = await getHierarchicalCalendar('global', { year });

    let deptCal: Calendar | null = null;
    if (userContext.department) {
        deptCal = await getHierarchicalCalendar('department', {
            year,
            department: userContext.department,
        });
    }

    let courseCal: Calendar | null = null;
    if (userContext.department && userContext.course) {
        courseCal = await getHierarchicalCalendar('course', {
            year,
            department: userContext.department,
            course: userContext.course,
        });
    }

    return {
        global: globalCal !== null,
        department: deptCal !== null,
        course: courseCal !== null,
    };
}

// ============================================================================
// Comprehensive Calendar Seeding (Admin)
// ============================================================================

/** Result of seeding all calendars */
export interface SeedAllCalendarsResult {
    global: boolean;
    departments: { department: string; seeded: boolean }[];
    courses: { department: string; course: string; seeded: boolean }[];
    groups: { department: string; course: string; groupId: string; groupName: string; seeded: boolean }[];
    totalSeeded: number;
}

/**
 * Seed all hierarchical calendars for all departments, courses, and groups
 * Should be called by admin when opening the calendar page
 * @param creatorUid - UID of the admin creating the calendars
 * @param year - Academic year (defaults to DEFAULT_YEAR)
 * @param users - All users to extract department/course pairs from
 * @param groups - All groups to create group calendars for
 * @returns Summary of what was seeded
 */
export async function seedAllCalendars(
    creatorUid: string,
    year: string = DEFAULT_YEAR,
    users: { department?: string; course?: string }[],
    groups: { id: string; name: string; department?: string; course?: string }[]
): Promise<SeedAllCalendarsResult> {
    const result: SeedAllCalendarsResult = {
        global: false,
        departments: [],
        courses: [],
        groups: [],
        totalSeeded: 0,
    };

    // 1. Seed global calendar
    const globalResult = await loadOrSeedCalendar('global', { year }, creatorUid);
    result.global = globalResult.seeded;
    if (globalResult.seeded) result.totalSeeded++;

    // 2. Extract unique departments and department/course pairs
    const departmentsSet = new Set<string>();
    const coursePairsMap = new Map<string, { department: string; course: string }>();

    for (const user of users) {
        if (user.department) {
            departmentsSet.add(user.department);
            if (user.course) {
                const key = `${user.department}|${user.course}`;
                if (!coursePairsMap.has(key)) {
                    coursePairsMap.set(key, { department: user.department, course: user.course });
                }
            }
        }
    }

    // 3. Seed department calendars
    for (const department of departmentsSet) {
        const deptResult = await loadOrSeedCalendar(
            'department',
            { year, department },
            creatorUid,
            { name: `${department} Calendar` }
        );
        result.departments.push({ department, seeded: deptResult.seeded });
        if (deptResult.seeded) result.totalSeeded++;
    }

    // 4. Seed course calendars
    for (const { department, course } of coursePairsMap.values()) {
        const courseResult = await loadOrSeedCalendar(
            'course',
            { year, department, course },
            creatorUid,
            { name: `${course} Calendar` }
        );
        result.courses.push({ department, course, seeded: courseResult.seeded });
        if (courseResult.seeded) result.totalSeeded++;
    }

    // 5. Seed group calendars
    for (const group of groups) {
        if (!group.department || !group.course) continue;

        const groupCal = await getHierarchicalCalendar('group', {
            year,
            department: group.department,
            course: group.course,
            groupId: group.id,
        });

        if (!groupCal) {
            // Create group calendar if it doesn't exist
            const permissions: CalendarPermission[] = [
                { groupId: group.id, canView: true, canEdit: true, canDelete: false },
                { role: 'admin', canView: true, canEdit: true, canDelete: true },
                { role: 'developer', canView: true, canEdit: true, canDelete: true },
            ];

            const calendar: Calendar = {
                id: CALENDAR_METADATA_DOC,
                name: `${group.name} Calendar`,
                description: `Calendar for ${group.name}`,
                level: 'group',
                color: DEFAULT_COLORS.group,
                pathContext: {
                    year,
                    department: group.department,
                    course: group.course,
                    groupId: group.id,
                },
                ownerUid: group.id,
                createdBy: creatorUid,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                permissions,
                groupId: group.id,
                groupName: group.name,
                isVisible: true,
                isDefault: false,
            };

            await setHierarchicalCalendar(calendar);
            result.groups.push({
                department: group.department,
                course: group.course,
                groupId: group.id,
                groupName: group.name,
                seeded: true,
            });
            result.totalSeeded++;
        } else {
            result.groups.push({
                department: group.department,
                course: group.course,
                groupId: group.id,
                groupName: group.name,
                seeded: false,
            });
        }
    }

    return result;
}
