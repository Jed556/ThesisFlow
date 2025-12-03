import {
    doc, setDoc, onSnapshot, collection, query, where,
    getDocs, addDoc, getDoc, deleteDoc, type WithFieldValue,
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

/** Firestore collection name for legacy flat calendars - used for migration */
const LEGACY_CALENDARS_COLLECTION = 'calendars';

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
        eventIds: [],
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
        eventIds: [],
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
 * Returns calendars from all levels the user has access to
 * @param uid - User's Firebase UID
 * @param userRole - User's role
 * @param userContext - User's path context (year/department/course)
 * @param groupIds - Array of group IDs the user belongs to
 */
export async function getUserCalendarsHierarchical(
    uid: string,
    userRole: UserRole,
    userContext: { year?: string; department?: string; course?: string },
    groupIds?: string[]
): Promise<Calendar[]> {
    const calendars: Calendar[] = [];
    const year = userContext.year || DEFAULT_YEAR;

    // 1. Always get global calendar if it exists
    const globalCal = await getHierarchicalCalendar('global', { year });
    if (globalCal) calendars.push(globalCal);

    // 2. Get department calendar if user has department context
    if (userContext.department) {
        const deptCal = await getHierarchicalCalendar('department', {
            year,
            department: userContext.department,
        });
        if (deptCal) calendars.push(deptCal);
    }

    // 3. Get course calendar if user has course context
    if (userContext.department && userContext.course) {
        const courseCal = await getHierarchicalCalendar('course', {
            year,
            department: userContext.department,
            course: userContext.course,
        });
        if (courseCal) calendars.push(courseCal);
    }

    // 4. Get group calendars for groups the user belongs to
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

    // 5. Get personal calendar
    const personalCal = await getHierarchicalCalendar('personal', {
        year,
        department: userContext.department,
        course: userContext.course,
        userId: uid,
    });
    if (personalCal) calendars.push(personalCal);

    // 6. Admins/developers: also fetch all calendars from legacy collection for migration
    if (userRole === 'admin' || userRole === 'developer') {
        const legacyCalendars = await getAllLegacyCalendars();
        const existingIds = new Set(calendars.map((c) => c.id));
        legacyCalendars.forEach((cal) => {
            if (!existingIds.has(cal.id)) {
                calendars.push(cal);
            }
        });
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
// Legacy Support (Flat Calendars Collection)
// These functions maintain backward compatibility with the old flat structure
// ============================================================================

/**
 * @deprecated Use setHierarchicalCalendar for new code
 * Create or update a calendar in the legacy flat collection
 */
export async function setCalendar(id: string | null, calendar: Calendar): Promise<string> {
    if (id) {
        const cleanedData = cleanData(calendar, 'update');
        const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        const cleanedData = cleanData(calendar, 'create');
        const ref = await addDoc(
            collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION),
            cleanedData as WithFieldValue<Calendar>
        );
        return ref.id;
    }
}

/**
 * @deprecated Use getHierarchicalCalendar for new code
 * Get a calendar by id from legacy collection
 */
export async function getCalendarById(id: string): Promise<Calendar | null> {
    const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Calendar;
}

/**
 * @deprecated Use getUserCalendarsHierarchical for new code
 * Get all calendars a user can view from legacy collection
 */
export async function getUserCalendars(
    uid: string,
    userRole?: string,
    groupIds?: string[]
): Promise<Calendar[]> {
    const calendars: Calendar[] = [];

    // Get personal calendar
    const personalQuery = query(
        collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION),
        where('type', '==', 'personal'),
        where('ownerUid', '==', uid)
    );
    const personalSnap = await getDocs(personalQuery);
    calendars.push(...personalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Calendar)));

    // Get group calendars if user has groups
    if (groupIds && groupIds.length > 0) {
        const groupQuery = query(
            collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION),
            where('type', '==', 'group'),
            where('groupId', 'in', groupIds)
        );
        const groupSnap = await getDocs(groupQuery);
        calendars.push(...groupSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Calendar)));
    }

    // Admins and developers see all calendars
    if (userRole === 'admin' || userRole === 'developer') {
        const allQuery = query(collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION));
        const allSnap = await getDocs(allQuery);
        const allCalendars = allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Calendar));

        const existingIds = new Set(calendars.map((c) => c.id));
        allCalendars.forEach((cal) => {
            if (!existingIds.has(cal.id)) {
                calendars.push(cal);
            }
        });
    }

    return calendars;
}

/**
 * @deprecated Use getHierarchicalCalendar for new code
 * Get calendars for a specific group from legacy collection
 */
