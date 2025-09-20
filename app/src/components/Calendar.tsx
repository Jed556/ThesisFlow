import * as React from 'react';
import { Box, IconButton, Button, ToggleButton, ToggleButtonGroup, Typography, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNew, ArrowForwardIos } from '@mui/icons-material';
import type { ScheduleEvent } from '../types/schedule';
import { isSameDay, isInRange, startOfMonth, endOfMonth, addDays } from '../utils/dateUtils';

interface CalendarProps {
    events: ScheduleEvent[];
    selected?: Date;
    onSelect?: (date?: Date) => void;
    onEventClick?: (event: ScheduleEvent) => void;
    onRangeSelect?: (r: { from?: Date; to?: Date }) => void;
}

/**
 * Calendar component for displaying and interacting with schedule events
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

    // Refs and state to measure day cell positions so we can position the
    // rounded "pill" exactly in pixels (robust against grid gaps, borders,
    // and rounding). We'll keep a map of refs by date string.
    const cellRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
    const [segPixelStyles, setSegPixelStyles] = React.useState<Record<string, { left: string; width: string }>>({});


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

    // Compute per-week pixel bounds for the pill segments after layout.
    React.useLayoutEffect(() => {
        // For each week, find segments again and compute pixel left/width from
        // the bounding rects of the start and end day cells. Key by week index
        // so we can lookup styles when rendering.
        const styles: Record<string, { left: string; width: string }> = {};
        matrix.forEach((week, wi) => {
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

            // For each segment compute pixel left/width
            segs.forEach((s, si) => {
                const startDay = week[s.start];
                const endDay = week[s.end];
                const startRef = cellRefs.current.get(startDay.toDateString());
                const endRef = cellRefs.current.get(endDay.toDateString());
                if (startRef && endRef) {
                    const startRect = startRef.getBoundingClientRect();
                    const endRect = endRef.getBoundingClientRect();
                    // The parent week container's left to compute relative px
                    const parent = startRef.parentElement; // the week grid
                    const parentRect = parent ? parent.getBoundingClientRect() : ({ left: 0, width: 0 } as DOMRect);
                    const parentWidth = Math.round(parentRect.width || 0);
                    const bleed = -1.5; // small overlap so pill meets circular buttons visually
                    let leftPx = Math.round(startRect.left - parentRect.left) - bleed;
                    let rightPx = Math.round(endRect.right - parentRect.left) + bleed;
                    // Clamp to parent bounds to avoid overflow/overshoot
                    leftPx = Math.max(0, leftPx);
                    rightPx = Math.min(parentWidth, rightPx);
                    styles[`w${wi}-s${si}`] = { left: `${leftPx}px`, width: `${Math.max(0, rightPx - leftPx)}px` };
                }
            });
        });
        setSegPixelStyles(styles);

        // Recompute on resize / zoom
        const onResize = () => {
            // throttle via rAF
            window.requestAnimationFrame(() => {
                // trigger recompute by re-running effect
                const newStyles: Record<string, { left: string; width: string }> = {};
                matrix.forEach((week, wi) => {
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
                    segs.forEach((s, si) => {
                        const startDay = week[s.start];
                        const endDay = week[s.end];
                        const startRef = cellRefs.current.get(startDay.toDateString());
                        const endRef = cellRefs.current.get(endDay.toDateString());
                        if (startRef && endRef) {
                            const startRect = startRef.getBoundingClientRect();
                            const endRect = endRef.getBoundingClientRect();
                            const parent = startRef.parentElement;
                            const parentRect = parent ? parent.getBoundingClientRect() : ({ left: 0, width: 0 } as DOMRect);
                            const parentWidth = Math.round(parentRect.width || 0);
                            const bleed = 6;
                            let leftPx = Math.round(startRect.left - parentRect.left) - bleed;
                            let rightPx = Math.round(endRect.right - parentRect.left) + bleed;
                            leftPx = Math.max(0, leftPx);
                            rightPx = Math.min(parentWidth, rightPx);
                            newStyles[`w${wi}-s${si}`] = { left: `${leftPx}px`, width: `${Math.max(0, rightPx - leftPx)}px` };
                        }
                    });
                });
                setSegPixelStyles(newStyles);
            });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [matrix, range]);

    return (
        <Paper sx={{ p: 2 }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
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

            {/* Weekday header: use same grid structure and consistent cell height to align with day cells */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, textAlign: 'center', mb: 1 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                    <Box key={d} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, p: 0 }}>
                        <Typography variant="caption" sx={{ lineHeight: 1 }}>{d}</Typography>
                    </Box>
                ))}
            </Box>

            <Box>
                {matrix.map((week, wi) => (
                    <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5, position: 'relative' }}>
                        {/* compute contiguous in-range segments for this week so we can paint a single rounded background behind them */}
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
                                const key = `w${wi}-s${i}`;
                                // Use pixel-measured styles when available; otherwise fall
                                // back to the lightweight calc-based bleed.
                                const px = segPixelStyles[key];
                                const left = px ? px.left : `calc(${(s.start * 100) / 7}% - 6px)`;
                                const width = px ? px.width : `calc(${((s.end - s.start + 1) * 100) / 7}% + 12px)`;
                                return (
                                    <Box
                                        key={`seg-${wi}-${i}`}
                                        sx={(theme) => ({
                                            position: 'absolute',
                                            left,
                                            width,
                                            // center the pill vertically relative to the week row
                                            top: 'calc(50% - 18px)',
                                            height: 36,
                                            bgcolor: alpha(theme.palette.primary.main, 0.18),
                                            borderRadius: '50rem',
                                            zIndex: 0,
                                        })}
                                    />
                                );
                            });
                        })()}

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
                                    ref={(el: HTMLDivElement | null) => {
                                        if (el) cellRefs.current.set(key, el);
                                        else cellRefs.current.delete(key);
                                    }}
                                    sx={{ p: 0, height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}
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
                                            minWidth: 36,
                                            width: 36,
                                            height: 36,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            // Fill the button for single-selected day or range endpoints; interior in-range days remain unfilled.
                                            bgcolor: isActive ? theme.palette.primary.main : undefined,
                                            color: isActive ? theme.palette.primary.contrastText : (inMonth ? undefined : theme.palette.text.disabled),
                                            borderRadius: '50%',
                                            px: 0,
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
                    </Box>
                ))}
            </Box>
        </Paper>
    );
}
