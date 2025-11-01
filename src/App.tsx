import * as React from 'react';
import { authSignOut, signInWithGoogle, onAuthStateChanged } from './utils/firebase/auth';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { getUserByEmail } from './utils/firebase/firestore';
import { setCurrentAppTheme } from './utils/devUtils';
import { buildNavigation } from './utils/navBuilder';
import { getUserRole } from './utils/roleUtils';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { navigationGroups } from './config/groups';
import { Outlet } from 'react-router';
import { SnackbarProvider, SnackbarContainer } from './components/Snackbar';
import { ThemeProvider as CustomThemeProvider, useTheme as useCustomTheme } from './contexts/ThemeContext';

import type { Navigation } from '@toolpad/core/AppProvider';
import type { Session, ExtendedAuthentication } from './types/session';
import type { User } from 'firebase/auth';

import CssBaseline from '@mui/material/CssBaseline';
const BRANDING = {
    title: 'ThesisFlow',
};

function AppContent() {
    const { theme: customTheme, updateThemeFromSeedColor, resetTheme } = useCustomTheme();
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
        async function initializeNavigation() {
            try {
                const userRole = sessionData?.user?.role;
                const nav = await buildNavigation(navigationGroups, userRole);
                setNavigation(nav);
            } catch (error) {
                console.error('Failed to build navigation:', error);
                setNavigation([]);
            }
        }

        initializeNavigation();
    }, [sessionData?.user?.role]);

    React.useEffect(() => {
        setSessionLoading(true);
        const unsubscribe = onAuthStateChanged(async (user: User | null) => {
            if (user) {
                setSession({ loading: true });
                const email = user.email || '';
                let userRole = getUserRole(email);
                try {
                    // prefer Firestore stored role when available
                    const profile = await getUserByEmail(email);
                    if (profile && profile.role) userRole = profile.role;

                    // Apply user's theme preference on login
                    if (profile?.preferences?.themeColor) {
                        updateThemeFromSeedColor(profile.preferences.themeColor);
                    } else {
                        // Reset to default if no theme preference
                        resetTheme();
                    }
                } catch (error) {
                    console.warn('Failed to fetch user profile for role:', error);
                    // Reset to default theme on error
                    resetTheme();
                }

                setSession({
                    user: {
                        email: email,
                        image: user.photoURL || '',
                        role: userRole,
                    },
                });
            } else {
                // Reset to default theme on logout
                resetTheme();
                setSession(null);
            }
        });

        return () => unsubscribe();
    }, [setSession, updateThemeFromSeedColor, resetTheme]);

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