export async function getGroupCalendar(groupId: string): Promise<Calendar | null> {
    const q = query(
        collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION),
        where('type', '==', 'group'),
        where('groupId', '==', groupId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Calendar;
}

/**
 * Get all calendars from legacy collection (admin only)
 */
export async function getAllLegacyCalendars(): Promise<Calendar[]> {
    const snap = await getDocs(collection(firebaseFirestore, LEGACY_CALENDARS_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Calendar));
}

/**
 * @deprecated Use getAllLegacyCalendars
 */
export const getAllCalendars = getAllLegacyCalendars;

/**
 * @deprecated Use deleteHierarchicalCalendar for new code
 * Delete a calendar by id from legacy collection
 */
export async function deleteCalendar(id: string): Promise<void> {
    if (!id) throw new Error('Calendar ID required');
    const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * @deprecated
 * Delete multiple calendars from legacy collection
 */
export async function bulkDeleteCalendars(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Calendar IDs required');
    const deletePromises = ids.map((id) => {
        const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, id);
        return deleteDoc(ref);
    });
    await Promise.all(deletePromises);
}

/**
 * @deprecated Use createPersonalCalendarForUser for new code
 * Create a personal calendar for a user in legacy collection
 */
export async function createPersonalCalendar(uid: string): Promise<string> {
    const calendar: Omit<Calendar, 'id'> = {
        name: 'Personal',
        description: 'Your personal calendar',
        level: 'personal',
        type: 'personal', // Legacy compatibility
        color: DEFAULT_COLORS.personal,
        pathContext: { year: DEFAULT_YEAR, userId: uid },
        eventIds: [],
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

    return await setCalendar(null, calendar as Calendar);
}

/**
 * @deprecated Use createGroupCalendarHierarchical for new code
 * Create a group calendar in legacy collection
 */
export async function createGroupCalendar(
    groupId: string,
    groupName: string,
    creatorUid: string,
    adviserUids?: string[],
    editorUids?: string[]
): Promise<string> {
    const permissions: CalendarPermission[] = [
        {
            groupId,
            canView: true,
            canEdit: true,
            canDelete: false,
        },
    ];

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

    permissions.push(
        { role: 'admin', canView: true, canEdit: true, canDelete: true },
        { role: 'developer', canView: true, canEdit: true, canDelete: true }
    );

    const calendar: Omit<Calendar, 'id'> = {
        name: groupName,
        description: `Calendar for ${groupName}`,
        level: 'group',
        type: 'group', // Legacy compatibility
        color: DEFAULT_COLORS.group,
        pathContext: { year: DEFAULT_YEAR, groupId },
        eventIds: [],
        ownerUid: groupId,
        createdBy: creatorUid,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions,
        groupId,
        groupName,
        isVisible: true,
        isDefault: false,
    };

    return await setCalendar(null, calendar as Calendar);
}

/**
 * @deprecated Use onHierarchicalCalendar for new code
 * Subscribe to realtime updates for a legacy calendar
 */
export function onCalendar(
    id: string,
    onData: (calendar: Calendar | null) => void,
    onError?: (error: Error) => void
): () => void {
    const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, id);
    return onSnapshot(
        ref,
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
// Event Management Helpers (work with both hierarchical and legacy)
// ============================================================================

/**
 * Add an event ID to a calendar's eventIds array
 * Works with both hierarchical and legacy calendars
 */
export async function addEventToCalendar(calendarId: string, eventId: string): Promise<void> {
    // Try legacy first
    const calendar = await getCalendarById(calendarId);
    if (!calendar) throw new Error('Calendar not found');

    const currentEventIds = calendar.eventIds || [];
    if (!currentEventIds.includes(eventId)) {
        const updatedEventIds = [...currentEventIds, eventId];
        const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, calendarId);
        await setDoc(
            ref,
            {
                eventIds: updatedEventIds,
                lastModified: new Date().toISOString(),
            },
            { merge: true }
        );
    }
}

/**
 * Remove an event ID from a calendar's eventIds array
 */
export async function removeEventFromCalendar(calendarId: string, eventId: string): Promise<void> {
    const calendar = await getCalendarById(calendarId);
    if (!calendar) throw new Error('Calendar not found');

    const currentEventIds = calendar.eventIds || [];
    const updatedEventIds = currentEventIds.filter((id) => id !== eventId);
    const ref = doc(firebaseFirestore, LEGACY_CALENDARS_COLLECTION, calendarId);
    await setDoc(
        ref,
        {
            eventIds: updatedEventIds,
            lastModified: new Date().toISOString(),
        },
        { merge: true }
    );
}

/**
 * Get all event IDs from user's visible calendars
 */
export async function getEventIdsFromCalendars(calendars: Calendar[]): Promise<string[]> {
    const eventIdsSet = new Set<string>();
    calendars.forEach((calendar) => {
        if (calendar.eventIds && Array.isArray(calendar.eventIds)) {
            calendar.eventIds.forEach((eventId) => eventIdsSet.add(eventId));
        }
    });
    return Array.from(eventIdsSet);
}
