import {
    GoogleAuthProvider, GithubAuthProvider, signInWithPopup, setPersistence, browserSessionPersistence,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { firebaseAuth } from '../firebaseConfig';
import { getError } from '../../../../utils/errorUtils';

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
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to sign in with Google');
        return {
            success: false,
            user: null,
            error: message,
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
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to sign in with GitHub');
        return {
            success: false,
            user: null,
            error: message,
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
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to sign in with email/password');
        return {
            success: false,
            user: null,
            error: message,
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
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to sign out');
        return {
            success: false,
            error: message,
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
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to delete current user');
        return {
            success: false,
            error: message,
        };
    }
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
export async function createAuthUser(email: string, password: string):
    Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
        // Sign out immediately so the created account doesn't remain the active session
        await signOut(firebaseAuth);
        return { success: true };
    } catch (error: unknown) {
        const details = getError(error);
        const identifier = details.code ?? details.message;
        // Common case: user already exists
        if (identifier && String(identifier).includes('auth/email-already-in-use')) {
            return { success: true, skipped: true };
        }
        return {
            success: false,
            error: String(identifier ?? 'Failed to create auth user'),
        };
    }
}

/**
 * Auth state observer
 * @param callback Callback function to handle user state changes
 * @returns Unsubscribe function to stop listening for auth state changes
 */
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
    return firebaseAuth.onAuthStateChanged(callback);
};
