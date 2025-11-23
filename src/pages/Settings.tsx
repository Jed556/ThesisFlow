import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Paper, Skeleton, Stack, TextField, Button, IconButton,
    Divider, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import {
    Settings, Edit, Save, Cancel, Lock, Visibility, VisibilityOff, Palette, CheckCircle,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getCurrentUserProfile, setUserProfile } from '../utils/firebase/firestore/user';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { uploadBanner, deleteFileFromStorage, revokeImagePreview } from '../utils/firebase/storage';
import { validateAvatarFile, createAvatarPreview, uploadAvatar } from '../utils/avatarUtils';
import { firebaseAuth } from '../utils/firebase/firebaseConfig';
import { ColorPickerDialog } from '../components/ColorPicker';
import { AnimatedPage } from '../components/Animate';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { getError } from '../../utils/errorUtils';
import { ProfileHeader } from '../components/Profile';
import type { NavigationItem } from '../types/navigation';
import type { UserProfile } from '../types/profile';
import type { Session } from '../types/session';

export const metadata: NavigationItem = {
    index: 100,
    title: 'Settings',
    segment: 'settings',
    icon: <Settings />,
    children: [],
    roles: ['student', 'statistician', 'editor', 'adviser', 'panel', 'moderator', 'head', 'admin'],
};

/**
 * Settings page for user preferences and profile management
 */
export default function SettingsPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const { updateThemeFromSeedColor, seedColor: currentThemeColor } = useCustomTheme();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state -- use a shallow partial of UserProfile, with nested fields optional
    type UserProfileForm = Partial<UserProfile> & {
        name?: Partial<UserProfile['name']>;
        preferences?: Partial<UserProfile['preferences']>;
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
            themeColor: '#2196F3',
            reduceAnimations: false,
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
                const themeColor = userProfile.preferences?.themeColor || '#2196F3';
                setFormData({
                    ...userProfile,
                    preferences: {
                        ...(userProfile.preferences ?? {}),
                        themeColor,
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
        field: keyof NonNullable<UserProfile['preferences']>
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            preferences: {
                ...(prev.preferences ?? {}),
                [field]: event.target.checked,
            }
        }));
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
            await setUserProfile(session.user.uid, formData as Partial<UserProfile>);

            // Update theme if color changed
            if ((formData.preferences?.themeColor ?? '') !== currentThemeColor) {
                updateThemeFromSeedColor(formData.preferences?.themeColor ?? '');
            }

            await loadProfile();
            setEditing(false);
            showNotification('Profile updated successfully', 'success');
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
                    themeColor: profile.preferences?.themeColor ?? '#2196F3',
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

            await uploadAvatar(file, session.user.uid, profile);
            await loadProfile();

            showNotification('Avatar updated successfully', 'success');
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

            await setUserProfile(session.user.uid, { banner: downloadURL });
            await loadProfile();

            showNotification('Banner updated successfully', 'success');
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

            await setUserProfile(session.user.uid, { preferences: updated.preferences });

            showNotification('Theme color updated successfully', 'success');
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
                                    variant="contained"
                                    startIcon={<Palette />}
                                    onClick={() => setColorPickerOpen(true)}
                                >
                                    Customize
                                </Button>
                            </Stack>
                        </Box>

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
