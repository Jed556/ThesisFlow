/**
 * User existence check endpoint
 * Returns whether any users exist in the system
 * This endpoint is public and doesn't require authentication
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, successResponse, errorResponse } from '../../utils/utils.js';
import { firestore } from '../../utils/firebase.js';

/**
 * Check if any users exist in the Firestore database
 * Searches across all year/department/course paths for user documents
 */
async function checkUsersExist(): Promise<boolean> {
    try {
        // Use collection group query to check for any user document
        const usersSnapshot = await firestore
            .collectionGroup('users')
            .limit(1)
            .get();

        return !usersSnapshot.empty;
    } catch (error) {
        console.error('Error checking users existence:', error);
        throw error;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow GET
    if (req.method !== 'GET') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    try {
        const usersExist = await checkUsersExist();

        return successResponse(res, {
            exists: usersExist,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error in user/exists endpoint:', error);
        return errorResponse(
            res,
            error instanceof Error ? error.message : 'Failed to check users',
            500
        );
    }
}
