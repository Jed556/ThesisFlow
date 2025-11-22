import * as React from 'react';

/**
 * Date utility functions for ThesisFlow application
 * Handles various date formats and provides consistent date operations
 */

/**
 * Converts a date-like value to the yyyy-mm-dd format expected by date inputs.
 */
export function toDateInputString(value?: string | Date | null): string {
    if (!value) return '';
    const candidate = typeof value === 'string' ? new Date(value) : value;
    if (!candidate || Number.isNaN(candidate.getTime())) {
        return '';
    }
    return candidate.toISOString().slice(0, 10);
}

/**
 * Normalizes a date input string into an ISO 8601 timestamp.
 * Falls back to the provided date or now when parsing fails.
 */
export function fromDateInputString(value?: string | null, fallbackDate?: Date): string {
    const fallback = fallbackDate ?? new Date();
    if (!value) {
        return fallback.toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return fallback.toISOString();
    }
    return parsed.toISOString();
}

/**
 * Formats a date-like value into a short, human readable string.
 */
export function formatDateShort(value?: string | Date | null, locale?: string): string {
    if (!value) return '—';
    const candidate = typeof value === 'string' ? new Date(value) : value;
    if (!candidate || Number.isNaN(candidate.getTime())) {
        return typeof value === 'string' ? value : '—';
    }
    return candidate.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Normalizes supported date inputs (Date, ISO strings, Firestore timestamps) into Date instances.
 * @param value - Date-like input to normalize
 * @returns A Date instance or null if the value cannot be normalized
 */
export function normalizeDateInput(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || value instanceof String) {
        const parsed = new Date(value as string);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object') {
        const maybeTimestamp = value as { seconds?: number; nanoseconds?: number; toDate?: () => Date };
        if (typeof maybeTimestamp?.toDate === 'function') {
            const date = maybeTimestamp.toDate();
            return Number.isNaN(date.getTime()) ? null : date;
        }
        if (typeof maybeTimestamp?.seconds === 'number') {
            const millis = maybeTimestamp.seconds * 1000 + (maybeTimestamp.nanoseconds ?? 0) / 1_000_000;
            const date = new Date(millis);
            return Number.isNaN(date.getTime()) ? null : date;
        }
    }
    return null;
}

/**
 * Normalize a timestamp-like value and return an ISO8601 string or undefined.
 * @param value - Date | ISO string | Firestore Timestamp | null/undefined
 * @param fallbackToNow - when true, return current time ISO if value is missing/invalid
 * @returns ISO string or undefined
 */
export function normalizeTimestamp(value: unknown, fallbackToNow?: boolean): string {
    const date = normalizeDateInput(value);
    if (date) return date.toISOString();
    if (fallbackToNow) return new Date().toISOString();
    return '';
}

/**
 * Returns the start of the day (midnight) for a given date
 * @param date - Date object
 * @returns - Timestamp of the start of the day
 */
