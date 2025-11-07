/**
 * Wipe users endpoint
 * Deletes every Firebase Auth user and associated Firestore user documents.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils.js';
import { authenticate } from '../auth.js';
import { auth, firestore } from '../firebase.js';
import { getError } from '../../utils/errorUtils.js';

const USERS_COLLECTION = 'users';
const FIRESTORE_BATCH_LIMIT = 500;
const AUTH_BATCH_LIMIT = 1000;

interface FirestoreWipeResult {
    deleted: number;
    batches: number;
}

interface AuthWipeResult {
    success: number;
    failed: number;
    errors: { uid: string; message: string }[];
}

/**
 * Delete every document from the Firestore users collection in batches.
 * @param batchSize - Maximum documents to delete per batch commit
 */
async function wipeFirestoreUsers(batchSize: number = FIRESTORE_BATCH_LIMIT): Promise<FirestoreWipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        const snapshot = await firestore.collection(USERS_COLLECTION).limit(batchSize).get();
        if (snapshot.empty) {
            break;
        }

        const batch = firestore.batch();
        snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();

        deleted += snapshot.size;
        batches += 1;
    }

    return { deleted, batches };
}

/**
 * Delete all Firebase Auth users by iterating through paginated results.
 * @param batchSize - Maximum users to request per listUsers call
 */
async function wipeAuthUsers(batchSize: number = AUTH_BATCH_LIMIT): Promise<AuthWipeResult> {
    let success = 0;
    let failed = 0;
    const errors: { uid: string; message: string }[] = [];
    let nextPageToken: string | undefined;

    do {
        const { users, pageToken } = await auth.listUsers(batchSize, nextPageToken);
        nextPageToken = pageToken;

        if (users.length === 0) {
            continue;
        }

        const uids = users.map(userRecord => userRecord.uid);
        const deleteResult = await auth.deleteUsers(uids);
        success += deleteResult.successCount;
        failed += deleteResult.failureCount;

        deleteResult.errors.forEach(errorEntry => {
            const message = errorEntry.error?.message ?? 'Unknown error';
            const uid = uids[errorEntry.index] ?? 'unknown';
            errors.push({ uid, message });
        });
    } while (nextPageToken);

    return { success, failed, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleCors(req, res)) return;

    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    const authContext = await authenticate(req);
    if (!authContext) {
        return errorResponse(res, 'Unauthorized: Provide either Bearer token or X-API-Secret', 401);
    }

    try {
        const firestoreResult = await wipeFirestoreUsers();
        const authResult = await wipeAuthUsers();

        return successResponse(res, {
            firestoreDeleted: firestoreResult.deleted,
            firestoreBatches: firestoreResult.batches,
            authDeleted: authResult.success,
            authFailed: authResult.failed,
            authErrors: authResult.errors,
        }, 'All users wiped successfully');
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to wipe users');
        console.error('User wipe failed:', error);
        return errorResponse(res, message, 500);
    }
}
