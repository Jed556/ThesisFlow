import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Paper, Avatar, CardMedia, Skeleton, Stack, TextField, Button, IconButton,
    Divider, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import {
    Settings, PhotoCamera, Person, Edit, Save, Cancel, Lock, Visibility, VisibilityOff, Palette, CheckCircle,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getCurrentUserProfile, setUserProfile } from '../utils/firebase/firestore/profile';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { uploadAvatar, uploadBanner, deleteImage, createImagePreview, revokeImagePreview } from '../utils/firebase/storage';
import { firebaseAuth } from '../utils/firebase/firebaseConfig';
import { ColorPickerDialog } from '../components/ColorPicker';
import { AnimatedPage } from '../components/Animate';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import type { NavigationItem } from '../types/navigation';
import type { UserProfile } from '../types/profile';
import type { Session } from '../types/session';

export const metadata: NavigationItem = {
    index: 100,
    title: 'Settings',
    segment: 'settings',
    icon: <Settings />,
    children: [],
    roles: ['admin', 'student', 'editor', 'adviser'],
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

    // Form state
    const [formData, setFormData] = useState({
        prefix: '',
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        phone: '',
        department: '',
        bio: '',
        themeColor: '#2196F3',
        reduceAnimations: false,
    });

    // Image upload state
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
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
                    prefix: userProfile.prefix || '',
                    firstName: userProfile.firstName || '',
                    middleName: userProfile.middleName || '',
                    lastName: userProfile.lastName || '',
                    suffix: userProfile.suffix || '',
                    phone: userProfile.phone || '',
                    department: userProfile.department || '',
                    bio: userProfile.bio || '',
                    themeColor,
                    reduceAnimations: userProfile.preferences?.reduceAnimations || false,
                });

                // Check if theme should be updated
                if (currentThemeColor !== themeColor && currentThemeColor) {
                    updateThemeFromSeedColor(themeColor);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            showNotification('Failed to load profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: event.target.value }));
    };

    const handleSwitchChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: event.target.checked }));
    };

    const handleSave = async () => {
        if (!session?.user?.email) return;

        try {
            setSaving(true);
            await setUserProfile(session.user.email, {
                prefix: formData.prefix,
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: formData.lastName,
                suffix: formData.suffix,
                phone: formData.phone,
                department: formData.department,
                bio: formData.bio,
                preferences: {
                    themeColor: formData.themeColor,
                    reduceAnimations: formData.reduceAnimations,
                }
            });

            // Update theme if color changed
            if (formData.themeColor !== currentThemeColor) {
                updateThemeFromSeedColor(formData.themeColor);
            }

            await loadProfile();
            setEditing(false);
            showNotification('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error saving profile:', error);
            showNotification('Failed to save profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (profile) {
            setFormData({
                prefix: profile.prefix || '',
                firstName: profile.firstName || '',
                middleName: profile.middleName || '',
                lastName: profile.lastName || '',
                suffix: profile.suffix || '',
                phone: profile.phone || '',
                department: profile.department || '',
                bio: profile.bio || '',
                themeColor: profile.preferences?.themeColor || '#2196F3',
                reduceAnimations: profile.preferences?.reduceAnimations || false,
            });
        }
        setEditing(false);
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !session?.user?.email) return;

        try {
            setUploadingAvatar(true);

            // Create preview
            const preview = createImagePreview(file);
            setAvatarPreview(preview);

            // Upload to Firebase Storage
            const downloadURL = await uploadAvatar(file, session.user.email);

            // Delete old avatar if exists
            if (profile?.avatar) {
                await deleteImage(profile.avatar).catch(console.error);
            }

            // Update profile
            await setUserProfile(session.user.email, { avatar: downloadURL });
            await loadProfile();

            showNotification('Avatar updated successfully', 'success');
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            showNotification(error.message || 'Failed to upload avatar', 'error');
        } finally {
            setUploadingAvatar(false);
            if (avatarPreview) {
                revokeImagePreview(avatarPreview);
                setAvatarPreview(null);
            }
        }
    };

    const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !session?.user?.email) return;

        try {
            setUploadingBanner(true);

            // Create preview
            const preview = createImagePreview(file);
            setBannerPreview(preview);

            // Upload to Firebase Storage
            const downloadURL = await uploadBanner(file, session.user.email);

            // Delete old banner if exists
            if (profile?.banner) {
                await deleteImage(profile.banner).catch(console.error);
            }

            // Update profile
            await setUserProfile(session.user.email, { banner: downloadURL });
            await loadProfile();

            showNotification('Banner updated successfully', 'success');
        } catch (error: any) {
            console.error('Error uploading banner:', error);
            showNotification(error.message || 'Failed to upload banner', 'error');
        } finally {
            setUploadingBanner(false);
            if (bannerPreview) {
                revokeImagePreview(bannerPreview);
                setBannerPreview(null);
            }
        }
    };

    const handleThemeColorConfirm = async (color: string) => {
        setFormData(prev => ({ ...prev, themeColor: color }));
        setColorPickerOpen(false);

        if (!session?.user?.email) return;

        try {
            // Update theme immediately
            updateThemeFromSeedColor(color);

            // Save to database
            await setUserProfile(session.user.email, {
                preferences: {
                    themeColor: color,
                    reduceAnimations: formData.reduceAnimations
                }
            });

            showNotification('Theme color updated successfully', 'success');
        } catch (error) {
            console.error('Error updating theme color:', error);
            showNotification('Failed to update theme color', 'error');
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
        } catch (error: any) {
            console.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password') {
                showNotification('Current password is incorrect', 'error');
            } else {
                showNotification('Failed to change password', 'error');
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const isProfileLoading = loading || !profile;

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
                                <CardMedia
                                    component={profile?.banner ? 'img' : 'div'}
                                    image={profile?.banner || undefined}
                                    sx={{
                                        width: '100%',
                                        aspectRatio: '3/1',
                                        minHeight: '200px',
                                        bgcolor: profile?.preferences?.themeColor || 'primary.main',
                                        objectFit: 'cover',
                                    }}
                                />
                                <input
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    id="banner-upload"
                                    type="file"
                                    onChange={handleBannerUpload}
                                    disabled={uploadingBanner}
                                />
                                <label htmlFor="banner-upload">
                                    <IconButton
                                        component="span"
                                        disabled={uploadingBanner}
                                        sx={{
                                            position: 'absolute',
                                            top: 16,
                                            right: 16,
                                            bgcolor: 'background.paper',
                                            '&:hover': { bgcolor: 'background.default' },
                                        }}
                                    >
                                        <PhotoCamera />
                                    </IconButton>
                                </label>
                            </>
                        )}

                        {/* Avatar - Overlapping */}
                        {isProfileLoading ? (
                            <Skeleton
                                variant="circular"
                                sx={{
                                    position: 'absolute',
                                    left: { xs: '50%', sm: 32 },
                                    bottom: { xs: -70, sm: -60 },
                                    transform: { xs: 'translateX(-50%)', sm: 'none' },
                                    width: { xs: 140, sm: 160 },
                                    height: { xs: 140, sm: 160 },
                                    border: '5px solid',
                                    borderColor: 'background.paper',
                                    zIndex: 2,
                                }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: { xs: '50%', sm: 32 },
                                    bottom: { xs: -70, sm: -60 },
                                    transform: { xs: 'translateX(-50%)', sm: 'none' },
                                    zIndex: 2,
                                }}
                            >
                                <Avatar
                                    src={avatarPreview || profile?.avatar}
                                    sx={{
                                        width: { xs: 140, sm: 160 },
                                        height: { xs: 140, sm: 160 },
                                        bgcolor: 'primary.main',
                                        border: '5px solid',
                                        borderColor: 'background.paper',
                                    }}
                                >
                                    {!profile?.avatar && <Person sx={{ fontSize: 64 }} />}
                                </Avatar>
                                <input
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    id="avatar-upload"
                                    type="file"
                                    onChange={handleAvatarUpload}
                                    disabled={uploadingAvatar}
                                />
                                <label htmlFor="avatar-upload">
                                    <IconButton
                                        component="span"
                                        disabled={uploadingAvatar}
                                        sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            bgcolor: 'background.paper',
                                            border: '2px solid',
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'background.default' },
                                        }}
                                    >
                                        <PhotoCamera fontSize="small" />
                                    </IconButton>
                                </label>
                            </Box>
                        )}
                    </Box>

                    {/* Profile Info */}
                    <Box
                        sx={{
                            px: 3,
                            pt: { xs: 10, sm: 8 },
                            pb: 3,
                            pl: { xs: 3, sm: '220px' },
                        }}
                    >
                        {isProfileLoading ? (
                            <>
                                <Skeleton variant="text" width="30%" height={36} />
                                <Skeleton variant="text" width="50%" height={24} sx={{ mt: 1 }} />
                            </>
                        ) : (
                            <>
                                <Typography variant="h4" fontWeight={700}>
                                    {[formData.prefix, formData.firstName, formData.middleName, formData.lastName, formData.suffix]
                                        .filter(Boolean)
                                        .join(' ')}
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {profile?.email} • {profile?.role}
                                </Typography>
                                {formData.department && (
                                    <Typography variant="body2" color="text.secondary">
                                        {formData.department}
                                    </Typography>
                                )}
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
                                value={formData.prefix}
                                onChange={handleInputChange('prefix')}
                                disabled={!editing}
                                placeholder="Dr., Prof., Mr., Ms."
                                sx={{ width: { xs: '100%', sm: '20%' } }}
                            />
                            <TextField
                                label="First Name"
                                value={formData.firstName}
                                onChange={handleInputChange('firstName')}
                                disabled={!editing}
                                required
                                fullWidth
                            />
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Middle Name"
                                value={formData.middleName}
                                onChange={handleInputChange('middleName')}
                                disabled={!editing}
                                fullWidth
                            />
                            <TextField
                                label="Last Name"
                                value={formData.lastName}
                                onChange={handleInputChange('lastName')}
                                disabled={!editing}
                                required
                                fullWidth
                            />
                            <TextField
                                label="Suffix"
                                value={formData.suffix}
                                onChange={handleInputChange('suffix')}
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
                                {currentThemeColor && currentThemeColor === formData.themeColor && (
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
                                        bgcolor: formData.themeColor,
                                        border: '3px solid',
                                        borderColor: currentThemeColor === formData.themeColor ? 'primary.main' : 'divider',
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
                                        {formData.themeColor.toUpperCase()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {currentThemeColor === formData.themeColor
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
                                    checked={formData.reduceAnimations}
                                    onChange={handleSwitchChange('reduceAnimations')}
                                    disabled={!editing && !session?.user?.email}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2">Reduce Animations</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Disable animations for better performance or accessibility
                                    </Typography>
                                </Box>
                            }
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
                    value={formData.themeColor}
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
                                InputProps={{
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
                                InputProps={{
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
                                InputProps={{
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
