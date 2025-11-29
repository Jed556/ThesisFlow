/**
 * User existence check endpoint
 * Returns whether any admin users exist in the system (excluding developer accounts)
 * This endpoint is public and doesn't require authentication
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, successResponse, errorResponse } from '../../utils/utils.js';
import { firestore } from '../../utils/firebase.js';

/**
 * Check if any admin users exist in the Firestore database (excluding developers)
 * Searches across all year/department/course paths for admin user documents
 */
async function checkAdminUsersExist(): Promise<boolean> {
    try {
        // Use collection group query to check for any admin user (not developer)
        const adminsSnapshot = await firestore
            .collectionGroup('users')
            .where('role', '==', 'admin')
            .limit(1)
            .get();

        return !adminsSnapshot.empty;
    } catch (error) {
        console.error('Error checking admin users existence:', error);
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
        const adminExists = await checkAdminUsersExist();

        return successResponse(res, {
            adminExists,
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
