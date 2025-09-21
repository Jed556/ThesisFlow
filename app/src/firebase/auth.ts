import {
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    setPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { firebaseAuth } from './firebaseConfig';

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

/**
 * Sign in with Google functionality
 * Uses Firebase Authentication with Google as the provider.
 * Sets session persistence to browser session.
 * @returns An object indicating success status, user info, and error message if any.
 */
export const signInWithGoogle = async () => {
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
export const signInWithGithub = async () => {
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
export const firebaseSignOut = async () => {
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
 * Auth state observer
 * @param callback Callback function to handle user state changes
 * @returns Unsubscribe function to stop listening for auth state changes
 */
export const onAuthStateChanged = (callback: (user: any) => void) => {
    return firebaseAuth.onAuthStateChanged(callback);
};
