import * as React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';
import type { ScheduleEvent } from '../types/schedule';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

function DayPickerWrapper({ selected, onSelect, modifiers }: { selected?: Date; onSelect: (d?: Date) => void; modifiers?: any }) {
    const eventDaysSet = React.useMemo(() => {
        const s = new Set<string>();
        (modifiers?.hasEvent || []).forEach((d: Date) => s.add(new Date(d).toDateString()));
        return s;
    }, [modifiers]);

    const components = {
        DayContent: ({ date }: { date: Date }) => {
            const key = date.toDateString();
            const has = eventDaysSet.has(key);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div>{date.getDate()}</div>
                    {has && <div style={{ width: 6, height: 6, borderRadius: 6, background: '#1976d2', marginTop: 4 }} />}
                </div>
            );
        }
    };

    const modifiersStyles = {
        hasEvent: {
            position: 'relative' as const,
        }
    };

    const captionLayout = 'dropdown';

    return (
        <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d: Date | undefined) => onSelect(d)}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            components={components as any}
            captionLayout={captionLayout}
        />
    );
}

interface CalendarProps {
    events: ScheduleEvent[];
    selected?: Date;
    onSelect?: (date?: Date) => void;
    onEventClick?: (event: ScheduleEvent) => void;
}

export default function Calendar({ events, selected, onSelect, onEventClick }: CalendarProps) {
    // Build a set of days that have events
    const eventDays = React.useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        events.forEach(ev => {
            const d = new Date(ev.startDate).toDateString();
            if (!map.has(d)) map.set(d, []);
            map.get(d)!.push(ev);
        });
        return map;
    }, [events]);

    const modifiers = React.useMemo(() => {
        const days: Date[] = [];
        eventDays.forEach((_, k) => days.push(new Date(k)));
        return { hasEvent: days };
    }, [eventDays]);

    const selectedKey = selected ? selected.toDateString() : undefined;
    const todaysEvents = selectedKey ? (eventDays.get(selectedKey) || []) : [];

    return (
        <Box>
            <DayPickerWrapper selected={selected} onSelect={onSelect || (() => { })} modifiers={modifiers} />

            <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1">Events</Typography>
                {selected ? (
                    todaysEvents.length > 0 ? (
                        <List>
                            {todaysEvents.map(ev => (
                                <ListItem key={ev.id} component="div" sx={{ cursor: 'pointer' }} onClick={() => onEventClick?.(ev)}>
                                    <ListItemText primary={ev.title} secondary={new Date(ev.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} />
                                    <div style={{ width: 12, height: 12, borderRadius: 6, background: ev.color || '#bdbdbd', marginLeft: 8 }} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography variant="body2" color="text.secondary">No events on this day.</Typography>
                    )
                ) : (
                    <Typography variant="body2" color="text.secondary">Select a date to view events.</Typography>
                )}
            </Box>
        </Box>
    );
}
