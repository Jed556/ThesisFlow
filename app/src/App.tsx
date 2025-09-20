import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from 'react-router';
import type { User } from 'firebase/auth';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import type { Authentication, Navigation } from '@toolpad/core/AppProvider';
import { firebaseSignOut, signInWithGoogle, onAuthStateChanged } from './firebase/auth';
import SessionContext, { type Session } from './SessionContext';
import { buildNavigation } from './utils/navBuilder';
import { getUserRole } from './utils/roleUtils';
import { navigationGroups } from './config/groups';
import { setCurrentAppTheme } from './utils/devUtils';
import appTheme from './theme';

const BRANDING = {
    title: 'ThesisFlow',
};

const AUTHENTICATION: Authentication = {
    signIn: signInWithGoogle,
    signOut: firebaseSignOut,
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
        const unsubscribe = onAuthStateChanged((user: User | null) => {
            if (user) {
                const email = user.email || '';
                const userRole = getUserRole(email);

                setSession({
                    user: {
                        name: user.displayName || '',
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
    );
}
