/**
 * Authentication utilities for Vercel serverless functions
 */
import type { VercelRequest } from '@vercel/node';
import { auth } from './firebase.js';

export interface AuthContext {
    user?: {
        uid: string;
        email?: string;
        role?: string;
    };
}

/**
 * Verify Firebase ID token from Authorization header
 */
export async function verifyFirebaseToken(req: VercelRequest): Promise<AuthContext | null> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return {
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                role: decodedToken.role || (decodedToken.admin ? 'admin' : undefined),
            },
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Verify admin API secret (for server-to-server calls)
 */
export function verifyApiSecret(req: VercelRequest): boolean {
    const apiSecret = req.headers['x-api-secret'] ?? req.headers['X-API-Secret'];
    const expectedSecret = process.env.ADMIN_API_SECRET;

    if (!expectedSecret) {
        console.error('ADMIN_API_SECRET not configured');
        return false;
    }

    return apiSecret === expectedSecret;
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(authContext: AuthContext | null): boolean {
    if (!authContext || !authContext.user) {
        return false;
    }

    return authContext.user.role === 'admin' || authContext.user.role === 'developer';
}

/**
 * Flexible authentication - accepts Firebase token OR API secret
 * Returns auth context if authenticated, null otherwise
 */
export async function authenticate(req: VercelRequest): Promise<AuthContext | null> {
    // Try Firebase token first
    const authContext = await verifyFirebaseToken(req);
    if (authContext && isAdmin(authContext)) {
        return authContext;
    }

    // Fall back to API secret
    if (verifyApiSecret(req)) {
        return { user: { uid: 'api-secret', role: 'admin' } };
    }

    return null;
}
