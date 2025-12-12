import * as React from 'react';
import {
    TextField, Button, Link, Alert, Typography, FormControl, IconButton,
    InputAdornment, InputLabel, OutlinedInput, Fab, CircularProgress, Tooltip
} from '@mui/material';
import { Visibility, VisibilityOff, Engineering as EngineeringIcon } from '@mui/icons-material';
import { SignInPage } from '@toolpad/core/SignInPage';
import { useNavigate, useLocation } from 'react-router';
import { useSession } from '@toolpad/core';
import { AuthenticationContext } from '@toolpad/core/AppProvider';
import { useSnackbar } from '../contexts/SnackbarContext';
import { signInWithCredentials } from '../utils/firebase/auth/client';
import { findUserById } from '../utils/firebase/firestore/user';
import { formatDisplayName } from '../utils/avatarUtils';

import { buildAdminApiHeaders, resolveAdminApiBaseUrl } from '../utils/firebase/api';
import { encryptPassword } from '../utils/cryptoUtils';
import type { NavigationItem } from '../types/navigation';
import type { Session, ExtendedAuthentication } from '../types/session';
import { AnimatedPage } from '../components/Animate';

export const metadata: NavigationItem = {
    title: 'Sign In',
    segment: 'sign-in',
    hidden: true,
    requiresLayout: false, // Sign-in page doesn't need app bar/drawer
};

const DEV_HELPER_USERNAME = import.meta.env.VITE_DEV_HELPER_USERNAME || '';
const DEV_HELPER_PASSWORD = import.meta.env.VITE_DEV_HELPER_PASSWORD || '';
const DEV_EMAIL_DOMAIN = import.meta.env.VITE_DEV_EMAIL_DOMAIN || 'thesisflow.dev';
const DEV_EMAIL_SUFFIX = DEV_EMAIL_DOMAIN.startsWith('@') ? DEV_EMAIL_DOMAIN : '@' + DEV_EMAIL_DOMAIN;
const DEV_HELPER_EXISTS = DEV_HELPER_USERNAME !== '' && DEV_HELPER_PASSWORD !== '';


/**
 * Context for managing form state in the sign-in page
 */
const FormContext = React.createContext<{
    emailValue: string;
    passwordValue: string;
    setEmailValue: (value: string) => void;
    setPasswordValue: (value: string) => void;
    noUsersState: boolean | null;
} | null>(null);

/**
 * Alert shown when no admin accounts exist yet
 */
function Alerts() {
    const formContext = React.useContext(FormContext);
    const noAdminState = formContext?.noUsersState;

    return (
        <>
            {noAdminState === true && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    No admin accounts exist yet. Use the developer button to initialize the system.
                </Alert>
            )}
        </>
    );
}

/**
 * Email input field component
 */
function CustomEmailField() {
    const formContext = React.useContext(FormContext);

    return (
        <TextField
            id="email"
            label="Email"
            name="email"
            type="email"
            size="small"
            fullWidth
            variant="outlined"
            value={formContext?.emailValue || ''}
            onChange={(e) => formContext?.setEmailValue(e.target.value)}
        />
    );
}

/**
 * Password input field component
 */
function CustomPasswordField() {
    const [showPassword, setShowPassword] = React.useState(false);
    const formContext = React.useContext(FormContext);

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent) => event.preventDefault();

    return (
        <FormControl sx={{ my: 2 }} fullWidth variant="outlined">
            <InputLabel size="small" htmlFor="password">Password</InputLabel>
            <OutlinedInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                size="small"
                value={formContext?.passwordValue || ''}
                onChange={(e) => formContext?.setPasswordValue(e.target.value)}
                endAdornment={
                    <InputAdornment position="end">
                        <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                            size="small"
                        >
                            {showPassword ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                        </IconButton>
                    </InputAdornment>
                }
                label="Password"
            />
        </FormControl>
    );
}

/**
 * Button component for submitting the sign-in form
 */
