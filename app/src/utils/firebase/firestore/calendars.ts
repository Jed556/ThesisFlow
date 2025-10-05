import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { Calendar, CalendarType } from '../../../types/schedule';

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
 */
export async function setCalendar(id: string | null, calendar: Calendar): Promise<string> {
    const cleanedData = cleanData(calendar);

    if (id) {
        const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, CALENDARS_COLLECTION), cleanedData as any);
        return ref.id;
    }
}

/**
 * Get a calendar by id
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
 */
export async function getUserCalendars(userEmail: string, userRole?: string, groupIds?: string[]): Promise<Calendar[]> {
    const calendars: Calendar[] = [];

    // Get personal calendar
    const personalQuery = query(
        collection(firebaseFirestore, CALENDARS_COLLECTION),
        where('type', '==', 'personal'),
        where('ownerId', '==', userEmail)
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
 */
export async function getAllCalendars(): Promise<Calendar[]> {
    const snap = await getDocs(collection(firebaseFirestore, CALENDARS_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Calendar));
}

/**
 * Delete a calendar by id
 * Note: Consider what happens to events in this calendar
 */
export async function deleteCalendar(id: string): Promise<void> {
    if (!id) throw new Error('Calendar ID required');
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple calendars by their IDs
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
 */
export async function createPersonalCalendar(userEmail: string): Promise<string> {
    const calendar: Omit<Calendar, 'id'> = {
        name: 'Personal',
        description: 'Your personal calendar',
        type: 'personal',
        color: DEFAULT_COLORS.personal,
        eventIds: [],
        ownerId: userEmail,
        createdBy: userEmail,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions: [
            {
                userEmail: userEmail,
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
 */
export async function createGroupCalendar(
    groupId: string,
    groupName: string,
    creatorEmail: string,
    adviserEmails?: string[],
    editorEmails?: string[]
): Promise<string> {
    const permissions: any[] = [
        {
            groupId: groupId,
            canView: true,
            canEdit: true,
            canDelete: false
        }
    ];

    // Add advisers with view and comment permission
    if (adviserEmails && adviserEmails.length > 0) {
        adviserEmails.forEach(email => {
            permissions.push({
                userEmail: email,
                canView: true,
                canEdit: true, // Advisers can edit
                canDelete: false
            });
        });
    }

    // Add editors with view and edit permission
    if (editorEmails && editorEmails.length > 0) {
        editorEmails.forEach(email => {
            permissions.push({
                userEmail: email,
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
        ownerId: groupId,
        createdBy: creatorEmail,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        permissions: permissions,
        groupId: groupId,
        groupName: groupName,
        isVisible: true,
        isDefault: false
    };

    return await setCalendar(null, calendar as Calendar);
}

/**
 * Subscribe to realtime updates for a calendar
 */
export function onCalendar(id: string, cb: (calendar: Calendar | null) => void) {
    const ref = doc(firebaseFirestore, CALENDARS_COLLECTION, id);
    return onSnapshot(ref, snap => {
        if (!snap.exists()) {
            cb(null);
            return;
        }
        cb({ id: snap.id, ...snap.data() } as Calendar);
    });
}

/**
 * Check if a user can edit a calendar
 */
export function canEditCalendar(calendar: Calendar, userEmail: string, userRole?: string): boolean {
    // Admins and developers can edit any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can edit
    if (calendar.type === 'personal') {
        return calendar.ownerId === userEmail;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find(p => p.userEmail === userEmail);
    if (userPerm) return userPerm.canEdit;

    // Check role permissions
    const rolePerm = calendar.permissions?.find(p => p.role === userRole);
    if (rolePerm) return rolePerm.canEdit;

    return false;
}

/**
 * Check if a user can view a calendar
 */
export function canViewCalendar(calendar: Calendar, userEmail: string, userRole?: string, userGroups?: string[]): boolean {
    // Admins and developers can view any calendar
    if (userRole === 'admin' || userRole === 'developer') return true;

    // Personal calendars: only owner can view
    if (calendar.type === 'personal') {
        return calendar.ownerId === userEmail;
    }

    // Group calendars: check if user is in the group
    if (calendar.type === 'group' && calendar.groupId && userGroups?.includes(calendar.groupId)) {
        return true;
    }

    // Check explicit permissions
    const userPerm = calendar.permissions?.find(p => p.userEmail === userEmail);
    if (userPerm) return userPerm.canView;

    // Check role permissions
    const rolePerm = calendar.permissions?.find(p => p.role === userRole);
    if (rolePerm) return rolePerm.canView;

    return false;
}

/**
 * Add an event ID to a calendar's eventIds array
 * Called when creating a new event
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
 */
export async function getEventIdsFromCalendars(calendars: Calendar[]): Promise<string[]> {
    // Collect all unique event IDs from selected calendars
    const eventIdsSet = new Set<string>();
    calendars.forEach(calendar => {
        calendar.eventIds.forEach(eventId => eventIdsSet.add(eventId));
    });
    return Array.from(eventIdsSet);
}
