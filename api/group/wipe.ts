/**
 * Wipe groups endpoint
 * Deletes every document from the Firestore groups collection.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils.js';
import { authenticate } from '../auth.js';
import { firestore } from '../firebase.js';
import { getError } from '../../utils/errorUtils.js';

const GROUPS_COLLECTION = 'groups';
const FIRESTORE_BATCH_LIMIT = 500;

interface WipeResult {
    deleted: number;
    batches: number;
}

/**
 * Delete every document from the Firestore groups collection in batches.
 * @param batchSize - Maximum documents to delete per batch commit
 */
async function wipeGroups(batchSize: number = FIRESTORE_BATCH_LIMIT): Promise<WipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        const snapshot = await firestore.collection(GROUPS_COLLECTION).limit(batchSize).get();
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
        const result = await wipeGroups();

        return successResponse(res, {
            deleted: result.deleted,
            batches: result.batches,
        }, 'All groups wiped successfully');
    } catch (error: unknown) {
        const { message } = getError(error, 'Unable to wipe groups');
        console.error('Group wipe failed:', error);
        return errorResponse(res, message, 500);
    }
}
