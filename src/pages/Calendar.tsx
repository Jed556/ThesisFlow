import * as React from 'react';
import {
    Box, Card, CardContent, Typography, Button, IconButton, TextField, Divider,
    Menu, MenuItem, Checkbox, FormControlLabel, Autocomplete
} from '@mui/material';
import {
    CalendarToday, ViewList, Add, Upload, Download, ExpandMore, AddCircle
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    EventCard, EventsRail, Calendar, EventDialog, DeleteEventDialog, NewCalendarDialog
} from '../components/Calendar';
import { AnimatedPage, AnimatedList } from '../components/Animate';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../contexts/SnackbarContext';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type {
    ScheduleEvent, EventStatus, EventLocation, Calendar as CalendarType, CalendarPermission
} from '../types/schedule';
import type { UserProfile } from '../types/profile';
import { format, isWithinInterval } from 'date-fns';
import { DEFAULT_YEAR } from '../config/firestore';
import {
    getUserCalendarsHierarchical, setHierarchicalCalendar, seedAllCalendars, loadOrSeedPersonalCalendar
} from '../utils/firebase/firestore/calendars';
import {
    setCalendarEvent, deleteCalendarEvent, getEventsFromCalendars,
} from '../utils/firebase/firestore/calendarEvents';
import { findAllUsers } from '../utils/firebase/firestore/user';
import { getAllGroups, getGroupsByMember } from '../utils/firebase/firestore/groups';

export const metadata: NavigationItem = {
    index: 2,
    title: 'Calendar',
    segment: 'calendar',
    icon: <CalendarToday />,
    group: 'main',
    children: [],
};

/**
 * Default calendar colors for new calendars
 */
const DEFAULT_CALENDAR_COLORS = [
    '#4285F4', '#0B8043', '#F4B400', '#DB4437', '#AB47BC',
    '#00ACC1', '#FF7043', '#9E9D24', '#5C6BC0', '#F09300'
];

// Default fallback color for events
const defaultEventColor = '#bdbdbd';


/**
 * Generate a unique key for a calendar based on its level and pathContext
 * This is needed because all calendars have id='metadata' in Firestore
 */
function getCalendarKey(cal: CalendarType): string {
    const parts = [cal.level, cal.pathContext.year];
    if (cal.pathContext.department) parts.push(cal.pathContext.department);
    if (cal.pathContext.course) parts.push(cal.pathContext.course);
    if (cal.pathContext.groupId) parts.push(cal.pathContext.groupId);
    if (cal.pathContext.userId) parts.push(cal.pathContext.userId);
    return parts.join('|');
}

/**
 * Find a calendar by its unique key
 */
function findCalendarByKey(calendars: CalendarType[], key: string): CalendarType | undefined {
    return calendars.find(cal => getCalendarKey(cal) === key);
}

/**
 * Find the calendar that an event belongs to based on its pathContext
 */
function findEventCalendar(
    event: ScheduleEvent,
    calendars: CalendarType[]
): CalendarType | undefined {
    return calendars.find(cal =>
        cal.level === event.calendarLevel &&
        cal.pathContext.year === event.calendarPathContext.year &&
        cal.pathContext.department === event.calendarPathContext.department &&
        cal.pathContext.course === event.calendarPathContext.course &&
        cal.pathContext.groupId === event.calendarPathContext.groupId &&
        cal.pathContext.userId === event.calendarPathContext.userId
    );
}

/**
 * Check if user can edit/delete an event
 */
function canModifyEvent(event: ScheduleEvent & { id: string }, uid?: string, userRole?: string): boolean {
    if (!uid) return false;
    if (userRole === 'admin' || userRole === 'developer') return true;
    return event.createdBy === uid;
}

/**
 * Parse CSV content to events
 * Note: CSV import requires specifying a default calendar since hierarchical context can't be
 * easily expressed in CSV. The default calendar's level and pathContext will be used.
 */
