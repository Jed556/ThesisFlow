/**
 * useCalendarDeadlineNotifications Hook
 * 
 * Monitors calendar events for upcoming deadlines and displays snackbar notifications.
 * This hook should be used at the app level to provide deadline reminders.
 */

import * as React from 'react';
import { useSnackbar } from '../contexts/SnackbarContext';
import type { UserProfile, CalendarNotificationTiming } from '../types/profile';
import { DEFAULT_CALENDAR_NOTIFICATIONS } from '../types/profile';
import type { ScheduleEvent, Calendar as CalendarType } from '../types/schedule';
import { getUserCalendarsHierarchical } from '../utils/firebase/firestore/calendars';
import { getEventsFromCalendars, onMultiCalendarEvents } from '../utils/firebase/firestore/calendarEvents';
import { DEFAULT_YEAR } from '../config/firestore';

/**
 * Convert notification timing to milliseconds
 */
function timingToMs(timing: CalendarNotificationTiming): number {
    const { value, unit } = timing;
    switch (unit) {
        case 'days':
            return value * 24 * 60 * 60 * 1000;
        case 'hours':
            return value * 60 * 60 * 1000;
        case 'minutes':
            return value * 60 * 1000;
        default:
            return value * 60 * 1000;
    }
}

/**
 * Check interval (in milliseconds) - how often to check for upcoming deadlines
 */
const CHECK_INTERVAL = 60 * 1000; // Every minute

/**
 * Storage key prefix for persisting shown notifications
 */
const STORAGE_KEY_PREFIX = 'deadline_notifications_shown_';

/**
 * Options for the useCalendarDeadlineNotifications hook
 */
export interface UseCalendarDeadlineNotificationsOptions {
    /** Whether to enable notifications (default: true) */
    enabled?: boolean;
    /** Duration for snackbar notifications in ms (default: 8000) */
    snackbarDuration?: number;
    /** Callback when deadline notifications are shown */
    onDeadlineNotification?: (event: ScheduleEvent, threshold: string) => void;
}

/**
 * Return value of the useCalendarDeadlineNotifications hook
 */
export interface UseCalendarDeadlineNotificationsResult {
    /** Upcoming deadlines (within the longest notification window) */
    upcomingDeadlines: ScheduleEvent[];
    /** Loading state */
    loading: boolean;
    /** Error if any */
    error: Error | null;
    /** Manually check for deadlines */
    checkDeadlines: () => void;
    /** Clear shown notifications (for testing/debugging) */
    clearShownNotifications: () => void;
}

/**
 * Get readable time until deadline
 */
function getTimeUntilString(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
        return hours === 1
            ? '1 hour'
            : `${hours} hours`;
    }
    return minutes <= 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * Format event date for display
 */
function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });

    if (isToday) {
        return `Today at ${timeStr}`;
    }
    if (isTomorrow) {
        return `Tomorrow at ${timeStr}`;
    }
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * Hook to monitor calendar events and show deadline notifications
 * @param userProfile - The current user's profile
 * @param options - Hook options
 * @returns Deadline monitoring state and handlers
 */
