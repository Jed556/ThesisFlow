/**
 * Authentication middleware for admin API endpoints
 * Validates Firebase ID tokens and admin API secrets
 */
import { Request, Response, NextFunction } from 'express';
import { auth } from './firebase';

export interface AuthRequest extends Request {
    user?: {
        uid: string;
        email?: string;
        role?: string;
    };
}

/**
 * Verify Firebase ID token from Authorization header
 */
export async function verifyFirebaseToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            role: decodedToken.role || decodedToken.admin ? 'admin' : undefined,
        };
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

/**
 * Check if user has admin privileges
 * Must be used after verifyFirebaseToken
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    // Check custom claims or role
    const isAdmin = req.user.role === 'admin' || req.user.role === 'developer';

    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
    }

    next();
}

/**
 * Verify admin API secret (for server-to-server calls)
 * Alternative to Firebase token auth
 */
export function verifyApiSecret(req: Request, res: Response, next: NextFunction) {
    const apiSecret = req.headers['x-api-secret'];
    const expectedSecret = process.env.ADMIN_API_SECRET;

    if (!expectedSecret) {
        console.error('ADMIN_API_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!apiSecret || apiSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API secret' });
    }

    next();
}
