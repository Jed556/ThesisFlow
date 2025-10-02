/**
 * Admin user management routes
 * Migrated from Firebase Functions
 */
import { Router, Response } from 'express';
import { auth } from '../firebase';
import { verifyFirebaseToken, requireAdmin, AuthRequest } from '../middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyFirebaseToken);
router.use(requireAdmin);

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
        return res.status(500).json({
            success: false,
            message: error?.message ?? 'Unable to delete user',
        });
    }
});

export default router;
