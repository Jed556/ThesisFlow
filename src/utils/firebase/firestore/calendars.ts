import {
    doc, setDoc, onSnapshot, collection, query, where,
    getDocs, addDoc, getDoc, deleteDoc, type WithFieldValue,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { Calendar, CalendarPermission } from '../../../types/schedule';

/** Firestore collection name for calendars */
const CALENDARS_COLLECTION = 'calendars';

// Default calendar colors
const DEFAULT_COLORS = {
    personal: '#4285F4', // Google Blue
    group: '#0B8043',    // Google Green
    custom: '#F4B400'    // Google Yellow
};

/**
 * Create or update a calendar
 * @param id - Calendar ID (null for new)
 * @param calendar - Calendar data
 */
export async function setCalendar(id: string | null, calendar: Calendar): Promise<string> {
    if (id) {
        // Update existing: use 'update' mode to keep null values (for field deletion)
        const cleanedData = cleanData(calendar, 'update');
        const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        // Create new: use 'create' mode to remove null/undefined/empty values
        const cleanedData = cleanData(calendar, 'create');
        const ref = await addDoc(
            collection(firebaseFirestore, CALENDARS_COLLECTION),
            cleanedData as WithFieldValue<Calendar>
        );
        return ref.id;
    }
}

/**
 * Get a calendar by id
 * @param id - Calendar ID
 */
export async function getCalendarById(id: string): Promise<Calendar | null> {
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Calendar;
}

/**
 * Get all calendars a user can view
 * Includes: personal calendar, group calendars, and custom calendars with permissions
 * @param uid - User's Firebase UID
 * @param userRole - User's role (optional)
 * @param groupIds - Array of group IDs the user belongs to (optional)
 */
export async function getUserCalendars(uid: string, userRole?: string, groupIds?: string[]): Promise<Calendar[]> {
    const calendars: Calendar[] = [];

    // Get personal calendar
    const personalQuery = query(
        collection(firebaseFirestore, CALENDARS_COLLECTION),
        where('type', '==', 'personal'),
        where('ownerUid', '==', uid)
    );
    const personalSnap = await getDocs(personalQuery);
    calendars.push(...personalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Calendar)));

    // Get group calendars if user has groups
    if (groupIds && groupIds.length > 0) {
        const groupQuery = query(
            collection(firebaseFirestore, CALENDARS_COLLECTION),
            where('type', '==', 'group'),
            where('groupId', 'in', groupIds)
        );
        const groupSnap = await getDocs(groupQuery);
        calendars.push(...groupSnap.docs.map(d => ({ id: d.id, ...d.data() } as Calendar)));
    }

    // Admins and developers see all calendars
    if (userRole === 'admin' || userRole === 'developer') {
        const allQuery = query(collection(firebaseFirestore, CALENDARS_COLLECTION));
        const allSnap = await getDocs(allQuery);
        const allCalendars = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Calendar));

        // Merge with existing, avoiding duplicates
        const existingIds = new Set(calendars.map(c => c.id));
        allCalendars.forEach(cal => {
            if (!existingIds.has(cal.id)) {
                calendars.push(cal);
            }
        });
    }

    return calendars;
}

/**
 * Get calendars for a specific group
 * @param groupId - Group ID
 */
