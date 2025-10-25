import type { Session as ToolpadSession, Authentication } from '@toolpad/core/AppProvider';

/**
 * Extended session user shape with ThesisFlow specific metadata.
 */
export interface ThesisFlowSessionUser extends NonNullable<ToolpadSession['user']> {
    role?: string;
}

/**
 * ThesisFlow session extends the base Toolpad session with additional user metadata.
 */
export interface Session extends ToolpadSession {
    user?: ThesisFlowSessionUser;
    loading?: boolean;
}

/**
 * Extended authentication contract exposing a session setter for internal flows.
 */
export interface ExtendedAuthentication extends Authentication {
    setSession?: (session: Session | null) => void;
}