function parseEventsCSV(
    csvContent: string,
    defaultCalendar: CalendarType
): Partial<ScheduleEvent>[] {
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const events: Partial<ScheduleEvent>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const event: Partial<ScheduleEvent> = {
            // Set default calendar's hierarchical context
            calendarLevel: defaultCalendar.level,
            calendarPathContext: defaultCalendar.pathContext,
        };

        headers.forEach((header, index) => {
            const value = values[index];
            if (!value) return;

            // Map common header variations
            if (header === 'title' || header === 'name') event.title = value;
            else if (header === 'description' || header === 'desc') event.description = value;
            // Note: calendarid in CSV is ignored - we use the selected default calendar
            else if (header === 'status') event.status = value as EventStatus;
            else if (header === 'startdate' || header === 'start') event.startDate = value;
            else if (header === 'enddate' || header === 'end') event.endDate = value;
            else if (header === 'color') event.color = value;
            else if (header === 'tags') event.tags = value.split(';').map(t => t.trim());
            else if (header === 'location') {
                event.location = { address: value, type: 'physical' } as EventLocation;
            }
        });

        if (event.title && event.startDate) {
            events.push(event);
        }
    }

    return events;
}

/**
 * Export events to CSV
 * Note: Calendar level and path context are exported for reference but may not be re-importable
 */
