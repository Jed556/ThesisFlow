/**
 * Create user endpoint
 * Creates a new Firebase user with email and password
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils.js';
import { getError } from '../../utils/errorUtils.js';
import { authenticate } from '../auth.js';
import { auth } from '../firebase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow POST
    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    // Authenticate
    const authContext = await authenticate(req);
    if (!authContext) {
        return errorResponse(res, 'Unauthorized: Provide either Bearer token or X-API-Secret', 401);
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400);
    }

    try {
        // Check if user already exists
        try {
            await auth.getUserByEmail(email);
            return successResponse(res, {}, 'User already exists');
        } catch (notFoundError: unknown) {
            // User doesn't exist, proceed with creation unless different error
            const { code } = getError(notFoundError);
            if (code !== 'auth/user-not-found') {
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
        return successResponse(
            res,
            { uid: userRecord.uid },
            'User created successfully'
        );
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to create user');
        console.error(`Failed to create user: ${email}`, error);
        return errorResponse(res, message, 500);
    }
}
