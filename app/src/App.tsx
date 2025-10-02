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
import SessionContext from './SessionContext';
import { Outlet } from 'react-router';

import type { Authentication, Navigation } from '@toolpad/core/AppProvider';
import type { Session } from './types/session';
import type { User } from 'firebase/auth';

import CssBaseline from '@mui/material/CssBaseline';
import appTheme from './theme';

const BRANDING = {
    title: 'ThesisFlow',
};

const AUTHENTICATION: Authentication = {
    signIn: signInWithGoogle,
    signOut: authSignOut,
};

export default function App() {
    const [session, setSession] = React.useState<Session | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [navigation, setNavigation] = React.useState<Navigation>([]);

    const sessionContextValue = React.useMemo(
        () => ({
            session,
            setSession,
            loading,
        }),
        [session, loading],
    );

    React.useEffect(() => {
        async function initializeNavigation() {
            try {
                const userRole = session?.user?.role as any;
                const nav = await buildNavigation(navigationGroups, userRole);
                setNavigation(nav);
            } catch (error) {
                console.error('Failed to build navigation:', error);
                setNavigation([]);
            }
        }

        initializeNavigation();
    }, [session]);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(async (user: User | null) => {
            if (user) {
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
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    setCurrentAppTheme(appTheme); // Store theme for dev utils

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <ReactRouterAppProvider
                navigation={navigation}
                branding={BRANDING}
                session={session}
                authentication={AUTHENTICATION}
                theme={appTheme}
            >
                <CssBaseline />
                <SessionContext.Provider value={sessionContextValue}>
                    <Outlet />
                </SessionContext.Provider>
            </ReactRouterAppProvider>
        </LocalizationProvider>
    );
}
