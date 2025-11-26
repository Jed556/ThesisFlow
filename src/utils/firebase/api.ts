import { firebaseAuth } from './firebaseConfig';

/**
 * Resolve the base URL for admin API calls, ensuring the default host includes the `/api` path.
 */
export const resolveAdminApiBaseUrl = (): string => {
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
 * Build the headers for admin API requests, preferring the Firebase ID token and
 * falling back to the configured API secret when running without an authenticated user.
 *
 * @returns Headers ready for use with admin API requests.
 * @throws Error when no authenticated user is present and no API secret is configured.
 */
export const buildAdminApiHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
        const idToken = await currentUser.getIdToken();
        headers.Authorization = `Bearer ${idToken}`;
        return headers;
    }

    const apiSecret = import.meta.env.VITE_ADMIN_API_SECRET;
    if (!apiSecret) {
        throw new Error('Not authenticated and no API secret configured');
    }

    headers['X-API-Secret'] = apiSecret;
    return headers;
};
