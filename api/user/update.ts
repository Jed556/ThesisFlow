/**
 * Update user endpoint
 * Updates a Firebase user's email, password, and/or custom claims (role)
 * Also supports updating Firestore profile fields like lastActive
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../../utils/utils.js';
import { getError } from '../../utils/errorUtils.js';
import { authenticate } from '../../utils/auth.js';
import { auth, firestore } from '../../utils/firebase.js';
import { decryptPassword } from '../../utils/cryptoUtils.js';

// Shared secret for password encryption (must match client-side)
const CRYPTO_SECRET = process.env.VITE_ADMIN_API_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow PUT/PATCH/POST
    if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    // Authenticate
    const authContext = await authenticate(req);
    if (!authContext) {
        return errorResponse(res, 'Unauthorized: Provide either Bearer token or X-API-Secret', 401);
    }

    const { uid, email, password, role, lastActive } = req.body;

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
            // Decrypt the encrypted password if CRYPTO_SECRET is configured
            let decryptedPassword = password;
            if (CRYPTO_SECRET) {
                try {
                    decryptedPassword = decryptPassword(password, CRYPTO_SECRET);
                } catch {
                    // Password might not be encrypted, use as-is
                    console.warn('Password decryption failed, using raw password');
                }
            }
            updateData.password = decryptedPassword;
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

        // Update Firestore profile fields if needed (lastActive)
        let firestoreUpdated = false;
        if (lastActive !== undefined) {
            try {
                // Find user document in Firestore using collectionGroup query
                const usersGroup = firestore.collectionGroup('users');
                const query = usersGroup.where('uid', '==', uid);
                const snapshot = await query.get();

                if (!snapshot.empty) {
                    const docRef = snapshot.docs[0].ref;
                    // Convert ISO string to Firestore timestamp
                    const lastActiveDate = typeof lastActive === 'string' 
                        ? new Date(lastActive) 
                        : lastActive;
                    await docRef.update({ lastActive: lastActiveDate });
                    firestoreUpdated = true;
                    console.log(`Updated Firestore profile for UID: ${uid}, lastActive: ${lastActive}`);
                }
            } catch (firestoreError) {
                console.warn('Failed to update Firestore profile:', firestoreError);
                // Don't fail the request if Firestore update fails
            }
        }

        return successResponse(
            res,
            {
                uid: userRecord.uid,
                email: userRecord.email,
                emailUpdated: updateData.email !== undefined,
                passwordUpdated: updateData.password !== undefined,
                roleUpdated: role !== undefined,
                firestoreUpdated,
            },
            'User updated successfully'
        );
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to update user');
        console.error(`Failed to update user: ${uid}`, error);
        return errorResponse(res, message, 500);
    }
}
