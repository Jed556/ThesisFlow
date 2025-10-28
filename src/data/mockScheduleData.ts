import type { ScheduleEvent, EventParticipant } from '../types/schedule';

/**
 * Mock schedule data for the ThesisFlow application
 * Contains sample events, meetings, deadlines, and academic calendar data
 */

// Common participants for events
const commonParticipants: Record<string, EventParticipant> = {
    johnDoe: {
        email: "john.doe@university.edu",
        role: "required",
        status: "accepted"
    },
    janeSmith: {
        email: "jane.smith@university.edu",
        role: "organizer",
        status: "accepted"
    },
    mikeJohnson: {
        email: "mike.johnson@university.edu",
        role: "required",
        status: "accepted"
    },
    sarahWilson: {
        email: "sarah.wilson@university.edu",
        role: "optional",
        status: "tentative"
    },
    alexChen: {
        email: "alex.chen@university.edu",
        role: "required",
        status: "accepted"
    },
    mariaGarcia: {
        email: "maria.garcia@university.edu",
        role: "optional",
        status: "pending"
    },
    davidKim: {
        email: "david.kim@university.edu",
        role: "required",
        status: "accepted"
    },
    emilyBrown: {
        email: "emily.brown@university.edu",
        role: "observer",
        status: "accepted"
    }
};

