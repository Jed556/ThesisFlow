import * as React from 'react';
import { Box, IconButton, Button, ToggleButton, ToggleButtonGroup, Typography, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNew, ArrowForwardIos } from '@mui/icons-material';
import type { ScheduleEvent } from '../../types/schedule';
import { isSameDay, isInRange, startOfMonth, endOfMonth, addDays } from '../../utils/dateUtils';

/**
 * Props for the Calendar component
 */
interface CalendarProps {
    /**
     * Array of schedule events to display
     */
    events: ScheduleEvent[];
    /**
     * Currently selected date
     */
    selected?: Date;
    /**
     * Callback when a date is selected
     * @param date - Selected date or undefined if deselected
     */
    onSelect?: (date?: Date) => void;
    /**
     * Callback when an event is clicked
     * @param event - The clicked schedule event
     */
    onEventClick?: (event: ScheduleEvent) => void;
    /**
     * Callback when a date range is selected (in range mode)
     * @param range - Object with optional from and to dates
     * If only from is set, the range is in-progress
     */
    onRangeSelect?: (range: { from?: Date; to?: Date }) => void;
}

/**
 * Interactive calendar
 * @param events - Array of schedule events
 * @param selected - Currently selected date
 * @param onSelect - Callback when a date is selected
 * @param onEventClick - Callback when an event is clicked
 * @param onRangeSelect - Callback when a date range is selected
 * @returns 
 */