function CustomButton() {
    return (
        <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            disableElevation
            color="primary"
            sx={{
                mt: 3,
                mb: 2,
                textTransform: 'capitalize'
            }}
        >
            Log In
        </Button>
    );
}

/**
 * Forgot password link component
 */
function ForgotPasswordLink() {
    return (
        <Link href="/forgot-password" variant="body2">
            Forgot password?
        </Link>
    );
}

/**
 * Props for DevAccountFab component
 */
interface DevAccountFabProps {
    onSignIn: (email: string, password: string) => Promise<void>;
    showFab: boolean;
}

/**
 * Floating action button for creating/signing in developer account
 * Only visible when no admin accounts exist (excluding developer accounts)
 */
function DevAccountFab({ onSignIn, showFab }: DevAccountFabProps) {
    const [loading, setLoading] = React.useState(false);
    const { showNotification } = useSnackbar();

    // Only show if DEV_HELPER is configured and no admin accounts exist
    if (!DEV_HELPER_EXISTS || !showFab) {
        return null;
    }

    const devEmail = DEV_HELPER_USERNAME + DEV_EMAIL_SUFFIX;
    const devPassword = DEV_HELPER_PASSWORD;

    const handleClick = async () => {
        setLoading(true);
        try {
            const apiBaseUrl = resolveAdminApiBaseUrl();
            const headers = await buildAdminApiHeaders();
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET || '';


            if (!apiSecret) {
                showNotification('API secret not configured', 'error');
                setLoading(false);
                return;
            }

            // Encrypt the password before sending to the API
            const encryptedPassword = await encryptPassword(devPassword, apiSecret);

            // Create the developer account via serverless API
            const response = await fetch(`${apiBaseUrl}/user/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: devEmail,
                    password: encryptedPassword,
                    role: 'developer',
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                // Account created or already exists
                if (data.message?.includes('already exists')) {
                    showNotification('Developer account exists, signing in...', 'info', 2000);
                } else {
                    showNotification('Developer account created, signing in...', 'success', 2000);
                }
            } else if (response.status === 409 || data.error?.includes('already exists')) {
                // Account exists - this is acceptable
                showNotification('Developer account exists, signing in...', 'info', 2000);
            } else {
                // Real error - show and abort
                console.error('Dev account creation failed:', response.status, data);
                showNotification(data.error || 'Failed to create developer account', 'error');
                setLoading(false);
                return;
            }

            // Small delay to ensure Firebase Auth has the user ready
            await new Promise(resolve => setTimeout(resolve, 500));

            // Sign in with Firebase Auth using the dev credentials
            await onSignIn(devEmail, devPassword);
        } catch (error) {
            console.error('Dev account FAB error:', error);
            showNotification(
                error instanceof Error ? error.message : 'Failed to sign in as developer',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip title="Quick Developer Sign In" placement="left">
            <Fab
                color="success"
                onClick={handleClick}
                disabled={loading}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                }}
                aria-label="developer sign in"
            >
                {loading ? (
                    <CircularProgress size={24} color="inherit" />
                ) : (
                    <EngineeringIcon />
                )}
            </Fab>
        </Tooltip>
    );
}

/**
 * Sign-in page
 */
export default function SignIn() {
    // Session hook for potential future use (e.g., redirect if already signed in)
    useSession<Session>();
    const authentication = React.useContext(AuthenticationContext) as ExtendedAuthentication | null;
    const { showNotification } = useSnackbar();
    const navigate = useNavigate();
    const location = useLocation();

    const sanitizeCallbackUrl = React.useCallback((value?: string | null) => {
        if (!value) return null;

        let decoded = value;
        try {
            decoded = decodeURIComponent(value);
        } catch {
            decoded = value;
        }

        if (decoded.startsWith('/')) {
            return decoded;
        }

        if (typeof window !== 'undefined') {
            try {
                const parsed = new URL(decoded, window.location.origin);
                if (parsed.origin === window.location.origin) {
                    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
                }
            } catch (error) {
                console.warn('Invalid callbackUrl provided:', error);
            }
        }

        return null;
    }, []);

    const callbackUrlFromSearch = React.useMemo(() => {
        const params = new URLSearchParams(location.search);
        return sanitizeCallbackUrl(params.get('callbackUrl'));
    }, [location.search, sanitizeCallbackUrl]);

    // Form state for controlled components
    const [emailValue, setEmailValue] = React.useState('');
    const [passwordValue, setPasswordValue] = React.useState('');
    const [noUsersState, setNoUsersState] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        let active = true;
        (async () => {
            try {
                // Use serverless API to check if admin users exist (avoids permission issues)
                const apiBaseUrl = resolveAdminApiBaseUrl();
                const headers = await buildAdminApiHeaders();
                const response = await fetch(`${apiBaseUrl}/user/exists`, {
                    method: 'GET',
                    headers,
                });

                if (!response.ok) {
                    throw new Error(`API returned ${response.status}`);
                }

                const data = await response.json();
                if (!active) return;
                // noUsersState = true means NO admin accounts exist (show FAB)
                setNoUsersState(!data.adminExists);
            } catch (error) {
                console.warn('Error checking existing admin users:', error);
                if (!active) return;
                setNoUsersState(null);
                // Don't show notification for this check - it's not critical
            }
        })();
        return () => { active = false; };
    }, []);

    // if (session?.loading) {
    //     return (
    //         <AnimatedPage variant="fade">
    //             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    //                 <Stack spacing={2} alignItems="center">
    //                     <CircularProgress size={28} />
    //                     <Typography variant="body2" color="text.secondary">
    //                         Preparing your session...
    //                     </Typography>
    //                 </Stack>
    //             </Box>
    //         </AnimatedPage>
    //     );
    // }

    // if (session?.user) {
    //     return <Navigate to="/" />;
    // }

    const formContextValue = {
        emailValue,
        passwordValue,
        setEmailValue,
        setPasswordValue,
        noUsersState,
    };

    /**
     * Handles developer account sign-in for the floating action button
     * Uses real Firebase authentication - no fake sessions
     */
    const handleDevSignIn = React.useCallback(async (email: string, password: string) => {
        // Use real Firebase sign-in (account must exist in Firebase Auth)
        const result = await signInWithCredentials(email, password);
        if (result?.success && result?.user) {
            const profile = await findUserById(result.user.uid);
            const displayName = profile ? formatDisplayName(profile) : (result.user.displayName || email.split('@')[0]);
            // For developer accounts, we may not have a Firestore profile
            // Create session from Firebase Auth user data
            const userSession: Session = {
                user: {
                    uid: profile?.uid || result.user.uid,
                    name: displayName,
                    email: profile?.email || result.user.email || email,
                    image: profile?.avatar || result.user.photoURL || '',
                    role: profile?.role || 'developer',
                    department: profile?.department,
                    course: profile?.course,
                },
            };
            authentication?.setSession?.(userSession);
            navigate('/', { replace: true });
            showNotification('Signed in as developer', 'success', 3000);
        } else {
            throw new Error(result?.error || 'Sign in failed');
        }
    }, [authentication, navigate, showNotification]);

    return (
        <AnimatedPage variant='fade' duration='enteringScreen'>
            <FormContext.Provider value={formContextValue}>
                <SignInPage
                    providers={[{ id: 'credentials', name: 'Knightmail' }]}
                    signIn={async (provider, formData, callbackUrl) => {
                        let result;
                        try {
                            if (provider.id === 'credentials') {
                                // Use our controlled values instead of formData for better reliability
                                const email = emailValue || (formData?.get('email') as string);
                                const password = passwordValue || (formData?.get('password') as string);

                                if (!email && !password) {
                                    return { error: 'Email and password are required' };
                                }
                                if (!email) return { error: 'Email is required' };
                                if (!password) return { error: 'Password is required' };


                                // Special dev-only db-helper shortcut: emails like <name>@thesisflow.dev
                                if ((DEV_HELPER_EXISTS && noUsersState))
                                    try {
                                        if (email.toLowerCase().endsWith(DEV_EMAIL_SUFFIX)) {
                                            const name = email.split('@')[0];
                                            // Only apply the dev-helper shortcut when the local-part exactly matches the configured dev username.
                                            // If the email is someone@thesisflow.dev but the local-part is not the dev helper username,
                                            // fall through to the normal sign-in flow (don't return an 'Invalid dev credentials' error).
                                            if (name === DEV_HELPER_USERNAME) {
                                                if (password === DEV_HELPER_PASSWORD) {
                                                    // Create a temporary session so Layout doesn't redirect to sign-in
                                                    try {
                                                        const tmpSession: Session = {
                                                            user: {
                                                                uid: 'dev556',
                                                                name,
                                                                email,
                                                                role: 'developer',
                                                            },
                                                        };
                                                        authentication?.setSession?.(tmpSession);
                                                        navigate('/', { replace: true });
                                                        showNotification('Signed in as developer', 'success', 3000);
                                                        return {};
                                                    } catch (e) {
                                                        // navigation error: fall back to normal flow
                                                        console.warn('dev navigation failed', e);
                                                    }
                                                } else {
                                                    return { error: 'Invalid dev credentials' };
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        // ignore env access issues and continue with normal sign-in
                                        console.warn('dev env check failed', e);
                                    }


                                result = await signInWithCredentials(email, password);
                            }

                            if (result?.success && result?.user) {
                                const profile = await findUserById(result.user.uid);

                                if (!profile) {
                                    showNotification('User profile not found. Contact an administrator.', 'error', 0);
                                    return { error: 'User profile not found' };
                                }

                                // Check if user must change password on first login (no lastActive = never logged in)
                                if (!profile.lastActive) {
                                    const userSession: Session = {
                                        user: {
                                            uid: profile.uid || result.user.uid,
                                            name: formatDisplayName(profile),
                                            email: profile.email,
                                            image: profile.avatar || '',
                                            role: profile.role,
                                            department: profile.department,
                                            course: profile.course,
                                        },
                                    };
                                    authentication?.setSession?.(userSession);
                                    // Redirect to change password page with first login context
                                    navigate('/change-password', {
                                        replace: true,
                                        state: {
                                            isFirstLogin: true,
                                            temporaryPassword: passwordValue ||
                                                (formData?.get('password') as string),
                                        },
                                    });
                                    showNotification(
                                        'Please set a new password for your account.',
                                        'info',
                                        5000
                                    );
                                    return {};
                                }

                                const userSession: Session = {
                                    user: {
                                        uid: profile.uid || result.user.uid,
                                        name: formatDisplayName(profile),
                                        email: profile.email,
                                        image: profile.avatar || '',
                                        role: profile.role,
                                        department: profile.department,
                                        course: profile.course,
                                    },
                                };
                                authentication?.setSession?.(userSession);
                                const targetUrl = sanitizeCallbackUrl(callbackUrl) ?? callbackUrlFromSearch ?? '/';
                                navigate(targetUrl, { replace: true });
                                return {};
                            }
                            return { error: result?.error || 'Failed to sign in' };
                        } catch (error) {
                            if (typeof error === 'object' && error !== null && 'code' in error) {
                                const errorCode = (error as { code: string }).code;
                                if (errorCode === 'auth/invalid-credential') {
                                    showNotification('Invalid email or password', 'error');
                                    return { error: 'Invalid Credentials' };
                                }
                                showNotification(`Authentication error: ${errorCode}`, 'error');
                            } else {
                                showNotification('An error occurred during sign in', 'error');
                            }
                            return { error: error instanceof Error ? error.message : 'An error occurred' };
                        }
                    }}
                    slots={{
                        subtitle: Alerts,
                        emailField: CustomEmailField,
                        passwordField: CustomPasswordField,
                        submitButton: CustomButton,
                        forgotPasswordLink: ForgotPasswordLink,
                    }}
                />
                <DevAccountFab onSignIn={handleDevSignIn} showFab={noUsersState === true} />
            </FormContext.Provider>
        </AnimatedPage>
    );
}
