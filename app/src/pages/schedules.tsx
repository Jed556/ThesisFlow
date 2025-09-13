import * as React from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Grid, Button, IconButton, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, TextField, Stack, Tooltip, Badge, Divider, List,
    ListItem, ListItemText, ListItemAvatar
} from '@mui/material';
import {
    CalendarToday, Event, Schedule, FilterList, ViewModule, ViewList, ViewWeek, AccessTime, LocationOn, People,
    PriorityHigh, Visibility, NotificationImportant, CheckCircle, Cancel, Warning, School, Book, Slideshow, Assignment,
    Groups, BeachAccess
} from '@mui/icons-material';
import Avatar, { Name } from '../components/Avatar';
import type { NavigationItem } from '../types/navigation';
import type { ScheduleEvent, EventType, EventPriority, EventStatus, CalendarView } from '../types/schedule';
import { mockScheduleEvents, mockAcademicCalendar } from '../data/mockScheduleData';

export const metadata: NavigationItem = {
    title: 'Schedules',
    segment: 'schedules',
    icon: <CalendarToday />,
    group: 'main',
    index: 2,
};

// Event type icons mapping
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

// Event priority colors
const priorityColors: Record<EventPriority, string> = {
    low: '#4caf50',
    medium: '#ff9800',
    high: '#f44336',
    critical: '#9c27b0'
};

