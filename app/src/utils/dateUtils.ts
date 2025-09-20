/**
 * Date utility functions for ThesisFlow application
 * Handles various date formats and provides consistent date operations
 */

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
 * Gets a relative time string (e.g., "2 days ago", "1 hour ago")
 * @param date - The date to compare to now
 * @returns Relative time string
 */
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffWeeks > 0) {
        return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

/**
 * Sorts an array of items by date property
 * @param items - Array of items with date properties
 * @param dateKey - The key name for the date property
 * @param order - Sort order ('asc' for oldest first, 'desc' for newest first)
 * @returns Sorted array
 */
export function sortByDate<T extends Record<string, any>>(
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