function exportEventsToCSV(
    events: (ScheduleEvent & { id: string })[],
    calendars: CalendarType[]
): string {
    const headers = [
        'Title', 'Description', 'CalendarName', 'CalendarLevel', 'Status',
        'StartDate', 'EndDate', 'Color', 'Tags', 'Location'
    ];
    const rows = events.map(event => {
        const eventCalendar = findEventCalendar(event, calendars);
        return [
            event.title || '',
            event.description || '',
            eventCalendar?.name || '',
            event.calendarLevel || '',
            event.status || '',
            event.startDate || '',
            event.endDate || '',
            event.color || '',
            event.tags?.join(';') || '',
            event.location?.address || event.location?.url || ''
        ];
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Calendar page for viewing and managing events
 */
export default function CalendarPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const [tabValue, setTabValue] = React.useState(0);
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
    const [selectedRange, setSelectedRange] = React.useState<{ start: Date; end: Date } | null>(null);
    const [filterStatuses, setFilterStatuses] = React.useState<EventStatus[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [events, setEvents] = React.useState<(ScheduleEvent & { id: string })[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<string[]>([]);
    const [userGroupIds, setUserGroupIds] = React.useState<string[]>([]); // User's group memberships
    const [loading, setLoading] = React.useState(true);

    // Dialog states
    const [openDialog, setOpenDialog] = React.useState(false);
    const [openCalendarDialog, setOpenCalendarDialog] = React.useState(false);
    const [editingEvent, setEditingEvent] = React.useState<(ScheduleEvent & { id: string }) | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
    const [eventToDelete, setEventToDelete] = React.useState<(ScheduleEvent & { id: string }) | null>(null);
    const [openNewCalendarDialog, setOpenNewCalendarDialog] = React.useState(false);
    const [calendarMenuAnchor, setCalendarMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [allTags, setAllTags] = React.useState<string[]>([]); // All available tags from events
    const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]); // All users for calendar sharing

    // Form state - tracks selected calendar by ID, level and pathContext come from the selected calendar
    const [formData, setFormData] = React.useState<Partial<ScheduleEvent> & {
        location?: Partial<EventLocation>;
        selectedCalendarId?: string; // Used to look up the calendar for level/pathContext
    }>({
        title: '',
        description: '',
        selectedCalendarId: '',
        status: 'scheduled',
        startDate: '',
        endDate: '',
        color: defaultEventColor,
        tags: [],
        location: {
            type: 'physical',
            address: '',
            room: '',
            url: '',
            platform: ''
        }
    });

    // New calendar form state
    const [newCalendarName, setNewCalendarName] = React.useState('');
    const [newCalendarColor, setNewCalendarColor] = React.useState(DEFAULT_CALENDAR_COLORS[0]);
    const [newCalendarDescription, setNewCalendarDescription] = React.useState('');
    const [newCalendarPermissions, setNewCalendarPermissions] = React.useState<(string | UserProfile)[]>([]);

    // Color picker state for debouncing
    const [colorPickerValue, setColorPickerValue] = React.useState(defaultEventColor);
    const colorUpdateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Debounced color update to prevent lag
    const handleColorChange = React.useCallback((newColor: string) => {
        setColorPickerValue(newColor);
        if (colorUpdateTimeoutRef.current) {
            clearTimeout(colorUpdateTimeoutRef.current);
        }
        colorUpdateTimeoutRef.current = setTimeout(() => {
            setFormData(prev => ({ ...prev, color: newColor }));
        }, 100); // 100ms debounce
    }, []);

    // Sync color picker with formData when dialog opens
    React.useEffect(() => {
        if (openDialog) {
            setColorPickerValue(formData.color || defaultEventColor);
        }
    }, [openDialog, formData.color]);

    // Load calendars and events from Firestore
    React.useEffect(() => {
        loadCalendarsAndEvents();
    }, [session?.user?.uid, session?.user?.role]);

    const loadCalendarsAndEvents = async () => {
        if (!session?.user?.uid) return;

        try {
            setLoading(true);

            // Use DEFAULT_YEAR (academic year format like "2025-2026") instead of calendar year
            const userContext = {
                year: DEFAULT_YEAR,
                department: session.user.department,
                course: session.user.course,
            };

            // For admin/developer, seed ALL calendars (global, all departments, courses, groups)
            // Similar to agendas and terminal requirements seeding pattern
            if (session.user.role === 'admin' || session.user.role === 'developer') {
                try {
                    // Get all users and groups to seed calendars for all contexts
                    const [allUsers, allGroups] = await Promise.all([
                        findAllUsers().catch(() => []),
                        getAllGroups().catch(() => []),
                    ]);

                    // Seed all calendars
                    const seedResult = await seedAllCalendars(
                        session.user.uid,
                        DEFAULT_YEAR,
                        allUsers.map(u => ({ department: u.department, course: u.course })),
                        allGroups.map(g => ({
                            id: g.id,
                            name: g.name,
                            department: g.department,
                            course: g.course,
                        }))
                    );

                    if (seedResult.totalSeeded > 0) {
                        showNotification(
                            `Initialized ${seedResult.totalSeeded} calendar(s)`,
                            'success'
                        );
                    }

                    // Store all users for calendar sharing
                    setAllUsers(allUsers);

                    // Get admin's own group memberships for writable calendars
                    const uid = session.user.uid;
                    const adminGroupIds = allGroups
                        .filter(g =>
                            g.members?.leader === uid ||
                            g.members?.members?.includes(uid)
                        )
                        .map(g => g.id);

                    // Store admin's group IDs for writableCalendars useMemo
                    setUserGroupIds(adminGroupIds);

                    // Load ALL calendars for admin/developer (pass allUsers and allGroups)
                    const userCalendars = await getUserCalendarsHierarchical(
                        session.user.uid,
                        session.user.role,
                        userContext,
                        adminGroupIds,
                        allUsers.map(u => ({ department: u.department, course: u.course })),
                        allGroups.map(g => ({ id: g.id, department: g.department, course: g.course }))
                    );

                    setCalendars(userCalendars);
                    setSelectedCalendarIds(userCalendars.map((cal: CalendarType) => getCalendarKey(cal)));

                    // Load events from all calendars
                    const fetchedEvents = await getEventsFromCalendars(userCalendars);
                    setEvents(fetchedEvents);

                    // Extract all unique tags from events for autocomplete
                    const tagsSet = new Set<string>();
                    fetchedEvents.forEach(event => {
                        if (Array.isArray(event.tags)) {
                            event.tags.forEach(tag => tagsSet.add(tag));
                        }
                    });
                    setAllTags(Array.from(tagsSet));
                } catch (error) {
                    console.error('Error seeding calendars:', error);
                }
            } else {
                // Regular user: seed personal calendar and load calendars based on their hierarchy
                try {
                    // Seed personal calendar for user if it doesn't exist
                    await loadOrSeedPersonalCalendar(
                        session.user.uid,
                        session.user.role,
                        userContext
                    );
                } catch (error) {
                    console.error('Error seeding personal calendar:', error);
                }

                // Fetch user's groups from Firestore (session.user.groups is not populated)
                let fetchedGroupIds: string[] = [];
                try {
                    const userGroups = await getGroupsByMember(session.user.uid);
                    fetchedGroupIds = userGroups.map(g => g.id);
                } catch (error) {
                    console.error('Error fetching user groups:', error);
                }

                // Store group IDs for writableCalendars useMemo
                setUserGroupIds(fetchedGroupIds);

                const userCalendars = await getUserCalendarsHierarchical(
                    session.user.uid,
                    session.user.role,
                    userContext,
                    fetchedGroupIds
                );

                setCalendars(userCalendars);
                setSelectedCalendarIds(userCalendars.map((cal: CalendarType) => getCalendarKey(cal)));

                // Load events from user's calendars
                const fetchedEvents = await getEventsFromCalendars(userCalendars);
                setEvents(fetchedEvents);

                // Extract all unique tags from events for autocomplete
                const tagsSet = new Set<string>();
                fetchedEvents.forEach(event => {
                    if (Array.isArray(event.tags)) {
                        event.tags.forEach(tag => tagsSet.add(tag));
                    }
                });
                setAllTags(Array.from(tagsSet));
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load calendars and events', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter events based on current filters, selected calendars, and range
    const filteredEvents = React.useMemo(() => {
        // If no calendars selected, return empty array
        if (selectedCalendarIds.length === 0) return [];

        return events.filter(event => {
            // Filter by selected calendars - find the calendar matching event's pathContext
            const eventCalendar = findEventCalendar(event, calendars);
            const matchesCalendar = eventCalendar
                ? selectedCalendarIds.includes(getCalendarKey(eventCalendar))
                : false;

            const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(event.status);

            // Filter by selected range or single date
            let matchesDateFilter = true;
            if (selectedRange) {
                // Range mode: check if event falls within range
                const eventStart = new Date(event.startDate);
                const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
                matchesDateFilter = isWithinInterval(eventStart, { start: selectedRange.start, end: selectedRange.end }) ||
                    isWithinInterval(eventEnd, { start: selectedRange.start, end: selectedRange.end });
            } else if (selectedDate) {
                // Single day mode: check if event occurs on this specific day
                const eventStart = new Date(event.startDate);
                const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;

                // Check if the selected date falls within the event's date range
                const selectedDayStart = new Date(selectedDate);
                selectedDayStart.setHours(0, 0, 0, 0);
                const selectedDayEnd = new Date(selectedDate);
                selectedDayEnd.setHours(23, 59, 59, 999);

                matchesDateFilter = (
                    (eventStart >= selectedDayStart && eventStart <= selectedDayEnd) ||
                    (eventEnd >= selectedDayStart && eventEnd <= selectedDayEnd) ||
                    (eventStart <= selectedDayStart && eventEnd >= selectedDayEnd)
                );
            }

            return matchesCalendar && matchesSearch && matchesStatus && matchesDateFilter;
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [searchTerm, selectedCalendarIds, filterStatuses, events, selectedRange, selectedDate, calendars]);

    // Get calendars user can add events to based on role permissions
    // - Personal: User can modify their own
    // - Group: Group members can add events  
    // - Department: Only heads and moderators can modify
    // - Global (Institutional): Only admins can modify
    const writableCalendars = React.useMemo(() => {
        const role = session?.user?.role;
        const uid = session?.user?.uid;

        if (role === 'admin' || role === 'developer') {
            return calendars; // Can add to any calendar
        }

        return calendars.filter(cal => {
            // Personal calendar: only owner can modify
            if (cal.level === 'personal') {
                return cal.ownerUid === uid;
            }

            // Group calendar: only group members can add events
            if (cal.level === 'group') {
                return cal.groupId && userGroupIds.includes(cal.groupId);
            }

            // Department calendar: only heads and moderators can modify
            if (cal.level === 'department') {
                return role === 'head' || role === 'moderator';
            }

            // Course calendar: heads, moderators can modify
            if (cal.level === 'course') {
                return role === 'head' || role === 'moderator';
            }

            // Global (institutional): only admins can modify (already handled above)
            if (cal.level === 'global') {
                return false;
            }

            return false;
        });
    }, [calendars, session?.user?.role, session?.user?.uid, userGroupIds]);

    const handleOpenDialog = (event?: ScheduleEvent & { id: string }) => {
        if (event) {
            setEditingEvent(event);
            // Find the calendar that matches the event's pathContext
            const matchingCalendar = calendars.find(cal =>
                cal.level === event.calendarLevel &&
                cal.pathContext.year === event.calendarPathContext.year &&
                cal.pathContext.department === event.calendarPathContext.department &&
                cal.pathContext.course === event.calendarPathContext.course &&
                cal.pathContext.groupId === event.calendarPathContext.groupId &&
                cal.pathContext.userId === event.calendarPathContext.userId
            );
            setFormData({
                ...event,
                selectedCalendarId: matchingCalendar ? getCalendarKey(matchingCalendar) : '',
            });
        } else {
            setEditingEvent(null);
            // If range is selected, use it for the new event
            const startDate = selectedRange?.start || selectedDate || new Date();
            const endDate = selectedRange?.end || selectedDate || new Date();

            // Get default calendar from writable calendars (prefer personal, then first writable)
            const defaultCalendar = writableCalendars.find(cal => cal.level === 'personal')
                || writableCalendars[0];

            setFormData({
                title: '',
                description: '',
                selectedCalendarId: defaultCalendar ? getCalendarKey(defaultCalendar) : '',
                status: 'scheduled',
                startDate: startDate instanceof Date && !isNaN(startDate.getTime())
                    ? format(startDate, "yyyy-MM-dd'T'HH:mm")
                    : '',
                endDate: endDate instanceof Date && !isNaN(endDate.getTime())
                    ? format(endDate, "yyyy-MM-dd'T'HH:mm")
                    : '',
                color: defaultCalendar?.color || defaultEventColor,
                tags: [],
                location: {
                    type: 'physical',
                    address: '',
                    room: '',
                    url: '',
                    platform: ''
                },
                createdBy: session?.user?.uid || ''
            });
            // Sync color picker with calendar color
            if (defaultCalendar?.color) {
                setColorPickerValue(defaultCalendar.color);
            }
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingEvent(null);
        // Get default calendar from writable calendars (prefer personal, then first writable)
        const defaultCalendar = writableCalendars.find(cal => cal.level === 'personal')
            || writableCalendars[0];
        setFormData({
            title: '',
            description: '',
            selectedCalendarId: defaultCalendar ? getCalendarKey(defaultCalendar) : '',
            status: 'scheduled',
            startDate: '',
            endDate: '',
            color: defaultCalendar?.color || defaultEventColor,
            tags: [],
            location: {
                type: 'physical',
                address: '',
                room: '',
                url: '',
                platform: ''
            }
        });
    };

    const handleSaveEvent = async () => {
        try {
            if (!formData.title || !formData.startDate) {
                showNotification('Title and start date are required', 'error');
                return;
            }

            if (!formData.selectedCalendarId) {
                showNotification('Please select a calendar', 'error');
                return;
            }

            // Find the selected calendar to get its level and pathContext
            const selectedCalendar = findCalendarByKey(calendars, formData.selectedCalendarId);
            if (!selectedCalendar) {
                showNotification('Selected calendar not found', 'error');
                return;
            }

            // Ensure tags is an array
            const eventTags = Array.isArray(formData.tags) ? formData.tags : [];

            const eventData: ScheduleEvent = {
                id: editingEvent?.id || '',
                title: formData.title,
                description: formData.description || '',
                calendarLevel: selectedCalendar.level,
                calendarPathContext: selectedCalendar.pathContext,
                status: formData.status as EventStatus,
                startDate: formData.startDate,
                endDate: formData.endDate || formData.startDate,
                isAllDay: false,
                organizer: session?.user?.uid || '',
                participants: [],
                color: formData.color || defaultEventColor,
                tags: eventTags,
                location: formData.location as EventLocation | undefined,
                createdBy: formData.createdBy || session?.user?.uid || '',
                createdAt: editingEvent?.createdAt || new Date().toISOString(),
                lastModified: new Date().toISOString(),
                lastModifiedBy: session?.user?.uid || ''
            };

            // Save event directly to calendar collection
            await setCalendarEvent(editingEvent?.id || null, eventData);
            await loadCalendarsAndEvents();
            handleCloseDialog();
            showNotification(`Event ${editingEvent ? 'updated' : 'created'} successfully`, 'success');
        } catch (error) {
            console.error('Error saving event:', error);
            showNotification('Failed to save event', 'error');
        }
    };

    const handleDeleteClick = (event: ScheduleEvent & { id: string }) => {
        setEventToDelete(event);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!eventToDelete) return;

        try {
            // Delete event from its calendar collection
            await deleteCalendarEvent(
                eventToDelete.calendarLevel,
                eventToDelete.calendarPathContext,
                eventToDelete.id
            );
            await loadCalendarsAndEvents();
            setDeleteConfirmOpen(false);
            setEventToDelete(null);
            showNotification('Event deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting event:', error);
            showNotification('Failed to delete event', 'error');
        }
    };

    const handleImportCSV = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const csvContent = event.target?.result as string;

                    // Use personal calendar as default for imports
                    const defaultCalendar = calendars.find(cal => cal.level === 'personal') || calendars[0];
                    if (!defaultCalendar) {
                        showNotification('No calendar available for import', 'error');
                        return;
                    }

                    const parsedEvents = parseEventsCSV(csvContent, defaultCalendar);

                    let successCount = 0;
                    for (const eventData of parsedEvents) {
                        try {
                            await setCalendarEvent(null, {
                                ...eventData,
                                calendarLevel: defaultCalendar.level,
                                calendarPathContext: defaultCalendar.pathContext,
                                createdBy: session?.user?.uid || '',
                                createdAt: new Date().toISOString(),
                                lastModified: new Date().toISOString()
                            } as ScheduleEvent);
                            successCount++;
                        } catch (error) {
                            console.error('Error importing event:', error);
                        }
                    }

                    await loadCalendarsAndEvents();
                    showNotification(
                        `Successfully imported ${successCount} of ${parsedEvents.length} events`,
                        successCount === parsedEvents.length ? 'success' : 'warning'
                    );
                } catch (error) {
                    console.error('Error parsing CSV:', error);
                    showNotification('Failed to parse CSV file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleExportCSV = () => {
        const csv = exportEventsToCSV(filteredEvents, calendars);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `events_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Events exported successfully', 'success');
    };

    const handleRangeSelect = (range: { from?: Date; to?: Date }) => {
        if (range.from && range.to) {
            setSelectedRange({ start: range.from, end: range.to });
            setSelectedDate(undefined);
        }
    };

    const handleToggleCalendar = (calendarId: string) => {
        setSelectedCalendarIds(prev =>
            prev.includes(calendarId)
                ? prev.filter(id => id !== calendarId)
                : [...prev, calendarId]
        );
    };

    const handleToggleAllCalendars = () => {
        if (selectedCalendarIds.length === calendars.length) {
            setSelectedCalendarIds([]);
        } else {
            setSelectedCalendarIds(calendars.map(cal => getCalendarKey(cal)));
        }
    };

    const handleCreateNewCalendar = async () => {
        if (!newCalendarName.trim()) {
            showNotification('Calendar name is required', 'error');
            return;
        }

        try {
            // Build permissions array
            const permissions: CalendarPermission[] = [
                {
                    uid: session?.user?.uid || '',
                    canView: true,
                    canEdit: true,
                    canDelete: true
                }
            ];

            // Add additional people from the input
            newCalendarPermissions.forEach((item) => {
                const uid = typeof item === 'string'
                    ? item
                    : item?.uid;

                if (uid) {
                    permissions.push({
                        uid: uid.trim().toLowerCase(),
                        canView: true,
                        canEdit: true,
                        canDelete: false
                    });
                }
            });

            const newCalendar: Omit<CalendarType, 'id'> = {
                name: newCalendarName,
                description: newCalendarDescription,
                level: 'personal', // Custom calendars are treated as personal level
                color: newCalendarColor,
                pathContext: {
                    year: DEFAULT_YEAR,
                    userId: session?.user?.uid || '',
                },
                ownerUid: session?.user?.uid || '',
                createdBy: session?.user?.uid || '',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                permissions: permissions,
                isVisible: true,
                isDefault: false
            };

            const calendarId = await setHierarchicalCalendar(newCalendar as CalendarType);

            await loadCalendarsAndEvents();
            setOpenNewCalendarDialog(false);
            setNewCalendarName('');
            setNewCalendarDescription('');
            setNewCalendarColor(DEFAULT_CALENDAR_COLORS[0]);
            setNewCalendarPermissions([]);
            showNotification('Calendar created successfully', 'success');

            return calendarId;
        } catch (error) {
            console.error('Error creating calendar:', error);
            showNotification('Failed to create calendar', 'error');
        }
    };

    const handleDateRangeSelect = (range: { from?: Date; to?: Date }) => {
        if (range.from && range.to) {
            const startDateStr = format(range.from, "yyyy-MM-dd'T'09:00");
            const endDateStr = format(range.to, "yyyy-MM-dd'T'10:00");

            setFormData(prev => ({
                ...prev,
                startDate: startDateStr,
                endDate: endDateStr
            }));
        }
    };

    return (
        <AnimatedPage variant="fade" duration="standard">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
                                Add Event
                            </Button>
                            {(session?.user?.role === 'admin' || session?.user?.role === 'developer') && (
                                <Button variant="contained" color="secondary" startIcon={<AddCircle />}
                                    onClick={() => setOpenNewCalendarDialog(true)}>
                                    New Calendar
                                </Button>
                            )}
                            <Button variant="outlined" startIcon={<Upload />} onClick={handleImportCSV}>
                                Import CSV
                            </Button>
                            <Button variant="outlined" startIcon={<Download />} onClick={handleExportCSV}
                                disabled={filteredEvents.length === 0}>
                                Export CSV
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                        {/* Main Content Area */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Button
                                    variant="outlined"
                                    endIcon={<ExpandMore />}
                                    onClick={(e) => setCalendarMenuAnchor(e.currentTarget)}
                                    sx={{ minWidth: 180 }}
                                >
                                    My Calendars ({selectedCalendarIds.length}/{calendars.length})
                                </Button>
                                <Menu
                                    anchorEl={calendarMenuAnchor}
                                    open={Boolean(calendarMenuAnchor)}
                                    onClose={() => setCalendarMenuAnchor(null)}
                                    slotProps={{
                                        paper: {
                                            sx: { minWidth: 250, maxHeight: 400 }
                                        }
                                    }}
                                >
                                    <MenuItem onClick={handleToggleAllCalendars} dense>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={selectedCalendarIds.length === calendars.length}
                                                    indeterminate={selectedCalendarIds.length > 0
                                                        && selectedCalendarIds.length < calendars.length}
                                                />
                                            }
                                            label={<Typography variant="body2" fontWeight={600}>Select All</Typography>}
                                        />
                                    </MenuItem>
                                    <Divider />
                                    {calendars.map(calendar => (
                                        <MenuItem
                                            key={getCalendarKey(calendar)}
                                            onClick={() => handleToggleCalendar(getCalendarKey(calendar))}
                                            dense
                                        >
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={selectedCalendarIds.includes(getCalendarKey(calendar))}
                                                        sx={{
                                                            color: calendar.color,
                                                            '&.Mui-checked': {
                                                                color: calendar.color
                                                            }
                                                        }}
                                                    />
                                                }
                                                label={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box
                                                            sx={{
                                                                width: 12,
                                                                height: 12,
                                                                borderRadius: '50%',
                                                                backgroundColor: calendar.color
                                                            }}
                                                        />
                                                        <Typography variant="body2">{calendar.name}</Typography>
                                                    </Box>
                                                }
                                            />
                                        </MenuItem>
                                    ))}
                                </Menu>
                                <TextField
                                    size="small"
                                    label="Search events"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    sx={{ minWidth: 240 }}
                                />
                                <Autocomplete
                                    multiple
                                    options={['scheduled', 'confirmed', 'cancelled', 'completed', 'rescheduled'] as EventStatus[]}
                                    value={filterStatuses}
                                    onChange={(_, v) => setFilterStatuses(v)}
                                    renderInput={(params) => <TextField {...params} size="small" label="Status" />}
                                    sx={{ minWidth: 180 }}
                                />
                                <IconButton aria-label="toggle view" onClick={() => setTabValue(v => (v === 0 ? 1 : 0))}>
                                    {tabValue === 0 ? <ViewList /> : <CalendarToday />}
                                </IconButton>
                            </Box>

                            {/* Calendar view content */}
                            <Box sx={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
                                {tabValue === 0 ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: { xs: 'column', md: 'row' },
                                            gap: 3,
                                            height: '100%',
                                        }}
                                    >
                                        {/* Calendar Column */}
                                        <Box
                                            sx={{
                                                flexShrink: 0,
                                                width: { xs: '100%', md: 'auto' },
                                                height: { xs: 'auto', md: '100%' },
                                            }}
                                        >
                                            <Calendar
                                                cellSize={60}
                                                cellPadding="0.3rem"
                                                events={events}
                                                selected={selectedDate}
                                                onSelect={(d) => {
                                                    setSelectedDate(d);
                                                    setSelectedRange(null);
                                                }}
                                                onEventClick={(ev) => setSelectedDate(new Date(ev.startDate))}
                                                onRangeSelect={handleRangeSelect}
                                            />
                                        </Box>

                                        {/* Events Rail Column */}
                                        <Box
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                height: { xs: 400, md: '100%' },
                                            }}
                                        >
                                            <EventsRail
                                                events={filteredEvents}
                                                calendars={calendars}
                                                selectedDate={selectedDate}
                                                selectedRange={selectedRange}
                                                loading={loading}
                                                findEventCalendar={findEventCalendar}
                                                onEdit={handleOpenDialog}
                                                onDelete={handleDeleteClick}
                                                canModifyEvent={(event) => canModifyEvent(
                                                    event,
                                                    session?.user?.uid ?? undefined,
                                                    session?.user?.role,
                                                )}
                                            />
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Showing {filteredEvents.length} events
                                        </Typography>
                                        {loading ? (
                                            <Typography variant="body2" color="text.secondary">Loading events...</Typography>
                                        ) : filteredEvents.length > 0 ? (
                                            <AnimatedList variant="slideUp" staggerDelay={40}>
                                                {filteredEvents.map(event => {
                                                    const canEdit = canModifyEvent(
                                                        event,
                                                        session?.user?.uid ?? undefined,
                                                        session?.user?.role,
                                                    );
                                                    const eventCalendar = findEventCalendar(event, calendars);
                                                    return (
                                                        <EventCard
                                                            key={event.id}
                                                            event={event}
                                                            calendar={eventCalendar}
                                                            onEdit={canEdit ? () => handleOpenDialog(event) : undefined}
                                                            onDelete={canEdit ? () => handleDeleteClick(event) : undefined}
                                                        />
                                                    );
                                                })}
                                            </AnimatedList>
                                        ) : (
                                            <Card>
                                                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                                    <Typography variant="h6" color="text.secondary">
                                                        No events found
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Try adjusting your filters or search terms
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Event Dialog */}
                        <EventDialog
                            open={openDialog}
                            onClose={handleCloseDialog}
                            onSave={handleSaveEvent}
                            editingEvent={editingEvent}
                            formData={formData}
                            setFormData={setFormData}
                            writableCalendars={writableCalendars}
                            getCalendarKey={getCalendarKey}
                            allTags={allTags}
                            defaultEventColor={defaultEventColor}
                            colorPickerValue={colorPickerValue}
                            onColorChange={handleColorChange}
                            onOpenCalendarDialog={() => setOpenCalendarDialog(true)}
                            canCreateCalendar={
                                session?.user?.role === 'admin' ||
                                session?.user?.role === 'developer'
                            }
                            onOpenNewCalendarDialog={() => setOpenNewCalendarDialog(true)}
                            findCalendarByKey={(key) => findCalendarByKey(calendars, key)}
                        />

                        {/* Delete Confirmation Dialog */}
                        <DeleteEventDialog
                            open={deleteConfirmOpen}
                            onClose={() => setDeleteConfirmOpen(false)}
                            onConfirm={handleConfirmDelete}
                            event={eventToDelete}
                        />

                        {/* Calendar Date Range Dialog */}
                        <Calendar
                            events={[]}
                            onRangeSelect={handleDateRangeSelect}
                            dialogMode={true}
                            open={openCalendarDialog}
                            onClose={() => setOpenCalendarDialog(false)}
                            dialogTitle="Select Date Range"
                            selectMode="range"
                        />

                        {/* New Calendar Dialog */}
                        <NewCalendarDialog
                            open={openNewCalendarDialog}
                            onClose={() => setOpenNewCalendarDialog(false)}
                            onCreate={handleCreateNewCalendar}
                            name={newCalendarName}
                            setName={setNewCalendarName}
                            description={newCalendarDescription}
                            setDescription={setNewCalendarDescription}
                            color={newCalendarColor}
                            setColor={setNewCalendarColor}
                            defaultColor={DEFAULT_CALENDAR_COLORS[0]}
                            canManagePermissions={
                                session?.user?.role === 'admin' ||
                                session?.user?.role === 'developer'
                            }
                            allUsers={allUsers}
                            permissions={newCalendarPermissions}
                            setPermissions={setNewCalendarPermissions}
                        />
                    </Box>
                </Box>
            </LocalizationProvider>
        </AnimatedPage>
    );
}
