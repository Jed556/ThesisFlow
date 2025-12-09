import {
    doc, onSnapshot, collection, query, where, getDocs,
    getDoc, documentId,
    type QueryConstraint, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';

import type { ScheduleEvent, CalendarLevel, CalendarPathContext, Calendar } from '../../../types/schedule';
import type { EventsListenerOptions } from './calendarEvents';

type EventRecord = ScheduleEvent & { id: string };

/** Firestore collection name used for events documents */
const EVENTS_COLLECTION = 'events';

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
 * Helper to check if an event matches a calendar's pathContext
 */
function eventMatchesCalendar(event: ScheduleEvent, calendar: Calendar): boolean {
    if (event.calendarLevel !== calendar.level) return false;
    const eventCtx = event.calendarPathContext;
    const calCtx = calendar.pathContext;
    if (!eventCtx || !calCtx) return false;
    if (eventCtx.year !== calCtx.year) return false;
    if (eventCtx.department !== calCtx.department) return false;
    if (eventCtx.course !== calCtx.course) return false;
    if (eventCtx.groupId !== calCtx.groupId) return false;
    if (eventCtx.userId !== calCtx.userId) return false;
    return true;
}

/**
 * Get all events from the events collection.
 * Optionally filter by calendars (using their level and pathContext).
 * Note: For large collections this should be paginated or limited.
 * @param calendars - Optional array of calendars to filter by (uses level and pathContext matching)
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getAllEvents(calendars?: Calendar[]): Promise<(ScheduleEvent & { id: string })[]> {
    // Get all events from the collection
    const snap = await getDocs(collection(firebaseFirestore, EVENTS_COLLECTION));
    const allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));

    // If no calendars filter, return all events
    if (!calendars || calendars.length === 0) {
        return allEvents;
    }

    // Filter events that match any of the provided calendars
    return allEvents.filter(event =>
        calendars.some(cal => eventMatchesCalendar(event, cal))
    );
}

/**
 * Get all events for a specific calendar using hierarchical path
 * @param level - Calendar level
 * @param pathContext - Calendar path context
 * @returns Array of ScheduleEvent with their Firestore document IDs
 */
export async function getEventsByCalendar(
    level: CalendarLevel,
    pathContext: CalendarPathContext
): Promise<(ScheduleEvent & { id: string })[]> {
    // Query by calendarLevel first
    const q = query(
        collection(firebaseFirestore, EVENTS_COLLECTION),
        where('calendarLevel', '==', level)
    );
    const snap = await getDocs(q);
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEvent & { id: string }));

    // Filter by pathContext matching
    return events.filter(event => {
        const ctx = event.calendarPathContext;
        if (!ctx) return false;
        if (ctx.year !== pathContext.year) return false;
        if (ctx.department !== pathContext.department) return false;
        if (ctx.course !== pathContext.course) return false;
        if (ctx.groupId !== pathContext.groupId) return false;
        if (ctx.userId !== pathContext.userId) return false;
        return true;
    });
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

/**
 * Listen to events that belong to the provided thesis IDs.
 */
export function listenEventsByThesisIds(
    thesisIds: string[] | undefined,
    options: EventsListenerOptions
): () => void {
    const uniqueIds = Array.from(new Set((thesisIds ?? []).filter((id): id is string => Boolean(id))));

    if (uniqueIds.length === 0) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const chunkSize = 10; // Firestore `in` queries accept up to 10 values per chunk
    const chunks: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += chunkSize) {
        chunks.push(uniqueIds.slice(index, index + chunkSize));
    }

    const aggregated = new Map<string, EventRecord>();
    const chunkEventIds = new Map<number, Set<string>>();

    const emit = (): void => {
        const sorted = Array.from(aggregated.values()).sort((a, b) => {
            const first = new Date(a.startDate ?? '').getTime();
            const second = new Date(b.startDate ?? '').getTime();
            if (Number.isNaN(first) || Number.isNaN(second)) {
                return 0;
            }
            return first - second;
        });
        options.onData(sorted);
    };

    const unsubscribes = chunks.map((chunk, chunkIndex) => {
        const eventsQuery = query(
            collection(firebaseFirestore, EVENTS_COLLECTION),
            where('thesisId', 'in', chunk)
        );

        return onSnapshot(
            eventsQuery,
            (snapshot: QuerySnapshot<DocumentData>) => {
                const seenIds = new Set<string>();
                snapshot.docs.forEach((docSnap) => {
                    aggregated.set(docSnap.id, {
                        id: docSnap.id,
                        ...(docSnap.data() as Omit<ScheduleEvent, 'id'>),
                    } as EventRecord);
                    seenIds.add(docSnap.id);
                });

                const previousIds = chunkEventIds.get(chunkIndex) ?? new Set<string>();
                previousIds.forEach((eventId) => {
                    if (!seenIds.has(eventId)) {
                        aggregated.delete(eventId);
                    }
                });

                chunkEventIds.set(chunkIndex, seenIds);
                emit();
            },
            (error) => {
                if (options.onError) {
                    options.onError(error as Error);
                } else {
                    console.error('Thesis events listener error:', error);
                }
            }
        );
    });

    return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
}
