import * as React from 'react';
import {
    Box, IconButton, Button, ToggleButton, ToggleButtonGroup, Typography,
    Paper, Dialog, DialogTitle, DialogContent, DialogActions, Skeleton
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNew, ArrowForwardIos } from '@mui/icons-material';
import type { ScheduleEvent } from '../../types/schedule';
import { isSameDay, isInRange, startOfMonth, endOfMonth, addDays } from '../../utils/dateUtils';

/**
 * Select mode for the calendar
 * - 'day': Single day selection only (hides toggle)
 * - 'range': Range selection only (hides toggle)
 * - 'all': Show toggle to switch between single and range
 */
export type CalendarSelectMode = 'day' | 'range' | 'all';

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
    /**
     * Dialog mode - renders calendar in a centered dialog with backdrop
     */
    dialogMode?: boolean;
    /**
     * Dialog open state (only used when dialogMode is true)
     */
    open?: boolean;
    /**
     * Dialog close handler
     */
    onClose?: () => void;
    /**
     * Dialog title
     */
    dialogTitle?: string;
    /**
     * Select mode - controls whether user can select day, range, or both
     * @default 'all'
     */
    selectMode?: CalendarSelectMode;
    /**
     * Allow deselection in single mode - if true, clicking selected date deselects it
     * @default true
     */
    allowDeselect?: boolean;
    /**
     * Whether the calendar data is still loading
     * @default false
     */
    loading?: boolean;
    /**
     * Size of each calendar day cell in pixels
     * @default 46
     */
    cellSize?: number;
    /**
     * Padding around each calendar day cell (CSS value)
     * @default '0.2rem'
     */
    cellPadding?: string;
}

/**
 * Interactive calendar
 * @param events - Array of schedule events
 * @param selected - Currently selected date
 * @param onSelect - Callback when a date is selected
 * @param onEventClick - Callback when an event is clicked
 * @param onRangeSelect - Callback when a date range is selected
 * @param dialogMode - Render in dialog mode with backdrop
 * @param open - Dialog open state
 * @param onClose - Dialog close handler
 * @param dialogTitle - Title for dialog mode
 * @param selectMode - Selection mode (day, range, or all)
 * @returns 
 */
