import * as React from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Grid, Button, IconButton,
    FormControl, InputLabel, Select, MenuItem, TextField, Stack, Tooltip, Badge, Divider, List,
    ListItem, ListItemText, ListItemAvatar, Autocomplete, Dialog, DialogTitle, DialogContent,
    DialogActions, Alert, Snackbar, Menu, Checkbox, FormControlLabel
} from '@mui/material';
import {
    CalendarToday, Event, Schedule, FilterList, ViewModule, ViewList, ViewWeek, AccessTime, LocationOn, People,
    PriorityHigh, Visibility, NotificationImportant, CheckCircle, Cancel, Warning, School, Book, Slideshow, Assignment,
    Groups, BeachAccess, Add, Edit, Delete, Upload, Download, Close, AddCircle, ExpandMore
} from '@mui/icons-material';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Avatar, Name } from '../components';
import { EventCard } from '../components';
import { Calendar as CalendarComponent } from '../components';
import AnimatedPage from '../components/Animate/AnimatedPage/AnimatedPage';
import AnimatedList from '../components/Animate/AnimatedList/AnimatedList';
import { useSession } from '../SessionContext';
import { getAllEvents, setEvent, deleteEvent } from '../utils/firebase/firestore';
import type { NavigationItem } from '../types/navigation';
import type { ScheduleEvent, EventStatus, CalendarView, EventLocation, Calendar as CalendarType } from '../types/schedule';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { getUserCalendars, createPersonalCalendar } from '../utils/firebase/firestore';

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

// Event status colors
const statusColors: Record<EventStatus, string> = {
    scheduled: '#2196f3',
    confirmed: '#4caf50',
    cancelled: '#757575',
    completed: '#388e3c',
    rescheduled: '#ff9800'
};

/**
 * Check if user can edit/delete an event
 */
function canModifyEvent(event: ScheduleEvent & { id: string }, userEmail?: string, userRole?: string): boolean {
    if (!userEmail) return false;
    if (userRole === 'admin' || userRole === 'developer') return true;
    return event.createdBy === userEmail;
}

/**
 * Parse CSV content to events
 */
function parseEventsCSV(csvContent: string, defaultCalendarId: string): Partial<ScheduleEvent>[] {
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const events: Partial<ScheduleEvent>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const event: any = {};

        headers.forEach((header, index) => {
            const value = values[index];
            if (!value) return;

            // Map common header variations
            if (header === 'title' || header === 'name') event.title = value;
            else if (header === 'description' || header === 'desc') event.description = value;
            else if (header === 'calendarid' || header === 'calendar') event.calendarId = value;
            else if (header === 'status') event.status = value as EventStatus;
            else if (header === 'startdate' || header === 'start') event.startDate = value;
            else if (header === 'enddate' || header === 'end') event.endDate = value;
            else if (header === 'color') event.color = value;
            else if (header === 'tags') event.tags = value.split(';').map(t => t.trim());
            else if (header === 'location') event.location = { address: value, type: 'physical' };
        });

        // Use default calendar if not specified
        if (!event.calendarId) {
            event.calendarId = defaultCalendarId;
        }

        if (event.title && event.startDate) {
            events.push(event);
        }
    }

    return events;
}

/**
 * Export events to CSV
 */
