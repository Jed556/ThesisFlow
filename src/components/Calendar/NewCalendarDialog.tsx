import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Stack, TextField, Typography, Autocomplete
} from '@mui/material';
import { Avatar, Name } from '../Avatar';
import type { UserProfile } from '../../types/profile';

/**
 * Props for the NewCalendarDialog component
 */
export interface NewCalendarDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback to close the dialog */
    onClose: () => void;
    /** Callback to create the calendar */
    onCreate: () => void;
    /** Calendar name */
    name: string;
    /** Callback to update calendar name */
    setName: (name: string) => void;
    /** Calendar description */
    description: string;
    /** Callback to update calendar description */
    setDescription: (description: string) => void;
    /** Calendar color */
    color: string;
    /** Callback to update calendar color */
    setColor: (color: string) => void;
    /** Default color for reset */
    defaultColor: string;
    /** Whether user can manage permissions */
    canManagePermissions: boolean;
    /** All users for sharing autocomplete */
    allUsers: UserProfile[];
    /** Selected permissions */
    permissions: (string | UserProfile)[];
    /** Callback to update permissions */
    setPermissions: (permissions: (string | UserProfile)[]) => void;
}

/**
 * Dialog component for creating new calendars
 */
export function NewCalendarDialog({
    open,
    onClose,
    onCreate,
    name,
    setName,
    description,
    setDescription,
    color,
    setColor,
    defaultColor,
    canManagePermissions,
    allUsers,
    permissions,
    setPermissions,
}: NewCalendarDialogProps) {
    const handleClose = () => {
        onClose();
        setName('');
        setDescription('');
        setColor(defaultColor);
        setPermissions([]);
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create New Calendar</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        label="Calendar Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        fullWidth
                        autoFocus
                    />
                    <TextField
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        rows={2}
                        fullWidth
                    />
                    <Box>
                        <Typography variant="body2" gutterBottom>Color</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Box
                                sx={{
                                    width: 56,
                                    height: 56,
                                    border: '2px solid',
                                    borderColor: 'divider',
                                    backgroundColor: color,
                                    borderRadius: 1,
                                    flexShrink: 0
                                }}
                            />
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            />
                        </Box>
                    </Box>
                    {canManagePermissions && (
                        <Autocomplete<UserProfile, true, false, true>
                            multiple
                            freeSolo
                            options={allUsers}
                            value={permissions}
                            onChange={(_, value) => setPermissions(value)}
                            getOptionLabel={(option) => {
                                if (typeof option === 'string') return option;
                                return option.email || '';
                            }}
                            renderOption={(props, option) => {
                                if (typeof option === 'string') {
                                    return <li {...props}>{option}</li>;
                                }
                                const fullName = [
                                    option.name.prefix, option.name.first, option.name.middle,
                                    option.name.last, option.name.suffix
                                ].filter(Boolean).join(' ');
                                return (
                                    <li {...props}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            width: '100%'
                                        }}>
                                            <Avatar
                                                uid={option.uid}
                                                initials={[Name.FIRST, Name.LAST]}
                                                size="small"
                                                editable={false}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {fullName || option.email}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: 'block' }}
                                                >
                                                    {option.email}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Add People (Emails)"
                                    placeholder="Search by name or email..."
                                    helperText="Grant view/edit access to selected users"
                                />
                            )}
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>
                    Cancel
                </Button>
                <Button onClick={onCreate} variant="contained">
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default NewCalendarDialog;