export default function Calendar({
    events,
    selected,
    onSelect,
    onEventClick,
    onRangeSelect,
    dialogMode = false,
    open = true,
    onClose,
    dialogTitle = 'Select Date',
    selectMode = 'all',
    allowDeselect = true,
    loading = false,
    cellSize = 46,
    cellPadding = '0.2rem'
}: CalendarProps) {
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

    // Determine initial mode based on selectMode
    const getInitialMode = (): 'single' | 'range' => {
        if (selectMode === 'day') return 'single';
        if (selectMode === 'range') return 'range';
        return 'single'; // default for 'all'
    };

    // UI state
    const [mode, setMode] = React.useState<'single' | 'range'>(getInitialMode);
    const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(new Date()));
    const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({});
    const [dragging, setDragging] = React.useState<'none' | 'start' | 'end'>('none');

    // Remember separate contexts for single and range modes
    const [singleModeContext, setSingleModeContext] = React.useState<Date | undefined>(selected);
    const [rangeModeContext, setRangeModeContext] = React.useState<{ from?: Date; to?: Date }>({});

    // Sync with prop when it changes externally
    React.useEffect(() => {
        if (selected && mode === 'single') {
            setSingleModeContext(selected);
        }
    }, [selected, mode]);

    // Reset mode when selectMode changes
    React.useEffect(() => {
        setMode(getInitialMode());
    }, [selectMode]);

    // When toggling modes, restore previous context
    const handleModeToggle = (newMode: 'single' | 'range') => {
        if (newMode === 'single') {
            // Restore single mode context
            if (singleModeContext) {
                onSelect?.(singleModeContext);
            }
            // Clear range display
            setRange({});
        } else {
            // Restore range mode context
            setRange(rangeModeContext);
            if (rangeModeContext.from && rangeModeContext.to) {
                onRangeSelect?.(rangeModeContext);
            }
        }
        setMode(newMode);
    };

    // End dragging on pointer up globally
    React.useEffect(() => {
        const onUp = () => {
            if (dragging !== 'none' && range.from && range.to) {
                // Notify parent when dragging ends with a complete range
                onRangeSelect?.(range);
            }
            setDragging('none');
        };
        window.addEventListener('pointerup', onUp);
        return () => window.removeEventListener('pointerup', onUp);
    }, [dragging, range, onRangeSelect]);

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
            if (cursor.getFullYear() > last.getFullYear()
                || (cursor.getFullYear() === last.getFullYear() && cursor.getMonth() > last.getMonth())) break;
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
            // Check if clicking the same date (for deselection)
            if (allowDeselect && selected && isSameDay(date, selected)) {
                onSelect?.(undefined);
                setSingleModeContext(undefined);
            } else {
                onSelect?.(date);
                setSingleModeContext(date);
            }
            return;
        }
        // Range mode: clicks set from/to
        const from = range.from;
        const to = range.to;
        if (!from || (from && to)) {
            const newRange = { from: date, to: undefined };
            setRange(newRange);
            setRangeModeContext(newRange);
            onRangeSelect?.(newRange);
            return;
        }
        if (from && !to) {
            let newRange;
            if (date.getTime() < from.getTime()) {
                newRange = { from: date, to: from };
            } else {
                newRange = { from, to: date };
            }
            setRange(newRange);
            setRangeModeContext(newRange);
            onRangeSelect?.(newRange);
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

    const calendarGridBoxSize = cellSize;
    const calendarGridPadding = cellPadding;
    // Scale font size based on cell size (base: 46px = 0.875rem body2)
    const scaledFontSize = `${(cellSize / 46) * 0.875}rem`;
    // Scale header font size (slightly smaller than day numbers)
    const scaledHeaderFontSize = `${(cellSize / 46) * 0.75}rem`;
    // Scale dot size based on cell size (base: 46px = 10px dot)
    const scaledDotSize = Math.round((cellSize / 46) * 10);

    // Determine if toggle should be shown
    const showToggle = selectMode === 'all';

    const calendarContent = (
        <Box sx={{ width: 'max-content' }}>
            <Paper sx={{ p: 2 }} elevation={dialogMode ? 0 : 2}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                    <Box>
                        {loading ? (
                            <Skeleton variant="text" width={150} height={32} />
                        ) : (
                            <Typography variant="h6">
                                {viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {loading ? (
                            <>
                                <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 1 }} />
                                <Skeleton variant="circular" width={32} height={32} />
                                <Skeleton variant="circular" width={32} height={32} />
                            </>
                        ) : (
                            <>
                                {showToggle && (
                                    <ToggleButtonGroup size="small" value={mode} exclusive
                                        onChange={(_, v) => v && handleModeToggle(v as 'single' | 'range')}>
                                        <ToggleButton value="single">Single</ToggleButton>
                                        <ToggleButton value="range">Range</ToggleButton>
                                    </ToggleButtonGroup>
                                )}
                                <IconButton onClick={() => setViewMonth(addDays(viewMonth, -30))} size="small">
                                    <ArrowBackIosNew fontSize="small" />
                                </IconButton>
                                <IconButton onClick={() => setViewMonth(addDays(viewMonth, 30))} size="small">
                                    <ArrowForwardIos fontSize="small" />
                                </IconButton>
                            </>
                        )}
                    </Box>
                </Box>

                {/* Calendar grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                    {/* Day header */}
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <Box
                            key={d}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: calendarGridBoxSize,
                                p: 0
                            }}
                        >
                            {loading ? (
                                <Skeleton variant="text" width={scaledDotSize * 2} height={scaledDotSize * 2} sx={{ mx: 'auto' }} />
                            ) : (
                                <Typography sx={{ lineHeight: 1, fontSize: scaledHeaderFontSize }}>{d}</Typography>
                            )}
                        </Box>
                    ))}

                    {/* Weeks */}
                    {loading ? (
                        // Show skeleton day cells while loading
                        Array.from({ length: 35 }).map((_, i) => (
                            <Box key={i}
                                sx={{
                                    p: calendarGridPadding, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                <Skeleton
                                    variant="rectangular"
                                    width={calendarGridBoxSize - 10}
                                    height={calendarGridBoxSize - 10}
                                    sx={{ borderRadius: '50%' }}
                                />
                            </Box>
                        ))
                    ) : (
                        // Show actual calendar days when loaded
                        matrix.map((week, wi) => {
                            // For each week we render segments as grid-spanning background elements
                            // followed by the 7 day cells. Each segment is placed on grid row (wi + 2)
                            // because header occupies row 1.
                            const calendarGridButtonSize = calendarGridBoxSize - 10;
                            return (
                                <React.Fragment key={wi}>
                                    {(() => {
                                        const segs: { start: number; end: number }[] = [];
                                        let inSeg = false;
                                        let segStart = 0;
                                        week.forEach((d, idx) => {
                                            const dayVal = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                                            const from = range.from ?
                                                new Date(
                                                    range.from.getFullYear(),
                                                    range.from.getMonth(),
                                                    range.from.getDate()
                                                ).getTime() : undefined;
                                            const to = range.to ?
                                                new Date(
                                                    range.to.getFullYear(),
                                                    range.to.getMonth(),
                                                    range.to.getDate()
                                                ).getTime() : undefined;
                                            const isIn = (from !== undefined
                                                && to !== undefined
                                                && dayVal >= Math.min(from, to)
                                                && dayVal <= Math.max(from, to));
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
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <Box
                                                key={key}
                                                sx={{
                                                    p: calendarGridPadding, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 1,
                                                    position: 'relative', gridRow: wi + 2, gridColumn: (day.getDay() + 1)
                                                }}
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
                                                    sx={{
                                                        minWidth: calendarGridButtonSize,
                                                        width: calendarGridButtonSize,
                                                        height: calendarGridButtonSize,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        // Fill the button for single-selected day or range endpoints; interior in-range days remain unfilled.
                                                        bgcolor: isActive ? 'primary.main' : undefined,
                                                        color: isActive ?
                                                            'primary.contrastText' : (inMonth ?
                                                                'text.primary' : 'action.disabled'),
                                                        borderRadius: '50%',
                                                        p: 0,
                                                        boxSizing: 'border-box',
                                                        // Grey outline for today's date
                                                        border: isToday ? '1px solid grey' : undefined,
                                                        '&:hover': {
                                                            bgcolor: isSelectedSingle ?
                                                                'primary.dark' : undefined
                                                        }
                                                    }}
                                                >
                                                    <Typography
                                                        variant='body2'
                                                        sx={{ lineHeight: 1, fontSize: scaledFontSize }}
                                                    >
                                                        {day.getDate()}
                                                    </Typography>
                                                </Button>

                                                {/* Event badge inside the button container (absolute so it doesn't affect layout) */}
                                                {todaysEvents.length > 0 && (
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        right: Math.round(scaledDotSize / 2),
                                                        top: Math.round(scaledDotSize / 2),
                                                        zIndex: 2
                                                    }}>
                                                        <Box sx={(theme) => ({
                                                            width: scaledDotSize,
                                                            height: scaledDotSize,
                                                            borderRadius: '50%',
                                                            backgroundColor: todaysEvents[0].color || 'primary.main',
                                                            boxShadow: `0 0 0 1px ${alpha(theme.palette.background.default, 0.06)}`
                                                        })} />
                                                    </Box>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })
                    )}
                </Box>
            </Paper>
        </Box>
    );

    // Wrap in dialog if dialogMode is enabled
    if (dialogMode) {
        return (
            <Dialog
                open={open} onClose={onClose} maxWidth="md"
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: 'transparent',
                            boxShadow: 'none',
                            overflow: 'visible'
                        }
                    },
                    backdrop: {
                        sx: {
                            backgroundColor: 'rgba(0, 0, 0, 0.7)'
                        }
                    }
                }}
            >
                <DialogTitle sx={{ bgcolor: 'background.paper', borderTopLeftRadius: 1, borderTopRightRadius: 1 }}>
                    {dialogTitle}
                </DialogTitle>
                <DialogContent sx={{ bgcolor: 'background.paper', p: 0, display: 'flex', justifyContent: 'center' }}>
                    {calendarContent}
                </DialogContent>
                <DialogActions sx={{ bgcolor: 'background.paper', borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (mode === 'range' && range.from && range.to) {
                                onRangeSelect?.(range);
                            } else if (mode === 'single' && selected) {
                                onSelect?.(selected);
                            }
                            onClose?.();
                        }}
                        disabled={(mode === 'range' && (!range.from || !range.to)) || (mode === 'single' && !selected)}
                    >
                        Select
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    return calendarContent;
}
