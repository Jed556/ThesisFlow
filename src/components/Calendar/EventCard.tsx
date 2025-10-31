import * as React from 'react';
import { Box, Card, CardContent, Typography, Chip, Stack, IconButton, Skeleton } from '@mui/material';
import { AccessTime, LocationOn, CalendarMonth, Monitor, Edit, Delete } from '@mui/icons-material';
import type { ScheduleEvent, EventStatus, Calendar as CalendarType } from '../../types/schedule';
import { getDisplayName, getProfile } from '../../utils/dbUtils';
import { Avatar, Name } from '../Avatar';

const defaultEventColor = '#bdbdbd';
const statusColors: Record<EventStatus, string> = {
    scheduled: '#2196f3',
    confirmed: '#4caf50',
    cancelled: '#757575',
    completed: '#388e3c',
    rescheduled: '#ff9800'
};

export default function EventCard({
    event,
    calendar,
    onEdit,
    onDelete,
    loading = false
}: {
    event: ScheduleEvent;
    calendar?: CalendarType;
    onEdit?: () => void;
    onDelete?: () => void;
    loading?: boolean;
}) {
    const startDate = event?.startDate ? new Date(event.startDate) : new Date();
    const endDate = event?.endDate ? new Date(event.endDate) : new Date(event.startDate || Date.now());
    const isToday = startDate.toDateString() === new Date().toDateString();
    const isPast = startDate < new Date();

    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <Card
            sx={{
                mb: 2,
                borderLeft: `4px solid ${loading ? '#bdbdbd' : (calendar?.color || event.color || defaultEventColor)}`,
                opacity: loading ? 1 : (isPast && event.status !== 'completed' ? 0.7 : 1),
                backgroundColor: loading ? 'background.paper' : (isToday ? 'action.hover' : 'background.paper'),
                transition: (theme) =>
                    theme.transitions.create(['transform', 'box-shadow'], {
                        duration: theme.transitions.duration.short,
                        easing: theme.transitions.easing.easeInOut,
                    }),
                '&:hover': {
                    transform: 'translateX(4px)',
                    boxShadow: (theme) => theme.shadows[6],
                },
            }}
        >
            <CardContent>
                {/* Header with title and status */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        {loading ? <Skeleton variant="circular" width={20} height={20} /> : <CalendarMonth fontSize="small" />}
                        {loading ? (
                            <Skeleton variant="text" width="40%" height={28} />
                        ) : (
                            <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>{event.title}</Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {loading ? (
                            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                        ) : (
                            <Chip label={event.status} size="small" sx={{ backgroundColor: statusColors[event.status], color: 'white' }} />
                        )}
                        {!loading && onEdit && (
                            <IconButton size="small" onClick={onEdit} sx={{ ml: 0.5 }}>
                                <Edit fontSize="small" />
                            </IconButton>
                        )}
                        {!loading && onDelete && (
                            <IconButton size="small" onClick={onDelete} sx={{ ml: 0 }}>
                                <Delete fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                </Box>

                {/* Description */}
                {loading ? (
                    <Skeleton variant="text" width="90%" height={20} sx={{ mb: 2 }} />
                ) : (
                    event.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{event.description}</Typography>
                )}

                <Stack spacing={1.5} sx={{ mb: 2 }}>
                    {/* Time information */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {loading ? (
                            <>
                                <Skeleton variant="circular" width={20} height={20} />
                                <Skeleton variant="text" width="60%" height={20} />
                            </>
                        ) : (
                            <>
                                <AccessTime fontSize="small" color="action" />
                                <Typography variant="body2">
                                    {formatDate(startDate)}
                                    {!event.isAllDay && <> at {formatTime(startDate)} - {formatTime(endDate)}</>}
                                    {event.isAllDay && <> (All Day)</>}
                                </Typography>
                            </>
                        )}
                    </Box>

                    {/* Location information */}
                    {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Skeleton variant="circular" width={20} height={20} />
                            <Skeleton variant="text" width="50%" height={20} />
                        </Box>
                    ) : (
                        event.location && (
                            <>
                                {(event.location.type === 'physical' || event.location.type === 'hybrid') && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LocationOn fontSize="small" color="action" />
                                        <Typography variant="body2">
                                            {event.location.address && event.location.room
                                                ? `${event.location.address} - Room ${event.location.room}`
                                                : event.location.address || `Room ${event.location.room}` || 'Physical location'
                                            }
                                        </Typography>
                                    </Box>
                                )}
                                {(event.location.type === 'virtual' || event.location.type === 'hybrid') && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Monitor fontSize="small" color="action" />
                                        <Typography variant="body2">
                                            {event.location.platform && event.location.url
                                                ? `${event.location.platform}: ${event.location.url}`
                                                : event.location.platform || event.location.url || 'Virtual meeting'
                                            }
                                        </Typography>
                                    </Box>
                                )}
                            </>
                        )
                    )}

                    {/* Calendar information */}
                    {!loading && calendar && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 1,
                                    backgroundColor: calendar.color
                                }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                Calendar: {calendar.name}
                            </Typography>
                        </Box>
                    )}
                </Stack>

                {/* Tags */}
                {loading ? (
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                        <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 2 }} />
                    </Box>
                ) : (
                    Array.isArray(event.tags) && event.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                            {event.tags.map((tag, index) => (
                                <Chip key={index} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                            ))}
                        </Box>
                    )
                )}

                {/* Participants with embedded skeleton in Avatar */}
                {loading ? (
                    <Box sx={{ mt: 2 }}>
                        <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Skeleton variant="circular" width={32} height={32} />
                            <Skeleton variant="circular" width={32} height={32} />
                            <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                    </Box>
                ) : (
                    Array.isArray(event.participants) && event.participants.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Participants ({event.participants.length}):</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {event.participants.slice(0, 5).map((participant, index) => (
                                    <Avatar
                                        key={index}
                                        email={participant?.email}
                                        initials={[Name.FIRST]}
                                        size="medium"
                                        tooltipText={`${getDisplayName(participant?.email)} (${participant?.role})`}
                                        sx={{ ...(participant?.status === 'declined' && { opacity: 0.5 }) }}
                                    />
                                ))}
                                {event.participants.length > 5 && (
                                    <Avatar name={`+${event.participants.length - 5}`} size="medium" sx={{ fontSize: '0.75rem' }} />
                                )}
                            </Box>
                        </Box>
                    )
                )}
            </CardContent>
        </Card>
    );
}
