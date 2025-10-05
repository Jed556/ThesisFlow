import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, updateDoc, deleteDoc, documentId } from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { addEventToCalendar, removeEventFromCalendar } from './calendars';
import { cleanData } from './firestore';

import type { ScheduleEvent } from '../../../types/schedule';

/** Firestore collection name used for events documents */
const EVENTS_COLLECTION = 'events';

/**
 * Create or update a schedule event
 */
export async function setEvent(id: string | null, event: ScheduleEvent): Promise<string> {
    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData(event);

    let eventId: string;
    
    if (id) {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        eventId = id;
    } else {
        const ref = await addDoc(collection(firebaseFirestore, EVENTS_COLLECTION), cleanedData as any);
        eventId = ref.id;
        
        // Add event ID to calendar's eventIds array
        await addEventToCalendar(event.calendarId, eventId);
    }
    
    return eventId;
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
 * Optionally filter by calendar IDs.
 * Note: For large collections this should be paginated or limited.
 * @param calendarIds - Optional array of calendar IDs to filter by
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getAllEvents(calendarIds?: string[]): Promise<(ScheduleEvent & { id: string })[]> {
    let q;

    if (calendarIds && calendarIds.length > 0) {
        // Filter by calendar IDs (Firestore 'in' supports up to 30 values)
        if (calendarIds.length <= 30) {
            q = query(
                collection(firebaseFirestore, EVENTS_COLLECTION),
                where('calendarId', 'in', calendarIds)
            );
        } else {
            // If more than 30 calendars, we need to batch the queries
            const batches = [];
            for (let i = 0; i < calendarIds.length; i += 30) {
                const batch = calendarIds.slice(i, i + 30);
                const batchQuery = query(
                    collection(firebaseFirestore, EVENTS_COLLECTION),
                    where('calendarId', 'in', batch)
                );
                batches.push(getDocs(batchQuery));
            }

            const results = await Promise.all(batches);
            const allDocs = results.flatMap(snap => snap.docs);
            return allDocs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));
        }
    } else {
        // Get all events if no filter
        q = collection(firebaseFirestore, EVENTS_COLLECTION);
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));
}

/**
 * Get all events for a specific calendar
 * @param calendarId - Calendar ID to filter by
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getEventsByCalendar(calendarId: string): Promise<(ScheduleEvent & { id: string })[]> {
    const q = query(
        collection(firebaseFirestore, EVENTS_COLLECTION),
        where('calendarId', '==', calendarId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));
}

/**
 * Delete an event by id
 * @param id - Event document ID
 */
export async function deleteEvent(id: string): Promise<void> {
    if (!id) throw new Error('Event ID required');
    
    // Get event to find its calendar ID
    const event = await getEventById(id);
    if (event) {
        // Remove event ID from calendar
        await removeEventFromCalendar(event.calendarId, id);
    }
    
    // Delete the event
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
    await deleteDoc(ref);
}

/**
 * Delete multiple events by their IDs
 * @param ids - Array of event document IDs to delete
 */
export async function bulkDeleteEvents(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) throw new Error('Event IDs required');

    // Fetch all events to get their calendar IDs
    const events = await Promise.all(ids.map(id => getEventById(id)));
    
    // Remove event IDs from calendars
    const calendarUpdates = events
        .filter(event => event !== null)
        .map(event => removeEventFromCalendar(event!.calendarId, event!.id!));
    
    await Promise.all(calendarUpdates);

    // Delete events
    const deletePromises = ids.map(id => {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Get events by their IDs (batch fetching)
 * This is the second step in the new async loading pattern
 * Firestore 'in' query supports up to 30 items, so we batch the requests
 * @param eventIds - Array of event IDs to fetch
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getEventsByIds(eventIds: string[]): Promise<(ScheduleEvent & { id: string })[]> {
    if (!eventIds || eventIds.length === 0) return [];

    const events: (ScheduleEvent & { id: string })[] = [];

    // Batch requests in groups of 30 (Firestore 'in' limit)
    for (let i = 0; i < eventIds.length; i += 30) {
        const batch = eventIds.slice(i, i + 30);
        const q = query(
            collection(firebaseFirestore, EVENTS_COLLECTION),
            where(documentId(), 'in', batch)
        );
        const snap = await getDocs(q);
        events.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string })));
    }

    return events;
}