// Mock schedule events
export const mockScheduleEvents: ScheduleEvent[] = [
    // Upcoming thesis defense
    {
        id: "evt_001",
        title: "John's Thesis Defense",
        description: "Final thesis defense presentation for 'Machine Learning Applications in Educational Technology'",
        calendarId: "cal_001",
        status: "confirmed",
        startDate: "2025-09-27T14:00:00.000Z", // 2 weeks from now at 2 PM
        endDate: "2025-09-27T16:00:00.000Z",   // 4 PM same day
        isAllDay: false,
        organizer: "jane.smith@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith,
            commonParticipants.mikeJohnson,
            commonParticipants.davidKim,
            commonParticipants.emilyBrown
        ],
        location: {
            type: "physical",
            address: "123 University Ave",
            room: "Computer Science Building, Room 301",
            notes: "Please arrive 15 minutes early for setup"
        },
        tags: ["thesis", "defense", "final", "computer-science"],
        color: "#d32f2f", // Red for critical events
        reminders: [
            { type: "email", timing: 1440, message: "Defense tomorrow at 2 PM" }, // 24 hours
            { type: "notification", timing: 60 }, // 1 hour before
            { type: "email", timing: 30 } // 30 minutes before
        ],
        createdBy: "jane.smith@university.edu",
        createdAt: "2025-08-14T09:00:00.000Z",
        lastModified: "2025-09-11T09:00:00.000Z",
        lastModifiedBy: "jane.smith@university.edu",
        thesisId: "thesis_001"
    },

    // Weekly adviser meeting
    {
        id: "evt_002",
        title: "Weekly Thesis Progress Meeting",
        description: "Regular check-in to discuss research progress, challenges, and next steps",
        calendarId: "cal_002",
        status: "scheduled",
        startDate: "2025-09-15T10:00:00.000Z", // 2 days from now at 10 AM
        endDate: "2025-09-15T11:00:00.000Z",   // 11 AM same day
        isAllDay: false,
        organizer: "jane.smith@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith,
            commonParticipants.sarahWilson,
            commonParticipants.alexChen
        ],
        location: {
            type: "hybrid",
            room: "Dr. Smith's Office 205",
            url: "https://zoom.us/j/123456789",
            platform: "Zoom"
        },
        tags: ["thesis", "progress", "weekly", "recurring"],
        color: "#1976d2", // Blue for meetings
        recurrence: {
            pattern: "weekly",
            interval: 1,
            daysOfWeek: [3], // Wednesday
            endDate: "2025-12-12T09:00:00.000Z" // 3 months from now
        },
        reminders: [
            { type: "notification", timing: 15 } // 15 minutes before
        ],
        createdBy: "jane.smith@university.edu",
        createdAt: "2025-07-14T09:00:00.000Z",
        lastModified: "2025-09-12T09:00:00.000Z",
        lastModifiedBy: "jane.smith@university.edu",
        thesisId: "thesis_001"
    },

    // Chapter submission deadline
    {
        id: "evt_003",
        title: "Chapter 4 Submission Deadline",
        description: "Final deadline for submitting Chapter 4: Results and Analysis",
        calendarId: "cal_002",
        status: "scheduled",
        startDate: "2025-09-20T23:59:00.000Z", // 1 week from now at 11:59 PM
        endDate: "2025-09-20T23:59:00.000Z",
        isAllDay: true,
        organizer: "mike.johnson@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith,
            commonParticipants.mikeJohnson
        ],
        tags: ["deadline", "chapter", "submission", "results"],
        color: "#f57c00", // Orange for deadlines
        reminders: [
            { type: "email", timing: 4320 }, // 3 days before
            { type: "notification", timing: 1440 }, // 1 day before
            { type: "email", timing: 240 } // 4 hours before
        ],
        createdBy: "mike.johnson@university.edu",
        createdAt: "2025-08-23T09:00:00.000Z",
        lastModified: "2025-08-23T09:00:00.000Z",
        lastModifiedBy: "mike.johnson@university.edu",
        thesisId: "thesis_001",
        chapterId: 4
    },

    // Research methodology workshop
    {
        id: "evt_004",
        title: "Research Methodology Workshop",
        description: "Advanced workshop on quantitative research methods and statistical analysis",
        calendarId: "cal_public",
        status: "confirmed",
        startDate: "2025-09-18T09:00:00.000Z", // 5 days from now at 9 AM
        endDate: "2025-09-18T17:00:00.000Z",  // 5 PM same day
        isAllDay: false,
        organizer: "david.kim@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.sarahWilson,
            commonParticipants.alexChen,
            commonParticipants.mariaGarcia,
            commonParticipants.davidKim
        ],
        location: {
            type: "physical",
            address: "456 Academic Way, University Conference Center",
            room: "Auditorium A"
        },
        tags: ["workshop", "methodology", "research", "statistics"],
        color: "#388e3c", // Green for workshops
        reminders: [
            { type: "email", timing: 1440, message: "Workshop tomorrow - bring laptop" },
            { type: "notification", timing: 60 }
        ],
        createdBy: "david.kim@university.edu",
        createdAt: "2025-07-30T09:00:00.000Z",
        lastModified: "2025-09-03T09:00:00.000Z",
        lastModifiedBy: "david.kim@university.edu"
    },

    // Consultation session
    {
        id: "evt_005",
        title: "Statistical Analysis Consultation",
        description: "One-on-one consultation for data analysis and interpretation of research results",
        calendarId: "cal_002",
        status: "scheduled",
        startDate: "2025-09-14T14:00:00.000Z", // Tomorrow at 2 PM
        endDate: "2025-09-14T15:30:00.000Z",  // 3:30 PM same day
        isAllDay: false,
        organizer: "david.kim@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.davidKim
        ],
        location: {
            type: "virtual",
            url: "https://teams.microsoft.com/l/meetup-join/...",
            platform: "Microsoft Teams"
        },
        tags: ["consultation", "statistics", "data-analysis"],
        color: "#7b1fa2", // Purple for consultations
        reminders: [
            { type: "notification", timing: 30 },
            { type: "email", timing: 120, message: "Don't forget to prepare your data files" }
        ],
        createdBy: "john.doe@university.edu",
        createdAt: "2025-09-10T09:00:00.000Z",
        lastModified: "2025-09-12T09:00:00.000Z",
        lastModifiedBy: "david.kim@university.edu",
        thesisId: "thesis_001"
    },

    // Literature review deadline (past event)
    {
        id: "evt_006",
        title: "Literature Review Submission",
        description: "Final submission of Chapter 2: Literature Review",
        calendarId: "cal_002",
        status: "completed",
        startDate: "2025-09-06T23:59:00.000Z", // 1 week ago
        endDate: "2025-09-06T23:59:00.000Z",
        isAllDay: true,
        organizer: "jane.smith@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith,
            commonParticipants.mikeJohnson
        ],
        tags: ["submission", "literature-review", "chapter", "completed"],
        color: "#4caf50", // Green for completed
        createdBy: "jane.smith@university.edu",
        createdAt: "2025-08-09T09:00:00.000Z",
        lastModified: "2025-09-07T09:00:00.000Z",
        lastModifiedBy: "john.doe@university.edu",
        thesisId: "thesis_001",
        chapterId: 2
    },

    // Upcoming presentation
    {
        id: "evt_007",
        title: "Research Progress Presentation",
        description: "Mid-semester presentation of research progress to department committee",
        calendarId: "cal_department",
        status: "confirmed",
        startDate: "2025-10-04T13:00:00.000Z", // 3 weeks from now at 1 PM
        endDate: "2025-10-04T14:30:00.000Z",  // 2:30 PM same day
        isAllDay: false,
        organizer: "jane.smith@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith,
            commonParticipants.mikeJohnson,
            commonParticipants.davidKim,
            commonParticipants.emilyBrown
        ],
        location: {
            type: "physical",
            room: "Department Conference Room 150"
        },
        tags: ["presentation", "progress", "committee", "mid-semester"],
        color: "#ff9800", // Orange for presentations
        reminders: [
            { type: "email", timing: 10080, message: "Presentation in one week - prepare slides" }, // 1 week
            { type: "notification", timing: 1440 }, // 1 day
            { type: "notification", timing: 60 } // 1 hour
        ],
        createdBy: "jane.smith@university.edu",
        createdAt: "2025-08-29T09:00:00.000Z",
        lastModified: "2025-09-08T09:00:00.000Z",
        lastModifiedBy: "jane.smith@university.edu",
        thesisId: "thesis_001"
    },

    // Holiday/break period
    {
        id: "evt_008",
        title: "Spring Break",
        description: "University spring break - no classes or meetings scheduled",
        calendarId: "cal_university",
        status: "scheduled",
        startDate: "2025-10-13T00:00:00.000Z", // 30 days from now
        endDate: "2025-10-20T23:59:00.000Z", // 7 days later
        isAllDay: true,
        organizer: "admin@university.edu",
        participants: [],
        tags: ["break", "holiday", "university", "spring"],
        color: "#607d8b", // Blue-grey for breaks
        createdBy: "admin@university.edu",
        createdAt: "2025-03-16T09:00:00.000Z",
        lastModified: "2025-03-16T09:00:00.000Z",
        lastModifiedBy: "admin@university.edu"
    },

    // Research group meeting
    {
        id: "evt_009",
        title: "AI Research Group Meeting",
        description: "Monthly meeting of the AI research group to share progress and collaborate",
        calendarId: "cal_research_group",
        status: "scheduled",
        startDate: "2025-09-23T15:00:00.000Z", // 10 days from now at 3 PM
        endDate: "2025-09-23T17:00:00.000Z",   // 5 PM same day
        isAllDay: false,
        organizer: "david.kim@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.sarahWilson,
            commonParticipants.alexChen,
            commonParticipants.mariaGarcia,
            commonParticipants.davidKim
        ],
        location: {
            type: "hybrid",
            room: "Lab 404",
            url: "https://zoom.us/j/987654321",
            platform: "Zoom"
        },
        tags: ["research-group", "ai", "collaboration", "monthly"],
        color: "#3f51b5", // Indigo for group meetings
        recurrence: {
            pattern: "monthly",
            interval: 1,
            dayOfMonth: 15,
            endDate: "2026-09-13T09:00:00.000Z" // 1 year from now
        },
        reminders: [
            { type: "email", timing: 1440, message: "Research group meeting tomorrow - prepare updates" }
        ],
        createdBy: "david.kim@university.edu",
        createdAt: "2025-06-15T09:00:00.000Z",
        lastModified: "2025-08-14T09:00:00.000Z",
        lastModifiedBy: "david.kim@university.edu"
    },

    // Ethics review deadline
    {
        id: "evt_010",
        title: "IRB Ethics Review Submission",
        description: "Deadline for submitting Institutional Review Board ethics review documentation",
        calendarId: "cal_002",
        status: "scheduled",
        startDate: "2025-09-16T17:00:00.000Z", // 3 days from now at 5 PM
        endDate: "2025-09-16T17:00:00.000Z",
        isAllDay: false,
        organizer: "jane.smith@university.edu",
        participants: [
            commonParticipants.johnDoe,
            commonParticipants.janeSmith
        ],
        tags: ["ethics", "irb", "review"],
        color: "#e91e63", // Pink for critical deadlines
        reminders: [
            { type: "email", timing: 2880, message: "IRB submission due in 2 days" }, // 2 days
            { type: "notification", timing: 1440 }, // 1 day
            { type: "email", timing: 240, message: "IRB deadline today at 5 PM!" } // 4 hours
        ],
        createdBy: "jane.smith@university.edu",
        createdAt: "2025-08-30T09:00:00.000Z",
        lastModified: "2025-09-11T09:00:00.000Z",
        lastModifiedBy: "jane.smith@university.edu",
        thesisId: "thesis_001"
    }
];

// Note: Academic calendar structure removed as the AcademicCalendar type is not defined in schedule.ts
// If you need academic calendar functionality, consider creating separate event arrays for holidays and important dates
