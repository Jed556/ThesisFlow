/**
 * Unified wipe endpoint for destructive maintenance operations.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils/utils.js';
import { authenticate } from '../utils/auth.js';
import { auth, firestore } from '../utils/firebase.js';
import { getError } from '../utils/errorUtils.js';

const FIRESTORE_BATCH_LIMIT = 500;
const AUTH_BATCH_LIMIT = 1000;
const VALID_CATEGORIES = [
    'calendar',
    'event',
    'file',
    'form',
    'group',
    'thesis',
    'user',
] as const;

type WipeCategory = typeof VALID_CATEGORIES[number];

interface FirestoreWipeResult {
    deleted: number;
    batches: number;
}

interface AuthWipeResult {
    success: number;
    failed: number;
    errors: { uid: string; message: string }[];
}

interface CategoryOutcome {
    data: Record<string, unknown>;
    message: string;
}

const FIRESTORE_WIPE_CONFIG: Record<Exclude<WipeCategory, 'user'>, { collection: string; successMessage: string }> = {
    calendar: {
        collection: 'calendars',
        successMessage: 'All calendars wiped successfully',
    },
    event: {
        collection: 'events',
        successMessage: 'All events wiped successfully',
    },
    file: {
        collection: 'files',
        successMessage: 'All files wiped successfully',
    },
    form: {
        collection: 'formTemplates',
        successMessage: 'All form templates wiped successfully',
    },
    group: {
        collection: 'groups',
        successMessage: 'All groups wiped successfully',
    },
    thesis: {
        collection: 'thesis',
        successMessage: 'All theses wiped successfully',
    },
};

const USER_SUCCESS_MESSAGE = 'All users wiped successfully';

/**
 * Type guard for validating wipe categories.
 */
function isWipeCategory(value: string): value is WipeCategory {
    return (VALID_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Delete every document from the provided Firestore collection using batched deletes.
 * @param collectionName Name of the collection to wipe.
 * @param batchSize Maximum number of documents to delete per batch commit.
 */
async function wipeFirestoreCollection(
    collectionName: string,
    batchSize: number = FIRESTORE_BATCH_LIMIT,
): Promise<FirestoreWipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        const snapshot = await firestore.collection(collectionName).limit(batchSize).get();
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
 * Delete every document from a collectionGroup (subcollections with the same name)
 * using batched deletes. Used for hierarchical data like users/groups/thesis.
 * @param subcollectionName Name of the subcollection to wipe across all paths.
 * @param batchSize Maximum number of documents to delete per batch commit.
 */
async function wipeFirestoreCollectionGroup(
    subcollectionName: string,
    batchSize: number = FIRESTORE_BATCH_LIMIT,
): Promise<FirestoreWipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        const snapshot = await firestore.collectionGroup(subcollectionName).limit(batchSize).get();
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
 * Delete every Firebase Auth user, aggregating successes and failures.
 * @param batchSize Maximum number of users to request per listUsers invocation.
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

/**
 * Execute the destructive wipe for the requested category.
 * @param category The category to wipe.
 */
async function handleCategoryWipe(category: WipeCategory): Promise<CategoryOutcome> {
    if (category === 'user') {
        // Use collectionGroup to wipe users across all hierarchical paths
        // Path: year/{year}/departments/{dept}/courses/{course}/users/{user}
        // Path: year/{year}/departments/{dept}/users/{user}
        // Path: year/{year}/users/{user}
        const firestoreResult = await wipeFirestoreCollectionGroup('users');
        const authResult = await wipeAuthUsers();

        return {
            data: {
                firestoreDeleted: firestoreResult.deleted,
                firestoreBatches: firestoreResult.batches,
                authDeleted: authResult.success,
                authFailed: authResult.failed,
                authErrors: authResult.errors,
            },
            message: USER_SUCCESS_MESSAGE,
        };
    }

    if (category === 'group') {
        // Use collectionGroup to wipe groups across all hierarchical paths
        const result = await wipeFirestoreCollectionGroup('groups');
        return {
            data: {
                deleted: result.deleted,
                batches: result.batches,
            },
            message: FIRESTORE_WIPE_CONFIG[category].successMessage,
        };
    }

    if (category === 'thesis') {
        // Use collectionGroup to wipe thesis across all hierarchical paths
        const result = await wipeFirestoreCollectionGroup('thesis');
        return {
            data: {
                deleted: result.deleted,
                batches: result.batches,
            },
            message: FIRESTORE_WIPE_CONFIG[category].successMessage,
        };
    }

    const { collection, successMessage } = FIRESTORE_WIPE_CONFIG[category];
    const result = await wipeFirestoreCollection(collection);

    return {
        data: {
            deleted: result.deleted,
            batches: result.batches,
        },
        message: successMessage,
    };
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

    let requestBody: unknown = req.body;
    if (typeof requestBody === 'string' && requestBody.length > 0) {
        try {
            requestBody = JSON.parse(requestBody);
        } catch {
            requestBody = undefined;
        }
    }

    const bodyCategory =
        requestBody && typeof requestBody === 'object'
            ? (requestBody as Record<string, unknown>).category
            : undefined;

    const queryCategoryRaw = req.query?.category;
    const queryCategory = Array.isArray(queryCategoryRaw) ? queryCategoryRaw[0] : queryCategoryRaw;

    const rawCategory =
        typeof bodyCategory === 'string'
            ? bodyCategory
            : typeof queryCategory === 'string'
                ? queryCategory
                : undefined;

    if (!rawCategory) {
        return errorResponse(res, 'Specify a wipe category via the "category" parameter', 400);
    }

    const normalizedCategory = rawCategory.trim().toLowerCase();
    if (!isWipeCategory(normalizedCategory)) {
        return errorResponse(
            res,
            `Unsupported wipe category "${rawCategory}". Valid categories: ${VALID_CATEGORIES.join(', ')}`,
            400,
        );
    }

    try {
        const { data, message } = await handleCategoryWipe(normalizedCategory);
        return successResponse(res, data, message);
    } catch (error: unknown) {
        const { message } = getError(error, `Unable to wipe ${normalizedCategory}`);
        console.error(`Wipe failed for category "${normalizedCategory}":`, error);
        return errorResponse(res, message, 500);
    }
}
