/**
 * Update user endpoint
 * Updates a Firebase user's email, password, and/or custom claims (role)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils.js';
import { getError } from '../../utils/errorUtils.js';
import { authenticate } from '../auth.js';
import { auth } from '../firebase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow PUT/PATCH
    if (req.method !== 'PUT' && req.method !== 'PATCH') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    // Authenticate
    const authContext = await authenticate(req);
    if (!authContext) {
        return errorResponse(res, 'Unauthorized: Provide either Bearer token or X-API-Secret', 401);
    }

    const { uid, email, password, role } = req.body;

    if (!uid) {
        return errorResponse(res, 'User UID is required', 400);
    }

    try {
        // Check if user exists
        let userRecord;
        try {
            userRecord = await auth.getUser(uid);
        } catch (notFoundError: unknown) {
            const { code } = getError(notFoundError);
            if (code === 'auth/user-not-found') {
                return errorResponse(res, 'User not found', 404);
            }
            throw notFoundError;
        }

        // Prepare update payload
        const updateData: {
            email?: string;
            password?: string;
        } = {};

        if (email && email !== userRecord.email) {
            updateData.email = email;
        }

        if (password) {
            updateData.password = password;
        }

        // Update user properties if any changes
        if (Object.keys(updateData).length > 0) {
            userRecord = await auth.updateUser(uid, updateData);
            console.log(`Updated user properties for UID: ${uid}`);
        }

        // Update custom claims (role) if provided
        if (role !== undefined) {
            // Get current custom claims
            const currentClaims = userRecord.customClaims || {};

            // Set the new role claim
            await auth.setCustomUserClaims(uid, {
                ...currentClaims,
                role,
            });
            console.log(`Updated custom claims for UID: ${uid} with role: ${role}`);
        }

        return successResponse(
            res,
            {
                uid: userRecord.uid,
                email: userRecord.email,
                emailUpdated: updateData.email !== undefined,
                passwordUpdated: updateData.password !== undefined,
                roleUpdated: role !== undefined,
            },
            'User updated successfully'
        );
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to update user');
        console.error(`Failed to update user: ${uid}`, error);
        return errorResponse(res, message, 500);
    }
}
