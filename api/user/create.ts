/**
 * Create user endpoint
 * Creates a new Firebase user with email and password
 * Supports encrypted password transmission for security
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../../utils/utils.js';
import { getError } from '../../utils/errorUtils.js';
import { authenticate } from '../../utils/auth.js';
import { auth } from '../../utils/firebase.js';
import { decryptPassword } from '../../utils/cryptoUtils.js';

// Shared secret for password encryption (must match client-side)
const CRYPTO_SECRET = process.env.VITE_ADMIN_API_SECRET || '';

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

    const { email, password, role, uid: customUid } = req.body ?? {};

    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    let normalizedPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !normalizedPassword) {
        return errorResponse(res, 'Email and password are required', 400);
    }

    // Decrypt the encrypted password
    if (!CRYPTO_SECRET) {
        console.error('CRYPTO_SECRET not configured');
        return errorResponse(res, 'Server configuration error', 500);
    }

    try {
        normalizedPassword = decryptPassword(normalizedPassword, CRYPTO_SECRET);
    } catch (decryptError) {
        console.error('Failed to decrypt password:', decryptError);
        return errorResponse(res, 'Password must be encrypted', 400);
    }

    const isValidEmailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValidEmailShape) {
        // Surface the payload shape to aid debugging without logging sensitive data like the password value
        console.error('Invalid email payload received during user creation', {
            receivedEmail: email,
            bodyKeys: typeof req.body === 'object' && req.body ? Object.keys(req.body) : [],
        });
        return errorResponse(res, 'Email must be a valid email address', 400);
    }

    try {
        // Check if user already exists by email
        try {
            const existingUser = await auth.getUserByEmail(normalizedEmail);
            return successResponse(res, { uid: existingUser.uid }, 'User already exists');
        } catch (notFoundError: unknown) {
            // User doesn't exist, proceed with creation unless different error
            const { code } = getError(notFoundError);
            if (code !== 'auth/user-not-found') {
                throw notFoundError;
            }
        }

        // If custom UID provided, check if it's already in use
        if (customUid) {
            try {
                await auth.getUser(customUid);
                return errorResponse(res, 'Custom UID already exists', 409);
            } catch (uidError: unknown) {
                const { code } = getError(uidError);
                if (code !== 'auth/user-not-found') {
                    throw uidError;
                }
                // UID doesn't exist, good to proceed
            }
        }

        // Create the user using Admin SDK with optional custom UID
        const userRecord = await auth.createUser({
            uid: customUid, // If undefined, Firebase will auto-generate
            email: normalizedEmail,
            password: normalizedPassword,
            emailVerified: false,
        });

        // Set custom claims if role is provided
        if (role) {
            await auth.setCustomUserClaims(userRecord.uid, { role });
            console.log(`Set custom claims for user: ${email} with role: ${role}`);
        }

        console.log(`Created user: ${normalizedEmail}`);
        return successResponse(
            res,
            { uid: userRecord.uid },
            'User created successfully'
        );
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to create user');
        console.error(`Failed to create user: ${normalizedEmail}`, error);
        return errorResponse(res, message, 500);
    }
}
