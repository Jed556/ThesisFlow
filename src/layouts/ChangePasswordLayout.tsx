import * as React from 'react';
import {
    Box, Button, Card, CardContent, CircularProgress, FormControl, IconButton,
    InputAdornment, InputLabel, OutlinedInput, Stack, Typography, Alert
} from '@mui/material';
import {
    Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon, Lock as LockIcon, Check as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { firebaseAuth } from '../utils/firebase/firebaseConfig';
import { updateUserProfile } from '../utils/firebase/firestore/user';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AnimatedPage } from '../components/Animate';
import { getError } from '../../utils/errorUtils';
import BrandingLogo from '../components/BrandingLogo';

export interface ChangePasswordLayoutProps {
    /**
     * The user's UID for updating profile
     */
    uid: string;
    /**
     * The user's email for reauthentication
     */
    email: string;
    /**
     * Title to display on the page
     */
    title?: string;
    /**
     * Description message to display
     */
    description?: string;
    /**
     * Whether this is a first-time password change (no current password required)
     */
    isFirstLogin?: boolean;
    /**
     * Temporary password for first login reauthentication
     */
    temporaryPassword?: string;
    /**
     * Callback when password change is successful
     */
    onSuccess?: () => void;
    /**
     * Where to redirect after successful password change
     */
    redirectTo?: string;
}

/**
 * Password validation requirements
 */
interface PasswordRequirement {
    id: string;
    label: string;
    validator: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    {
        id: 'length',
        label: 'At least 8 characters',
        validator: (password) => password.length >= 8,
    },
    {
        id: 'uppercase',
        label: 'At least one uppercase letter',
        validator: (password) => /[A-Z]/.test(password),
    },
    {
        id: 'lowercase',
        label: 'At least one lowercase letter',
        validator: (password) => /[a-z]/.test(password),
    },
    {
        id: 'number',
        label: 'At least one number',
        validator: (password) => /\d/.test(password),
    },
];

/**
 * Reusable layout component for changing passwords
 * Used for first login password change and forgot password flows
 */
