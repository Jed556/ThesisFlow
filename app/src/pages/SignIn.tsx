'use client';
import * as React from 'react';
import { LinearProgress, TextField, Button, Link, Alert, FormControl, IconButton, InputAdornment, InputLabel, OutlinedInput } from '@mui/material';
import { Visibility, VisibilityOff, AccountCircle } from '@mui/icons-material';
import { SignInPage } from '@toolpad/core/SignInPage';
import { Navigate, useNavigate } from 'react-router';
import { useSession, type Session } from '../SessionContext';
import { signInWithGoogle, signInWithGithub, signInWithCredentials } from '../firebase/auth';
import { getUserRole } from '../utils/roleUtils';
import type { NavigationItem } from '../types/navigation';

export const metadata: NavigationItem = {
    // group: 'main',
    title: 'Sign In',
    segment: 'sign-in',
    // icon: <DashboardIcon />,
    // children: [],
    // path: '/dashboard',
    // roles: ['user', 'admin'],
    hidden: true,
};

function Info() {
    return (
        <>
            {/* <Alert severity="info">
        You can use <strong>toolpad-demo@mui.com</strong> with the password <strong>@demo1</strong> to
        test
      </Alert> */}
        </>
    );
}

function CustomEmailField() {
    return (
        <TextField
            id="email"
            label="Email"
            name="email"
            type="email"
            size="small"
            // required
            fullWidth
            // slotProps={{
            //   input: {
            //     startAdornment: (
            //       <InputAdornment position="start">
            //         <AccountCircle fontSize="inherit" />
            //       </InputAdornment>
            //     ),
            //   },
            // }}
            variant="outlined"
        />
    );
}

function CustomPasswordField() {
    const [showPassword, setShowPassword] = React.useState(false);

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    const handleMouseDownPassword = (event: React.MouseEvent) => {
        event.preventDefault();
    };

    return (
        <FormControl sx={{ my: 2 }} fullWidth variant="outlined">
            <InputLabel size="small" htmlFor="password">
                Password
            </InputLabel>
            <OutlinedInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                size="small"
                // required
                endAdornment={
                    <InputAdornment position="end">
                        <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                            size="small"
                        >
                            {showPassword ? (
                                <VisibilityOff fontSize="inherit" />
                            ) : (
                                <Visibility fontSize="inherit" />
                            )}
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

function SignUpLink() {
    return (
        <Link href="/" variant="body2">
            Sign up
        </Link>
    );
}

export default function SignIn() {
    const { session, setSession, loading } = useSession();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div style={{ width: '100%' }}>
                <LinearProgress />
            </div>
        );
    }

    if (session) {
        return <Navigate to="/" />;
    }

    return (
        <SignInPage
            providers={[
                // { id: 'google', name: 'Google' },
                // { id: 'github', name: 'GitHub' },
                { id: 'credentials', name: 'Knightmail' },
            ]}
            signIn={async (provider, formData, callbackUrl) => {
                let result;
                try {
                    // if (provider.id === 'google') {
                    //   result = await signInWithGoogle();
                    // }
                    // if (provider.id === 'github') {
                    //   result = await signInWithGithub();
                    // }
                    if (provider.id === 'credentials') {
                        const email = formData?.get('email') as string;
                        const password = formData?.get('password') as string;

                        if (!email && !password) {
                            return { error: 'Email and password are required' };
                        }

                        if (!email) {
                            return { error: 'Email is required' };
                        }

                        if (!password) {
                            return { error: 'Password is required' };
                        }

                        result = await signInWithCredentials(email, password);
                    }

                    if (result?.success && result?.user) {
                        // Convert Firebase user to Session format
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
                // signUpLink: SignUpLink,
                // rememberMe: RememberMeCheckbox,
                forgotPasswordLink: ForgotPasswordLink,
            }}
        />
    );
}
