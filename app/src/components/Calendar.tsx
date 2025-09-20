import * as React from 'react';
import { Box, Typography, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';
import type { ScheduleEvent } from '../types/schedule';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

function DayPickerWrapper({ selected, onSelect, modifiers }: { selected?: Date; onSelect: (d?: Date) => void; modifiers?: any }) {
    const eventDaysSet = React.useMemo(() => {
        const s = new Set<string>();
        (modifiers?.hasEvent || []).forEach((d: Date) => s.add(new Date(d).toDateString()));
        return s;
    }, [modifiers]);

    // control the displayed month in the DayPicker so we can provide our own
    // MUI-based month/year selectors.
    const [month, setMonth] = React.useState<Date>(() => selected || new Date());

    React.useEffect(() => {
        if (selected) setMonth(selected);
    }, [selected]);

    const components = {
        DayContent: ({ date }: { date: Date }) => {
            const key = date.toDateString();
            const has = eventDaysSet.has(key);
            const isSelected = selected && selected.toDateString() === key;
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Button
                        onClick={() => onSelect?.(date)}
                        disableElevation
                        sx={(theme) => ({
                            minWidth: 0,
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isSelected ? theme.palette.primary.contrastText : theme.palette.text.primary,
                            bgcolor: isSelected ? 'primary.main' : 'transparent',
                            '&:hover': {
                                bgcolor: isSelected ? 'primary.dark' : theme.palette.action.hover,
                            },
                            padding: 0,
                            lineHeight: 1,
                        })}
                        aria-label={`Select ${date.toDateString()}`}
                    >
                        <Box component="span">{date.getDate()}</Box>
                    </Button>
                    {has && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'primary.main', mt: '4px' }} />}
                </Box>
            );
        }
    };

    const modifiersStyles = {
        hasEvent: {
            position: 'relative' as const,
        }
    };

    const monthNames = React.useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }));
    }, []);

    const currentYear = new Date().getFullYear();
    const yearRange = React.useMemo(() => {
        const start = currentYear - 5;
        const end = currentYear + 5;
        const years: number[] = [];
        for (let y = start; y <= end; y++) years.push(y);
        return years;
    }, [currentYear]);

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                <FormControl size="small">
                    <InputLabel id="calendar-month-label">Month</InputLabel>
                    <Select
                        labelId="calendar-month-label"
                        value={month.getMonth()}
                        label="Month"
                        onChange={(e) => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1))}
                    >
                        {monthNames.map((m, i) => (
                            <MenuItem key={m} value={i}>{m}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small">
                    <InputLabel id="calendar-year-label">Year</InputLabel>
                    <Select
                        labelId="calendar-year-label"
                        value={month.getFullYear()}
                        label="Year"
                        onChange={(e) => setMonth(new Date(Number(e.target.value), month.getMonth(), 1))}
                    >
                        {yearRange.map(y => (
                            <MenuItem key={y} value={y}>{y}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            <DayPicker
                mode="single"
                selected={selected}
                onSelect={(d: Date | undefined) => onSelect(d)}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                components={components as any}
                month={month}
                onMonthChange={(m: Date) => setMonth(m)}
            />
        </Box>
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
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: ev.color || 'grey.400', ml: 1 }} />
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
