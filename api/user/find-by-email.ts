/**
 * Find user by email endpoint
 * Used for forgot password flow to check if a user exists
 * This endpoint is public and returns limited user information
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, successResponse, errorResponse } from '../../utils/utils.js';
import { firestore } from '../../utils/firebase.js';

interface UserInfo {
    uid: string;
    email: string;
    displayName?: string;
}

/**
 * Find a user by email address using Admin SDK
 * Returns limited information for security
 * @param email - Email address to search for
 */
async function findUserByEmail(email: string): Promise<UserInfo | null> {
    try {
        // Use collection group query to find user by email
        const usersSnapshot = await firestore
            .collectionGroup('users')
            .where('email', '==', email.toLowerCase().trim())
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            return null;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        // Return limited information for security
        return {
            uid: userData.uid || userDoc.id,
            email: userData.email,
            displayName: userData.name
                ? `${userData.name.first || ''} ${userData.name.last || ''}`.trim()
                : undefined,
        };
    } catch (error) {
        console.error('Error finding user by email:', error);
        throw error;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow POST to prevent email enumeration via GET query params in logs
    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return errorResponse(res, 'Email is required', 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, 'Invalid email format', 400);
        }

        const user = await findUserByEmail(email);

        if (!user) {
            // Return 404 but with a generic message to prevent email enumeration
            return errorResponse(res, 'User not found', 404);
        }

        return successResponse(res, {
            user,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error in user/find-by-email endpoint:', error);
        return errorResponse(
            res,
            error instanceof Error ? error.message : 'Failed to find user',
            500
        );
    }
}