export function dayTime(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Checks if a date is within a specified range
 * @param date - Date to check
 * @param range - Date range with optional from/to dates
 * @returns - True if the date is within the range, false otherwise
 */
export function isInRange(date: Date, range: { from?: Date; to?: Date }) {
    if (!range.from || !range.to) return false;
    const a = dayTime(range.from);
    const b = dayTime(range.to);
    const t = dayTime(date);
    return t >= Math.min(a, b) && t <= Math.max(a, b);
}

/**
 * Checks if two dates are the same day
 * @param a - First date
 * @param b - Second date
 * @returns - True if the dates are the same day, false otherwise
 */
export function isSameDay(a?: Date, b?: Date) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Returns the start of the month for a given date
 * @param date - Date object
 * @returns - Date object representing the start of the month
 */
export function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Returns the end of the month for a given date
 * @param date - Date object
 * @returns - Date object representing the end of the month
 */
export function endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Adds a specified number of days to a date
 * @param date - Date object
 * @param days - Number of days to add
 * @returns - New Date object with the added days
 */
export function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Creates a date relative to today with specified offset and time
 * @param daysFromNow - Number of days from today (can be negative for past dates)
 * @param hour - Hour of the day (0-23), defaults to 9
 * @param minute - Minute of the hour (0-59), defaults to 0
 * @returns ISO string representation of the date
 */
export function createRelativeDate(daysFromNow: number, hour: number = 9, minute: number = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
}

/**
 * Creates a date for a specific date and time
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @param hour - Hour (0-23), defaults to 0
 * @param minute - Minute (0-59), defaults to 0
 * @returns ISO string representation of the date
 */
export function createSpecificDate(year: number, month: number, day: number, hour: number = 0, minute: number = 0): string {
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    return date.toISOString();
}

/**
 * Parses date strings in the ThesisFlow format: "2024-04-15 at 11:30 AM"
 * @param dateString - The date string to parse
 * @returns Date object
 */
export function parseThesisDate(dateString: string): Date {
    // Handle the specific date format: "2024-04-15 at 11:30 AM"
    // Convert "at" to a space and parse the date
    const normalizedDate = dateString.replace(' at ', ' ');
    const parsedDate = new Date(normalizedDate);

    // If parsing fails, try alternative parsing
    if (isNaN(parsedDate.getTime())) {
        // Try parsing just the date part if the full string fails
        const datePart = dateString.split(' at ')[0];
        const fallbackDate = new Date(datePart);

        if (isNaN(fallbackDate.getTime())) {
            console.warn(`Failed to parse date: ${dateString}`);
            return new Date(); // Return current date as fallback
        }

        return fallbackDate;
    }

    return parsedDate;
}

/**
 * Formats a date to the ThesisFlow display format
 * @param date - The date to format
 * @returns Formatted date string in "YYYY-MM-DD at H:MM AM/PM" format
 */
export function formatThesisDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const time = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return `${year}-${month}-${day} at ${time}`;
}

/**
 * Unified relative formatter.
 * @param date - date to format relative to now
 * @param options.style - 'long' (default) or 'short'
 * @param options.showSeconds - include seconds for sub-minute values
 * @param options.omitAgo - when true, omit the trailing 'ago' in long mode
 * @param now - optional "now" date for testing or custom reference
 * @returns formatted relative time string
 */
