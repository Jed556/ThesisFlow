import {
    doc, setDoc, onSnapshot, collection, query, where, getDocs,
    addDoc, getDoc, deleteDoc, documentId, writeBatch,
    type WithFieldValue, type QueryConstraint, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { addEventToCalendar, removeEventFromCalendar } from './calendars';
import { cleanData } from './firestore';

import type { ScheduleEvent } from '../../../types/schedule';

type EventRecord = ScheduleEvent & { id: string };

export interface EventsListenerOptions {
    onData: (events: EventRecord[]) => void;
    onError?: (error: Error) => void;
}

/** Firestore collection name used for events documents */
const EVENTS_COLLECTION = 'events';

/**
 * Create or update a schedule event
 */
export async function setEvent(id: string | null, event: ScheduleEvent): Promise<string> {
    let eventId: string;

    if (id) {
        // Update existing event: use 'update' mode and remove 'id' field
        const { id: _, ...eventWithoutId } = event;
        const cleanedData = cleanData(eventWithoutId, 'update');
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        await setDoc(ref, cleanedData, { merge: true });
        eventId = id;
    } else {
        // Create new event: use 'create' mode and remove 'id' field
        const { id: _, ...eventWithoutId } = event;
        const cleanedData = cleanData(eventWithoutId, 'create');
        const ref = await addDoc(
            collection(firebaseFirestore, EVENTS_COLLECTION),
            cleanedData as WithFieldValue<ScheduleEvent>
        );
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
export function onEvent(
    id: string,
    onData: (event: ScheduleEvent | null) => void,
    onError?: (err: unknown) => void
): () => void {
    const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);

    // Wrap the listener and provide a default error handler that logs to console
    // if the caller doesn't provide one. Return the unsubscribe function.
    const unsubscribe = onSnapshot(
        ref,
        (snap) => onData(snap.exists() ? (snap.data() as ScheduleEvent) : null),
        (err) => {
            if (onError) onError(err);
            else console.error('onEvent listener error', err);
        }
    );

    return unsubscribe;
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

    // Batch-delete event documents atomically
    const batch = writeBatch(firebaseFirestore);
    ids.forEach((id) => {
        const ref = doc(firebaseFirestore, EVENTS_COLLECTION, id);
        batch.delete(ref);
    });

    await batch.commit();
}

/**
 * Subscribe to events collection updates with optional query constraints.
 * Mirrors the listener structure used in thesis.ts to provide a consistent API.
 * @param constraints - Optional Firestore query constraints to narrow the listener scope
 * @param options - Listener callbacks invoked for data updates or errors
 * @returns Unsubscribe handler to detach the snapshot listener
 */
export function listenEvents(
    constraints: QueryConstraint[] | undefined,
    options: EventsListenerOptions
): () => void {
    const { onData, onError } = options;
    const baseCollection = collection(firebaseFirestore, EVENTS_COLLECTION);
    const eventsQuery = constraints && constraints.length > 0
        ? query(baseCollection, ...constraints)
        : baseCollection;

    return onSnapshot(
        eventsQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const events = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<ScheduleEvent, 'id'>),
            } as EventRecord));
            onData(events);
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Events listener error:', error);
            }
        }
    );
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
