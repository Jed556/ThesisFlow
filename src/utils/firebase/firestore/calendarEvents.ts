/**
 * Calendar Events - Hierarchical Event Management
 * 
 * Events are stored directly under calendar collections:
 * - year/{year}/calendar/{eventId}
 * - year/{year}/departments/{dept}/calendar/{eventId}
 * - year/{year}/departments/{dept}/courses/{course}/calendar/{eventId}
 * - year/{year}/departments/{dept}/courses/{course}/groups/{groupId}/calendar/{eventId}
 * - year/{year}/users/{userId}/calendar/{eventId}
 * - year/{year}/departments/{dept}/users/{userId}/calendar/{eventId}
 * - year/{year}/departments/{dept}/courses/{course}/users/{userId}/calendar/{eventId}
 */

import {
    doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch,
    onSnapshot, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { getCalendarCollectionPath } from './calendars';

import type { ScheduleEvent, CalendarLevel, CalendarPathContext, Calendar } from '../../../types/schedule';

type EventRecord = ScheduleEvent & { id: string };

export interface EventsListenerOptions {
    onData: (events: EventRecord[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Event CRUD Operations (Hierarchical)
// ============================================================================

/**
 * Get the document path for an event within a calendar collection
 * Path: {calendarCollectionPath}/{eventId}
 */
export function getEventDocPath(
    level: CalendarLevel,
    context: CalendarPathContext,
    eventId: string
): string {
    return `${getCalendarCollectionPath(level, context)}/${eventId}`;
}

/**
 * Create or update an event in a hierarchical calendar
 * @param id - Event ID (null for new events)
 * @param event - Event data including calendarLevel and calendarPathContext
 * @returns The event ID
 */
export async function setCalendarEvent(
    id: string | null,
    event: ScheduleEvent
): Promise<string> {
    if (!event.calendarLevel || !event.calendarPathContext) {
        throw new Error('Event must have calendarLevel and calendarPathContext');
    }

    const eventId = id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const docPath = getEventDocPath(event.calendarLevel, event.calendarPathContext, eventId);
    const docRef = doc(firebaseFirestore, docPath);

    const { id: _, ...eventWithoutId } = event;
    const cleanedData = cleanData({
        ...eventWithoutId,
        id: eventId,
        lastModified: new Date().toISOString(),
    }, id ? 'update' : 'create');

    await setDoc(docRef, cleanedData, { merge: true });
    return eventId;
}

/**
 * Get an event by ID from a specific calendar
 */
export async function getCalendarEvent(
    level: CalendarLevel,
    context: CalendarPathContext,
    eventId: string
): Promise<ScheduleEvent | null> {
    const docPath = getEventDocPath(level, context, eventId);
    const docRef = doc(firebaseFirestore, docPath);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ScheduleEvent;
}

/**
 * Delete an event from a calendar
 */
export async function deleteCalendarEvent(
    level: CalendarLevel,
    context: CalendarPathContext,
    eventId: string
): Promise<void> {
    const docPath = getEventDocPath(level, context, eventId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Get all events from a specific calendar
 */
export async function getCalendarEvents(
    level: CalendarLevel,
    context: CalendarPathContext
): Promise<EventRecord[]> {
    const collectionPath = getCalendarCollectionPath(level, context);
    const collectionRef = collection(firebaseFirestore, collectionPath);
    const snap = await getDocs(collectionRef);

    return snap.docs
        .filter(d => d.id !== 'metadata') // Skip the metadata document
        .map(d => ({ id: d.id, ...d.data() } as EventRecord));
}

/**
 * Get all events from multiple calendars
 */
export async function getEventsFromCalendars(
    calendars: Calendar[]
): Promise<EventRecord[]> {
    const allEvents: EventRecord[] = [];

    for (const calendar of calendars) {
        const events = await getCalendarEvents(calendar.level, calendar.pathContext);
        allEvents.push(...events);
    }

    return allEvents;
}

/**
 * Subscribe to realtime updates for events in a calendar
 */
export function onCalendarEvents(
    level: CalendarLevel,
    context: CalendarPathContext,
    onData: (events: EventRecord[]) => void,
    onError?: (error: Error) => void
): () => void {
    const collectionPath = getCalendarCollectionPath(level, context);
    const collectionRef = collection(firebaseFirestore, collectionPath);

    return onSnapshot(
        collectionRef,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const events = snapshot.docs
                .filter(d => d.id !== 'metadata') // Skip the metadata document
                .map(d => ({ id: d.id, ...d.data() } as EventRecord));
            onData(events);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Calendar events listener error:', error);
            }
        }
    );
}

/**
 * Subscribe to realtime updates for events from multiple calendars
 */
export function onMultiCalendarEvents(
    calendars: Calendar[],
    options: EventsListenerOptions
): () => void {
    const { onData, onError } = options;

    if (calendars.length === 0) {
        onData([]);
        return () => { /* no-op */ };
    }

    const aggregated = new Map<string, EventRecord>();
    const calendarEventIds = new Map<string, Set<string>>();

    const emit = (): void => {
        const sorted = Array.from(aggregated.values()).sort((a, b) => {
            const first = new Date(a.startDate ?? '').getTime();
            const second = new Date(b.startDate ?? '').getTime();
            if (Number.isNaN(first) || Number.isNaN(second)) return 0;
            return first - second;
        });
        onData(sorted);
    };

    const unsubscribes = calendars.map((calendar, calIndex) => {
        const collectionPath = getCalendarCollectionPath(calendar.level, calendar.pathContext);
        const collectionRef = collection(firebaseFirestore, collectionPath);

        return onSnapshot(
            collectionRef,
            (snapshot: QuerySnapshot<DocumentData>) => {
                const seenIds = new Set<string>();
                snapshot.docs.forEach((docSnap) => {
                    if (docSnap.id === 'metadata') return; // Skip metadata
                    const eventData = {
                        id: docSnap.id,
                        ...docSnap.data(),
                    } as EventRecord;
                    aggregated.set(docSnap.id, eventData);
                    seenIds.add(docSnap.id);
                });

                // Remove events that no longer exist in this calendar
                const previousIds = calendarEventIds.get(String(calIndex)) ?? new Set<string>();
                previousIds.forEach((eventId) => {
                    if (!seenIds.has(eventId)) {
                        aggregated.delete(eventId);
                    }
                });

                calendarEventIds.set(String(calIndex), seenIds);
                emit();
            },
            (error) => {
                if (onError) {
                    onError(error as Error);
                } else {
                    console.error('Multi-calendar events listener error:', error);
                }
            }
        );
    });

    return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
}

/**
 * Bulk delete events from a calendar
 */
export async function bulkDeleteCalendarEvents(
    level: CalendarLevel,
    context: CalendarPathContext,
    eventIds: string[]
): Promise<void> {
    if (eventIds.length === 0) return;

    const batch = writeBatch(firebaseFirestore);

    for (const eventId of eventIds) {
        const docPath = getEventDocPath(level, context, eventId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

/**
 * Move an event from one calendar to another
 */
export async function moveCalendarEvent(
    sourceLevel: CalendarLevel,
    sourceContext: CalendarPathContext,
    targetLevel: CalendarLevel,
    targetContext: CalendarPathContext,
    eventId: string
): Promise<void> {
    // Get the event from source calendar
    const event = await getCalendarEvent(sourceLevel, sourceContext, eventId);
    if (!event) throw new Error('Event not found');

    // Update event's calendar reference
    const updatedEvent: ScheduleEvent = {
        ...event,
        calendarLevel: targetLevel,
        calendarPathContext: targetContext,
    };

    // Create in target calendar
    await setCalendarEvent(eventId, updatedEvent);

    // Delete from source calendar
    await deleteCalendarEvent(sourceLevel, sourceContext, eventId);
}
