/**
 * Admin user management routes
 * Migrated from Firebase Functions
 */
import { Router, Response } from 'express';
import { auth } from '../firebase';
import { verifyFirebaseToken, requireAdmin, verifyApiSecret, AuthRequest } from '../middleware';

const router = Router();

/**
 * Flexible authentication middleware
 * Accepts either Firebase ID token OR API secret
 */
async function flexibleAuth(req: AuthRequest, res: Response, next: any) {
    const authHeader = req.headers.authorization;
    const apiSecret = req.headers['x-api-secret'];

    try {
        // Try Firebase token first
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];

            try {
                const decodedToken = await auth.verifyIdToken(idToken);
                req.user = {
                    uid: decodedToken.uid,
                    email: decodedToken.email,
                    role: decodedToken.role || (decodedToken.admin ? 'admin' : undefined),
                };

                // Check admin privileges
                const isAdmin = req.user.role === 'admin' || req.user.role === 'developer';
                if (!isAdmin) {
                    return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
                }

                return next();
            } catch (tokenError) {
                console.error('Token verification failed:', tokenError);
                return res.status(401).json({ error: 'Unauthorized: Invalid token' });
            }
        }

        // Fall back to API secret
        if (apiSecret) {
            const expectedSecret = process.env.ADMIN_API_SECRET;

            if (!expectedSecret) {
                console.error('ADMIN_API_SECRET not configured');
                return res.status(500).json({ error: 'Server configuration error' });
            }

            if (apiSecret === expectedSecret) {
                return next();
            }

            return res.status(401).json({ error: 'Unauthorized: Invalid API secret' });
        }

        // No valid auth provided
        return res.status(401).json({ error: 'Unauthorized: Provide either Bearer token or x-api-secret' });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

// Apply flexible authentication to all routes
router.use(flexibleAuth);

/**
 * POST /api/admin/users/create
 * Create a new Firebase Auth user
 */
router.post('/users/create', async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required',
        });
    }

    try {
        // Check if user already exists
        try {
            await auth.getUserByEmail(email);
            return res.json({
                success: true,
                message: 'User already exists',
            });
        } catch (notFoundError: any) {
            // User doesn't exist, proceed with creation
            if (notFoundError.code !== 'auth/user-not-found') {
                throw notFoundError;
            }
        }

        // Create the user using Admin SDK
        const userRecord = await auth.createUser({
            email,
            password,
            emailVerified: false,
        });

        console.log(`Created user: ${email}`);
        return res.json({
            success: true,
            uid: userRecord.uid,
            message: 'User created successfully',
        });
    } catch (error: any) {
        console.error(`Failed to create user: ${email}`, error);
        console.error('Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack,
        });
        return res.status(500).json({
            success: false,
            message: error?.message ?? 'Unable to create user',
        });
    }
});

/**
 * POST /api/admin/users/delete
 * Delete a Firebase Auth user by UID or email
 */
router.post('/users/delete', async (req: AuthRequest, res: Response) => {
    const { uid, email } = req.body;

    if (!uid && !email) {
        return res.status(400).json({
            success: false,
            message: 'Provide a uid or email to delete a user',
        });
    }

    try {
        if (uid) {
            await auth.deleteUser(uid);
        } else if (email) {
            const userRecord = await auth.getUserByEmail(email);
            await auth.deleteUser(userRecord.uid);
        }

        console.log(`Deleted user: ${uid || email}`);
        return res.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error: any) {
        console.error(`Failed to delete user: ${uid || email}`, error);
        console.error('Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack,
        });
        return res.status(500).json({
            success: false,
            message: error?.message ?? 'Unable to delete user',
        });
    }
});

export default router;
