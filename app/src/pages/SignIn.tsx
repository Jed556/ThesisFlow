import * as React from 'react';
import { TextField, Button, Link, Alert, Typography, FormControl, IconButton, InputAdornment, InputLabel, OutlinedInput, Box, Chip, Stack } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { SignInPage } from '@toolpad/core/SignInPage';
import { Navigate, useNavigate } from 'react-router';
import { useSession } from '../SessionContext';
import { signInWithCredentials } from '../utils/firebase/auth';
import { getAllUsers, getUserByEmail } from '../utils/firebase/firestore';
import { isDevelopmentEnvironment } from '../utils/devUtils';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';

export const metadata: NavigationItem = {
    title: 'Sign In',
    segment: 'sign-in',
    hidden: true,
};

const DEV_HELPER_USERNAME = import.meta.env.VITE_DEV_HELPER_USERNAME || '';
const DEV_HELPER_PASSWORD = import.meta.env.VITE_DEV_HELPER_PASSWORD || '';
const DEV_EMAIL_DOMAIN = import.meta.env.VITE_DEV_EMAIL_DOMAIN || 'thesisflow.dev';
const DEV_EMAIL_SUFFIX = DEV_EMAIL_DOMAIN.startsWith('@') ? DEV_EMAIL_DOMAIN : '@' + DEV_EMAIL_DOMAIN;
const DEV_HELPER_EXISTS = DEV_HELPER_USERNAME !== '' && DEV_HELPER_PASSWORD !== '';
const DEV_HELPER_ENABLED = (import.meta.env.VITE_DEV_HELPER_ENABLED === 'true') && DEV_HELPER_EXISTS;


/**
 * Context for managing form state in the sign-in page
 */
const FormContext = React.createContext<{
    emailValue: string;
    passwordValue: string;
    setEmailValue: (value: string) => void;
    setPasswordValue: (value: string) => void;
} | null>(null);

function noUsers(): boolean | null {
    const [noUsers, setNoUsers] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        let active = true;
        (async () => {
            try {
                const existing = await getAllUsers();
                if (!active) return;
                setNoUsers(existing.length === 0);
            } catch (err) {
                console.warn('Failed to check existing users', err);
                if (!active) return;
                setNoUsers(null);
            }
        })();
        return () => { active = false; };
    }, []);

    return noUsers;
}

/**
 * Info alert with test account buttons for development environment
 */
function Alerts() {
    const formContext = React.useContext(FormContext);
    let testAccountsStack;

    if (isDevelopmentEnvironment()) {
        const testAccounts: { role: string; email: string; color: 'primary' | 'secondary' | 'info' | 'error' | 'success' }[] = [
            { role: 'Student', email: 'student' + DEV_EMAIL_SUFFIX, color: 'primary' as const },
            { role: 'Adviser', email: 'adviser' + DEV_EMAIL_SUFFIX, color: 'secondary' as const },
            { role: 'Editor', email: 'editor' + DEV_EMAIL_SUFFIX, color: 'info' as const },
            { role: 'Admin', email: 'admin' + DEV_EMAIL_SUFFIX, color: 'error' as const },
        ];

        if (DEV_HELPER_ENABLED) {
            testAccounts.push({ role: 'Developer', email: DEV_HELPER_USERNAME + DEV_EMAIL_SUFFIX, color: 'success' as const });
        }

        const handleDevClick = (email: string) => {
            if (formContext && isDevelopmentEnvironment()) {
                formContext.setEmailValue(email);

                if (DEV_HELPER_ENABLED)
                    try {
                        const emailPrefix = email.split('@')[0];
                        if (emailPrefix === (DEV_HELPER_USERNAME) && DEV_HELPER_PASSWORD) {
                            formContext.setPasswordValue(DEV_HELPER_PASSWORD);
                            return;
                        }
                    } catch (e) { } // ignore env access issues and fall back to default

                formContext.setPasswordValue('Password_123');
            }
        };

        testAccountsStack = (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {testAccounts.map((account) => (
                    <Chip
                        key={account.email}
                        label={account.role}
                        color={account.color}
                        variant="outlined"
                        clickable
                        size="small"
                        onClick={() => handleDevClick(account.email)}
                        sx={{
                            cursor: 'pointer',
                            '&:hover': {
                                backgroundColor: `${account.color}.50`,
                            }
                        }}
                    />
                ))}
            </Stack>
        );
    }

    return (
        <>
            {testAccountsStack && (
                <Alert severity="info">
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Development Test Accounts
                    </Typography>
                    {testAccountsStack}
                </Alert>
            )}
            {noUsers() === true && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    No user accounts exist yet. Sign in with the developer account first to initialize users.
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
        <Link href="/" variant="body2">
            Forgot password?
        </Link>
    );
}

/**
 * Sign-in page
 */
export default function SignIn() {
    const { session, setSession } = useSession();
    const navigate = useNavigate();

    // Form state for controlled components
    const [emailValue, setEmailValue] = React.useState('');
    const [passwordValue, setPasswordValue] = React.useState('');

    if (session) {
        return <Navigate to="/" />;
    }

    const formContextValue = {
        emailValue,
        passwordValue,
        setEmailValue,
        setPasswordValue,
    };

    return (
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
                            if ((DEV_HELPER_EXISTS && noUsers()) || DEV_HELPER_ENABLED)
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
                                                            name,
                                                            email,
                                                            role: 'developer',
                                                        },
                                                    };
                                                    setSession(tmpSession);
                                                    navigate('/dev-helper', { replace: true });
                                                    return {};
                                                } catch (e) {
                                                    // navigation error: fall back to normal flow
                                                    console.warn('dev-helper navigation failed', e);
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
                            const email = result.user.email || '';
                            let userRole;

                            try {
                                const profile = await getUserByEmail(email);
                                if (profile && profile.role) {
                                    userRole = profile.role;
                                }
                            } catch (err) {
                                // ignore and fallback to getUserRole
                                console.warn('Failed to read user profile for role detection', err);
                            }

                            const userSession: Session = {
                                user: {
                                    name: result.user.displayName || '',
                                    email: email,
                                    image: result.user.photoURL || '',
                                    role: userRole,
                                },
                            };
                            setSession(userSession);
                            navigate(callbackUrl || '/', { replace: true });
                            return {};
                        }
                        return { error: result?.error || 'Failed to sign in' };
                    } catch (error) {
                        if (typeof error === 'object' && error !== null && 'code' in error) {
                            console.error('Sign-in error:', (error as { code: string }).code);
                            if ((error as { code: string }).code === 'auth/invalid-credential') {
                                return { error: 'Invalid Credentials' };
                            }
                        } else {
                            console.error('Sign-in error:', error);
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
        </FormContext.Provider>
    );
}
