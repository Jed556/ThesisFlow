/**
 * Delete user endpoint
 * Deletes a Firebase user by UID or email
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../../libs/utils';
import { authenticate } from '../../libs/auth';
import { auth } from '../../libs/firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow DELETE
    if (req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    // Authenticate
    const authContext = await authenticate(req);
    if (!authContext) {
        return errorResponse(res, 'Unauthorized: Provide either Bearer token or X-API-Secret', 401);
    }

    const { uid, email } = req.body;

    if (!uid && !email) {
        return errorResponse(res, 'Provide a uid or email to delete a user', 400);
    }

    try {
        if (uid) {
            await auth.deleteUser(uid);
        } else if (email) {
            const userRecord = await auth.getUserByEmail(email);
            await auth.deleteUser(userRecord.uid);
        }

        console.log(`Deleted user: ${uid || email}`);
        return successResponse(res, {}, 'User deleted successfully');
    } catch (error: any) {
        console.error(`Failed to delete user: ${uid || email}`, error);
        return errorResponse(res, error?.message ?? 'Unable to delete user', 500);
    }
}
