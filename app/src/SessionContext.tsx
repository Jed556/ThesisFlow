import * as React from 'react';
import type { SessionContext } from './types/session';

/**
 * Base application context for session management 
 */
const SessionContext = React.createContext<SessionContext>({
    session: null,
    setSession: () => { },
    loading: true,
});

export default SessionContext;

export const useSession = () => React.useContext(SessionContext);
