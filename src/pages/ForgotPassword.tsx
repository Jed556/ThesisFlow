import * as React from 'react';
import {
    Box, Button, Card, CardContent, CircularProgress, Stack,
    TextField, Typography, Alert, Link, Stepper, Step, StepLabel,
    FormControl, IconButton, InputAdornment, InputLabel, OutlinedInput,
} from '@mui/material';
import {
    Email as EmailIcon, Lock as LockIcon, Pin as PinIcon,
    Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
    Check as CheckIcon, ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AnimatedPage } from '../components/Animate';
import BrandingLogo from '../components/BrandingLogo';
import type { NavigationItem } from '../types/navigation';

export const metadata: NavigationItem = {
    title: 'Forgot Password',
    segment: 'forgot-password',
    hidden: true,
    requiresLayout: false,
};

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

const STEPS = ['Enter Email', 'Verify OTP', 'Reset Password'];
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a random OTP code
 */
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Forgot Password page with OTP verification
 * Allows users to reset their password via email OTP
 */
export default function ForgotPassword() {
    const navigate = useNavigate();
    const { showNotification } = useSnackbar();

    // Step state
    const [activeStep, setActiveStep] = React.useState(0);

    // Email step
    const [email, setEmail] = React.useState('');
    const [emailError, setEmailError] = React.useState<string | null>(null);
    const [sendingOtp, setSendingOtp] = React.useState(false);

    // OTP step
    const [otp, setOtp] = React.useState('');
    const [generatedOtp, setGeneratedOtp] = React.useState<string | null>(null);
    const [otpExpiry, setOtpExpiry] = React.useState<Date | null>(null);
    const [otpError, setOtpError] = React.useState<string | null>(null);
    const [verifyingOtp, setVerifyingOtp] = React.useState(false);
    const [resendCooldown, setResendCooldown] = React.useState(0);

    // Password step
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [resettingPassword, setResettingPassword] = React.useState(false);
    const [passwordError, setPasswordError] = React.useState<string | null>(null);

    // User data from email lookup
    const [_userName, setUserName] = React.useState<string | undefined>();
    const [userUid, setUserUid] = React.useState<string | null>(null);

    // Resend cooldown timer
    React.useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    /**
     * Validate email format
     */
    const isValidEmail = (emailStr: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
    };

    /**
     * Send OTP to user's email
     */
    const handleSendOtp = async () => {
        setEmailError(null);

        if (!email.trim()) {
            setEmailError('Please enter your email address.');
            return;
        }

        if (!isValidEmail(email)) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        setSendingOtp(true);

        try {
            // Check if user exists via API (bypasses Firestore rules for unauthenticated users)
            const findUserResponse = await fetch('/api/user/find-by-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (!findUserResponse.ok) {
                if (findUserResponse.status === 404) {
                    setEmailError('No account found with this email address.');
                } else {
                    const errorData = await findUserResponse.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to check email');
                }
                setSendingOtp(false);
                return;
            }

            const { user } = await findUserResponse.json();
            if (!user) {
                setEmailError('No account found with this email address.');
                setSendingOtp(false);
                return;
            }

            // Store user info for later
            setUserName(user.displayName);
            setUserUid(user.uid);

            // Generate OTP
            const newOtp = generateOtp();
            setGeneratedOtp(newOtp);
            setOtpExpiry(new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000));

            // Send OTP email
            const response = await fetch('/api/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: email,
                    template: 'otp',
                    data: {
                        recipientName: user.displayName,
                        pin: newOtp,
                        expiryMinutes: OTP_EXPIRY_MINUTES,
                        purpose: 'reset your password',
                    },
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send verification code');
            }

            showNotification('Verification code sent to your email!', 'success');
            setActiveStep(1);
            setResendCooldown(60); // 60 second cooldown for resend
        } catch (err) {
            console.error('Failed to send OTP:', err);
            setEmailError('Failed to send verification code. Please try again.');
        } finally {
            setSendingOtp(false);
        }
    };

    /**
     * Resend OTP code
     */
    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        await handleSendOtp();
    };

    /**
     * Verify entered OTP
     */
    const handleVerifyOtp = () => {
        setOtpError(null);

        if (otp.length !== OTP_LENGTH) {
            setOtpError('Please enter the complete 6-digit code.');
            return;
        }

        // Check if OTP is expired
        if (otpExpiry && new Date() > otpExpiry) {
            setOtpError('Verification code has expired. Please request a new one.');
            return;
        }

        setVerifyingOtp(true);

        // Verify OTP
        if (otp === generatedOtp) {
            showNotification('Code verified successfully!', 'success');
            setActiveStep(2);
        } else {
            setOtpError('Invalid verification code. Please try again.');
        }

        setVerifyingOtp(false);
    };

    /**
     * Check if all password requirements are met
     */
    const passwordRequirementsMet = PASSWORD_REQUIREMENTS.every((req) =>
        req.validator(newPassword)
    );

    /**
     * Check if passwords match
     */
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

    /**
     * Reset password via API
     */
    const handleResetPassword = async () => {
        setPasswordError(null);

        if (!passwordRequirementsMet) {
            setPasswordError('Please meet all password requirements.');
            return;
        }

        if (!passwordsMatch) {
            setPasswordError('Passwords do not match.');
            return;
        }

        if (!userUid) {
            setPasswordError('User information not found. Please start over.');
            return;
        }

        setResettingPassword(true);

        try {
            // Import crypto utilities to encrypt the password
            const { encryptPassword } = await import('../utils/cryptoUtils');
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET || '';

            if (!apiSecret) {
                throw new Error('Configuration error');
            }

            const encryptedPassword = await encryptPassword(newPassword, apiSecret);

            // Call the update user API to reset password
            const response = await fetch('/api/user/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Secret': apiSecret,
                },
                body: JSON.stringify({
                    uid: userUid,
                    password: encryptedPassword,
                    lastActive: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to reset password');
            }

            showNotification('Password reset successfully! Please sign in.', 'success');
            navigate('/sign-in', { replace: true });
        } catch (err) {
            console.error('Failed to reset password:', err);
            setPasswordError(
                err instanceof Error ? err.message : 'Failed to reset password. Please try again.'
            );
        } finally {
            setResettingPassword(false);
        }
    };

    /**
     * Go back to previous step
     */
    const handleBack = () => {
        if (activeStep === 1) {
            setActiveStep(0);
            setOtp('');
            setOtpError(null);
        } else if (activeStep === 2) {
            setActiveStep(1);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordError(null);
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
                        maxWidth: 500,
                        width: '100%',
                        borderRadius: 3,
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack spacing={3}>
                            {/* Logo and Back Button */}
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                {activeStep > 0 ? (
                                    <IconButton onClick={handleBack} size="small">
                                        <ArrowBackIcon />
                                    </IconButton>
                                ) : (
                                    <Box sx={{ width: 40 }} />
                                )}
                                <BrandingLogo sx={{ width: 40, height: 40 }} />
                                <Box sx={{ width: 40 }} />
                            </Stack>

                            {/* Stepper */}
                            <Stepper activeStep={activeStep} alternativeLabel>
                                {STEPS.map((label) => (
                                    <Step key={label}>
                                        <StepLabel>{label}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>

                            {/* Step Content */}
                            {activeStep === 0 && (
                                <Stack spacing={3} alignItems="center">
                                    <Box
                                        sx={{
                                            bgcolor: 'primary.main',
                                            borderRadius: '50%',
                                            p: 2,
                                            display: 'flex',
                                        }}
                                    >
                                        <EmailIcon sx={{ fontSize: 32, color: 'primary.contrastText' }} />
                                    </Box>

                                    <Stack spacing={1} alignItems="center" textAlign="center">
                                        <Typography variant="h5" fontWeight="bold">
                                            Forgot Password?
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Enter your email address and we&apos;ll send you a verification
                                            code to reset your password.
                                        </Typography>
                                    </Stack>

                                    {emailError && (
                                        <Alert severity="error" sx={{ width: '100%' }}>
                                            {emailError}
                                        </Alert>
                                    )}

                                    <TextField
                                        fullWidth
                                        label="Email Address"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        size="small"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                                    />

                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={handleSendOtp}
                                        disabled={sendingOtp}
                                    >
                                        {sendingOtp ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : (
                                            'Send Verification Code'
                                        )}
                                    </Button>

                                    <Link
                                        component="button"
                                        variant="body2"
                                        onClick={() => navigate('/sign-in')}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        Back to Sign In
                                    </Link>
                                </Stack>
                            )}

                            {activeStep === 1 && (
                                <Stack spacing={3} alignItems="center">
                                    <Box
                                        sx={{
                                            bgcolor: 'primary.main',
                                            borderRadius: '50%',
                                            p: 2,
                                            display: 'flex',
                                        }}
                                    >
                                        <PinIcon sx={{ fontSize: 32, color: 'primary.contrastText' }} />
                                    </Box>

                                    <Stack spacing={1} alignItems="center" textAlign="center">
                                        <Typography variant="h5" fontWeight="bold">
                                            Enter Verification Code
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            We sent a 6-digit code to <strong>{email}</strong>.
                                            Enter it below to continue.
                                        </Typography>
                                    </Stack>

                                    {otpError && (
                                        <Alert severity="error" sx={{ width: '100%' }}>
                                            {otpError}
                                        </Alert>
                                    )}

                                    <TextField
                                        fullWidth
                                        label="Verification Code"
                                        value={otp}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            if (value.length <= OTP_LENGTH) {
                                                setOtp(value);
                                            }
                                        }}
                                        size="small"
                                        slotProps={{
                                            htmlInput: {
                                                maxLength: OTP_LENGTH,
                                                style: { letterSpacing: '0.5em', textAlign: 'center', fontWeight: 'bold' },
                                            },
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                                    />

                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={handleVerifyOtp}
                                        disabled={verifyingOtp || otp.length !== OTP_LENGTH}
                                    >
                                        {verifyingOtp ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : (
                                            'Verify Code'
                                        )}
                                    </Button>

                                    <Typography variant="body2" color="text.secondary">
                                        Didn&apos;t receive the code?{' '}
                                        {resendCooldown > 0 ? (
                                            <span>Resend in {resendCooldown}s</span>
                                        ) : (
                                            <Link
                                                component="button"
                                                variant="body2"
                                                onClick={handleResendOtp}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                Resend
                                            </Link>
                                        )}
                                    </Typography>
                                </Stack>
                            )}

                            {activeStep === 2 && (
                                <Stack spacing={3} alignItems="center">
                                    <Box
                                        sx={{
                                            bgcolor: 'primary.main',
                                            borderRadius: '50%',
                                            p: 2,
                                            display: 'flex',
                                        }}
                                    >
                                        <LockIcon sx={{ fontSize: 32, color: 'primary.contrastText' }} />
                                    </Box>

                                    <Stack spacing={1} alignItems="center" textAlign="center">
                                        <Typography variant="h5" fontWeight="bold">
                                            Reset Password
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Create a new password for your account.
                                        </Typography>
                                    </Stack>

                                    {passwordError && (
                                        <Alert severity="error" sx={{ width: '100%' }}>
                                            {passwordError}
                                        </Alert>
                                    )}

                                    <Box sx={{ width: '100%' }}>
                                        <Stack spacing={2.5}>
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
                                                <InputLabel size="small">Confirm Password</InputLabel>
                                                <OutlinedInput
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    size="small"
                                                    label="Confirm Password"
                                                    error={confirmPassword.length > 0 && !passwordsMatch}
                                                    endAdornment={
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                onClick={() =>
                                                                    setShowConfirmPassword(!showConfirmPassword)
                                                                }
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
                                        </Stack>
                                    </Box>

                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={handleResetPassword}
                                        disabled={resettingPassword || !passwordRequirementsMet || !passwordsMatch}
                                    >
                                        {resettingPassword ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </Button>
                                </Stack>
                            )}
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