export function formatRelative(date: Date, options?:
    { style?: 'long' | 'short'; showSeconds?: boolean; omitAgo?: boolean }, now?: Date): string {
    const _now = now ?? new Date();
    const diffMs = _now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    const style = options?.style ?? 'long';
    const isShort = style === 'short';
    const showSeconds = !!options?.showSeconds;
    const omitAgo = !!options?.omitAgo;

    if (isShort) {
        if (diffYears > 0) return `${diffYears}yr`;
        if (diffMonths > 0) return `${diffMonths}mo`;
        if (diffWeeks > 0) return `${diffWeeks}wk`;
        if (diffDays > 0) return `${diffDays}d`;
        if (diffHours > 0) return `${diffHours}h`;
        if (diffMinutes > 0) return `${diffMinutes}m`;
        if (showSeconds) {
            if (diffSeconds > 0) return `${diffSeconds}s`;
        }
        return 'now';
    }

    // long style
    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
    if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;

    // less than a minute
    if (showSeconds) {
        if (diffSeconds > 0) return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''}${omitAgo ? '' : ' ago'}`;
        return isShort ? 'now' : 'Just now';
    }

    if (isShort) return 'now';
    return 'Just now';
}

/**
 * Formats a log timestamp for display: local time + relative time
 * @param date - date to format
 * @param options.style - 'long' (default) or 'short'
 * @param options.showSeconds - include seconds for sub-minute values
 * @param options.omitAgo - when true, omit the trailing 'ago' in long mode
 * @param now - optional "now" date for testing or custom reference
 * @returns string like '11:34 AM · 2m' or '11:34 AM · 2 minutes ago'
 */
export function formatLogTimestamp(
    date: Date, options?: { style?: 'long' | 'short'; showSeconds?: boolean; omitAgo?: boolean },
    now?: Date):
    string {
    // Determine relative string and whether the timestamp is ~1 day old
    const _now = now ?? new Date();
    const rel = formatRelative(
        date,
        { style: options?.style ?? 'long', showSeconds: options?.showSeconds, omitAgo: options?.omitAgo },
        _now
    );

    // Compute difference in days to detect the 1-day boundary precisely
    const diffMs = _now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // If exactly 1 day old, swap the usual display: show relative on the left and the date on the right
    if (diffDays === 1) {
        // show full date (no time) on the right side in local format: e.g., '2025-09-27' or localized short date
        const dateStr = date.toLocaleDateString('en-US');
        if (!rel) return dateStr;
        return `${rel} · ${dateStr}`;
    }

    // Default: show time on the left, relative on the right
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (!rel) return timeStr;
    return `${timeStr} · ${rel}`;
}

/**
 * React hook: returns a ticking `Date`.
 * @param conservative - if true, start with higher-frequency ticks and gradually degrade to less frequent ticks (seconds -> minutes -> hours) to conserve resources.
 * @param ticksPerSecond - initial frequency in ticks per second when running high-frequency phase.
 * @returns current ticking date
 */

export function useTick(conservative: boolean = false, ticksPerSecond: number = 1) {
    const [now, setNow] = React.useState(() => new Date());

    React.useEffect(() => {
        let id: ReturnType<typeof setInterval> | undefined;
        let switchTimer: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
            if (id) clearInterval(id);
            if (switchTimer) clearTimeout(switchTimer);
            id = undefined;
            switchTimer = undefined;
        };

        // compute initial interval from ticksPerSecond (Hz)
        const initialMs = Math.max(1, Math.round(1000 / Math.max(1, ticksPerSecond)));

        if (!conservative) {
            // aggressive/real-time mode: continuous ticks at initialMs
            id = setInterval(() => setNow(new Date()), initialMs);
            return cleanup;
        }

        // conservative mode: multiplicative progression of intervals
        // multipliers: seconds -> minutes -> hours -> days -> weeks
        const multipliers = [60, 60, 24, 7];

        // intervalsMs[0] = initialMs, intervalsMs[i] = initialMs * product(multipliers[0..i-1])
        const intervalsMs: number[] = [initialMs];
        for (let i = 0; i < multipliers.length; i++) {
            intervalsMs.push(intervalsMs[i] * multipliers[i]);
        }

        // durations (in seconds) for how long to stay in phase i before switching to i+1
        // durationsSec[i] = product(multipliers[0..i]) where i corresponds to the multiplier index
        const durationsSec: number[] = [];
        let acc = 1;
        for (const m of multipliers) {
            acc *= m;
            durationsSec.push(acc);
        }

        const startPhase = (p: number) => {
            cleanup();
            const interval = intervalsMs[Math.min(p, intervalsMs.length - 1)];
            id = setInterval(() => setNow(new Date()), interval);
            // schedule next phase if there is one
            if (p < durationsSec.length) {
                switchTimer = setTimeout(() => startPhase(p + 1), durationsSec[p] * 1000);
            }
        };

        startPhase(0);

        return cleanup;
    }, [conservative, ticksPerSecond]);

    return now;
}

/**
 * Sorts an array of items by date property
 * @param items - Array of items with date properties
 * @param dateKey - The key name for the date property
 * @param order - Sort order ('asc' for oldest first, 'desc' for newest first)
 * @returns Sorted array
 */
export function sortByDate<T extends Record<string, unknown>>(
    items: T[],
    dateKey: keyof T,
    order: 'asc' | 'desc' = 'asc'
): T[] {
    return [...items].sort((a, b) => {
        const dateA = parseThesisDate(a[dateKey] as string);
        const dateB = parseThesisDate(b[dateKey] as string);

        if (order === 'asc') {
            return dateA.getTime() - dateB.getTime();
        } else {
            return dateB.getTime() - dateA.getTime();
        }
    });
}

/**
 * Checks if a date string is valid in ThesisFlow format
 * @param dateString - The date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidThesisDate(dateString: string): boolean {
    try {
        const parsed = parseThesisDate(dateString);
        return !isNaN(parsed.getTime());
    } catch {
        return false;
    }
}

/**
 * Gets the current date in ThesisFlow format
 * @returns Current date formatted as ThesisFlow date string
 */
export function getCurrentThesisDate(): string {
    return formatThesisDate(new Date());
}
