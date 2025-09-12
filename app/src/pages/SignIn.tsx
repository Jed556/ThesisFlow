import * as React from 'react';
import { TextField, Button, Link, Alert, Typography, FormControl, IconButton, InputAdornment, InputLabel, OutlinedInput, Box, Chip, Stack } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { SignInPage } from '@toolpad/core/SignInPage';
import { Navigate, useNavigate } from 'react-router';
import { useSession, type Session } from '../SessionContext';
import { signInWithCredentials } from '../firebase/auth';
import { getUserRole } from '../utils/roleUtils';
import { isDevelopmentEnvironment } from '../utils/developmentUtils';
import type { NavigationItem } from '../types/navigation';

export const metadata: NavigationItem = {
    title: 'Sign In',
    segment: 'sign-in',
    hidden: true,
};

const FormContext = React.createContext<{
    emailValue: string;
    passwordValue: string;
    setEmailValue: (value: string) => void;
    setPasswordValue: (value: string) => void;
} | null>(null);

function Info() {
    if (!isDevelopmentEnvironment()) {
        return null;
    }

    const formContext = React.useContext(FormContext);

    const testAccounts = [
        { role: 'Student', email: 'student@test.com', color: 'primary' as const },
        { role: 'Adviser', email: 'adviser@test.com', color: 'secondary' as const },
        { role: 'Editor', email: 'editor@test.com', color: 'info' as const },
        { role: 'Admin', email: 'admin@test.com', color: 'error' as const },
    ];

    const handleDevClick = (email: string) => {
        if (formContext && isDevelopmentEnvironment()) {
            formContext.setEmailValue(email);
            formContext.setPasswordValue('Password_123');
        }
    };

    return (
        <Alert severity="info">
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Development Test Accounts
            </Typography>
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
        </Alert>
    );
}

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

function ForgotPasswordLink() {
    return (
        <Link href="/" variant="body2">
            Forgot password?
        </Link>
    );
}

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

                            result = await signInWithCredentials(email, password);
                        }

                        if (result?.success && result?.user) {
                            const email = result.user.email || '';
                            const userRole = getUserRole(email);

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
                    subtitle: Info,
                    emailField: CustomEmailField,
                    passwordField: CustomPasswordField,
                    submitButton: CustomButton,
                    forgotPasswordLink: ForgotPasswordLink,
                }}
            />
        </FormContext.Provider>
    );
}
