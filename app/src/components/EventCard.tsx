import * as React from 'react';
import { Box, Card, CardContent, Typography, Chip, Stack } from '@mui/material';
import { AccessTime, LocationOn, Visibility, NotificationImportant, School, Book, Slideshow, Assignment, Groups, Event } from '@mui/icons-material';
import Avatar, { Name } from './Avatar';
import { getDisplayName, getProfile } from '../utils/dbUtils';
import type { ScheduleEvent, EventType, EventStatus } from '../types/schedule';

const defaultEventColor = '#bdbdbd';
const statusColors: Record<EventStatus, string> = {
    scheduled: '#2196f3',
    confirmed: '#4caf50',
    cancelled: '#757575',
    completed: '#388e3c',
    rescheduled: '#ff9800'
};

const eventTypeIcons: Record<EventType, React.ReactElement> = {
    meeting: <Groups fontSize="small" />,
    deadline: <Assignment fontSize="small" />,
    defense: <School fontSize="small" />,
    presentation: <Slideshow fontSize="small" />,
    consultation: <Event fontSize="small" />,
    lecture: <Book fontSize="small" />,
    submission: <Assignment fontSize="small" />,
    holiday: <Event fontSize="small" />,
    other: <Event fontSize="small" />
};

export default function EventCard({ event }: { event: ScheduleEvent }) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const isToday = startDate.toDateString() === new Date().toDateString();
    const isPast = startDate < new Date();
    const isUpcoming = startDate > new Date() && startDate.getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;

    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <Card
            sx={{
                mb: 2,
                borderLeft: `4px solid ${event.color || defaultEventColor}`,
                opacity: isPast && event.status !== 'completed' ? 0.7 : 1,
                backgroundColor: isToday ? 'action.hover' : 'background.paper'
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        {eventTypeIcons[event.type]}
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>{event.title}</Typography>
                        {isToday && <Chip label="Today" size="small" color="primary" />}
                        {isUpcoming && <Chip label="Upcoming" size="small" color="warning" />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={event.status} size="small" sx={{ backgroundColor: statusColors[event.status], color: 'white' }} />
                        <Chip label={event.status} size="small" sx={{ backgroundColor: statusColors[event.status], color: 'white' }} />
                    </Box>
                </Box>

                {event.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{event.description}</Typography>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2">
                                {formatDate(startDate)}
                                {!event.isAllDay && <> at {formatTime(startDate)} - {formatTime(endDate)}</>}
                                {event.isAllDay && <> (All Day)</>}
                            </Typography>
                        </Box>

                        {event.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationOn fontSize="small" color="action" />
                                <Typography variant="body2">
                                    {event.location.name}
                                    {event.location.room && ` - ${event.location.room}`}
                                    {event.location.type === 'virtual' && event.location.platform && ` (${event.location.platform})`}
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Visibility fontSize="small" color="action" />
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{event.visibility.replace('-', ' ')}</Typography>
                        </Box>
                    </Box>
                </Stack>

                {event.tags && event.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {event.tags.map((tag, index) => (
                            <Chip key={index} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                        ))}
                    </Box>
                )}

                {event.participants.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Participants ({event.participants.length}):</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {event.participants.slice(0, 5).map((participant, index) => (
                                <Avatar
                                    key={index}
                                    email={participant.email}
                                    initials={[Name.FIRST]}
                                    size="medium"
                                    tooltipText={`${getDisplayName(participant.email)} (${participant.role})`}
                                    sx={{ ...(participant.status === 'declined' && { opacity: 0.5 }) }}
                                />
                            ))}
                            {event.participants.length > 5 && (
                                <Avatar name={`+${event.participants.length - 5}`} size="medium" sx={{ fontSize: '0.75rem' }} />
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
