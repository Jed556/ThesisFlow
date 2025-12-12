import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import type { ScheduleEvent, Calendar as CalendarType } from '../../types/schedule';
import EventCard from './EventCard';
import { AnimatedList } from '../Animate';

/**
 * Props for the EventsRail component
 */
interface EventsRailProps {
    /** Array of events to display */
    events: (ScheduleEvent & { id: string })[];
    /** All available calendars for mapping events */
    calendars: CalendarType[];
    /** Selected date for single day view */
    selectedDate?: Date;
    /** Selected range for range view */
    selectedRange?: { start: Date; end: Date } | null;
    /** Whether data is loading */
    loading?: boolean;
    /** Function to find the calendar an event belongs to */
    findEventCalendar: (event: ScheduleEvent, calendars: CalendarType[]) => CalendarType | undefined;
    /** Callback when edit is clicked */
    onEdit?: (event: ScheduleEvent & { id: string }) => void;
    /** Callback when delete is clicked */
    onDelete?: (event: ScheduleEvent & { id: string }) => void;
    /** Function to check if user can modify an event */
    canModifyEvent?: (event: ScheduleEvent & { id: string }) => boolean;
}

/**
 * EventsRail - Shows events for a selected date or range with scrollable body
 * and sticky header. Similar pattern to SubmissionsRail.
 */
export const EventsRail: React.FC<EventsRailProps> = ({
    events,
    calendars,
    selectedDate,
    selectedRange,
    loading = false,
    findEventCalendar,
    onEdit,
    onDelete,
    canModifyEvent,
}) => {
    // Build the title based on selection
    const title = React.useMemo(() => {
        if (selectedRange) {
            return `Events from ${format(selectedRange.start, 'MMM d')} to ${format(selectedRange.end, 'MMM d, yyyy')}`;
        }
        if (selectedDate) {
            return `Events on ${format(selectedDate, 'MMMM d, yyyy')}`;
        }
        return 'Events';
    }, [selectedDate, selectedRange]);

    // Build subtitle with event count
    const subtitle = React.useMemo(() => {
        if (loading) return 'Loading events...';
        if (!selectedDate && !selectedRange) return 'Select a date or range to see events';
        if (events.length === 0) return 'No events for this selection';
        return `${events.length} event${events.length !== 1 ? 's' : ''}`;
    }, [events.length, loading, selectedDate, selectedRange]);

    return (
        <Stack
            sx={{
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
            }}
        >
            {/* Sticky Header */}
            <Box
                sx={{
                    flexShrink: 0,
                    pb: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {subtitle}
                </Typography>
            </Box>

            {/* Scrollable Body */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pt: 1.5,
                }}
            >
                {loading ? (
                    <Typography variant="body2" color="text.secondary">
                        Loading events...
                    </Typography>
                ) : !selectedDate && !selectedRange ? (
                    <Typography variant="body2" color="text.secondary">
                        Select a date or range to see events.
                    </Typography>
                ) : events.length > 0 ? (
                    <AnimatedList variant="slideUp" staggerDelay={40}>
                        {events.map(event => {
                            const eventCalendar = findEventCalendar(event, calendars);
                            const canEdit = canModifyEvent ? canModifyEvent(event) : false;
                            return (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    calendar={eventCalendar}
                                    onEdit={canEdit && onEdit ? () => onEdit(event) : undefined}
                                    onDelete={canEdit && onDelete ? () => onDelete(event) : undefined}
                                />
                            );
                        })}
                    </AnimatedList>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        No events for this selection.
                    </Typography>
                )}
            </Box>
        </Stack>
    );
};

export default EventsRail;
