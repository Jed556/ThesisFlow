import {
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    setPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { firebaseAuth, firebaseFunctions } from './firebaseConfig';

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

/**
 * Sign in with Google functionality
 * Uses Firebase Authentication with Google as the provider.
 * Sets session persistence to browser session.
 * @returns An object indicating success status, user info, and error message if any.
 */
export async function signInWithGoogle() {
    try {
        return setPersistence(firebaseAuth, browserSessionPersistence).then(async () => {
            const result = await signInWithPopup(firebaseAuth, googleProvider);
            return {
                success: true,
                user: result.user,
                error: null,
            };
        });
    } catch (error: any) {
        return {
            success: false,
            user: null,
            error: error.message,
        };
    }
};

/**
 * Sign in with GitHub functionality
 * Uses Firebase Authentication with GitHub as the provider.
 * Sets session persistence to browser session.
 * @returns An object indicating success status, user info, and error message if any.
 */
export async function signInWithGithub() {
    try {
        return setPersistence(firebaseAuth, browserSessionPersistence).then(async () => {
            const result = await signInWithPopup(firebaseAuth, githubProvider);
            return {
                success: true,
                user: result.user,
                error: null,
            };
        });
    } catch (error: any) {
        return {
            success: false,
            user: null,
            error: error.message,
        };
    }
};

/**
 * Sign in with email and password functionality
 * Uses Firebase Authentication with email and password.
 * Sets session persistence to browser session.
 * @param email User's email address
 * @param password User's password
 * @returns An object indicating success status, user info, and error message if any.
 */
export async function signInWithCredentials(email: string, password: string) {
    try {
        return setPersistence(firebaseAuth, browserSessionPersistence).then(async () => {
            const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
            return {
                success: true,
                user: userCredential.user,
                error: null,
            };
        });
    } catch (error: any) {
        return {
            success: false,
            user: null,
            error: error.message || 'Failed to sign in with email/password',
        };
    }
}

/**
 * Sign out functionality with Firebase Authentication
 * @returns An object indicating success status and error message if any.
 */
export async function authSignOut() {
    try {
        await signOut(firebaseAuth);
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Delete the currently signed-in user
 * @returns An object indicating success status and error message if any.
 */
export async function authDelete() {
    try {
        const user = firebaseAuth.currentUser;
        if (user) {
            await user.delete();
            return { success: true };
        }
        return { success: false, error: 'No user is currently signed in.' };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Shape of the request payload for the admin delete callable function.
 */
interface AdminDeleteUserPayload {
    uid?: string;
    email?: string;
}

/**
 * Response payload structure for the admin delete callable function.
 */
interface AdminDeleteUserResponse {
    success: boolean;
    message?: string;
}

/**
 * Delete another user account using the admin API server.
 *
 * This can only be successfully executed by authenticated administrators.
 * The API validates admin privileges before deleting the specified user by UID or email.
 *
 * @param payload - Identifier for the account to remove. Either `uid` or `email` must be provided.
 * @returns Result indicating success or failure along with an optional message.
 */
export async function adminDeleteUserAccount(payload: AdminDeleteUserPayload): Promise<AdminDeleteUserResponse> {
    if (!payload?.uid && !payload?.email) {
        return { success: false, message: 'Provide at least a uid or email for deletion.' };
    }

    try {
        const currentUser = firebaseAuth.currentUser;
        if (!currentUser) {
            return { success: false, message: 'Not authenticated' };
        }

        // Get ID token for authentication
        const idToken = await currentUser.getIdToken();

        // Call the admin API server
        const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/admin/users/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        const message = error?.message ?? 'Failed to delete user account. Ensure you have admin privileges.';
        return { success: false, message };
    }
}



/**
 * Auth state observer
 * @param callback Callback function to handle user state changes
 * @returns Unsubscribe function to stop listening for auth state changes
 */
export const onAuthStateChanged = (callback: (user: any) => void) => {
    return firebaseAuth.onAuthStateChanged(callback);
};

/**
 * Create a new Firebase Auth user with email and password.
 * This creates the authentication account only (not the Firestore profile).
 * After calling this, you should sign out to avoid the created account becoming the active session.
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns An object indicating success status and error message if any
 */
export async function createAuthUser(email: string, password: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
        // Sign out immediately so the created account doesn't remain the active session
        await signOut(firebaseAuth);
        return { success: true };
    } catch (err: any) {
        // Common case: user already exists
        const code = err?.code || err?.message || String(err);
        if (code && String(code).includes('auth/email-already-in-use')) {
            return { success: true, skipped: true };
        }
        return { success: false, error: String(code) };
    }
}

/**
 * Shape of the request payload for the admin create user callable function.
 */
interface AdminCreateUserPayload {
    email: string;
    password: string;
}

/**
 * Response payload structure for the admin create user callable function.
 */
interface AdminCreateUserResponse {
    success: boolean;
    uid?: string;
    message?: string;
}

/**
 * Create a new Firebase Auth user using the admin API server.
 * This method does NOT affect the current user's session, making it safe for admins to create users.
 *
 * This can only be successfully executed by authenticated administrators.
 * The API validates admin privileges before creating the specified user.
 *
 * @param email - Email address for the new user
 * @param password - Password for the new user
 * @returns Result indicating success or failure along with an optional message and uid
 */
export async function adminCreateUserAccount(email: string, password: string): Promise<AdminCreateUserResponse> {
    if (!email || !password) {
        return { success: false, message: 'Email and password are required.' };
    }

    try {
        const currentUser = firebaseAuth.currentUser;
        if (!currentUser) {
            return { success: false, message: 'Not authenticated' };
        }

        // Get ID token for authentication
        const idToken = await currentUser.getIdToken();

        // Call the admin API server
        const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/admin/users/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ email, password }),
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        const message = error?.message ?? 'Failed to create user account. Ensure you have admin privileges.';
        return { success: false, message };
    }
}
