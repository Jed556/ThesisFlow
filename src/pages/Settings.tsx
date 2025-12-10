import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Paper, Skeleton, Stack, TextField, Button, IconButton,
    Divider, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
    Chip, Select, MenuItem, FormControl, Tooltip
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
    Settings, Edit, Save, Cancel, Lock, Visibility, VisibilityOff, Palette, CheckCircle,
    Restore as RestoreIcon, Notifications as NotificationsIcon, Add as AddIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getCurrentUserProfile, updateUserProfile, getCurrentUserAuditContext } from '../utils/firebase/firestore/user';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { uploadBanner, deleteFileFromStorage, revokeImagePreview } from '../utils/firebase/storage';
import { validateAvatarFile, createAvatarPreview, uploadAvatar } from '../utils/avatarUtils';
import { firebaseAuth } from '../utils/firebase/firebaseConfig';
import { ColorPickerDialog } from '../components/ColorPicker';
import { AnimatedPage } from '../components/Animate';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { getError } from '../../utils/errorUtils';
import { ProfileHeader } from '../components/Profile';
import { createUserAuditEntry } from '../utils/firebase/firestore/userAudits';
import type { NavigationItem } from '../types/navigation';
import type { UserProfile, UserPreferences, CalendarNotificationTiming } from '../types/profile';
import { MAX_CALENDAR_NOTIFICATIONS, DEFAULT_CALENDAR_NOTIFICATIONS } from '../types/profile';
import type { Session } from '../types/session';
import type { AuditAction } from '../types/audit';
import { devLog } from '../utils/devUtils';

/** Default theme color */
const DEFAULT_THEME_COLOR = '#2196F3';

export const metadata: NavigationItem = {
    index: 100,
    title: 'Settings',
    segment: 'settings',
    icon: <Settings />,
    children: [],
    roles: ['student', 'statistician', 'editor', 'adviser', 'panel', 'moderator', 'head', 'admin'],
};

/**
 * Notification timing row component for calendar notifications
 */
interface NotificationTimingRowProps {
    index: number;
    timing: CalendarNotificationTiming;
    onEnabledChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onValueChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onUnitChange: (event: SelectChangeEvent<string>) => void;
    onDelete: () => void;
    canDelete: boolean;
}

function NotificationTimingRow({
    index,
    timing,
    onEnabledChange,
    onValueChange,
    onUnitChange,
    onDelete,
    canDelete,
}: NotificationTimingRowProps) {
    return (
        <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
                control={
                    <Switch
                        checked={timing.enabled}
                        onChange={onEnabledChange}
                        size="small"
                    />
                }
                label={
                    <Typography variant="body2" sx={{ minWidth: 100 }}>
                        Reminder {index + 1}
                    </Typography>
                }
                sx={{ mr: 0 }}
            />
            <TextField
                type="number"
                value={timing.value}
                onChange={onValueChange}
                disabled={!timing.enabled}
                size="small"
                sx={{ width: 80 }}
                slotProps={{
                    htmlInput: { min: 1, max: timing.unit === 'days' ? 30 : timing.unit === 'hours' ? 24 : 60 },
                }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }} disabled={!timing.enabled}>
                <Select
                    value={timing.unit}
                    onChange={onUnitChange}
                >
                    <MenuItem value="minutes">Minutes</MenuItem>
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
                before event
            </Typography>
            <Tooltip title={canDelete ? 'Remove reminder' : 'At least one reminder required'}>
                <span>
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        disabled={!canDelete}
                        color="error"
                        sx={{ ml: 'auto' }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </Stack>
    );
}

/**
 * Settings page for user preferences and profile management
 */
