import * as React from 'react';
import { authSignOut, signInWithGoogle, onAuthStateChanged } from './utils/firebase/auth/client';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { findUserById } from './utils/firebase/firestore/user';
import { formatDisplayName } from './utils/avatarUtils';
import { setCurrentAppTheme } from './utils/devUtils';
import { buildNavigation } from './utils/navBuilder';
import { getUserRole } from './utils/roleUtils';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { navigationGroups } from './config/navigationGroups';
import { Outlet } from 'react-router';
import { SnackbarProvider, SnackbarContainer, useSnackbar } from './components/Snackbar';
import { ThemeProvider as CustomThemeProvider, useTheme as useCustomTheme } from './contexts/ThemeContext';
import BackgroundJobNotifications from './components/BackgroundJobNotifications';
import CalendarDeadlineNotifications from './components/CalendarDeadlineNotifications';

import type { Navigation } from '@toolpad/core/AppProvider';
import type { Session, ExtendedAuthentication } from './types/session';
import type { User } from 'firebase/auth';

import { CssBaseline } from '@mui/material';
import BrandingLogo from './components/BrandingLogo';

const BRANDING = {
    title: 'ThesisFlow',
    logo: <BrandingLogo />,
    homeUrl: '/dashboard'
};

function AppContent() {
    const { theme: customTheme, updateThemeFromSeedColor, resetTheme } = useCustomTheme();
    const { showNotification } = useSnackbar();
    const [sessionData, setSessionData] = React.useState<Session | null>(null);
    const [sessionLoading, setSessionLoading] = React.useState(true);
    const [navigation, setNavigation] = React.useState<Navigation>([]);

    const setSession = React.useCallback((nextSession: Session | null) => {
        setSessionData(nextSession);
        setSessionLoading(nextSession?.loading ?? false);
    }, []);

    const handleSignOut = React.useCallback(async () => {
        // Reset theme to default before signing out
        resetTheme();
        await authSignOut();
    }, [resetTheme]);

    const authentication = React.useMemo<ExtendedAuthentication>(
        () => ({
            signIn: signInWithGoogle,
            signOut: handleSignOut,
            setSession,
        }),
        [handleSignOut, setSession],
    );

    React.useEffect(() => {
        let active = true;

        async function initializeNavigation() {
            const userRole = sessionData?.user?.role;

            if (!userRole) {
                setNavigation([]);
                return;
            }

            try {
                const nav = await buildNavigation(navigationGroups, userRole);
                if (!active) return;
                setNavigation(nav);
            } catch (error) {
                console.error('Failed to build navigation:', error);
                if (!active) return;
                setNavigation([]);
            }
        }

        initializeNavigation();

        return () => {
            active = false;
        };
    }, [sessionData?.user?.role]);

    React.useEffect(() => {
        setSessionLoading(true);
        const unsubscribe = onAuthStateChanged(async (user: User | null) => {
            if (user) {
                setSession({ loading: true });

                try {
                    // Get role from Auth claims first, then fall back to Firestore
                    let userRole = await getUserRole(true); // Force refresh to get latest claims

                    // Fetch user profile for additional data
                    const profile = await findUserById(user.uid);

                    // Prefer Firestore role if Auth claims don't exist (backwards compatibility)
                    if (profile && profile.role && !userRole) {
                        userRole = profile.role;
                    }

                    // If we still don't have a valid role, don't create session
                    if (!userRole) {
                        console.error('Unable to determine user role');
                        showNotification('Unable to load user role. Please contact an administrator.', 'error', 0);
                        await authSignOut();
                        resetTheme();
                        setSession(null);
                        return;
                    }

                    // Apply user's theme preference on login
                    if (profile?.preferences?.themeColor) {
                        updateThemeFromSeedColor(profile.preferences.themeColor);
                    } else {
                        // Reset to default if no theme preference
                        resetTheme();
                    }

                    setSession({
                        user: {
                            uid: user.uid,
                            email: user.email || '',
                            name: profile ? formatDisplayName(profile) : (user.displayName || user.email || ''),
                            image: profile?.avatar || user.photoURL || '',
                            role: userRole,
                            department: profile?.department,
                            course: profile?.course,
                        },
                    });
                } catch (error) {
                    console.error('Failed to initialize session:', error);
                    showNotification('Failed to load user profile. Please try signing in again.', 'error', 0);
                    await authSignOut();
                    resetTheme();
                    setSession(null);
                }
            } else {
                // Reset to default theme on logout
                resetTheme();
                setSession(null);
            }
        });

        return () => unsubscribe();
    }, [setSession, updateThemeFromSeedColor, resetTheme, showNotification]);

    const session = React.useMemo<Session | null>(() => {
        if (sessionLoading) {
            return { loading: true } as Session;
        }
        if (sessionData) {
            return { ...sessionData, loading: false };
        }
        return null;
    }, [sessionData, sessionLoading]);

    setCurrentAppTheme(customTheme); // Store theme for dev utils

    return (
        <ReactRouterAppProvider
            navigation={navigation}
            branding={BRANDING}
            session={session}
            authentication={authentication}
            theme={customTheme}
        >
            <CssBaseline />
            <Outlet />
            <SnackbarContainer />
            <BackgroundJobNotifications />
            <CalendarDeadlineNotifications />
        </ReactRouterAppProvider>
    );
}

export default function App() {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <CustomThemeProvider>
                <SnackbarProvider>
                    <AppContent />
                </SnackbarProvider>
            </CustomThemeProvider>
        </LocalizationProvider>
    );
}
