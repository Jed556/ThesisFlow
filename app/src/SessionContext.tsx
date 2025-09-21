import * as React from 'react';

/**
 * Session user information
 */
export interface Session {
    user: {
        name?: string;
        email?: string;
        image?: string;
        role?: string;
    };
}

/**
 * Context type for session management
 */
interface SessionContextType {
    session: Session | null;
    setSession: (session: Session) => void;
    loading: boolean;
}

/**
 * Base application context for session management 
 */
const SessionContext = React.createContext<SessionContextType>({
    session: null,
    setSession: () => { },
    loading: true,
});

export default SessionContext;

export const useSession = () => React.useContext(SessionContext);
