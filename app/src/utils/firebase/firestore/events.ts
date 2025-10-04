import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { ScheduleEvent } from '../../../types/schedule';

/** Firestore collection name used for user documents */
const EVENTS_COLLECTION = 'events';
const ACADEMIC_CALENDARS_COLLECTION = 'academic_calendars';

/**
 * Create or update a schedule event
 */
export async function setEvent(id: string | null, event: ScheduleEvent): Promise<string> {
    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData(event);

    if (id) {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, EVENTS_COLLECTION), cleanedData as any);
        return ref.id;
    }
}

/**
 * Get an event by id
 */
export async function getEventById(id: string): Promise<ScheduleEvent | null> {
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as ScheduleEvent;
}

/**
 * Subscribe to realtime updates for an event
 */
export function onEvent(id: string, cb: (event: ScheduleEvent | null) => void) {
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    return onSnapshot(ref, snap => cb(snap.exists() ? (snap.data() as ScheduleEvent) : null));
}

/**
 * Get all events from the events collection.
 * Note: For large collections this should be paginated or limited.
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getAllEvents(): Promise<(ScheduleEvent & { id: string })[]> {
    const snap = await getDocs(collection(firebaseFirestore, EVENTS_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));
}

/**
 * Delete an event by id
 * @param id - Event document ID
 */
export async function deleteEvent(id: string): Promise<void> {
    if (!id) throw new Error('Event ID required');
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple events by their IDs
 * @param ids - Array of event document IDs to delete
 */
export async function bulkDeleteEvents(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Event IDs required');

    const deletePromises = ids.map(id => {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

// ==========================
// Academic calendars helpers
// ==========================

import type { AcademicCalendar } from '../../../types/schedule';

/**
 * Get academic calendar by id
 * @returns {AcademicCalendar} or null if not found
 */
export async function getAcademicCalendarById(id: string): Promise<AcademicCalendar | null> {
    const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as AcademicCalendar;
}

/**
 * Get all academic calendars
 * @returns {AcademicCalendar[]} Array of AcademicCalendar with their Firestore document IDs
 */
export async function getAllAcademicCalendars(): Promise<(AcademicCalendar & { id: string })[]> {
    const snap = await getDocs(collection(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademicCalendar & { id: string }));
}


/**
 * Create or update academic calendar
 * @param id - Document ID to update, or null to create new
 * @param calendar - AcademicCalendar data
 */
export async function setAcademicCalendar(id: string | null, calendar: AcademicCalendar): Promise<string> {
    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData(calendar);

    if (id) {
        const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        return id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION), cleanedData as any);
        return ref.id;
    }
}

/**
 * Delete an academic calendar by id
 * @param id - Academic calendar document ID
 */
export async function deleteAcademicCalendar(id: string): Promise<void> {
    if (!id) throw new Error('Academic calendar ID required');
    const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple academic calendars by their IDs
 * @param ids - Array of academic calendar document IDs to delete
 * @returns Promise that resolves when all deletions are complete
 */
export async function bulkDeleteAcademicCalendars(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Academic calendar IDs required');

    const deletePromises = ids.map(id => {
        const ref = doc(firebaseFirestore, ACADEMIC_CALENDARS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}