// Event status colors
const statusColors: Record<EventStatus, string> = {
    scheduled: '#2196f3',
    confirmed: '#4caf50',
    cancelled: '#757575',
    completed: '#388e3c',
    rescheduled: '#ff9800'
};

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`schedule-tabpanel-${index}`}
            aria-labelledby={`schedule-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

function EventCard({ event }: { event: ScheduleEvent }) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const isToday = startDate.toDateString() === new Date().toDateString();
    const isPast = startDate < new Date();
    const isUpcoming = startDate > new Date() && startDate.getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000; // Within 7 days

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <Card
            sx={{
                mb: 2,
                borderLeft: `4px solid ${event.color || priorityColors[event.priority]}`,
                opacity: isPast && event.status !== 'completed' ? 0.7 : 1,
                backgroundColor: isToday ? 'action.hover' : 'background.paper'
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        {eventTypeIcons[event.type]}
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                            {event.title}
                        </Typography>
                        {isToday && <Chip label="Today" size="small" color="primary" />}
                        {isUpcoming && <Chip label="Upcoming" size="small" color="warning" />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                            label={event.priority}
                            size="small"
                            sx={{
                                backgroundColor: priorityColors[event.priority],
                                color: 'white',
                                fontWeight: 'bold'
                            }}
                        />
                        <Chip
                            label={event.status}
                            size="small"
                            sx={{
                                backgroundColor: statusColors[event.status],
                                color: 'white'
                            }}
                        />
                    </Box>
                </Box>

                {event.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {event.description}
                    </Typography>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2">
                                {formatDate(startDate)}
                                {!event.isAllDay && (
                                    <> at {formatTime(startDate)} - {formatTime(endDate)}</>
                                )}
                                {event.isAllDay && <> (All Day)</>}
                            </Typography>
                        </Box>

                        {event.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationOn fontSize="small" color="action" />
                                <Typography variant="body2">
                                    {event.location.name}
                                    {event.location.room && ` - ${event.location.room}`}
                                    {event.location.type === 'virtual' && event.location.platform &&
                                        ` (${event.location.platform})`
                                    }
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <People fontSize="small" color="action" />
                            <Typography variant="body2">
                                {event.participants.length} participant{event.participants.length !== 1 ? 's' : ''}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Visibility fontSize="small" color="action" />
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {event.visibility.replace('-', ' ')}
                            </Typography>
                        </Box>
                    </Box>
                </Stack>

                {event.tags && event.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {event.tags.map((tag, index) => (
                            <Chip
                                key={index}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                            />
                        ))}
                    </Box>
                )}

                {event.participants.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Participants:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {event.participants.slice(0, 5).map((participant, index) => (
                                <Tooltip key={index} title={`${participant.name} (${participant.role})`}>
                                    <Avatar
                                        name={participant.name}
                                        initials={[Name.FIRST]}
                                        size="medium"
                                        sx={{
                                            ...(participant.status === 'declined' && { opacity: 0.5 })
                                        }}
                                    />
                                </Tooltip>
                            ))}
                            {event.participants.length > 5 && (
                                <Avatar
                                    name={`+${event.participants.length - 5}`}
                                    size="medium"
                                    sx={{ fontSize: '0.75rem' }}
                                />
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

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
                                        label={event.priority}
                                        size="small"
                                        color={event.priority === 'critical' ? 'error' :
                                            event.priority === 'high' ? 'warning' : 'default'}
                                    />
                                }
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        name={event.type}
                                        size="medium"
                                        sx={{ bgcolor: event.color || priorityColors[event.priority] }}
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

export default function Schedules() {
    const [tabValue, setTabValue] = React.useState(0);
    const [calendarView, setCalendarView] = React.useState<CalendarView>('month');
    const [filterType, setFilterType] = React.useState<EventType | 'all'>('all');
    const [filterPriority, setFilterPriority] = React.useState<EventPriority | 'all'>('all');
    const [filterStatus, setFilterStatus] = React.useState<EventStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = React.useState('');

    // Filter events based on current filters
    const filteredEvents = React.useMemo(() => {
        return mockScheduleEvents.filter(event => {
            const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesType = filterType === 'all' || event.type === filterType;
            const matchesPriority = filterPriority === 'all' || event.priority === filterPriority;
            const matchesStatus = filterStatus === 'all' || event.status === filterStatus;

            return matchesSearch && matchesType && matchesPriority && matchesStatus;
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [searchTerm, filterType, filterPriority, filterStatus]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Button variant="contained" startIcon={<Event />}>
                    Add Event
                </Button>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab label="Calendar View" icon={<CalendarToday />} iconPosition="start" />
                    <Tab label="List View" icon={<ViewList />} iconPosition="start" />
                    <Tab label="Upcoming" icon={<Schedule />} iconPosition="start" />
                </Tabs>
            </Box>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FilterList />
                        Filters
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Search events"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <FormControl fullWidth size="small">
                            <InputLabel>Event Type</InputLabel>
                            <Select
                                value={filterType}
                                label="Event Type"
                                onChange={(e) => setFilterType(e.target.value as EventType | 'all')}
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                <MenuItem value="meeting">Meeting</MenuItem>
                                <MenuItem value="deadline">Deadline</MenuItem>
                                <MenuItem value="defense">Defense</MenuItem>
                                <MenuItem value="presentation">Presentation</MenuItem>
                                <MenuItem value="lecture">Lecture</MenuItem>
                                <MenuItem value="consultation">Consultation</MenuItem>
                                <MenuItem value="submission">Submission</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel>Priority</InputLabel>
                            <Select
                                value={filterPriority}
                                label="Priority"
                                onChange={(e) => setFilterPriority(e.target.value as EventPriority | 'all')}
                            >
                                <MenuItem value="all">All Priorities</MenuItem>
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                                <MenuItem value="critical">Critical</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filterStatus}
                                label="Status"
                                onChange={(e) => setFilterStatus(e.target.value as EventStatus | 'all')}
                            >
                                <MenuItem value="all">All Statuses</MenuItem>
                                <MenuItem value="scheduled">Scheduled</MenuItem>
                                <MenuItem value="confirmed">Confirmed</MenuItem>
                                <MenuItem value="cancelled">Cancelled</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </CardContent>
            </Card>

            {/* Tab Panels */}
            <TabPanel value={tabValue} index={0}>
                {/* Calendar View */}
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">Calendar View</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    size="small"
                                    variant={calendarView === 'month' ? 'contained' : 'outlined'}
                                    onClick={() => setCalendarView('month')}
                                >
                                    Month
                                </Button>
                                <Button
                                    size="small"
                                    variant={calendarView === 'week' ? 'contained' : 'outlined'}
                                    onClick={() => setCalendarView('week')}
                                >
                                    Week
                                </Button>
                                <Button
                                    size="small"
                                    variant={calendarView === 'day' ? 'contained' : 'outlined'}
                                    onClick={() => setCalendarView('day')}
                                >
                                    Day
                                </Button>
                            </Box>
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            Calendar component would be implemented here with a full calendar library
                            <br />
                            Showing {filteredEvents.length} events
                        </Typography>
                    </CardContent>
                </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
                {/* List View */}
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
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
                {/* Upcoming View */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                    <Box sx={{ flex: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Next 7 Days
                        </Typography>
                        {filteredEvents
                            .filter(event => {
                                const eventDate = new Date(event.startDate);
                                const now = new Date();
                                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                                return eventDate > now && eventDate <= sevenDaysFromNow;
                            })
                            .map(event => (
                                <EventCard key={event.id} event={event} />
                            ))
                        }
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <UpcomingEvents events={mockScheduleEvents} />
                    </Box>
                </Stack>
            </TabPanel>
        </Box>
    );
}