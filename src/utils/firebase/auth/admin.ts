import { firebaseAuth } from '../firebaseConfig';
import { getError } from '../../../../utils/errorUtils';

/**
 * Resolve the base URL for admin API calls, ensuring the default host includes the `/api` path.
 */
const resolveAdminApiBaseUrl = (): string => {
    const envUrl = import.meta.env.VITE_ADMIN_API_URL?.trim();
    if (envUrl && envUrl.length > 0) {
        return envUrl.replace(/\/+$/, '');
    }

    const runtimeOrigin = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3001';

    return `${runtimeOrigin.replace(/\/+$/, '')}/api`;
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
        const apiUrl = resolveAdminApiBaseUrl();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
            // Use Firebase ID token for authentication if user is signed in
            const idToken = await currentUser.getIdToken();
            headers.Authorization = `Bearer ${idToken}`;
        } else {
            // Fall back to API secret for dev-helper or server-to-server calls
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET;
            if (!apiSecret) {
                return { success: false, message: 'Not authenticated and no API secret configured' };
            }
            headers['X-API-Secret'] = apiSecret;
        }

        // Call the admin API server
        const response = await fetch(`${apiUrl}/user/delete`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to delete user account. Ensure you have admin privileges.');
        return { success: false, message };
    }
}

/**
 * Bulk delete user accounts using the admin API server.
 *
 * This can only be successfully executed by authenticated administrators.
 * The API validates admin privileges before deleting the specified users.
 *
 * @param payloads - Array of identifiers for accounts to remove
 * @returns Result indicating success or failure along with an optional message
 */
export async function adminBulkDeleteUserAccounts(payloads: AdminDeleteUserPayload[]): Promise<AdminDeleteUserResponse> {
    if (!payloads || payloads.length === 0) {
        return { success: false, message: 'Provide at least one user to delete.' };
    }

    try {
        const apiUrl = resolveAdminApiBaseUrl();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
            const idToken = await currentUser.getIdToken();
            headers.Authorization = `Bearer ${idToken}`;
        } else {
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET;
            if (!apiSecret) {
                return { success: false, message: 'Not authenticated and no API secret configured' };
            }
            headers['X-API-Secret'] = apiSecret;
        }

        // Call the admin API server
        const response = await fetch(`${apiUrl}/user/bulk-delete`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ users: payloads }),
        });

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to bulk delete user accounts. Ensure you have admin privileges.');
        return { success: false, message };
    }
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
 * @param role - Optional role to set as a custom claim (e.g., 'admin', 'student', 'adviser')
 * @returns Result indicating success or failure along with an optional message and uid
 */
export async function adminCreateUserAccount(email: string, password: string, role?: string): Promise<AdminCreateUserResponse> {
    if (!email || !password) {
        return { success: false, message: 'Email and password are required.' };
    }

    try {
        const apiUrl = resolveAdminApiBaseUrl();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
            // Use Firebase ID token for authentication if user is signed in
            const idToken = await currentUser.getIdToken();
            headers.Authorization = `Bearer ${idToken}`;
        } else {
            // Fall back to API secret for dev-helper or server-to-server calls
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET;
            if (!apiSecret) {
                return { success: false, message: 'Not authenticated and no API secret configured' };
            }
            headers['X-API-Secret'] = apiSecret;
        }

        // Call the admin API server
        const response = await fetch(`${apiUrl}/user/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password, role }),
        });

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to create user account. Ensure you have admin privileges.');
        return { success: false, message };
    }
}

/**
 * Payload for updating a user account
 */
interface AdminUpdateUserPayload {
    uid: string;
    email?: string;
    password?: string;
    role?: string;
}

/**
 * Response payload structure for the admin update user function.
 */
interface AdminUpdateUserResponse {
    success: boolean;
    uid?: string;
    email?: string;
    emailUpdated?: boolean;
    passwordUpdated?: boolean;
    roleUpdated?: boolean;
    message?: string;
}

/**
 * Update an existing Firebase Auth user using the admin API server.
 * Can update email, password, and/or role (custom claim).
 *
 * This can only be successfully executed by authenticated administrators.
 * The API validates admin privileges before updating the specified user.
 *
 * @param payload - Update payload containing uid and optional email, password, and/or role
 * @returns Result indicating success or failure along with update details
 */
export async function adminUpdateUserAccount(payload: AdminUpdateUserPayload): Promise<AdminUpdateUserResponse> {
    if (!payload.uid) {
        return { success: false, message: 'User UID is required.' };
    }

    // At least one field must be provided for update
    if (!payload.email && !payload.password && payload.role === undefined) {
        return { success: false, message: 'At least one field (email, password, or role) must be provided for update.' };
    }

    try {
        const apiUrl = resolveAdminApiBaseUrl();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
            // Use Firebase ID token for authentication if user is signed in
            const idToken = await currentUser.getIdToken();
            headers.Authorization = `Bearer ${idToken}`;
        } else {
            // Fall back to API secret for dev-helper or server-to-server calls
            const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET;
            if (!apiSecret) {
                return { success: false, message: 'Not authenticated and no API secret configured' };
            }
            headers['X-API-Secret'] = apiSecret;
        }

        // Call the admin API server
        const response = await fetch(`${apiUrl}/user/update`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        const { message } = getError(error, 'Failed to update user account. Ensure you have admin privileges.');
        return { success: false, message };
    }
}
