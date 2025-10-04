/**
 * Schedule and calendar-related type definitions for the ThesisFlow application
 * Contains all scheduling, event, and calendar types
 */

// Academic semester types
export type AcademicSemester = 'first' | 'second' | 'intersemester' | 'summer';

// Event types for different kinds of scheduled activities
export type EventType =
    | 'meeting'
    | 'deadline'
    | 'defense'
    | 'lecture'
    | 'presentation'
    | 'consultation'
    | 'submission'
    | 'holiday'
    | 'other';


// Event status
export type EventStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';

// Recurrence pattern for recurring events
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// Participant role in events
export type ParticipantRole = 'organizer' | 'required' | 'optional' | 'observer';

export type ParticipantStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

/**
 * Event visibility levels
 * 'public' - visible to all users
 * 'private' - visible only to the event creator and invited participants
 * 'group' - visible to a specific group (e.g., thesis group)
 * 'groups' - visible to all handled groups of the author
 * 'department' - visible to all users in the same department or faculty
 */
export type EventVisibility = 'public' | 'private' | 'group' | 'groups' | 'department';

// Participant interface
export interface EventParticipant {
    email: string;
    role: ParticipantRole;
    status: ParticipantStatus
    responseDate?: Date;
}

// Location interface for events
export interface EventLocation {
    type: 'physical' | 'virtual' | 'hybrid';
    name: string;
    address?: string;
    room?: string;
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
    type: EventType;
    status: EventStatus;
    visibility: EventVisibility;

    // Date and time information
    startDate: string; // ISO date string
    endDate: string;   // ISO date string
    isAllDay: boolean;

    // Participants and organizer
    organizer: string; // email of organizer
    participants: EventParticipant[];

    // Location information
    location?: EventLocation;

    // Additional metadata
    tags?: string[];
    color?: string; // for calendar display
    attachments?: string[]; // file hashes

    // Recurrence and reminders
    recurrence?: RecurrenceSettings;
    reminders?: EventReminder[];

    // Tracking information
    createdBy: string;
    createdAt: string;
    lastModified: string;
    lastModifiedBy: string;

    // Thesis-specific information
    thesisId?: string;
    chapterId?: number;
    relatedDeadlines?: string[]; // IDs of related events
}

// Calendar view types
export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'year';

// Filter options for schedule display
export interface ScheduleFilter {
    eventTypes?: EventType[];
    statuses?: EventStatus[];
    participants?: string[]; // email addresses
    dateRange?: {
        start: string;
        end: string;
    };
    tags?: string[];
    visibility?: EventVisibility[];
}

// Schedule statistics interface
export interface ScheduleStats {
    totalEvents: number;
    upcomingEvents: number;
    overdueEvents: number;
    eventsByType: Record<EventType, number>;
    eventsByStatus: Record<EventStatus, number>;
}

// Academic calendar interface for semester/term schedules
export interface AcademicCalendar {
    year: number;
    semester: AcademicSemester;
    startDate: string;
    endDate: string;
    holidays: ScheduleEvent[];
    importantDates: ScheduleEvent[];
    examPeriods: {
        midterm: { start: string; end: string };
        final: { start: string; end: string };
    };
}

// Event creation/update payload
export interface EventPayload {
    title: string;
    description?: string;
    type: EventType;
    startDate: string;
    endDate: string;
    isAllDay: boolean;
    participants: Omit<EventParticipant, 'status' | 'responseDate'>[];
    location?: Omit<EventLocation, 'notes'>;
    tags?: string[];
    recurrence?: RecurrenceSettings;
    reminders?: EventReminder[];
    visibility: EventVisibility;
}

// Schedule notification interface
export interface ScheduleNotification {
    id: string;
    eventId: string;
    userId: string;
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
    userId: string;
    date: string;
    timeSlots: TimeSlot[];
    workingHours: {
        start: string; // e.g., "09:00"
        end: string;   // e.g., "17:00"
    };
}
