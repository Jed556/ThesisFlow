import type { Session as ToolpadSession, Authentication } from '@toolpad/core/AppProvider';
import type { UserRole } from './profile';

/**
 * Extended session user shape with ThesisFlow specific metadata.
 */
export interface ThesisFlowSessionUser extends NonNullable<ToolpadSession['user']> {
    uid: string;
    role: UserRole;
    /** User's department or affiliation */
    department?: string;
    /** User's degree program or course */
    course?: string;
    /** Array of group IDs the user belongs to */
    groups?: string[];
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
