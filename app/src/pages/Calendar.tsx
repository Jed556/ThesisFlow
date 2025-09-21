import * as React from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Grid, Button, IconButton,
    FormControl, InputLabel, Select, MenuItem, TextField, Stack, Tooltip, Badge, Divider, List,
    ListItem, ListItemText, ListItemAvatar, Autocomplete
} from '@mui/material';
import {
    CalendarToday, Event, Schedule, FilterList, ViewModule, ViewList, ViewWeek, AccessTime, LocationOn, People,
    PriorityHigh, Visibility, NotificationImportant, CheckCircle, Cancel, Warning, School, Book, Slideshow, Assignment,
    Groups, BeachAccess
} from '@mui/icons-material';
import { getDisplayName, getProfile } from '../utils/dbUtils';
import { Avatar, Name } from '../components';
import { EventCard } from '../components';
import { Calendar } from '../components';
import type { NavigationItem } from '../types/navigation';
import type { ScheduleEvent, EventType, EventStatus, CalendarView } from '../types/schedule';
import { mockScheduleEvents, mockAcademicCalendar } from '../data/mockScheduleData';

export const metadata: NavigationItem = {
    title: 'Calendar',
    segment: 'calendar',
    icon: <CalendarToday />,
    group: 'main',
    index: 2,
};

/**
 * Mapping of event types to their corresponding icons
 */
const eventTypeIcons: Record<EventType, React.ReactElement> = {
    meeting: <Groups fontSize="small" />,
    deadline: <Assignment fontSize="small" />,
    defense: <School fontSize="small" />,
    presentation: <Slideshow fontSize="small" />,
    consultation: <People fontSize="small" />,
    lecture: <Book fontSize="small" />,
    submission: <Assignment fontSize="small" />,
    holiday: <BeachAccess fontSize="small" />,
    other: <Event fontSize="small" />
};

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

// Calendar/List toggle and upcoming column are handled in the main component render


/**
 * Upcoming events list component
 * @param events - Array of schedule events
 */
function UpcomingEvents({ events }: { events: ScheduleEvent[] }) {
    const upcomingEvents = events
        .filter(event => new Date(event.startDate) > new Date())
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5);

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NotificationImportant color="primary" />
                    Upcoming Events
                </Typography>
                <List dense>
                    {upcomingEvents.map((event, index) => (
                        <React.Fragment key={event.id}>
                            <ListItem
                                secondaryAction={
                                    <Chip
                                        label={event.status}
                                        size="small"
                                        sx={{ bgcolor: statusColors[event.status], color: 'white' }}
                                    />
                                }
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        name={event.type}
                                        size="medium"
                                        sx={{ bgcolor: event.color || defaultEventColor }}
                                    />
                                </ListItemAvatar>
                                <ListItemText
                                    primary={event.title}
                                    secondary={
                                        <>
                                            {new Date(event.startDate).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })}
                                            {event.location && ` • ${event.location.name}`}
                                        </>
                                    }
                                />
                            </ListItem>
                            {index < upcomingEvents.length - 1 && <Divider variant="inset" component="li" />}
                        </React.Fragment>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}

/**
 * Calendar page for viewing events
 */
export default function CalendarPage() {
    const [tabValue, setTabValue] = React.useState(0);
    const [calendarView, setCalendarView] = React.useState<CalendarView>('month');
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
    const [showUpcoming, setShowUpcoming] = React.useState(true);
    const [filterTypes, setFilterTypes] = React.useState<EventType[]>([]);
    const [filterStatuses, setFilterStatuses] = React.useState<EventStatus[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');

    // Filter events based on current filters
    const filteredEvents = React.useMemo(() => {
        return mockScheduleEvents.filter(event => {
            const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesType = filterTypes.length === 0 || filterTypes.includes(event.type);
            const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(event.status);

            return matchesSearch && matchesType && matchesStatus;
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [searchTerm, filterTypes, filterStatuses]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Button variant="contained" startIcon={<Event />}>
                        Add Event
                    </Button>
                    <TextField size="small" label="Search events" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ minWidth: 240 }} />
                    <Autocomplete
                        multiple
                        options={["meeting", "deadline", "defense", "presentation", "consultation", "lecture", "submission", "holiday", "other"] as EventType[]}
                        value={filterTypes}
                        onChange={(_, v) => setFilterTypes(v)}
                        renderValue={(value: EventType[], getTagProps) =>
                            value.map((option: EventType, index: number) => (
                                <Chip label={option} {...getTagProps({ index })} key={option} />
                            ))
                        }
                        renderInput={(params) => <TextField {...params} size="small" label="Types" />}
                        sx={{ minWidth: 220 }}
                    />
                    <Autocomplete
                        multiple
                        options={["scheduled", "confirmed", "cancelled", "completed", "rescheduled"] as EventStatus[]}
                        value={filterStatuses}
                        onChange={(_, v) => setFilterStatuses(v)}
                        renderValue={(value: EventStatus[], getTagProps) =>
                            value.map((option: EventStatus, index: number) => (
                                <Chip label={option} {...getTagProps({ index })} key={option} />
                            ))
                        }
                        renderInput={(params) => <TextField {...params} size="small" label="Status" />}
                        sx={{ minWidth: 180 }}
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton aria-label="toggle view" onClick={() => setTabValue(v => (v === 0 ? 1 : 0))}>
                        {tabValue === 0 ? <ViewList /> : <CalendarToday />}
                    </IconButton>
                    <Button variant="text" startIcon={<Schedule />} onClick={() => setShowUpcoming(s => !s)}>
                        {showUpcoming ? 'Hide Upcoming' : 'Show Upcoming'}
                    </Button>
                </Box>
            </Box>

            {/* Filters moved into header as chip multi-selects */}

            {/* Main content: two-column layout: main (Calendar or List) + Upcoming (toggleable) */}
            <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: showUpcoming ? '0 1 70%' : '1 1 100%' }}>
                    {tabValue === 0 ? (
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="h6">Calendar View</Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" variant={calendarView === 'month' ? 'contained' : 'outlined'} onClick={() => setCalendarView('month')}>Month</Button>
                                        <Button size="small" variant={calendarView === 'week' ? 'contained' : 'outlined'} onClick={() => setCalendarView('week')}>Week</Button>
                                        <Button size="small" variant={calendarView === 'day' ? 'contained' : 'outlined'} onClick={() => setCalendarView('day')}>Day</Button>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                                    <Box sx={{ width: { xs: '100%', md: '33%' } }}>
                                        <Calendar events={mockScheduleEvents} selected={selectedDate} onSelect={(d) => setSelectedDate(d)} onEventClick={(ev) => setSelectedDate(new Date(ev.startDate))} />
                                        {/* internal view buttons removed to avoid duplication with header controls */}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '67%' } }}>
                                        <Typography variant="subtitle1" gutterBottom>
                                            Events on {selectedDate ? selectedDate.toLocaleDateString() : '—'}
                                        </Typography>
                                        {selectedDate ? (
                                            filteredEvents.filter(ev => {
                                                const d = new Date(ev.startDate);
                                                return d.toDateString() === selectedDate.toDateString();
                                            }).map(ev => (
                                                <EventCard key={ev.id} event={ev} />
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">Select a date to see events.</Typography>
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
                            {filteredEvents.map(event => (
                                <EventCard key={event.id} event={event} />
                            ))}
                            {filteredEvents.length === 0 && (
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

                {showUpcoming && (
                    <Box sx={{ flex: '0 0 30%' }}>
                        <UpcomingEvents events={mockScheduleEvents} />
                    </Box>
                )}
            </Box>
        </Box>
    );
}