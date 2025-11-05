/**
 * Schedule and calendar-related type definitions for the ThesisFlow application
 * Contains all scheduling, event, and calendar types
 * 
 * Calendar System Design (Google Calendar Model):
 * - Each user has a "Personal" calendar (auto-created)
 * - Each group has a shared calendar (auto-created)
 * - Admins/Developers can create custom calendars
 * - Events belong to ONE calendar
 * - Users can filter which calendars to view
 */

// Calendar type for different calendar categories
export type CalendarType = 'personal' | 'group' | 'custom';

// Event status
export type EventStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';

// Recurrence pattern for recurring events
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// Participant role in events
export type ParticipantRole = 'organizer' | 'required' | 'optional' | 'observer';

export type ParticipantStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

/**
 * Calendar interface - represents a collection of events
 * Similar to Google Calendar's calendar system
 */
export interface Calendar {
    id: string;
    name: string;
    description?: string;
    type: CalendarType;
    color: string; // hex color for UI display

    // Event management
    eventIds: string[]; // Array of event IDs that belong to this calendar

    // Ownership and access control
    ownerUid: string; // Firebase UID of owner (user UID for personal, group id for group calendars)
    createdBy: string; // Firebase UID of creator
    createdAt: string;
    lastModified: string;

    // Access permissions
    // For personal: only owner can view/edit
    // For group: group members + advisers/editors can view, owner can edit
    // For custom: defined by permissions array
    permissions: CalendarPermission[];

    // Group-specific fields
    groupId?: string; // If this is a group calendar
    groupName?: string; // Display name for group calendars

    // Visibility flags
    isVisible: boolean; // Can be hidden without deleting
    isDefault?: boolean; // Is this a default calendar (Personal for users)
}

/**
 * Calendar permissions for fine-grained access control
 */
export interface CalendarPermission {
    uid?: string; // specific user by Firebase UID
    role?: string; // or role-based (admin, developer, editor, adviser, student)
    groupId?: string; // or group-based
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

// Participant interface
export interface EventParticipant {
    uid: string; // Firebase UID instead of email
    role: ParticipantRole;
    status: ParticipantStatus
    responseDate?: Date;
}

// Location interface for events
export interface EventLocation {
    type: 'physical' | 'virtual' | 'hybrid';
    // Physical location fields (required for physical/hybrid)
    address?: string;
    room?: string;
    // Virtual location fields (required for virtual/hybrid)
    url?: string; // For virtual meetings
    platform?: string; // e.g., 'Zoom', 'Teams', 'Google Meet'
    notes?: string;
}

// Reminder settings
export interface EventReminder {
    type: 'email' | 'notification' | 'sms';
    timing: number; // minutes before event
    message?: string;
}

// Recurrence settings
export interface RecurrenceSettings {
    pattern: RecurrencePattern;
    interval: number; // e.g., every 2 weeks
    endDate?: string;
    occurrences?: number; // number of times to repeat
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
    dayOfMonth?: number; // for monthly recurrence
}

// Main schedule event interface
export interface ScheduleEvent {
    id: string;
    title: string;
    description?: string;
    status: EventStatus;

    // Calendar association - events belong to ONE calendar
    calendarId: string; // ID of the calendar this event belongs to

    // Date and time information
    startDate: string; // ISO date string
    endDate: string;   // ISO date string
    isAllDay: boolean;

    // Participants and organizer
    organizer: string; // Firebase UID of organizer
    participants: EventParticipant[];

    // Location information
    location?: EventLocation;

    // Additional metadata
    tags?: string[];
    color?: string; // optional override for calendar color
    attachments?: string[]; // file hashes

    // Recurrence and reminders
    recurrence?: RecurrenceSettings;
    reminders?: EventReminder[];

    // Tracking information
    createdBy: string; // Firebase UID
    createdAt: string;
    lastModified: string;
    lastModifiedBy: string; // Firebase UID

    // Thesis-specific information
    thesisId?: string;
    chapterId?: number;
    relatedDeadlines?: string[]; // IDs of related events
}

// Calendar view types
export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'year';

// Filter options for schedule display
export interface ScheduleFilter {
    calendarIds?: string[]; // Filter by specific calendars
    statuses?: EventStatus[];
    participants?: string[]; // Firebase UIDs
    dateRange?: {
        start: string;
        end: string;
    };
    tags?: string[];
}

// Schedule statistics interface
export interface ScheduleStats {
    totalEvents: number;
    upcomingEvents: number;
    overdueEvents: number;
    eventsByStatus: Record<EventStatus, number>;
    eventsByCalendar: Record<string, number>; // Count by calendar ID
}

// Event creation/update payload
export interface EventPayload {
    title: string;
    description?: string;
    calendarId: string; // Required: which calendar to add event to
    startDate: string;
    endDate: string;
    isAllDay: boolean;
    participants: Omit<EventParticipant, 'status' | 'responseDate'>[];
    location?: Omit<EventLocation, 'notes'>;
    tags?: string[];
    recurrence?: RecurrenceSettings;
    reminders?: EventReminder[];
}

// Schedule notification interface
export interface ScheduleNotification {
    id: string;
    eventId: string;
    uid: string; // Firebase UID
    type: 'reminder' | 'update' | 'cancellation' | 'invitation';
    message: string;
    sentDate: string;
    readDate?: string;
    actionRequired: boolean;
}

// Time slot interface for availability checking
export interface TimeSlot {
    start: string;
    end: string;
    available: boolean;
    eventId?: string;
    eventTitle?: string;
}

// Availability interface
export interface UserAvailability {
    uid: string; // Firebase UID
    date: string;
    timeSlots: TimeSlot[];
    workingHours: {
        start: string; // e.g., "09:00"
        end: string;   // e.g., "17:00"
    };
}