export default function ChangePasswordLayout({
    uid,
    email,
    title = 'Change Password',
    description = 'Please enter your new password.',
    isFirstLogin = false,
    temporaryPassword,
    onSuccess,
    redirectTo = '/',
}: ChangePasswordLayoutProps) {
    const navigate = useNavigate();
    const { showNotification } = useSnackbar();

    const [currentPassword, setCurrentPassword] = React.useState(temporaryPassword ?? '');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    /**
     * Check if all password requirements are met
     */
    const passwordRequirementsMet = React.useMemo(() => {
        return PASSWORD_REQUIREMENTS.every((req) => req.validator(newPassword));
    }, [newPassword]);

    /**
     * Check if passwords match
     */
    const passwordsMatch = React.useMemo(() => {
        return newPassword === confirmPassword && confirmPassword.length > 0;
    }, [newPassword, confirmPassword]);

    /**
     * Check if form is valid for submission
     */
    const isFormValid = React.useMemo(() => {
        const hasCurrentPassword = isFirstLogin || currentPassword.length > 0;
        return hasCurrentPassword && passwordRequirementsMet && passwordsMatch;
    }, [isFirstLogin, currentPassword, passwordRequirementsMet, passwordsMatch]);

    /**
     * Handle password change submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!firebaseAuth.currentUser) {
            setError('You must be signed in to change your password.');
            return;
        }

        if (!isFormValid) {
            setError('Please fill in all fields correctly.');
            return;
        }

        setLoading(true);

        try {
            // Reauthenticate the user
            const passwordToUse = isFirstLogin && temporaryPassword
                ? temporaryPassword
                : currentPassword;

            const credential = EmailAuthProvider.credential(email, passwordToUse);
            await reauthenticateWithCredential(firebaseAuth.currentUser, credential);

            // Update the password
            await updatePassword(firebaseAuth.currentUser, newPassword);

            // Set lastActive to mark first successful login
            await updateUserProfile(uid, { lastActive: new Date() });

            showNotification('Password changed successfully!', 'success');

            if (onSuccess) {
                onSuccess();
            } else {
                navigate(redirectTo, { replace: true });
            }
        } catch (err) {
            const parsedError = getError(err, 'Failed to change password');
            console.error('Password change error:', parsedError);

            if (parsedError.code === 'auth/wrong-password') {
                setError('Current password is incorrect.');
            } else if (parsedError.code === 'auth/weak-password') {
                setError('New password is too weak. Please choose a stronger password.');
            } else if (parsedError.code === 'auth/requires-recent-login') {
                setError('Your session has expired. Please sign in again.');
            } else {
                setError(parsedError.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatedPage variant="fade" duration="enteringScreen">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    p: 3,
                }}
            >
                <Card
                    elevation={3}
                    sx={{
                        maxWidth: 450,
                        width: '100%',
                        borderRadius: 3,
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack spacing={3} alignItems="center">
                            {/* Logo */}
                            <Box sx={{ mb: 1 }}>
                                <BrandingLogo sx={{ width: 48, height: 48 }} />
                            </Box>

                            {/* Lock Icon */}
                            <Box
                                sx={{
                                    bgcolor: 'primary.main',
                                    borderRadius: '50%',
                                    p: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <LockIcon sx={{ fontSize: 32, color: 'primary.contrastText' }} />
                            </Box>

                            {/* Title and Description */}
                            <Stack spacing={1} alignItems="center" textAlign="center">
                                <Typography variant="h5" fontWeight="bold">
                                    {title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {description}
                                </Typography>
                            </Stack>

                            {/* Error Alert */}
                            {error && (
                                <Alert severity="error" sx={{ width: '100%' }}>
                                    {error}
                                </Alert>
                            )}

                            {/* Password Form */}
                            <Box
                                component="form"
                                onSubmit={handleSubmit}
                                sx={{ width: '100%' }}
                            >
                                <Stack spacing={2.5}>
                                    {/* Current Password - only show if not first login or no temp password */}
                                    {(!isFirstLogin || !temporaryPassword) && (
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel size="small">
                                                {isFirstLogin ? 'Temporary Password' : 'Current Password'}
                                            </InputLabel>
                                            <OutlinedInput
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                size="small"
                                                label={isFirstLogin ? 'Temporary Password' : 'Current Password'}
                                                endAdornment={
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showCurrentPassword ? (
                                                                <VisibilityOffIcon fontSize="small" />
                                                            ) : (
                                                                <VisibilityIcon fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </InputAdornment>
                                                }
                                            />
                                        </FormControl>
                                    )}

                                    {/* New Password */}
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel size="small">New Password</InputLabel>
                                        <OutlinedInput
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            size="small"
                                            label="New Password"
                                            endAdornment={
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        {showNewPassword ? (
                                                            <VisibilityOffIcon fontSize="small" />
                                                        ) : (
                                                            <VisibilityIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            }
                                        />
                                    </FormControl>

                                    {/* Password Requirements */}
                                    <Box sx={{ pl: 1 }}>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ mb: 0.5, display: 'block' }}
                                        >
                                            Password requirements:
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {PASSWORD_REQUIREMENTS.map((req) => {
                                                const isMet = req.validator(newPassword);
                                                return (
                                                    <Stack
                                                        key={req.id}
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <CheckIcon
                                                            sx={{
                                                                fontSize: 16,
                                                                color: isMet ? 'success.main' : 'text.disabled',
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            color={isMet ? 'success.main' : 'text.secondary'}
                                                        >
                                                            {req.label}
                                                        </Typography>
                                                    </Stack>
                                                );
                                            })}
                                        </Stack>
                                    </Box>

                                    {/* Confirm Password */}
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel size="small">Confirm New Password</InputLabel>
                                        <OutlinedInput
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            size="small"
                                            label="Confirm New Password"
                                            error={confirmPassword.length > 0 && !passwordsMatch}
                                            endAdornment={
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        {showConfirmPassword ? (
                                                            <VisibilityOffIcon fontSize="small" />
                                                        ) : (
                                                            <VisibilityIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            }
                                        />
                                        {confirmPassword.length > 0 && !passwordsMatch && (
                                            <Typography
                                                variant="caption"
                                                color="error"
                                                sx={{ mt: 0.5, ml: 1.5 }}
                                            >
                                                Passwords do not match
                                            </Typography>
                                        )}
                                    </FormControl>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        fullWidth
                                        disabled={loading || !isFormValid}
                                        sx={{ mt: 1 }}
                                    >
                                        {loading ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : (
                                            'Change Password'
                                        )}
                                    </Button>
                                </Stack>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Footer */}
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 3, textAlign: 'center' }}
                >
                    ThesisFlow - Research Management System
                </Typography>
            </Box>
        </AnimatedPage>
    );
}