export async function getGroupCalendar(groupId: string): Promise<Calendar | null> {
    const q = query(
        collection(firebaseFirestore, CALENDARS_COLLECTION),
        where('type', '==', 'group'),
        where('groupId', '==', groupId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Calendar;
}

/**
 * Get all calendars (admin only)
 * @param id - Calendar ID
 */
export async function getAllCalendars(): Promise<Calendar[]> {
    const snap = await getDocs(collection(firebaseFirestore, CALENDARS_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Calendar));
}

/**
 * Delete a calendar by id
 * @param id - Calendar ID
 */
export async function deleteCalendar(id: string): Promise<void> {
    if (!id) throw new Error('Calendar ID required');
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple calendars by their IDs
 * @param ids - Array of calendar IDs to delete
 */
export async function bulkDeleteCalendars(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Calendar IDs required');

    const deletePromises = ids.map(id => {
        const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Create a personal calendar for a user (auto-generated)
 * Should be called when a new user is created
 * @param uid - User's Firebase UID
 */
export async function createPersonalCalendar(uid: string): Promise<string> {
    const calendar: Omit<Calendar, 'id'> = {
        name: 'Personal',
        description: 'Your personal calendar',
        type: 'personal',
        color: DEFAULT_COLORS.personal,
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
                canDelete: false // Can't delete personal calendar
            }
        ],
        isVisible: true,
        isDefault: true
    };

    return await setCalendar(null, calendar as Calendar);
}

/**
 * Create a group calendar (auto-generated)
 * Should be called when a new group is created
 * Automatically adds advisers and editors with appropriate permissions
 * @param groupId - Group ID
 * @param groupName - Group name
 * @param creatorUid - UID of the user creating the group
 * @param adviserUids - Array of adviser UIDs to grant access
 * @param editorUids - Array of editor UIDs to grant access
 * @return Calendar ID or the reference firestore document ID
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
            canDelete: false
        }
    ];

    // Add advisers with view and comment permission
    if (adviserUids && adviserUids.length > 0) {
        adviserUids.forEach(uid => {
            permissions.push({
                uid,
                canView: true,
                canEdit: true,
                canDelete: false
            });
        });
    }

    // Add editors with view and edit permission
    if (editorUids && editorUids.length > 0) {
        editorUids.forEach(uid => {
            permissions.push({
                uid,
                canView: true,
                canEdit: true,
                canDelete: false
            });
        });
    }

    // Admins and developers can always access
    permissions.push({
        role: 'admin',
        canView: true,
        canEdit: true,
        canDelete: true
    });
    permissions.push({
        role: 'developer',
        canView: true,
        canEdit: true,
        canDelete: true
    });

    const calendar: Omit<Calendar, 'id'> = {
        name: groupName,
        description: `Calendar for ${groupName}`,
        type: 'group',
        color: DEFAULT_COLORS.group,
        eventIds: [],
        ownerUid: groupId,
        createdBy: creatorUid,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions: permissions,
        groupId,
        groupName: groupName,
        isVisible: true,
        isDefault: false
    };

    return await setCalendar(null, calendar as Calendar);
}

/**
 * Subscribe to realtime updates for a calendar
 * @param id - Calendar ID
 * @param cb - Callback function to handle calendar updates
 */
export function onCalendar(
    id: string,
    onData: (calendar: Calendar | null) => void,
    onError?: (error: Error) => void
): () => void {
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
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

/**
 * Check if a user can edit a calendar
 * @param calendar - Calendar object
 * @param uid - User's Firebase UID
 * @param userRole - User's role (optional)
 */
export function canEditCalendar(calendar: Calendar, uid: string, userRole?: string): boolean {
    // Admins and developers can edit any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can edit
    if (calendar.type === 'personal') {
        return calendar.ownerUid === uid;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find(p => p.uid === uid);
    if (userPerm) return userPerm.canEdit;

    // Check role permissions
    const rolePerm = calendar.permissions?.find(p => p.role === userRole);
    if (rolePerm) return rolePerm.canEdit;

    return false;
}

/**
 * Check if a user can view a calendar
 * @param calendar - Calendar object
 * @param uid - User's Firebase UID
 * @param userRole - User's role (optional)
 * @param userGroups - Array of group IDs the user belongs to (optional)
 */
export function canViewCalendar(calendar: Calendar, uid: string, userRole?: string, userGroups?: string[]): boolean {
    // Admins and developers can view any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can view
    if (calendar.type === 'personal') {
        return calendar.ownerUid === uid;
    }

    // Group calendars: check if user is in the group
    if (calendar.type === 'group' && calendar.groupId && userGroups?.includes(calendar.groupId)) {
        return true;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find(p => p.uid === uid);
    if (userPerm) return userPerm.canView;

    // Check role permissions
    const rolePerm = calendar.permissions?.find(p => p.role === userRole);
    if (rolePerm) return rolePerm.canView;

    return false;
}

/**
 * Add an event ID to a calendar's eventIds array
 * Called when creating a new event
 * @param calendarId - ID of the calendar
 * @param eventId - ID of the event to add
 */
export async function addEventToCalendar(calendarId: string, eventId: string): Promise<void> {
    const calendar = await getCalendarById(calendarId);
    if (!calendar) throw new Error('Calendar not found');

    // Add event ID if not already present
    if (!calendar.eventIds.includes(eventId)) {
        const updatedEventIds = [...calendar.eventIds, eventId];
        const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, calendarId);
        await setDoc(ref, {
            eventIds: updatedEventIds,
            lastModified: new Date().toISOString()
        }, { merge: true });
    }
}

/**
 * Remove an event ID from a calendar's eventIds array
 * Called when deleting an event
 * @param calendarId - ID of the calendar
 * @param eventId - ID of the event to remove
 */
export async function removeEventFromCalendar(calendarId: string, eventId: string): Promise<void> {
    const calendar = await getCalendarById(calendarId);
    if (!calendar) throw new Error('Calendar not found');

    // Remove event ID if present
    const updatedEventIds = calendar.eventIds.filter(id => id !== eventId);
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, calendarId);
    await setDoc(ref, {
        eventIds: updatedEventIds,
        lastModified: new Date().toISOString()
    }, { merge: true });
}

/**
 * Get all event IDs from user's visible calendars
 * This is the first step in the new async loading pattern
 * @param calendars - Array of Calendar objects
 */
export async function getEventIdsFromCalendars(calendars: Calendar[]): Promise<string[]> {
    // Collect all unique event IDs from selected calendars
    const eventIdsSet = new Set<string>();
    calendars.forEach(calendar => {
        // Defensive check: some calendars may not have eventIds initialized
        if (calendar.eventIds && Array.isArray(calendar.eventIds)) {
            calendar.eventIds.forEach(eventId => eventIdsSet.add(eventId));
        }
    });
    return Array.from(eventIdsSet);
}
