import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, IconButton, InputLabel, MenuItem, Select, Stack,
    TextField, Tooltip, Typography, Autocomplete
} from '@mui/material';
import { CalendarToday, AddCircle } from '@mui/icons-material';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { format } from 'date-fns';
import type { ScheduleEvent, EventStatus, EventLocation, Calendar as CalendarType } from '../../types/schedule';

/**
 * Props for the EventDialog component
 */
export interface EventDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback to close the dialog */
    onClose: () => void;
    /** Callback to save the event */
    onSave: () => void;
    /** Event being edited (null for new events) */
    editingEvent: (ScheduleEvent & { id: string }) | null;
    /** Form data for the event */
    formData: Partial<ScheduleEvent> & {
        location?: Partial<EventLocation>;
        selectedCalendarId?: string;
    };
    /** Callback to update form data */
    setFormData: React.Dispatch<React.SetStateAction<Partial<ScheduleEvent> & {
        location?: Partial<EventLocation>;
        selectedCalendarId?: string;
    }>>;
    /** Calendars the user can write to */
    writableCalendars: CalendarType[];
    /** Get unique key for a calendar */
    getCalendarKey: (cal: CalendarType) => string;
    /** All available tags for autocomplete */
    allTags: string[];
    /** Default event color */
    defaultEventColor: string;
    /** Current color picker value */
    colorPickerValue: string;
    /** Callback when color changes */
    onColorChange: (color: string) => void;
    /** Callback to open the calendar date picker dialog */
    onOpenCalendarDialog: () => void;
    /** Whether user can create new calendars */
    canCreateCalendar: boolean;
    /** Callback to open new calendar dialog */
    onOpenNewCalendarDialog: () => void;
    /** Find calendar by its unique key */
    findCalendarByKey: (key: string) => CalendarType | undefined;
}

/**
 * Dialog component for creating and editing calendar events
 */
