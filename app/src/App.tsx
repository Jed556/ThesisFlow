import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Outlet } from 'react-router';
import type { User } from 'firebase/auth';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import type { Authentication, Navigation } from '@toolpad/core/AppProvider';
import { firebaseSignOut, signInWithGoogle, onAuthStateChanged } from './firebase/auth';
import SessionContext, { type Session } from './SessionContext';
import { buildNavigation } from './utils/navBuilder';
import { getUserRole } from './utils/roleUtils';
import { navigationGroups } from './config/groups';
import theme from './theme';

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

  // Initialize navigation
  React.useEffect(() => {
    async function initializeNavigation() {
      try {
        // Get user role from session
        const userRole = session?.user?.role as any; // Type assertion for role
        const nav = await buildNavigation(navigationGroups, userRole);
        setNavigation(nav);
      } catch (error) {
        console.error('Failed to build navigation:', error);
        setNavigation([]);
      }
    }
    
    initializeNavigation();
  }, [session]); // Rebuild navigation when session changes

  React.useEffect(() => {
    // Returns an `unsubscribe` function to be called during teardown
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

  return (
    <ReactRouterAppProvider
      navigation={navigation}
      branding={BRANDING}
      session={session}
      authentication={AUTHENTICATION}
    >
      <SessionContext.Provider value={sessionContextValue}>
        <ThemeProvider theme={theme}>
          <Outlet />
        </ThemeProvider>
      </SessionContext.Provider>
    </ReactRouterAppProvider>
  );
}