export function useCalendarDeadlineNotifications(
    userProfile: UserProfile | null | undefined,
    options: UseCalendarDeadlineNotificationsOptions = {}
): UseCalendarDeadlineNotificationsResult {
    const {
        enabled = true,
        snackbarDuration = 8000,
        onDeadlineNotification,
    } = options;

    const { showNotification } = useSnackbar();
    const [upcomingDeadlines, setUpcomingDeadlines] = React.useState<ScheduleEvent[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Get notification timings from user preferences (array-based)
    const notificationTimings = React.useMemo((): CalendarNotificationTiming[] => {
        const calNotif = userProfile?.preferences?.calendarNotifications;
        return calNotif && calNotif.length > 0
            ? calNotif
            : DEFAULT_CALENDAR_NOTIFICATIONS;
    }, [userProfile?.preferences?.calendarNotifications]);

    // Track shown notifications per threshold to avoid duplicates
    // Key format: eventId_threshold (e.g., "evt_123_first")
    const shownNotificationsRef = React.useRef<Set<string>>(new Set());

    // Storage key for this user
    const storageKey = userProfile?.uid
        ? `${STORAGE_KEY_PREFIX}${userProfile.uid}`
        : null;

    // Load shown notifications from localStorage
    React.useEffect(() => {
        if (!storageKey) return;

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Only keep notifications from the last 48 hours
                const cutoff = Date.now() - 48 * 60 * 60 * 1000;
                const validEntries = Object.entries(parsed).filter(
                    ([, timestamp]) => (timestamp as number) > cutoff
                );
                shownNotificationsRef.current = new Set(
                    validEntries.map(([key]) => key)
                );
            }
        } catch (e) {
            console.warn('Failed to load shown notifications from storage:', e);
        }
    }, [storageKey]);

    // Save shown notifications to localStorage
    const persistShownNotifications = React.useCallback(() => {
        if (!storageKey) return;

        try {
            const data: Record<string, number> = {};
            shownNotificationsRef.current.forEach((key) => {
                data[key] = Date.now();
            });
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to persist shown notifications:', e);
        }
    }, [storageKey]);

    // Clear shown notifications
    const clearShownNotifications = React.useCallback(() => {
        shownNotificationsRef.current.clear();
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    }, [storageKey]);

    // Fetch user's calendars
    React.useEffect(() => {
        if (!userProfile?.uid || !enabled) {
            setCalendars([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const fetchCalendars = async () => {
            try {
                const userCalendars = await getUserCalendarsHierarchical(
                    userProfile.uid,
                    userProfile.role,
                    {
                        year: DEFAULT_YEAR,
                        department: userProfile.department,
                        course: userProfile.course,
                    }
                );
                if (isMounted) {
                    setCalendars(userCalendars);
                    setError(null);
                }
            } catch (err) {
                console.error('Failed to fetch calendars:', err);
                if (isMounted) {
                    setError(err as Error);
                }
            }
        };

        fetchCalendars();

        return () => {
            isMounted = false;
        };
    }, [userProfile?.uid, userProfile?.role, userProfile?.department, userProfile?.course, enabled]);

    // Check for deadlines and show notifications
    const checkDeadlines = React.useCallback(async () => {
        if (!enabled || calendars.length === 0) return;

        // Build thresholds from user preferences array (already in array format)
        // Convert timings to ms and sort by time (descending - longest first)
        const sortedThresholds = notificationTimings
            .filter((t) => t.enabled)
            .map((t) => ({
                id: t.id,
                ms: timingToMs(t),
                enabled: t.enabled,
            }))
            .sort((a, b) => b.ms - a.ms);

        // Find the longest threshold window for filtering events
        const maxThresholdMs = sortedThresholds.length > 0
            ? sortedThresholds[0].ms
            : 24 * 60 * 60 * 1000; // Default 24h

        const now = Date.now();
        const windowEnd = now + maxThresholdMs;

        try {
            // Fetch events from all calendars
            const allEvents = await getEventsFromCalendars(calendars);

            // Filter to upcoming events within the longest notification window
            const upcoming = allEvents.filter((event) => {
                const eventStart = new Date(event.startDate).getTime();
                return (
                    eventStart > now &&
                    eventStart <= windowEnd &&
                    event.status !== 'cancelled' &&
                    event.status !== 'completed'
                );
            });

            // Sort by start date
            upcoming.sort(
                (a, b) =>
                    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            );

            setUpcomingDeadlines(upcoming);

            // Check each event against notification thresholds
            for (const event of upcoming) {
                const eventStart = new Date(event.startDate).getTime();
                const timeUntil = eventStart - now;

                // Find the applicable threshold
                for (let i = 0; i < sortedThresholds.length; i++) {
                    const threshold = sortedThresholds[i];
                    // Min is the next threshold, or 0 if this is the last one
                    const nextThreshold = sortedThresholds[i + 1];
                    const minMs = nextThreshold ? nextThreshold.ms : 0;

                    if (!threshold.enabled) continue;

                    const notificationKey = `${event.id}_${threshold.id}`;

                    // Check if within threshold range and not already shown
                    if (
                        timeUntil <= threshold.ms &&
                        timeUntil > minMs &&
                        !shownNotificationsRef.current.has(notificationKey)
                    ) {
                        // Mark as shown
                        shownNotificationsRef.current.add(notificationKey);
                        persistShownNotifications();

                        // Show notification
                        const timeStr = getTimeUntilString(timeUntil);
                        const dateStr = formatEventDate(event.startDate);

                        // Determine severity based on threshold position
                        const isLastThreshold = i === sortedThresholds.length - 1;
                        const severity = isLastThreshold ? 'warning' : 'info';

                        showNotification({
                            title: `📅 Upcoming: ${event.title}`,
                            message: `Starting in ${timeStr} (${dateStr})`,
                            severity,
                            duration: snackbarDuration,
                            showDivider: true,
                            showProgress: true,
                            actions: [
                                {
                                    label: 'View Calendar',
                                    onClick: () => {
                                        window.location.href = '/calendar';
                                    },
                                    variant: 'text',
                                },
                            ],
                        });

                        // Call callback if provided
                        if (onDeadlineNotification) {
                            onDeadlineNotification(event, threshold.id);
                        }

                        // Only show one notification per event per check
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('Failed to check deadlines:', err);
            setError(err as Error);
        }
    }, [
        enabled,
        calendars,
        notificationTimings,
        snackbarDuration,
        onDeadlineNotification,
        showNotification,
        persistShownNotifications,
    ]);

    // Set up periodic deadline checks
    React.useEffect(() => {
        if (!enabled || calendars.length === 0) return;

        // Initial check
        checkDeadlines();

        // Set up interval
        const intervalId = setInterval(checkDeadlines, CHECK_INTERVAL);

        return () => {
            clearInterval(intervalId);
        };
    }, [enabled, calendars, checkDeadlines]);

    // Also listen to calendar events in real-time for immediate updates
    React.useEffect(() => {
        if (!enabled || calendars.length === 0) return;

        const unsubscribe = onMultiCalendarEvents(calendars, {
            onData: () => {
                // Re-check deadlines when events change
                checkDeadlines();
            },
            onError: (err: Error) => {
                console.error('Calendar events listener error:', err);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [enabled, calendars, checkDeadlines]);

    return {
        upcomingDeadlines,
        loading,
        error,
        checkDeadlines,
        clearShownNotifications,
    };
}
