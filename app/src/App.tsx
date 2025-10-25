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

import type { Navigation } from '@toolpad/core/AppProvider';
import type { Session, ExtendedAuthentication } from './types/session';
import type { User } from 'firebase/auth';

import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
const BRANDING = {
    title: 'ThesisFlow',
};

export default function App() {
    const [sessionData, setSessionData] = React.useState<Session | null>(null);
    const [sessionLoading, setSessionLoading] = React.useState(true);
    const [navigation, setNavigation] = React.useState<Navigation>([]);
    const setSession = React.useCallback((nextSession: Session | null) => {
        setSessionData(nextSession);
        setSessionLoading(nextSession?.loading ?? false);
    }, []);
    const authentication = React.useMemo<ExtendedAuthentication>(
        () => ({
            signIn: signInWithGoogle,
            signOut: authSignOut,
            setSession,
        }),
        [setSession],
    );

    React.useEffect(() => {
        async function initializeNavigation() {
            try {
                const userRole = sessionData?.user?.role as any;
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
                } catch (err) {
                    console.warn('Failed to fetch user profile for role:', err);
                }

                setSession({
                    user: {
                        email: email,
                        image: user.photoURL || '',
                        role: userRole,
                    },
                });
            } else {
                setSession(null);
            }
        });

        return () => unsubscribe();
    }, [setSession]);

    const session = React.useMemo<Session | null>(() => {
        if (sessionLoading) {
            return { loading: true } as Session;
        }
        if (sessionData) {
            return { ...sessionData, loading: false };
        }
        return null;
    }, [sessionData, sessionLoading]);

    setCurrentAppTheme(theme); // Store theme for dev utils

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <ReactRouterAppProvider
                navigation={navigation}
                branding={BRANDING}
                session={session}
                authentication={authentication}
                theme={theme}
            >
                <SnackbarProvider>
                    <CssBaseline />
                    <Outlet />
                    <SnackbarContainer />
                </SnackbarProvider>
            </ReactRouterAppProvider>
        </LocalizationProvider>
    );
}
