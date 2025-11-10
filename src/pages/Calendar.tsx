import * as React from 'react';
import {
    Box, Card, CardContent, Typography, Button, IconButton, FormControl, InputLabel, Select,
    MenuItem, TextField, Stack, Tooltip, Divider, Autocomplete, Dialog, DialogTitle,
    DialogContent, DialogActions, Menu, Checkbox, FormControlLabel
} from '@mui/material';
import {
    CalendarToday, ViewList, Add, Upload, Download, AddCircle, ExpandMore
} from '@mui/icons-material';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Avatar, Name } from '../components/Avatar';
import { EventCard, Calendar } from '../components/Calendar';
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
import { getUserCalendars, getEventIdsFromCalendars, setCalendar } from '../utils/firebase/firestore/calendars';
import { setEvent, deleteEvent, getEventsByIds } from '../utils/firebase/firestore/events';
import { importScheduleFromCsv, exportScheduleToCsv, importCalendarsFromCsv, exportCalendarsToCsv } from '../utils/csv';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../hooks/useBackgroundJobs';

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
 * Check if user can edit/delete an event
 */
function canModifyEvent(event: ScheduleEvent & { id: string }, uid?: string, userRole?: string): boolean {
    if (!uid) return false;
    if (userRole === 'admin' || userRole === 'developer') return true;
    return event.createdBy === uid;
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
    const [loading, setLoading] = React.useState(true);
    const { startJob } = useBackgroundJobControls();

    const hasActiveEventImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            return job.metadata?.jobType === 'events-import';
        }, [])
    );

    const hasActiveCalendarImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            return job.metadata?.jobType === 'calendars-import';
        }, [])
    );

    const hasActiveImport = hasActiveEventImport || hasActiveCalendarImport;
    const isMountedRef = React.useRef(true);

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

    // Form state
    const [formData, setFormData] = React.useState<Partial<ScheduleEvent> & { location?: Partial<EventLocation> }>({
        title: '',
        description: '',
        calendarId: '',
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

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (colorUpdateTimeoutRef.current) {
                clearTimeout(colorUpdateTimeoutRef.current);
            }
        };
    }, []);

    const loadCalendarsAndEvents = React.useCallback(async () => {
        if (!session?.user?.uid) return;

        try {
            setLoading(true);

            const userCalendars = await getUserCalendars(
                session.user.uid,
                session.user.role,
                []
            );

            if (!isMountedRef.current) {
                return;
            }

            setCalendars(userCalendars);
            setSelectedCalendarIds(userCalendars.map(cal => cal.id));

            const eventIds = await getEventIdsFromCalendars(userCalendars);
            const fetchedEvents = await getEventsByIds(eventIds);

            if (!isMountedRef.current) {
                return;
            }

            setEvents(fetchedEvents);

            const tagsSet = new Set<string>();
            fetchedEvents.forEach(event => {
                if (Array.isArray(event.tags)) {
                    event.tags.forEach(tag => tagsSet.add(tag));
                }
            });
            setAllTags(Array.from(tagsSet));

            if (session.user.role === 'admin' || session.user.role === 'developer') {
                try {
                    const { getAllUsers } = await import('../utils/firebase/firestore');
                    if (isMountedRef.current) {
                        const users: UserProfile[] = await getAllUsers();
                        if (isMountedRef.current) {
                            setAllUsers(users);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load users:', error);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load calendars and events', 'error');
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [session?.user?.uid, session?.user?.role, showNotification]);

    // Load calendars and events from Firestore
    React.useEffect(() => {
        if (hasActiveImport) {
            return;
        }
        void loadCalendarsAndEvents();
    }, [loadCalendarsAndEvents, hasActiveImport]);

    // Filter events based on current filters, selected calendars, and range
    const filteredEvents = React.useMemo(() => {
        // If no calendars selected, return empty array
        if (selectedCalendarIds.length === 0) return [];

        return events.filter(event => {
            // Filter by selected calendars (Google Calendar style)
            const matchesCalendar = selectedCalendarIds.includes(event.calendarId);

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
    }, [searchTerm, selectedCalendarIds, filterStatuses, events, selectedRange, selectedDate]);

    const handleOpenDialog = (event?: ScheduleEvent & { id: string }) => {
        if (event) {
            setEditingEvent(event);
            setFormData(event);
        } else {
            setEditingEvent(null);
            // If range is selected, use it for the new event
            const startDate = selectedRange?.start || selectedDate || new Date();
            const endDate = selectedRange?.end || selectedDate || new Date();

            // Get default calendar (first personal calendar or first available)
            const defaultCalendar = calendars.find(cal => cal.type === 'personal') || calendars[0];

            setFormData({
                title: '',
                description: '',
                calendarId: defaultCalendar?.id || '',
                status: 'scheduled',
                startDate: startDate instanceof Date && !isNaN(startDate.getTime())
                    ? format(startDate, "yyyy-MM-dd'T'HH:mm")
                    : '',
                endDate: endDate instanceof Date && !isNaN(endDate.getTime())
                    ? format(endDate, "yyyy-MM-dd'T'HH:mm")
                    : '',
                color: defaultEventColor,
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
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingEvent(null);
        const defaultCalendar = calendars.find(cal => cal.type === 'personal') || calendars[0];
        setFormData({
            title: '',
            description: '',
            calendarId: defaultCalendar?.id || '',
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
    };

    const handleSaveEvent = async () => {
        try {
            if (!formData.title || !formData.startDate) {
                showNotification('Title and start date are required', 'error');
                return;
            }

            if (!formData.calendarId) {
                showNotification('Please select a calendar', 'error');
                return;
            }

            // Ensure tags is an array
            const eventTags = Array.isArray(formData.tags) ? formData.tags : [];

            const eventData: ScheduleEvent = {
                id: editingEvent?.id || '',
                title: formData.title,
                description: formData.description || '',
                calendarId: formData.calendarId,
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

            await setEvent(editingEvent?.id || null, eventData);
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
            await deleteEvent(eventToDelete.id);
            await loadCalendarsAndEvents();
            setDeleteConfirmOpen(false);
            setEventToDelete(null);
            showNotification('Event deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting event:', error);
            showNotification('Failed to delete event', 'error');
        }
    };

    const triggerFilePicker = React.useCallback((accept: string, onSelect: (file: File) => void) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = () => {
            const file = input.files?.[0];
            if (file) {
                onSelect(file);
            }
            input.remove();
        };
        input.click();
    }, []);

    /**
     * Import schedule events from CSV using the background job manager.
     */
    const handleEventImport = React.useCallback(() => {
        if (!session?.user?.uid) {
            showNotification('You need to be signed in to import events.', 'error');
            return;
        }

        if (calendars.length === 0) {
            showNotification('No calendars available for import.', 'error');
            return;
        }

        if (hasActiveEventImport) {
            showNotification('An event import is already running.', 'info');
            return;
        }

        triggerFilePicker('.csv', (file) => {
            const personalCalendar = calendars.find(cal => cal.type === 'personal' && cal.ownerUid === session?.user?.uid);
            const fallbackCalendarId = personalCalendar?.id ?? calendars[0]?.id;
            const calendarIds = new Set(calendars.map(cal => cal.id));

            startJob(
                `Importing events from ${file.name}`,
                async (updateProgress, signal) => {
                    const text = await file.text();
                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const { parsed, errors: parseErrors } = importScheduleFromCsv(text);
                    const errors = parseErrors.map(error => `Parse: ${error}`);

                    if (parsed.length === 0) {
                        return { count: 0, total: 0, errors };
                    }

                    let successCount = 0;
                    const total = parsed.length;
                    const progressTotal = Math.max(total, 1);

                    for (let index = 0; index < parsed.length; index++) {
                        if (signal.aborted) {
                            throw new Error('Import cancelled');
                        }

                        const rawEvent = parsed[index];
                        const resolvedCalendarId = rawEvent.calendarId && calendarIds.has(rawEvent.calendarId)
                            ? rawEvent.calendarId
                            : fallbackCalendarId;

                        if (!resolvedCalendarId) {
                            errors.push(
                                `Row ${index + 2}: Missing valid calendar for "${rawEvent.title
                                || rawEvent.id || `event ${index + 1}`}"`
                            );
                            continue;
                        }

                        updateProgress({
                            current: index + 1,
                            total: progressTotal,
                            message: `Saving ${rawEvent.title || `event ${index + 1}`}`,
                        });

                        const eventData: ScheduleEvent = {
                            ...rawEvent,
                            id: '',
                            calendarId: resolvedCalendarId,
                            createdBy: rawEvent.createdBy || session?.user?.uid || '',
                            createdAt: rawEvent.createdAt || new Date().toISOString(),
                            lastModified: new Date().toISOString(),
                            lastModifiedBy: session?.user?.uid || rawEvent.lastModifiedBy || '',
                            organizer: rawEvent.organizer || session?.user?.uid || '',
                            participants: rawEvent.participants ?? [],
                            isAllDay: Boolean(rawEvent.isAllDay),
                            color: rawEvent.color || defaultEventColor,
                            tags: rawEvent.tags ?? [],
                        };

                        try {
                            await setEvent(null, eventData);
                            successCount++;
                        } catch (error) {
                            errors.push(
                                `Failed to import ${rawEvent.title || `row ${index + 2}`}: ${error instanceof Error ?
                                    error.message : 'Unknown error'}`
                            );
                        }
                    }

                    return { count: successCount, total, errors };
                },
                { fileName: file.name, fileSize: file.size, jobType: 'events-import' },
                (job) => {
                    if (isMountedRef.current) {
                        void loadCalendarsAndEvents();
                    }

                    if (job.status === 'completed' && job.result) {
                        const result = job.result as { count: number; total: number; errors: string[] };
                        if (result.total === 0) {
                            if (result.errors.length > 0) {
                                showNotification(
                                    `No events imported. ${result.errors.length} warning(s) encountered.`,
                                    'warning',
                                    6000
                                );
                            } else {
                                showNotification('No events found in the CSV file.', 'info');
                            }
                            return;
                        }

                        if (result.errors.length > 0) {
                            showNotification(
                                `Imported ${result.count} of ${result.total} event(s) with warnings`,
                                'warning',
                                6000,
                                {
                                    label: 'View Errors',
                                    onClick: () =>
                                        showNotification(`Import warnings:\n${result.errors.join('\n')}`, 'error', 0),
                                }
                            );
                        } else {
                            showNotification(`Successfully imported ${result.count} event(s)`, 'success');
                        }
                    } else if (job.status === 'failed') {
                        showNotification(`Event import failed: ${job.error ?? 'Unknown error'}`, 'error');
                    }
                }
            );

            showNotification('Event import started in the background.', 'info', 5000);
        });
    }, [calendars, hasActiveEventImport, loadCalendarsAndEvents, session?.user?.uid, showNotification, startJob, triggerFilePicker]);

    /**
     * Export the currently filtered events to CSV.
     */
    const handleEventExport = React.useCallback(() => {
        if (filteredEvents.length === 0) {
            showNotification('No events available to export for the current filters.', 'info');
            return;
        }

        const csvText = exportScheduleToCsv(filteredEvents);
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `events_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification(`Exported ${filteredEvents.length} event(s)`, 'success');
    }, [filteredEvents, showNotification]);

    /**
     * Import calendars from CSV. Restricted to admin/developer roles.
     */
    const handleCalendarImport = React.useCallback(() => {
        if (session?.user?.role !== 'admin' && session?.user?.role !== 'developer') {
            showNotification('Only administrators or developers can import calendars.', 'error');
            return;
        }

        if (hasActiveCalendarImport) {
            showNotification('A calendar import is already running.', 'info');
            return;
        }

        triggerFilePicker('.csv', (file) => {
            startJob(
                `Importing calendars from ${file.name}`,
                async (updateProgress, signal) => {
                    const text = await file.text();
                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const { parsed, errors: parseErrors } = importCalendarsFromCsv(text);
                    const errors = parseErrors.map(error => `Parse: ${error}`);

                    if (parsed.length === 0) {
                        return { count: 0, total: 0, errors };
                    }

                    let successCount = 0;
                    const total = parsed.length;
                    const progressTotal = Math.max(total, 1);

                    for (let index = 0; index < parsed.length; index++) {
                        if (signal.aborted) {
                            throw new Error('Import cancelled');
                        }

                        const record = parsed[index];
                        const ownerUid = record.ownerUid || session?.user?.uid || '';
                        if (!ownerUid) {
                            errors.push(`Row ${index + 2}: Missing ownerUid and no fallback available.`);
                            continue;
                        }

                        const calendarType = record.type ?? 'custom';
                        const permissions = record.permissions && record.permissions.length > 0
                            ? record.permissions
                            : [{
                                uid: ownerUid,
                                canView: true,
                                canEdit: true,
                                canDelete: calendarType !== 'personal',
                            }];

                        const calendarPayload: CalendarType = {
                            id: record.id ?? '',
                            name: record.name ?? `Calendar ${index + 1}`,
                            description: record.description,
                            type: calendarType,
                            color: record.color ?? DEFAULT_CALENDAR_COLORS[0],
                            eventIds: record.eventIds ?? [],
                            ownerUid,
                            createdBy: record.createdBy || session?.user?.uid || ownerUid,
                            createdAt: record.createdAt || new Date().toISOString(),
                            lastModified: new Date().toISOString(),
                            permissions,
                            groupId: record.groupId,
                            groupName: record.groupName,
                            isVisible: typeof record.isVisible === 'boolean' ? record.isVisible : true,
                            isDefault: record.isDefault,
                        };

                        updateProgress({
                            current: index + 1,
                            total: progressTotal,
                            message: `Saving ${calendarPayload.name}`,
                        });

                        try {
                            await setCalendar(record.id ?? null, calendarPayload);
                            successCount++;
                        } catch (error) {
                            errors.push(
                                `Failed to import ${calendarPayload.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
                            );
                        }
                    }

                    return { count: successCount, total, errors };
                },
                { fileName: file.name, fileSize: file.size, jobType: 'calendars-import' },
                (job) => {
                    if (isMountedRef.current) {
                        void loadCalendarsAndEvents();
                    }

                    if (job.status === 'completed' && job.result) {
                        const result = job.result as { count: number; total: number; errors: string[] };

                        if (result.total === 0) {
                            if (result.errors.length > 0) {
                                showNotification(
                                    `No calendars imported. ${result.errors.length} warning(s) encountered.`,
                                    'warning',
                                    6000
                                );
                            } else {
                                showNotification('No calendars found in the CSV file.', 'info');
                            }
                            return;
                        }

                        if (result.errors.length > 0) {
                            showNotification(
                                `Imported ${result.count} of ${result.total} calendar(s) with warnings`,
                                'warning',
                                6000,
                                {
                                    label: 'View Errors',
                                    onClick: () =>
                                        showNotification(`Import warnings:\n${result.errors.join('\n')}`, 'info', 0),
                                }
                            );
                        } else {
                            showNotification(`Successfully imported ${result.count} calendar(s)`, 'success');
                        }
                    } else if (job.status === 'failed') {
                        showNotification(`Calendar import failed: ${job.error ?? 'Unknown error'}`, 'error');
                    }
                }
            );

            showNotification('Calendar import started in the background.', 'info', 5000);
        });
    }, [hasActiveCalendarImport, loadCalendarsAndEvents, session?.user?.role,
        session?.user?.uid, showNotification, startJob, triggerFilePicker]);

    /**
     * Export accessible calendars to CSV.
     */
    const handleCalendarExport = React.useCallback(() => {
        if (calendars.length === 0) {
            showNotification('No calendars available to export.', 'info');
            return;
        }

        const csvText = exportCalendarsToCsv(calendars);
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `calendars_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification(`Exported ${calendars.length} calendar(s)`, 'success');
    }, [calendars, showNotification]);

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
            setSelectedCalendarIds(calendars.map(cal => cal.id));
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
                type: 'custom',
                color: newCalendarColor,
                eventIds: [],
                ownerUid: session?.user?.uid || '',
                createdBy: session?.user?.uid || '',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                permissions: permissions,
                isVisible: true,
                isDefault: false
            };

            const calendarId = await setCalendar(null, newCalendar as CalendarType);

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

    // Get calendars user can add events to
    const writableCalendars = React.useMemo(() => {
        const role = session?.user?.role;
        const uid = session?.user?.uid;

        if (role === 'admin' || role === 'developer') {
            return calendars; // Can add to any calendar
        }

        return calendars.filter(cal => {
            if (cal.type === 'personal' && cal.ownerUid === uid) return true;
            if (cal.type === 'group') return true; // Students/editors can add to group calendars
            return false;
        });
    }, [calendars, session?.user?.role, session?.user?.uid]);

    return (
        <AnimatedPage variant="fade" duration="standard">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
                            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
                                Add Event
                            </Button>
                            {(session?.user?.role === 'admin' || session?.user?.role === 'developer') && (
                                <Button variant="contained" color="secondary" startIcon={<AddCircle />}
                                    onClick={() => setOpenNewCalendarDialog(true)}>
                                    New Calendar
                                </Button>
                            )}
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<Upload />}
                                    onClick={handleEventImport}
                                    disabled={hasActiveEventImport}
                                >
                                    {hasActiveEventImport ? 'Importing Events...' : 'Import Events CSV'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Download />}
                                    onClick={handleEventExport}
                                    disabled={filteredEvents.length === 0}
                                >
                                    Export Events CSV
                                </Button>
                            </Stack>
                            {(session?.user?.role === 'admin' || session?.user?.role === 'developer') && (
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Upload />}
                                        onClick={handleCalendarImport}
                                        disabled={hasActiveCalendarImport}
                                    >
                                        {hasActiveCalendarImport ? 'Importing Calendars...' : 'Import Calendars CSV'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Download />}
                                        onClick={handleCalendarExport}
                                        disabled={calendars.length === 0}
                                    >
                                        Export Calendars CSV
                                    </Button>
                                </Stack>
                            )}
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
                                        <MenuItem key={calendar.id} onClick={() => handleToggleCalendar(calendar.id)} dense>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={selectedCalendarIds.includes(calendar.id)}
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
                            <Box>
                                {tabValue === 0 ? (
                                    <Card>
                                        <CardContent>
                                            <Box
                                                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Typography variant="h6">Calendar View</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                                                <Calendar
                                                    events={events}
                                                    selected={selectedDate}
                                                    onSelect={(d) => {
                                                        setSelectedDate(d);
                                                        setSelectedRange(null);
                                                    }}
                                                    onEventClick={(ev) => setSelectedDate(new Date(ev.startDate))}
                                                    onRangeSelect={handleRangeSelect}
                                                />
                                                <Box sx={{ width: { xs: '100%', md: '67%' } }}>
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        {selectedRange
                                                            // eslint-disable-next-line max-len
                                                            ? `Events from ${format(selectedRange.start, 'MMM d')} to ${format(selectedRange.end, 'MMM d')}`
                                                            : `Events on ${selectedDate ? selectedDate.toLocaleDateString() : '—'}`
                                                        }
                                                    </Typography>
                                                    {loading ? (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Loading events...
                                                        </Typography>
                                                    ) : selectedDate || selectedRange ? (
                                                        filteredEvents.length > 0 ? (
                                                            <AnimatedList variant="slideUp" staggerDelay={40}>
                                                                {filteredEvents.map(ev => {
                                                                    const canEdit = canModifyEvent(
                                                                        ev,
                                                                        session?.user?.uid ?? undefined,
                                                                        session?.user?.role,
                                                                    );
                                                                    const eventCalendar =
                                                                        calendars.find(cal => cal.id === ev.calendarId);
                                                                    return (
                                                                        <EventCard
                                                                            key={ev.id}
                                                                            event={ev}
                                                                            calendar={eventCalendar}
                                                                            onEdit={canEdit ? () =>
                                                                                handleOpenDialog(ev) : undefined}
                                                                            onDelete={canEdit ? () =>
                                                                                handleDeleteClick(ev) : undefined}
                                                                        />
                                                                    );
                                                                })}
                                                            </AnimatedList>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                No events for this selection.
                                                            </Typography>
                                                        )
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Select a date or range to see events.
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
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
                                                    const eventCalendar = calendars.find(cal => cal.id === event.calendarId);
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
                        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                            <DialogTitle>
                                {editingEvent ? 'Edit Event' : 'Create Event'}
                            </DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <TextField
                                        label="Title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        fullWidth
                                    />
                                    <TextField
                                        label="Description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        multiline
                                        rows={3}
                                        fullWidth
                                    />
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                        <FormControl fullWidth required>
                                            <InputLabel>Calendar</InputLabel>
                                            <Select
                                                value={formData.calendarId}
                                                label="Calendar"
                                                onChange={(e) => setFormData({ ...formData, calendarId: e.target.value })}
                                            >
                                                {writableCalendars.map(cal => (
                                                    <MenuItem key={cal.id} value={cal.id}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Box
                                                                sx={{
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: '50%',
                                                                    backgroundColor: cal.color
                                                                }}
                                                            />
                                                            {cal.name}
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        {(session?.user?.role === 'admin' || session?.user?.role === 'developer') && (
                                            <Tooltip title="Create New Calendar">
                                                <IconButton
                                                    onClick={() => setOpenNewCalendarDialog(true)}
                                                    sx={{ mt: 1 }}
                                                    color="primary"
                                                >
                                                    <AddCircle />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Status</InputLabel>
                                            <Select
                                                value={formData.status}
                                                label="Status"
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                                            >
                                                <MenuItem value="scheduled">Scheduled</MenuItem>
                                                <MenuItem value="confirmed">Confirmed</MenuItem>
                                                <MenuItem value="cancelled">Cancelled</MenuItem>
                                                <MenuItem value="completed">Completed</MenuItem>
                                                <MenuItem value="rescheduled">Rescheduled</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Tooltip title="Event Color">
                                                <Box
                                                    sx={{
                                                        width: 56,
                                                        height: 56,
                                                        border: '2px solid',
                                                        borderColor: 'divider',
                                                        backgroundColor: formData.color || defaultEventColor,
                                                        borderRadius: 1,
                                                        flexShrink: 0
                                                    }}
                                                />
                                            </Tooltip>
                                            <input
                                                type="color"
                                                value={colorPickerValue}
                                                onChange={(e) => handleColorChange(e.target.value)}
                                                style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    border: '2px solid',
                                                    borderColor: '#e0e0e0',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <TextField
                                            label="Start Date"
                                            type="date"
                                            value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                                            onChange={(e) => {
                                                const time = formData.startDate?.split('T')[1] || '09:00';
                                                setFormData({ ...formData, startDate: `${e.target.value}T${time}` });
                                            }}
                                            required
                                            fullWidth
                                            slotProps={{
                                                inputLabel: { shrink: true },
                                                input: {
                                                    endAdornment: (
                                                        <IconButton
                                                            edge="end"
                                                            onClick={() => setOpenCalendarDialog(true)}
                                                            size="small"
                                                        >
                                                            <CalendarToday fontSize="small" />
                                                        </IconButton>
                                                    )
                                                }
                                            }}
                                        />
                                        <TextField
                                            label="End Date"
                                            type="date"
                                            value={formData.endDate ? formData.endDate.split('T')[0] : ''}
                                            onChange={(e) => {
                                                const time = formData.endDate?.split('T')[1] || '10:00';
                                                setFormData({ ...formData, endDate: `${e.target.value}T${time}` });
                                            }}
                                            fullWidth
                                            slotProps={{
                                                inputLabel: { shrink: true },
                                                input: {
                                                    endAdornment: (
                                                        <IconButton
                                                            edge="end"
                                                            onClick={() => setOpenCalendarDialog(true)}
                                                            size="small"
                                                        >
                                                            <CalendarToday fontSize="small" />
                                                        </IconButton>
                                                    )
                                                }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <MobileTimePicker
                                            label="Start Time"
                                            value={formData.startDate ? new Date(formData.startDate) : null}
                                            onChange={(newValue) => {
                                                if (newValue) {
                                                    const date = formData.startDate?.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
                                                    const time = format(newValue, 'HH:mm');
                                                    setFormData({ ...formData, startDate: `${date}T${time}` });
                                                }
                                            }}
                                            openTo="hours"
                                            views={['hours', 'minutes']}
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    required: true
                                                }
                                            }}
                                        />
                                        <MobileTimePicker
                                            label="End Time"
                                            value={formData.endDate ? new Date(formData.endDate) : null}
                                            onChange={(newValue) => {
                                                if (newValue) {
                                                    const date = formData.endDate?.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
                                                    const time = format(newValue, 'HH:mm');
                                                    setFormData({ ...formData, endDate: `${date}T${time}` });
                                                }
                                            }}
                                            openTo="hours"
                                            views={['hours', 'minutes']}
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true
                                                }
                                            }}
                                        />
                                    </Box>
                                    <Autocomplete
                                        multiple
                                        freeSolo
                                        options={allTags}
                                        value={formData.tags || []}
                                        onChange={(_, v) => setFormData({ ...formData, tags: v })}
                                        renderInput={(params) =>
                                            <TextField {...params} label="Tags" placeholder="Add or select tags..." />}
                                    />
                                    <Box>
                                        <Typography variant="subtitle2" gutterBottom>Location</Typography>
                                        <Stack spacing={2}>
                                            <FormControl fullWidth>
                                                <InputLabel>Type</InputLabel>
                                                <Select
                                                    value={formData.location?.type || 'physical'}
                                                    label="Type"
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        location: {
                                                            type: e.target.value as 'physical' | 'virtual' | 'hybrid',
                                                            address: formData.location?.address,
                                                            room: formData.location?.room,
                                                            url: formData.location?.url,
                                                            platform: formData.location?.platform
                                                        }
                                                    })}
                                                >
                                                    <MenuItem value="physical">Physical</MenuItem>
                                                    <MenuItem value="virtual">Virtual</MenuItem>
                                                    <MenuItem value="hybrid">Hybrid</MenuItem>
                                                </Select>
                                            </FormControl>
                                            {(formData.location?.type === 'physical' || formData.location?.type === 'hybrid') && (
                                                <>
                                                    <TextField
                                                        label="Address"
                                                        value={formData.location?.address || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            location: {
                                                                ...formData.location,
                                                                type: formData.location?.type || 'physical',
                                                                address: e.target.value
                                                            }
                                                        })}
                                                        required
                                                        fullWidth
                                                    />
                                                    <TextField
                                                        label="Room"
                                                        value={formData.location?.room || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            location: {
                                                                ...formData.location,
                                                                type: formData.location?.type || 'physical',
                                                                room: e.target.value
                                                            }
                                                        })}
                                                        required
                                                        fullWidth
                                                    />
                                                </>
                                            )}
                                            {(formData.location?.type === 'virtual' || formData.location?.type === 'hybrid') && (
                                                <>
                                                    <TextField
                                                        label="URL"
                                                        value={formData.location?.url || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            location: {
                                                                ...formData.location,
                                                                type: formData.location?.type || 'virtual',
                                                                url: e.target.value
                                                            }
                                                        })}
                                                        placeholder="https://meet.google.com/..."
                                                        required
                                                        fullWidth
                                                    />
                                                    <TextField
                                                        label="Platform"
                                                        value={formData.location?.platform || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            location: {
                                                                ...formData.location,
                                                                type: formData.location?.type || 'virtual',
                                                                platform: e.target.value
                                                            }
                                                        })}
                                                        placeholder="Zoom, Teams, Google Meet, etc."
                                                        required
                                                        fullWidth
                                                    />
                                                </>
                                            )}
                                        </Stack>
                                    </Box>
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleCloseDialog}>Cancel</Button>
                                <Button onClick={handleSaveEvent} variant="contained">
                                    {editingEvent ? 'Update' : 'Create'}
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Delete Confirmation Dialog */}
                        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                            <DialogTitle>Delete Event</DialogTitle>
                            <DialogContent>
                                <Typography>
                                    Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
                                </Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                                <Button onClick={handleConfirmDelete} color="error" variant="contained">
                                    Delete
                                </Button>
                            </DialogActions>
                        </Dialog>

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
                        <Dialog open={openNewCalendarDialog} onClose={() => setOpenNewCalendarDialog(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Create New Calendar</DialogTitle>
                            <DialogContent>
                                <Stack spacing={3} sx={{ mt: 1 }}>
                                    <TextField
                                        label="Calendar Name"
                                        value={newCalendarName}
                                        onChange={(e) => setNewCalendarName(e.target.value)}
                                        required
                                        fullWidth
                                        autoFocus
                                    />
                                    <TextField
                                        label="Description"
                                        value={newCalendarDescription}
                                        onChange={(e) => setNewCalendarDescription(e.target.value)}
                                        multiline
                                        rows={2}
                                        fullWidth
                                    />
                                    <Box>
                                        <Typography variant="body2" gutterBottom>Color</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <Box
                                                sx={{
                                                    width: 56,
                                                    height: 56,
                                                    border: '2px solid',
                                                    borderColor: 'divider',
                                                    backgroundColor: newCalendarColor,
                                                    borderRadius: 1,
                                                    flexShrink: 0
                                                }}
                                            />
                                            <input
                                                type="color"
                                                value={newCalendarColor}
                                                onChange={(e) => setNewCalendarColor(e.target.value)}
                                                style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    border: '2px solid #e0e0e0',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                    {(session?.user?.role === 'admin' || session?.user?.role === 'developer') && (
                                        <Autocomplete<UserProfile, true, false, true>
                                            multiple
                                            freeSolo
                                            options={allUsers}
                                            value={newCalendarPermissions}
                                            onChange={(_, value) => setNewCalendarPermissions(value)}
                                            getOptionLabel={(option) => {
                                                if (typeof option === 'string') return option;
                                                return option.email || '';
                                            }}
                                            renderOption={(props, option) => {
                                                if (typeof option === 'string') {
                                                    return <li {...props}>{option}</li>;
                                                }
                                                const fullName = [
                                                    option.name.prefix, option.name.first, option.name.middle,
                                                    option.name.last, option.name.suffix
                                                ].filter(Boolean).join(' ');
                                                return (
                                                    <li {...props}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                            <Avatar
                                                                uid={option.uid}
                                                                initials={[Name.FIRST, Name.LAST]}
                                                                size="small"
                                                            />
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                    {fullName || option.email}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary"
                                                                    sx={{ display: 'block' }}>
                                                                    {option.email}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Add People (Emails)"
                                                    placeholder="Search by name or email..."
                                                    helperText="Grant view/edit access to selected users"
                                                />
                                            )}
                                        />
                                    )}
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => {
                                    setOpenNewCalendarDialog(false);
                                    setNewCalendarName('');
                                    setNewCalendarDescription('');
                                    setNewCalendarColor(DEFAULT_CALENDAR_COLORS[0]);
                                    setNewCalendarPermissions([]);
                                }}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreateNewCalendar} variant="contained">
                                    Create
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                </Box>
            </LocalizationProvider>
        </AnimatedPage>
    );
}