function exportEventsToCSV(events: (ScheduleEvent & { id: string })[]): string {
    const headers = ['Title', 'Description', 'CalendarId', 'Status', 'StartDate', 'EndDate', 'Color', 'Tags', 'Location'];
    const rows = events.map(event => [
        event.title || '',
        event.description || '',
        event.calendarId || '',
        event.status || '',
        event.startDate || '',
        event.endDate || '',
        event.color || '',
        event.tags?.join(';') || '',
        event.location?.address || event.location?.url || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Calendar page for viewing and managing events
 */
export default function CalendarPage() {
    const { session } = useSession();
    const [tabValue, setTabValue] = React.useState(0);
    const [calendarView, setCalendarView] = React.useState<CalendarView>('month');
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
    const [selectedRange, setSelectedRange] = React.useState<{ start: Date; end: Date } | null>(null);
    const [filterStatuses, setFilterStatuses] = React.useState<EventStatus[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [events, setEvents] = React.useState<(ScheduleEvent & { id: string })[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<string[]>([]);
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
    const [allUsers, setAllUsers] = React.useState<any[]>([]); // All users for calendar sharing
    const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'warning' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

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
    const [newCalendarPermissions, setNewCalendarPermissions] = React.useState<string[]>([]);

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
    }, [session?.user?.email, session?.user?.role]);

    const loadCalendarsAndEvents = async () => {
        if (!session?.user?.email) return;

        try {
            setLoading(true);

            // Load user's accessible calendars
            const userCalendars = await getUserCalendars(
                session.user.email,
                session.user.role,
                [] // TODO: Add user groups when available in user profile
            );

            setCalendars(userCalendars);

            // Select all calendars by default (Google Calendar style)
            setSelectedCalendarIds(userCalendars.map(cal => cal.id));

            // Load all events (will be filtered by selected calendars in UI)
            const fetchedEvents = await getAllEvents();
            setEvents(fetchedEvents);

            // Extract all unique tags from events for autocomplete
            const tagsSet = new Set<string>();
            fetchedEvents.forEach(event => {
                if (Array.isArray(event.tags)) {
                    event.tags.forEach(tag => tagsSet.add(tag));
                }
            });
            setAllTags(Array.from(tagsSet));

            // Load all users for calendar sharing (admin/developer only)
            if (session.user.role === 'admin' || session.user.role === 'developer') {
                try {
                    const { getAllUsers } = await import('../utils/firebase/firestore');
                    const users = await getAllUsers();
                    setAllUsers(users);
                } catch (err) {
                    console.error('Failed to load users:', err);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setSnackbar({ open: true, message: 'Failed to load calendars and events', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

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
                createdBy: session?.user?.email || ''
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
                setSnackbar({ open: true, message: 'Title and start date are required', severity: 'error' });
                return;
            }

            if (!formData.calendarId) {
                setSnackbar({ open: true, message: 'Please select a calendar', severity: 'error' });
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
                organizer: session?.user?.email || '',
                participants: [],
                color: formData.color || defaultEventColor,
                tags: eventTags,
                location: formData.location as EventLocation | undefined,
                createdBy: formData.createdBy || session?.user?.email || '',
                createdAt: editingEvent?.createdAt || new Date().toISOString(),
                lastModified: new Date().toISOString(),
                lastModifiedBy: session?.user?.email || ''
            };

            await setEvent(editingEvent?.id || null, eventData);
            await loadCalendarsAndEvents();
            handleCloseDialog();
            setSnackbar({ open: true, message: `Event ${editingEvent ? 'updated' : 'created'} successfully`, severity: 'success' });
        } catch (error) {
            console.error('Error saving event:', error);
            setSnackbar({ open: true, message: 'Failed to save event', severity: 'error' });
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
            setSnackbar({ open: true, message: 'Event deleted successfully', severity: 'success' });
        } catch (error) {
            console.error('Error deleting event:', error);
            setSnackbar({ open: true, message: 'Failed to delete event', severity: 'error' });
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
                    const defaultCalendar = calendars.find(cal => cal.type === 'personal') || calendars[0];
                    if (!defaultCalendar) {
                        setSnackbar({ open: true, message: 'No calendar available for import', severity: 'error' });
                        return;
                    }

                    const parsedEvents = parseEventsCSV(csvContent, defaultCalendar.id);

                    let successCount = 0;
                    for (const eventData of parsedEvents) {
                        try {
                            await setEvent(null, {
                                ...eventData,
                                createdBy: session?.user?.email || '',
                                createdAt: new Date().toISOString(),
                                lastModified: new Date().toISOString()
                            } as ScheduleEvent);
                            successCount++;
                        } catch (err) {
                            console.error('Error importing event:', err);
                        }
                    }

                    await loadCalendarsAndEvents();
                    setSnackbar({
                        open: true,
                        message: `Successfully imported ${successCount} of ${parsedEvents.length} events`,
                        severity: successCount === parsedEvents.length ? 'success' : 'warning'
                    });
                } catch (error) {
                    console.error('Error parsing CSV:', error);
                    setSnackbar({ open: true, message: 'Failed to parse CSV file', severity: 'error' });
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleExportCSV = () => {
        const csv = exportEventsToCSV(filteredEvents);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `events_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setSnackbar({ open: true, message: 'Events exported successfully', severity: 'success' });
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
            setSelectedCalendarIds(calendars.map(cal => cal.id));
        }
    };

    const handleCreateNewCalendar = async () => {
        if (!newCalendarName.trim()) {
            setSnackbar({ open: true, message: 'Calendar name is required', severity: 'error' });
            return;
        }

        try {
            // Build permissions array
            const permissions: any[] = [
                {
                    userEmail: session?.user?.email || '',
                    canView: true,
                    canEdit: true,
                    canDelete: true
                }
            ];

            // Add additional people from the input
            newCalendarPermissions.forEach((item: any) => {
                let email = '';
                if (typeof item === 'string') {
                    email = item;
                } else if (item && typeof item === 'object' && item.email) {
                    email = item.email;
                }

                if (email && email.includes('@')) {
                    permissions.push({
                        userEmail: email.trim().toLowerCase(),
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
                ownerId: session?.user?.email || '',
                createdBy: session?.user?.email || '',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                permissions: permissions,
                isVisible: true,
                isDefault: false
            };

            const { setCalendar } = await import('../utils/firebase/firestore');
            const calendarId = await setCalendar(null, newCalendar as CalendarType);

            await loadCalendarsAndEvents();
            setOpenNewCalendarDialog(false);
            setNewCalendarName('');
            setNewCalendarDescription('');
            setNewCalendarColor(DEFAULT_CALENDAR_COLORS[0]);
            setNewCalendarPermissions([]);
            setSnackbar({ open: true, message: 'Calendar created successfully', severity: 'success' });

            return calendarId;
        } catch (error) {
            console.error('Error creating calendar:', error);
            setSnackbar({ open: true, message: 'Failed to create calendar', severity: 'error' });
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
        const email = session?.user?.email;

        if (role === 'admin' || role === 'developer') {
            return calendars; // Can add to any calendar
        }

        return calendars.filter(cal => {
            if (cal.type === 'personal' && cal.ownerId === email) return true;
            if (cal.type === 'group') return true; // Students/editors can add to group calendars
            return false;
        });
    }, [calendars, session?.user?.role, session?.user?.email]);

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
                                <Button variant="contained" color="secondary" startIcon={<AddCircle />} onClick={() => setOpenNewCalendarDialog(true)}>
                                    New Calendar
                                </Button>
                            )}
                            <Button variant="outlined" startIcon={<Upload />} onClick={handleImportCSV}>
                                Import CSV
                            </Button>
                            <Button variant="outlined" startIcon={<Download />} onClick={handleExportCSV} disabled={filteredEvents.length === 0}>
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
                                                    indeterminate={selectedCalendarIds.length > 0 && selectedCalendarIds.length < calendars.length}
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
                                    options={["scheduled", "confirmed", "cancelled", "completed", "rescheduled"] as EventStatus[]}
                                    value={filterStatuses}
                                    onChange={(_, v) => setFilterStatuses(v)}
                                    renderInput={(params) => <TextField {...params} size="small" label="Status" />}
                                    sx={{ minWidth: 180 }}
                                />
                                <IconButton aria-label="toggle view" onClick={() => setTabValue(v => (v === 0 ? 1 : 0))}>
                                    {tabValue === 0 ? <ViewList /> : <CalendarToday />}
                                </IconButton>
                            </Box>                        {/* Calendar view content */}
                            <Box>
                                {tabValue === 0 ? (
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Typography variant="h6">Calendar View</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                                                <CalendarComponent
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
                                                            ? `Events from ${format(selectedRange.start, 'MMM d')} to ${format(selectedRange.end, 'MMM d')}`
                                                            : `Events on ${selectedDate ? selectedDate.toLocaleDateString() : '—'}`
                                                        }
                                                    </Typography>
                                                    {loading ? (
                                                        <Typography variant="body2" color="text.secondary">Loading events...</Typography>
                                                    ) : selectedDate || selectedRange ? (
                                                        filteredEvents.length > 0 ? (
                                                            <AnimatedList variant="slideUp" staggerDelay={40}>
                                                                {filteredEvents.map(ev => {
                                                                    const canEdit = canModifyEvent(ev, session?.user?.email, session?.user?.role);
                                                                    const eventCalendar = calendars.find(cal => cal.id === ev.calendarId);
                                                                    return (
                                                                        <EventCard
                                                                            key={ev.id}
                                                                            event={ev}
                                                                            calendar={eventCalendar}
                                                                            onEdit={canEdit ? () => handleOpenDialog(ev) : undefined}
                                                                            onDelete={canEdit ? () => handleDeleteClick(ev) : undefined}
                                                                        />
                                                                    );
                                                                })}
                                                            </AnimatedList>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">No events for this selection.</Typography>
                                                        )
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">Select a date or range to see events.</Typography>
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
                                                    const canEdit = canModifyEvent(event, session?.user?.email, session?.user?.role);
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
                                        renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add or select tags..." />}
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

                        {/* Snackbar for notifications */}
                        <Snackbar
                            open={snackbar.open}
                            autoHideDuration={6000}
                            onClose={() => setSnackbar({ ...snackbar, open: false })}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        >
                            <Alert
                                onClose={() => setSnackbar({ ...snackbar, open: false })}
                                severity={snackbar.severity}
                                sx={{ width: '100%' }}
                            >
                                {snackbar.message}
                            </Alert>
                        </Snackbar>

                        {/* Calendar Date Range Dialog */}
                        <CalendarComponent
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
                                        <Autocomplete
                                            multiple
                                            freeSolo
                                            options={allUsers}
                                            value={newCalendarPermissions}
                                            onChange={(_, v) => setNewCalendarPermissions(v)}
                                            getOptionLabel={(option) => {
                                                if (typeof option === 'string') return option;
                                                return option.email || '';
                                            }}
                                            renderOption={(props, option) => {
                                                if (typeof option === 'string') {
                                                    return <li {...props}>{option}</li>;
                                                }
                                                const fullName = [option.prefix, option.firstName, option.middleName, option.lastName, option.suffix]
                                                    .filter(Boolean)
                                                    .join(' ');
                                                return (
                                                    <li {...props}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                            <Avatar
                                                                email={option.email}
                                                                initials={[Name.FIRST, Name.LAST]}
                                                                size="small"
                                                            />
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                    {fullName || option.email}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
