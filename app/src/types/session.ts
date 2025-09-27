import type { UserProfile } from './profile';

/**
 * Session interface used throughout the app. We keep it small (Partial of UserProfile)
 * because the session doesn't need the full UserProfile shape.
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
 * Context for session management
 */
export interface SessionContext {
    session: Session | null;
    setSession: (session: Session | null) => void;
    loading: boolean;
}