export default function SettingsPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const { updateThemeFromSeedColor, seedColor: currentThemeColor, resetTheme } = useCustomTheme();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state -- use a shallow partial of UserProfile, with nested fields optional
    type UserProfileForm = Partial<UserProfile> & {
        name?: Partial<UserProfile['name']>;
        preferences?: Partial<UserPreferences>;
    };

    // Form state -- using UserProfileForm so nested name/preferences fields are optional
    const [formData, setFormData] = useState<UserProfileForm>({
        name: {
            prefix: '',
            first: '',
            middle: '',
            last: '',
            suffix: '',
        },
        phone: '',
        department: '',
        bio: '',
        preferences: {
            themeColor: DEFAULT_THEME_COLOR,
            reduceAnimations: false,
            calendarNotifications: [...DEFAULT_CALENDAR_NOTIFICATIONS],
        },
    });

    // Image upload state
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    // Color picker state
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    // Password change state
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [changingPassword, setChangingPassword] = useState(false);

    /**
     * Create a personal audit entry for account changes
     */
    const createAccountAudit = async (
        action: AuditAction,
        name: string,
        description: string
    ) => {
        if (!profile) return;

        try {
            // Get the actual audit context from the user's document path
            const ctx = await getCurrentUserAuditContext();
            if (!ctx) {
                console.warn('Could not get audit context for current user');
                return;
            }

            devLog('Creating audit with context:', ctx);

            await createUserAuditEntry(ctx, {
                name,
                description,
                userId: profile.uid,
                targetUserId: profile.uid,
                category: 'account',
                action,
                showSnackbar: false, // Don't show snackbar for own actions
            });
        } catch (error) {
            // Don't fail the main action if audit fails
            console.error('Failed to create account audit:', error);
        }
    };

    // Load profile
    useEffect(() => {
        loadProfile();
    }, [session]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const userProfile = await getCurrentUserProfile();
            if (userProfile) {
                setProfile(userProfile);
                const themeColor = userProfile.preferences?.themeColor || DEFAULT_THEME_COLOR;
                setFormData({
                    ...userProfile,
                    preferences: {
                        ...(userProfile.preferences ?? {}),
                        themeColor,
                        calendarNotifications: userProfile.preferences?.calendarNotifications
                            ?? [...DEFAULT_CALENDAR_NOTIFICATIONS],
                    },
                });

                if (currentThemeColor !== themeColor && currentThemeColor) {
                    updateThemeFromSeedColor(themeColor);
                }
            }
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to load profile');
            console.error('Error loading profile:', error);
            showNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: keyof UserProfile) => (event: React.ChangeEvent<HTMLInputElement>) => {
        // Generic top-level field updater (phone, department, bio, etc.)
        setFormData(prev => ({ ...prev, [field]: event.target.value }));
    };

    const handleSwitchChange = (
        field: keyof NonNullable<UserPreferences>
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            preferences: {
                ...(prev.preferences ?? {}),
                [field]: event.target.checked,
            }
        }));
    };

    /** Handler for calendar notification timing changes */
    const handleCalendarNotificationChange = (
        index: number,
        field: keyof CalendarNotificationTiming
    ) => (event: React.ChangeEvent<HTMLInputElement> | SelectChangeEvent<string>) => {
        const value = field === 'enabled'
            ? (event.target as HTMLInputElement).checked
            : field === 'value'
                ? parseInt(event.target.value, 10) || 0
                : event.target.value;

        setFormData(prev => {
            const currentNotifications = prev.preferences?.calendarNotifications ?? [...DEFAULT_CALENDAR_NOTIFICATIONS];
            const updatedNotifications = currentNotifications.map((timing, i) =>
                i === index ? { ...timing, [field]: value } : timing
            );

            return {
                ...prev,
                preferences: {
                    ...(prev.preferences ?? {}),
                    calendarNotifications: updatedNotifications,
                },
            };
        });
    };

    /** Add a new calendar notification reminder */
    const handleAddCalendarNotification = () => {
        setFormData(prev => {
            const currentNotifications = prev.preferences?.calendarNotifications ?? [...DEFAULT_CALENDAR_NOTIFICATIONS];
            if (currentNotifications.length >= MAX_CALENDAR_NOTIFICATIONS) return prev;

            const newNotification: CalendarNotificationTiming = {
                id: `custom-${Date.now()}`,
                enabled: true,
                value: 30,
                unit: 'minutes',
            };

            return {
                ...prev,
                preferences: {
                    ...(prev.preferences ?? {}),
                    calendarNotifications: [...currentNotifications, newNotification],
                },
            };
        });
    };

    /** Remove a calendar notification reminder */
    const handleRemoveCalendarNotification = (index: number) => () => {
        setFormData(prev => {
            const currentNotifications = prev.preferences?.calendarNotifications ?? [...DEFAULT_CALENDAR_NOTIFICATIONS];
            if (currentNotifications.length <= 1) return prev; // Keep at least one

            const updatedNotifications = currentNotifications.filter((_, i) => i !== index);

            return {
                ...prev,
                preferences: {
                    ...(prev.preferences ?? {}),
                    calendarNotifications: updatedNotifications,
                },
            };
        });
    };

    /** Save calendar notification preferences */
    const handleSaveCalendarNotifications = async () => {
        if (!session?.user?.uid) return;

        try {
            setSaving(true);
            await updateUserProfile(session.user.uid, {
                preferences: {
                    ...(formData.preferences ?? {}),
                },
            });
            showNotification('Calendar notification settings saved', 'success');

            // Create audit entry for preferences update
            await createAccountAudit(
                'account_preferences_updated',
                'Notification Settings Updated',
                'You updated your calendar notification settings'
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to save notification settings');
            console.error('Error saving notification settings:', error);
            showNotification(message, 'error');
        } finally {
            setSaving(false);
        }
    };

    /** Reset theme to default */
    const handleResetTheme = async () => {
        if (!session?.user?.uid) return;

        try {
            // Reset theme immediately in UI
            resetTheme();

            // Update form data
            setFormData(prev => ({
                ...prev,
                preferences: {
                    ...(prev.preferences ?? {}),
                    themeColor: DEFAULT_THEME_COLOR,
                },
            }));

            // Save to database
            await updateUserProfile(session.user.uid, {
                preferences: {
                    ...(formData.preferences ?? {}),
                    themeColor: DEFAULT_THEME_COLOR,
                },
            });

            showNotification('Theme reset to default', 'success');

            // Create audit entry for theme change
            await createAccountAudit(
                'account_theme_changed',
                'Theme Reset',
                'You reset your theme to default'
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to reset theme');
            console.error('Error resetting theme:', error);
            showNotification(message, 'error');
        }
    };

    const handleNameChange = (field: keyof NonNullable<UserProfile['name']>) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            name: {
                ...(prev.name ?? {}),
                [field]: event.target.value,
            }
        } as UserProfileForm));
    };

    const handleSave = async () => {
        if (!session?.user?.uid) {
            showNotification('Unable to update profile because the user ID is missing.', 'error');
            return;
        }

        try {
            setSaving(true);
            // We store a partial UserProfile object in formData, so pass it directly
            await updateUserProfile(session.user.uid, formData as Partial<UserProfile>);

            // Update theme if color changed
            if ((formData.preferences?.themeColor ?? '') !== currentThemeColor) {
                updateThemeFromSeedColor(formData.preferences?.themeColor ?? '');
            }

            await loadProfile();
            setEditing(false);
            showNotification('Profile updated successfully', 'success');

            // Create audit entry for profile update
            await createAccountAudit(
                'account_updated',
                'Profile Updated',
                'You updated your profile information'
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to save profile');
            console.error('Error saving profile:', error);
            showNotification(message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (profile) {
            setFormData({
                ...profile,
                preferences: {
                    ...(profile.preferences ?? {}),
                    themeColor: profile.preferences?.themeColor ?? DEFAULT_THEME_COLOR,
                    calendarNotifications: profile.preferences?.calendarNotifications || { ...DEFAULT_CALENDAR_NOTIFICATIONS },
                }
            });
        }
        setEditing(false);
    };

    const handleAvatarChange = async (file: File) => {
        if (!session?.user?.uid || !profile) return;

        const validation = validateAvatarFile(file);
        if (!validation.valid) {
            showNotification(validation.error!, 'error');
            return;
        }

        try {
            setUploadingAvatar(true);

            const preview = await createAvatarPreview(file);
            setAvatarPreview(preview);

            if (profile.avatar) {
                await deleteFileFromStorage(profile.avatar).catch(console.error);
            }

            await uploadAvatar(file, session.user.uid);
            await loadProfile();

            showNotification('Avatar updated successfully', 'success');

            // Create audit entry for avatar change
            await createAccountAudit(
                'account_avatar_changed',
                'Avatar Updated',
                'You updated your profile avatar'
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to upload avatar');
            console.error('Error uploading avatar:', error);
            showNotification(message, 'error');
        } finally {
            setUploadingAvatar(false);
            if (avatarPreview) {
                revokeImagePreview(avatarPreview);
                setAvatarPreview(null);
            }
        }
    };

    const handleBannerChange = async (file: File) => {
        if (!session?.user?.email || !session?.user?.uid) return;

        try {
            setUploadingBanner(true);

            const downloadURL = await uploadBanner(file, session.user.email);

            if (profile?.banner) {
                await deleteFileFromStorage(profile.banner).catch(console.error);
            }

            await updateUserProfile(session.user.uid, { banner: downloadURL });
            await loadProfile();

            showNotification('Banner updated successfully', 'success');

            // Create audit entry for banner change
            await createAccountAudit(
                'account_banner_changed',
                'Banner Updated',
                'You updated your profile banner'
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to upload banner');
            console.error('Error uploading banner:', error);
            showNotification(message, 'error');
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleThemeColorConfirm = async (color: string) => {
        setFormData(prev => ({
            ...(prev ?? {}),
            preferences: {
                ...(prev?.preferences ?? {}),
                themeColor: color,
            }
        } as UserProfileForm));
        setColorPickerOpen(false);

        if (!session?.user?.uid) return;

        try {
            // Update theme immediately
            updateThemeFromSeedColor(color);

            // Save to database
            // apply change to local form data and persist the updated preferences
            const updated = {
                ...(formData ?? {}),
                preferences: {
                    ...(formData?.preferences ?? {}),
                    themeColor: color,
                    reduceAnimations: formData?.preferences?.reduceAnimations ?? false,
                }
            } as UserProfileForm;

            setFormData(updated);

            await updateUserProfile(session.user.uid, { preferences: updated.preferences });

            showNotification('Theme color updated successfully', 'success');

            // Create audit entry for theme change
            await createAccountAudit(
                'account_theme_changed',
                'Theme Color Changed',
                `You changed your theme color to ${color}`
            );
        } catch (error: unknown) {
            const { message } = getError(error, 'Failed to update theme color');
            console.error('Error updating theme color:', error);
            showNotification(message, 'error');
        }
    };

    const handlePasswordChange = async () => {
        if (!firebaseAuth.currentUser || !session?.user?.email) return;

        // Validation
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            setChangingPassword(true);

            // Re-authenticate user
            const credential = EmailAuthProvider.credential(
                session.user.email,
                passwordData.currentPassword
            );
            await reauthenticateWithCredential(firebaseAuth.currentUser, credential);

            // Update password
            await updatePassword(firebaseAuth.currentUser, passwordData.newPassword);

            // Reset form and close dialog
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            setPasswordDialogOpen(false);
            showNotification('Password changed successfully', 'success');

            // Create audit entry for password change
            await createAccountAudit(
                'account_password_changed',
                'Password Changed',
                'You changed your account password'
            );
        } catch (error: unknown) {
            const parsedError = getError(error, 'Failed to change password');
            console.error('Error changing password:', parsedError);
            if (parsedError.code === 'auth/wrong-password') {
                showNotification('Current password is incorrect', 'error');
            } else {
                showNotification(parsedError.message, 'error');
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const isProfileLoading = loading || !profile;

    const isActiveThemeColor = currentThemeColor && currentThemeColor === (formData.preferences?.themeColor ?? '');

    return (
        <AnimatedPage variant="fade">
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Profile Header */}
                <Paper
                    elevation={3}
                    sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        mb: 3,
                    }}
                >
                    {/* Banner Section */}
                    <Box sx={{ position: 'relative' }}>
                        {isProfileLoading ? (
                            <Skeleton
                                variant="rectangular"
                                sx={{ width: '100%', aspectRatio: '3/1', minHeight: '200px' }}
                            />
                        ) : (
                            <>
                                <ProfileHeader
                                    profile={profile!}
                                    bannerEditable
                                    onBannerChange={handleBannerChange}
                                    bannerUploading={uploadingBanner}
                                    avatarEditable
                                    onAvatarChange={handleAvatarChange}
                                    avatarUploading={uploadingAvatar}
                                    showMeta={true}
                                />
                            </>
                        )}
                    </Box>

                </Paper>

                {/* Account Details */}
                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Account Details</Typography>
                        {!editing ? (
                            <Button startIcon={<Edit />} onClick={() => setEditing(true)}>
                                Edit
                            </Button>
                        ) : (
                            <Stack direction="row" spacing={1}>
                                <Button
                                    startIcon={<Cancel />}
                                    onClick={handleCancel}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<Save />}
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    Save
                                </Button>
                            </Stack>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <Stack spacing={3}>
                        {/* Name Fields */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Prefix"
                                value={formData.name?.prefix ?? ''}
                                onChange={handleNameChange('prefix')}
                                disabled={!editing}
                                placeholder="Dr., Prof., Mr., Ms."
                                sx={{ width: { xs: '100%', sm: '20%' } }}
                            />
                            <TextField
                                label="First Name"
                                value={formData.name?.first ?? ''}
                                onChange={handleNameChange('first')}
                                disabled={!editing}
                                required
                                fullWidth
                            />
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Middle Name"
                                value={formData.name?.middle ?? ''}
                                onChange={handleNameChange('middle')}
                                disabled={!editing}
                                fullWidth
                            />
                            <TextField
                                label="Last Name"
                                value={formData.name?.last ?? ''}
                                onChange={handleNameChange('last')}
                                disabled={!editing}
                                required
                                fullWidth
                            />
                            <TextField
                                label="Suffix"
                                value={formData.name?.suffix ?? ''}
                                onChange={handleNameChange('suffix')}
                                disabled={!editing}
                                placeholder="Jr., Sr., III"
                                sx={{ width: { xs: '100%', sm: '20%' } }}
                            />
                        </Stack>

                        {/* Contact Info */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Phone"
                                value={formData.phone}
                                onChange={handleInputChange('phone')}
                                disabled={!editing}
                                type="tel"
                                fullWidth
                            />
                            <TextField
                                label="Department"
                                value={formData.department}
                                onChange={handleInputChange('department')}
                                disabled={!editing}
                                fullWidth
                            />
                        </Stack>

                        {/* Bio */}
                        <TextField
                            label="Bio"
                            value={formData.bio}
                            onChange={handleInputChange('bio')}
                            disabled={!editing}
                            multiline
                            rows={4}
                            placeholder="Tell us about yourself..."
                            fullWidth
                        />
                    </Stack>
                </Paper>

                {/* Preferences */}
                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Preferences
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Stack spacing={3}>
                        {/* Theme Color */}
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Palette fontSize="small" color="action" />
                                <Typography variant="subtitle2">
                                    Theme Color
                                </Typography>
                                {isActiveThemeColor && (
                                    <Chip
                                        icon={<CheckCircle />}
                                        label="Active"
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                    />
                                )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Pick a seed color to generate a Material 3 theme palette for your entire interface
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box
                                    onClick={() => setColorPickerOpen(true)}
                                    sx={{
                                        width: 80,
                                        height: 56,
                                        bgcolor: formData.preferences?.themeColor ?? 'primary.main',
                                        border: '3px solid',
                                        borderColor: isActiveThemeColor ? 'primary.main' : 'divider',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: 2,
                                        '&:hover': {
                                            borderColor: 'primary.main',
                                            transform: 'scale(1.05)',
                                            boxShadow: 4,
                                        },
                                    }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight={600}>
                                        {(formData.preferences?.themeColor ?? '').toUpperCase()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {isActiveThemeColor
                                            ? 'Currently applied to your interface'
                                            : 'Click the color box to change'}
                                    </Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<RestoreIcon />}
                                    onClick={handleResetTheme}
                                    disabled={formData.preferences?.themeColor === DEFAULT_THEME_COLOR}
                                >
                                    Reset
                                </Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Calendar Notifications */}
                        <Box>
                            {(() => {
                                const notifications: CalendarNotificationTiming[] =
                                    formData.preferences?.calendarNotifications
                                    ?? DEFAULT_CALENDAR_NOTIFICATIONS;
                                const notificationCount = notifications.length;
                                const canAddMore = notificationCount < MAX_CALENDAR_NOTIFICATIONS;
                                const canDelete = notificationCount > 1;

                                return (
                                    <>
                                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                            <NotificationsIcon fontSize="small" color="action" />
                                            <Typography variant="subtitle2">
                                                Calendar Event Notifications
                                            </Typography>
                                            <Chip
                                                label={`${notificationCount}/${MAX_CALENDAR_NOTIFICATIONS}`}
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                            />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Configure when to receive notifications before calendar events
                                            (up to {MAX_CALENDAR_NOTIFICATIONS} reminders)
                                        </Typography>

                                        <Stack spacing={2}>
                                            {/* Dynamic Notification Rows */}
                                            {notifications.map((timing, index) => (
                                                <NotificationTimingRow
                                                    key={index}
                                                    index={index}
                                                    timing={timing}
                                                    onEnabledChange={handleCalendarNotificationChange(index, 'enabled')}
                                                    onValueChange={handleCalendarNotificationChange(index, 'value')}
                                                    onUnitChange={handleCalendarNotificationChange(index, 'unit')}
                                                    onDelete={handleRemoveCalendarNotification(index)}
                                                    canDelete={canDelete}
                                                />
                                            ))}

                                            {/* Add Reminder Button */}
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<AddIcon />}
                                                    onClick={handleAddCalendarNotification}
                                                    disabled={!canAddMore}
                                                    size="small"
                                                >
                                                    Add Reminder
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    onClick={handleSaveCalendarNotifications}
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Saving...' : 'Save'}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </>
                                );
                            })()}
                        </Box>

                        <Divider />

                        {/* Reduce Animations */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.preferences?.reduceAnimations ?? false}
                                    onChange={handleSwitchChange('reduceAnimations')}
                                    disabled={!editing && !session?.user?.email}
                                />
                            }
                            label={(
                                <Box>
                                    <Typography variant="body2">Reduce Animations</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Disable animations for better performance or accessibility
                                    </Typography>
                                </Box>
                            )}
                        />
                    </Stack>
                </Paper>

                {/* Security */}
                <Paper elevation={1} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Security
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Button
                        variant="outlined"
                        startIcon={<Lock />}
                        onClick={() => setPasswordDialogOpen(true)}
                    >
                        Change Password
                    </Button>
                </Paper>

                {/* Color Picker Dialog */}
                <ColorPickerDialog
                    open={colorPickerOpen}
                    onClose={() => setColorPickerOpen(false)}
                    value={formData.preferences?.themeColor ?? '#2196F3'}
                    onConfirm={handleThemeColorConfirm}
                    title="Choose Theme Color"
                />

                {/* Password Change Dialog */}
                <Dialog
                    open={passwordDialogOpen}
                    onClose={() => !changingPassword && setPasswordDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                label="Current Password"
                                type={showPasswords.current ? 'text' : 'password'}
                                value={passwordData.currentPassword}
                                onChange={(e) =>
                                    setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))
                                }
                                fullWidth
                                disabled={changingPassword}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <IconButton
                                                onClick={() =>
                                                    setShowPasswords(prev => ({ ...prev, current: !prev.current }))
                                                }
                                                edge="end"
                                            >
                                                {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        ),
                                    }
                                }}
                            />
                            <TextField
                                label="New Password"
                                type={showPasswords.new ? 'text' : 'password'}
                                value={passwordData.newPassword}
                                onChange={(e) =>
                                    setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))
                                }
                                fullWidth
                                disabled={changingPassword}
                                helperText="Must be at least 6 characters"
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <IconButton
                                                onClick={() =>
                                                    setShowPasswords(prev => ({ ...prev, new: !prev.new }))
                                                }
                                                edge="end"
                                            >
                                                {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        ),
                                    }
                                }}
                            />
                            <TextField
                                label="Confirm New Password"
                                type={showPasswords.confirm ? 'text' : 'password'}
                                value={passwordData.confirmPassword}
                                onChange={(e) =>
                                    setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
                                }
                                fullWidth
                                disabled={changingPassword}
                                error={
                                    passwordData.confirmPassword !== '' &&
                                    passwordData.newPassword !== passwordData.confirmPassword
                                }
                                helperText={
                                    passwordData.confirmPassword !== '' &&
                                        passwordData.newPassword !== passwordData.confirmPassword
                                        ? 'Passwords do not match'
                                        : ''
                                }
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <IconButton
                                                onClick={() =>
                                                    setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))
                                                }
                                                edge="end"
                                            >
                                                {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        ),
                                    }
                                }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPasswordDialogOpen(false)} disabled={changingPassword}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handlePasswordChange}
                            disabled={changingPassword}
                        >
                            {changingPassword ? 'Changing...' : 'Change Password'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </AnimatedPage>
    );
}