export default function Calendar({ events, selected, onSelect, onEventClick, onRangeSelect }: CalendarProps) {
    // Map events by date string for quick lookup
    const eventDays = React.useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        events.forEach(ev => {
            const d = new Date(ev.startDate).toDateString();
            if (!map.has(d)) map.set(d, []);
            map.get(d)!.push(ev);
        });
        return map;
    }, [events]);

    // UI state
    const [mode, setMode] = React.useState<'single' | 'range'>('single');
    const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(new Date()));
    const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({});
    const [dragging, setDragging] = React.useState<'none' | 'start' | 'end'>('none');

    // Notify parent of range changes
    React.useEffect(() => onRangeSelect?.(range), [range, onRangeSelect]);

    // End dragging on pointer up globally
    React.useEffect(() => {
        const onUp = () => setDragging('none');
        window.addEventListener('pointerup', onUp);
        return () => window.removeEventListener('pointerup', onUp);
    }, []);

    /**
     * Builds a calendar matrix for the given month
     * @param month - Month to build matrix for
     * @returns Array of weeks, each week is an array of days
     */
    function buildMatrix(month: Date) {
        const first = startOfMonth(month);
        const last = endOfMonth(month);
        // Start from Sunday before or equal to first
        const start = addDays(first, -first.getDay());
        const matrix: Date[][] = [];
        let cursor = start;
        for (let week = 0; week < 6; week++) {
            const days: Date[] = [];
            for (let i = 0; i < 7; i++) {
                days.push(cursor);
                cursor = addDays(cursor, 1);
            }
            matrix.push(days);
            // stop early if we've passed the month
            if (cursor.getFullYear() > last.getFullYear() || (cursor.getFullYear() === last.getFullYear() && cursor.getMonth() > last.getMonth())) break;
        }
        return matrix;
    }

    const matrix = React.useMemo(() => buildMatrix(viewMonth), [viewMonth]);

    // We'll render the weekday header and all day cells inside the same CSS grid
    // so the columns align perfectly and resizing doesn't cause jitter.
    // Range "pill" backgrounds are rendered as grid-spanning elements (no pixel
    // measurement required).


    /**
     * Handles click events on a day cell
     * @param date - Date that was clicked
     * @returns 
     */
    function handleDayClick(date: Date) {
        if (mode === 'single') {
            onSelect?.(date);
            return;
        }
        // Range mode: clicks set from/to
        const from = range.from;
        const to = range.to;
        if (!from || (from && to)) {
            setRange({ from: date, to: undefined });
            return;
        }
        if (from && !to) {
            if (date.getTime() < from.getTime()) setRange({ from: date, to: from });
            else setRange({ from, to: date });
        }
    }

    /**
     * Handles pointer down events on the start or end of the range
     * @param which - Which endpoint is being dragged
     */
    function handleEndpointPointerDown(which: 'start' | 'end') {
        setDragging(which);
    }

    /**
     * Handles pointer enter events on a day cell
     * @param date - Date being hovered over
     */
    function handlePointerEnterDay(date: Date) {
        if (dragging === 'none') return;
        const curFrom = range.from;
        const curTo = range.to;
        if (dragging === 'start') {
            let newFrom = date;
            let newTo = curTo || date;
            if (newFrom.getTime() > newTo.getTime()) [newFrom, newTo] = [newTo, newFrom];
            setRange({ from: newFrom, to: newTo });
        } else if (dragging === 'end') {
            let newTo = date;
            let newFrom = curFrom || date;
            if (newFrom.getTime() > newTo.getTime()) [newFrom, newTo] = [newTo, newFrom];
            setRange({ from: newFrom, to: newTo });
        }
    }

    // No pixel-measurement required; range segments will be rendered using
    // grid column spans so they align perfectly with header columns.

    const calendarGridBoxSize = 46;
    const calendarGridPadding = '0.2rem';

    return (
        <Box sx={{ width: 'max-content' }}>
            <Paper sx={{ p: 2 }} elevation={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                    <Box>
                        <Typography variant="h6">{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
                            <ToggleButton value="single">Single</ToggleButton>
                            <ToggleButton value="range">Range</ToggleButton>
                        </ToggleButtonGroup>
                        <IconButton onClick={() => setViewMonth(addDays(viewMonth, -30))} size="small"><ArrowBackIosNew fontSize="small" /></IconButton>
                        <IconButton onClick={() => setViewMonth(addDays(viewMonth, 30))} size="small"><ArrowForwardIos fontSize="small" /></IconButton>
                    </Box>
                </Box>

                {/* Calendar grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                    {/* Day header */}
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <Box key={d} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, p: 0 }}>
                            <Typography variant="caption" sx={{ lineHeight: 1 }}>{d}</Typography>
                        </Box>
                    ))}

                    {/* Weeks */}
                    {matrix.map((week, wi) => {
                        // For each week we render segments as grid-spanning background elements
                        // followed by the 7 day cells. Each segment is placed on grid row (wi + 2)
                        // because header occupies row 1.
                        const calendarGridButtonSize = calendarGridBoxSize - 10;
                        return (
                            <React.Fragment key={wi}>
                                {(() => {
                                    const segs: Array<{ start: number; end: number }> = [];
                                    let inSeg = false;
                                    let segStart = 0;
                                    week.forEach((d, idx) => {
                                        const dayVal = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                                        const from = range.from ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime() : undefined;
                                        const to = range.to ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate()).getTime() : undefined;
                                        const isIn = (from !== undefined && to !== undefined && dayVal >= Math.min(from, to) && dayVal <= Math.max(from, to));
                                        if (isIn && !inSeg) { inSeg = true; segStart = idx; }
                                        if (!isIn && inSeg) { inSeg = false; segs.push({ start: segStart, end: idx - 1 }); }
                                    });
                                    if (inSeg) segs.push({ start: segStart, end: 6 });
                                    return segs.map((s, i) => {
                                        // NOTE: Calculate margins to align segment with circular buttons
                                        // Button width = 36px, cell padding = 0.5rem (8px), gap = 0.5 (4px)
                                        // Each cell is (36 + 2*8) = 52px wide
                                        // Segment should start at left edge of first button and end at right edge of last button
                                        // Left & Right margin: move inward by padding amount (8px)

                                        return (
                                            <Box
                                                key={`seg-${wi}-${i}`}
                                                sx={(theme) => ({
                                                    gridColumn: `${s.start + 1} / ${s.end + 2}`,
                                                    gridRow: wi + 2,
                                                    alignSelf: 'center',
                                                    height: calendarGridButtonSize,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                                                    borderRadius: '50rem',
                                                    zIndex: 0,
                                                    pointerEvents: 'none',
                                                    // Use margin to inset the segment to match button edges
                                                    marginLeft: calendarGridPadding,
                                                    marginRight: calendarGridPadding,
                                                })}
                                            />
                                        );
                                    });
                                })()}

                                {/* Days in week */}
                                {week.map((day) => {
                                    const inMonth = day.getMonth() === viewMonth.getMonth();
                                    const key = day.toDateString();
                                    const todaysEvents = eventDays.get(key) || [];
                                    const isStart = range.from && isSameDay(range.from, day);
                                    const isEnd = range.to && isSameDay(range.to, day);
                                    const inR = isInRange(day, range);
                                    const isSelectedSingle = mode === 'single' && selected && isSameDay(selected, day);
                                    const isEndpointInRange = mode === 'range' && (isStart || isEnd);
                                    const isActive = isSelectedSingle || isEndpointInRange;
                                    return (
                                        <Box
                                            key={key}
                                            sx={{ p: calendarGridPadding, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative', gridRow: wi + 2, gridColumn: (day.getDay() + 1) }}
                                        >
                                            <Button
                                                onClick={() => handleDayClick(day)}
                                                onPointerEnter={() => handlePointerEnterDay(day)}
                                                onPointerDown={(e) => {
                                                    if (mode === 'range') {
                                                        if (isStart) { e.preventDefault(); handleEndpointPointerDown('start'); }
                                                        else if (isEnd) { e.preventDefault(); handleEndpointPointerDown('end'); }
                                                    }
                                                }}
                                                // Show filled/contained when selected in single mode or when this day is a range endpoint.
                                                variant={isActive ? 'contained' : 'text'}
                                                sx={(theme) => ({
                                                    minWidth: calendarGridButtonSize,
                                                    width: calendarGridButtonSize,
                                                    height: calendarGridButtonSize,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    // Fill the button for single-selected day or range endpoints; interior in-range days remain unfilled.
                                                    bgcolor: isActive ? theme.palette.primary.main : undefined,
                                                    color: isActive ? theme.palette.primary.contrastText : (inMonth ? undefined : theme.palette.text.disabled),
                                                    borderRadius: '50%',
                                                    p: 0,
                                                    boxSizing: 'border-box',
                                                    '&:hover': { bgcolor: isSelectedSingle ? theme.palette.primary.dark : undefined }
                                                })}
                                            >
                                                <Typography variant="body2" sx={{ lineHeight: 1 }}>{day.getDate()}</Typography>
                                            </Button>

                                            {/* Event badge inside the button container (absolute so it doesn't affect layout) */}
                                            {todaysEvents.length > 0 && (
                                                <Box sx={{ position: 'absolute', right: 2, top: 10, zIndex: 2 }}>
                                                    <Box sx={(theme) => ({ width: 10, height: 10, borderRadius: '50%', backgroundColor: todaysEvents[0].color || theme.palette.primary.main, boxShadow: `0 0 0 3px ${alpha(theme.palette.background.default, 0.06)}` })} />
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </React.Fragment>
                        )
                    })}
                </Box>
            </Paper>
        </Box>
    );
}