export function EventDialog({
    open,
    onClose,
    onSave,
    editingEvent,
    formData,
    setFormData,
    writableCalendars,
    getCalendarKey,
    allTags,
    defaultEventColor,
    colorPickerValue,
    onColorChange,
    onOpenCalendarDialog,
    canCreateCalendar,
    onOpenNewCalendarDialog,
    findCalendarByKey,
}: EventDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        fullWidth
                    />
                    <TextField
                        label="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        multiline
                        rows={3}
                        fullWidth
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <FormControl fullWidth required>
                            <InputLabel>Calendar</InputLabel>
                            <Select
                                value={formData.selectedCalendarId}
                                label="Calendar"
                                onChange={(e) => {
                                    const calendarKey = e.target.value;
                                    const selectedCal = findCalendarByKey(calendarKey);
                                    setFormData({
                                        ...formData,
                                        selectedCalendarId: calendarKey,
                                        // Set color to calendar color when calendar changes
                                        color: selectedCal?.color || formData.color || defaultEventColor
                                    });
                                    // Also update the color picker
                                    if (selectedCal?.color) {
                                        onColorChange(selectedCal.color);
                                    }
                                }}
                            >
                                {writableCalendars.map(cal => (
                                    <MenuItem key={getCalendarKey(cal)} value={getCalendarKey(cal)}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    backgroundColor: cal.color
                                                }}
                                            />
                                            {cal.name}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {canCreateCalendar && (
                            <Tooltip title="Create New Calendar">
                                <IconButton
                                    onClick={onOpenNewCalendarDialog}
                                    sx={{ mt: 1 }}
                                    color="primary"
                                >
                                    <AddCircle />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={formData.status}
                                label="Status"
                                onChange={(e) => setFormData({
                                    ...formData,
                                    status: e.target.value as EventStatus
                                })}
                            >
                                <MenuItem value="scheduled">Scheduled</MenuItem>
                                <MenuItem value="confirmed">Confirmed</MenuItem>
                                <MenuItem value="cancelled">Cancelled</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                                <MenuItem value="rescheduled">Rescheduled</MenuItem>
                            </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title="Event Color">
                                <Box
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        border: '2px solid',
                                        borderColor: 'divider',
                                        backgroundColor: formData.color || defaultEventColor,
                                        borderRadius: 1,
                                        flexShrink: 0
                                    }}
                                />
                            </Tooltip>
                            <input
                                type="color"
                                value={colorPickerValue}
                                onChange={(e) => onColorChange(e.target.value)}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    border: '2px solid',
                                    borderColor: '#e0e0e0',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="Start Date"
                            type="date"
                            value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                            onChange={(e) => {
                                const time = formData.startDate?.split('T')[1] || '09:00';
                                setFormData({ ...formData, startDate: `${e.target.value}T${time}` });
                            }}
                            required
                            fullWidth
                            slotProps={{
                                inputLabel: { shrink: true },
                                input: {
                                    endAdornment: (
                                        <IconButton
                                            edge="end"
                                            onClick={onOpenCalendarDialog}
                                            size="small"
                                        >
                                            <CalendarToday fontSize="small" />
                                        </IconButton>
                                    )
                                }
                            }}
                        />
                        <TextField
                            label="End Date"
                            type="date"
                            value={formData.endDate ? formData.endDate.split('T')[0] : ''}
                            onChange={(e) => {
                                const time = formData.endDate?.split('T')[1] || '10:00';
                                setFormData({ ...formData, endDate: `${e.target.value}T${time}` });
                            }}
                            fullWidth
                            slotProps={{
                                inputLabel: { shrink: true },
                                input: {
                                    endAdornment: (
                                        <IconButton
                                            edge="end"
                                            onClick={onOpenCalendarDialog}
                                            size="small"
                                        >
                                            <CalendarToday fontSize="small" />
                                        </IconButton>
                                    )
                                }
                            }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <MobileTimePicker
                            label="Start Time"
                            value={formData.startDate ? new Date(formData.startDate) : null}
                            onChange={(newValue) => {
                                if (newValue) {
                                    const date = formData.startDate?.split('T')[0]
                                        || format(new Date(), 'yyyy-MM-dd');
                                    const time = format(newValue, 'HH:mm');
                                    setFormData({ ...formData, startDate: `${date}T${time}` });
                                }
                            }}
                            openTo="hours"
                            views={['hours', 'minutes']}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    required: true
                                }
                            }}
                        />
                        <MobileTimePicker
                            label="End Time"
                            value={formData.endDate ? new Date(formData.endDate) : null}
                            onChange={(newValue) => {
                                if (newValue) {
                                    const date = formData.endDate?.split('T')[0]
                                        || format(new Date(), 'yyyy-MM-dd');
                                    const time = format(newValue, 'HH:mm');
                                    setFormData({ ...formData, endDate: `${date}T${time}` });
                                }
                            }}
                            openTo="hours"
                            views={['hours', 'minutes']}
                            slotProps={{
                                textField: {
                                    fullWidth: true
                                }
                            }}
                        />
                    </Box>
                    <Autocomplete
                        multiple
                        freeSolo
                        options={allTags}
                        value={formData.tags || []}
                        onChange={(_, v) => setFormData({ ...formData, tags: v })}
                        renderInput={(params) =>
                            <TextField {...params} label="Tags" placeholder="Add or select tags..." />
                        }
                    />
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Location</Typography>
                        <Stack spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    value={formData.location?.type || 'physical'}
                                    label="Type"
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        location: {
                                            type: e.target.value as 'physical' | 'virtual' | 'hybrid',
                                            address: formData.location?.address,
                                            room: formData.location?.room,
                                            url: formData.location?.url,
                                            platform: formData.location?.platform
                                        }
                                    })}
                                >
                                    <MenuItem value="physical">Physical</MenuItem>
                                    <MenuItem value="virtual">Virtual</MenuItem>
                                    <MenuItem value="hybrid">Hybrid</MenuItem>
                                </Select>
                            </FormControl>
                            {(formData.location?.type === 'physical' ||
                                formData.location?.type === 'hybrid') && (
                                    <>
                                        <TextField
                                            label="Address"
                                            value={formData.location?.address || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                location: {
                                                    ...formData.location,
                                                    type: formData.location?.type || 'physical',
                                                    address: e.target.value
                                                }
                                            })}
                                            required
                                            fullWidth
                                        />
                                        <TextField
                                            label="Room"
                                            value={formData.location?.room || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                location: {
                                                    ...formData.location,
                                                    type: formData.location?.type || 'physical',
                                                    room: e.target.value
                                                }
                                            })}
                                            required
                                            fullWidth
                                        />
                                    </>
                                )}
                            {(formData.location?.type === 'virtual' ||
                                formData.location?.type === 'hybrid') && (
                                    <>
                                        <TextField
                                            label="URL"
                                            value={formData.location?.url || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                location: {
                                                    ...formData.location,
                                                    type: formData.location?.type || 'virtual',
                                                    url: e.target.value
                                                }
                                            })}
                                            placeholder="https://meet.google.com/..."
                                            required
                                            fullWidth
                                        />
                                        <TextField
                                            label="Platform"
                                            value={formData.location?.platform || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                location: {
                                                    ...formData.location,
                                                    type: formData.location?.type || 'virtual',
                                                    platform: e.target.value
                                                }
                                            })}
                                            placeholder="Zoom, Teams, Google Meet, etc."
                                            required
                                            fullWidth
                                        />
                                    </>
                                )}
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onSave} variant="contained">
                    {editingEvent ? 'Update' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default EventDialog;
